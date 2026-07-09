# Design — Server-trusted operator auth (retire the spoofable `x-operator-tier` header)

**Date:** 2026-07-09
**Severity:** CRITICAL (prod-reachable privilege escalation) · **Status:** design approved, pending spec review
**Fixes:** `.gstack/qa-reports/SECURITY-CRITICAL-operator-header-escalation-2026-07-09.md`
**Owner decisions (2026-07-09):** env allowlist keyed on Portal DID · scope = `operator/*` + `admin/*` + secondary-header cleanup · single PR.

---

## 1. Problem

Every `grid/src/api/operator/*` route derives the caller's operator tier from the **client-supplied** `x-operator-tier` header and the operator identity from `x-operator-id` (format-checked only, never verified). `policy.ts` marks all `operator.*` routes `'public'`, so the global auth hook passes them straight through. Any anonymous caller sending `x-operator-tier: 5` + a well-formed `x-operator-id: op:<uuid>` is treated as a Tier‑5 operator and can freeze/ban humans, delete/slash/fork Nous (brain exfiltration), read private minds, pause the clock, and rewrite governance laws. Verified on `https://api.noesiis.com`.

`admin/*` routes share the same header pattern but sit behind `GRID_ADMIN_ENABLED` (off on prod → 503, not currently exposed). `account-endowment` and `portal-manager` already use the server-trusted `operatorScope`, but keep the spoofable header as a *secondary* signal and never check operator membership — a smaller "any logged-in human = operator" gap behind their own feature flags.

## 2. Goal / success criteria

- No route under `grid/src/api/operator/` or `grid/src/api/admin/` reads `x-operator-tier` / `x-operator-id` from `req.headers` as an auth source. Enforced by a CI gate.
- Operator tier + identity are derived **server-side** from the authenticated Portal session DID, checked against an env allowlist.
- **Fail-closed:** with `GRID_OPERATOR_DIDS` unset/empty, every operator route returns 403 — deploying the fix closes prod even before configuration.
- The `operator.*` audit contract is **unchanged**: `operator_id` stays `op:<uuid-v4>` (preserves R‑31‑01 zero-diff audit invariant and every `appendOperator*` guard). The `op:<uuid>` is now sourced from the allowlist entry, not a header.
- Existing per-route min-tier gates (H2–H5) and their `tier_too_low` error ladder are preserved; only the *source* of the tier changes.
- Steward Console can still perform operator actions (via a server-held operator Portal credential), and all existing tests pass against the new gate.

Non-goals: multi-operator management UI, DB-backed operator table, rewriting the `op:<uuid>` audit identity into a DID (explicitly out of scope — would touch the frozen audit contract).

## 3. Architecture

### 3.1 Server-trusted operator identity (the allowlist)

Reuse the identity that already exists: `tryDid` resolves the `noesis_portal_token` cookie into `req.didContext.operatorDid` = the operator's Portal human existence-DID (`did:noesis:human:*`). The only missing piece is *is this DID an operator, and at what tier*.

**New env `GRID_OPERATOR_DIDS`.** Comma-separated entries; each entry pipe-separated `DID|op:UUID|tier`:

```
GRID_OPERATOR_DIDS=did:noesis:human:0x<henry>|op:11111111-1111-4111-8111-111111111111|5
```

- `DID` — operator's Portal existence-DID (must match `DID_RE`).
- `op:UUID` — server-trusted operator id written to audit (must match `OPERATOR_ID_RE`).
- `tier` — 1–5 (optional, default 5).

Pipe `|` is the intra-entry delimiter because DIDs and `op:` ids both contain `:` and `-`. Parsed **once at boot** into `Map<did, {operatorId, tier}>`. A malformed entry is logged and **skipped** (fail-safe — never grants access). Unset/empty ⇒ empty map ⇒ every operator route 403 (fail-closed).

### 3.2 New shared module `grid/src/api/preHandlers/operatorAuth.ts`

```ts
export interface OperatorGrant { operatorId: string; tier: number; }
export function parseOperatorAllowlist(raw: string | undefined): Map<string, OperatorGrant>;
export function resolveOperator(
  operatorDid: string | undefined,
  allowlist: Map<string, OperatorGrant>,
): OperatorGrant | null;
```

Single source of truth for "who is an operator + their tier", used by the operator hook branch, admin routes, and the secondary-header cleanup. The parsed map is built in `buildServerWithHub` from `process.env.GRID_OPERATOR_DIDS` and stored on `GridServices.operatorAllowlist` (injectable so tests pass a fixture map without touching env).

### 3.3 DIDContext extension

```ts
export interface DIDContext {
  readonly did: string;
  readonly tier: VisitorTier;
  readonly operatorDid?: string;
  readonly operatorTier?: number;  // NEW — server-trusted, set only by the operator gate
  readonly operatorId?: string;    // NEW — server-trusted op:<uuid> for audit payloads
}
```

### 3.4 The gate — new `operator_only` policy

Add `'operator_only'` to `ROUTE_DID_POLICY_VALUES`. Retag all 16 `operator/*` route entries in `policy.ts` from `'public'` → `'operator_only'` (including the fork, cognitive-snapshot, and relationship-inspect entries). New branch in the global `onRequest` hook (`server.ts`):

```ts
if (policy === 'operator_only') {
  const ctx = await requirePortalSession(req, reply, { didStore: services.didStore });
  if (!ctx) return;                              // 401 portal_session_required (was: 401 tier_missing)
  const grant = resolveOperator(ctx.operatorDid, services.operatorAllowlist ?? EMPTY);
  if (!grant) return reply.code(403).send({ error: 'not_operator' });
  req.didContext = { ...ctx, operatorTier: grant.tier, operatorId: grant.operatorId };
  return;
}
```

Authentication (are you a known operator?) is centralized here; authorization (do you hold the tier for *this* action?) stays per-route.

### 3.5 Per-route handler change (16 operator files)

Each handler drops the header-read block and reads the server-trusted values, keeping its existing min-tier gate and audit-literal tier:

```ts
// BEFORE: const tierHeader = req.headers['x-operator-tier']; ...401/400 ladder...
// AFTER:
const tier = req.didContext?.operatorTier ?? 0;
if (tier < 5) { reply.code(403); return { error: 'tier_too_low' }; }
const resolvedTier: 'H5' = 'H5';
const resolvedOperatorId = req.didContext?.operatorId!;  // server-trusted op:<uuid>
```

Remove now-unused `OPERATOR_ID_REGEX` imports. The `401 tier_missing` / `400 invalid_operator_id` cases disappear (the gate now returns `401 portal_session_required` / `403 not_operator` before the handler runs).

### 3.6 Admin routes

Keep `admin/*` policy `'public'` so the `GRID_ADMIN_ENABLED` 503-first kill-switch semantics are preserved. Rewrite the internal `tierGate()` in `config.ts`/`restart.ts`/`notifications.ts` to call `resolveOperator(req.didContext?.operatorDid, allowlist)` instead of reading headers (the `'public'` hook branch already populates `req.didContext` via `tryDid`). When admin is enabled, a non-allowlisted caller gets `403 not_operator`; an under-tier operator gets `403 tier_too_low`.

### 3.7 Secondary-header cleanup

`account-endowment` and `portal-manager` already gate on `operatorScope`. Replace their secondary `x-operator-tier >= 5` header signal with `resolveOperator(...)` membership + tier, closing the "any logged-in human" gap. Their feature flags (`GRID_ENDOWMENT_ENABLED`, portal-manager flag) are unchanged.

### 3.8 CI gate

`scripts/check-operator-header-auth.mjs` (modeled on `scripts/check-no-operator-sanction-path.mjs`): scan `grid/src/api/operator/**` + `grid/src/api/admin/**`; fail if any file reads `x-operator-tier` or `x-operator-id` from request headers. Wire into the same CI lint set as the sibling `check-*.mjs` gates.

### 3.9 Client — Steward Console proxy

`steward/src/app/api/operator/[...path]/route.ts` currently injects `x-operator-id` from `STEWARD_OPERATOR_ID` and forwards the browser's `x-operator-tier`. Rewrite it to attach a **server-held operator Portal credential** — a long-lived `noesis_portal_token` JWT (Grid-signed) for the operator DID, stored as a server-only env `STEWARD_OPERATOR_PORTAL_TOKEN` (same server-only trust posture as today's `STEWARD_OPERATOR_ID`). The proxy sends it as the `noesis_portal_token` cookie to the Grid; `tryDid` resolves the DID; the allowlist grants the tier. Drop the `x-operator-*` headers.

> **Execution-time verification:** confirm the Grid's portal JWT signing key can mint a token for the operator DID and that the proxy path resolves end-to-end against a running Grid before removing the header path. If a long-lived token is undesirable, fall back to forwarding the interactive operator's session cookie.

### 3.10 Documentation sync (mandatory, same PR)

- `wiki/1-design/decisions.md` — new `D-*`: operator auth = Portal-session + env allowlist; `x-operator-tier`/`x-operator-id` retired as an auth source everywhere.
- `wiki/1-design/civic-architecture.md` (operator framework D‑V3‑18 / D‑V3‑36) — note operator identity is server-trusted.
- `.planning/STATE.md` Accumulated Context + decisions log — record the fix and the fail-closed invariant.
- Update the SECURITY-CRITICAL report status → FIXED with the commit ref.

## 4. Testing strategy

- **New unit tests** for `operatorAuth.ts`: allowlist parsing (valid/malformed/empty/tier-default), `resolveOperator` hit/miss.
- **New gate tests**: anonymous → 401; logged-in non-operator → 403 `not_operator`; allowlisted under-tier → 403 `tier_too_low`; allowlisted at-tier → passes; **forged `x-operator-tier: 5` with no session → 403** (the regression proving the vuln is closed).
- **Migrate ~25 existing operator/admin test files**: a shared helper `operatorSession({ tier })` that (a) provides a fixture allowlist map to the server and (b) mints a `noesis_portal_token` cookie for the fixture operator DID. Tests swap `headers: { 'x-operator-tier', 'x-operator-id' }` → `cookies: { noesis_portal_token }`, and update `tier_missing` expectations to `portal_session_required` / `not_operator`.
- **CI gate self-test**: the gate fails on a fixture file containing the header read, passes on the cleaned tree.

## 5. Risks / edge cases

- **Test blast radius (~25 files).** Mitigated by the single `operatorSession()` helper; mechanical swaps.
- **Audit contract.** Untouched — `operator_id` stays `op:<uuid>` sourced server-side; every `appendOperator*` guard still holds.
- **Steward end-to-end.** The credential-forwarding path (§3.9) is the least-certain piece; verify against a live Grid during execution before deleting the header path.
- **Ordering for admin.** Anonymous callers to *enabled* admin now get `403 not_operator` instead of `401 tier_missing`; acceptable (both deny).
- **Deploy step.** Prod must set `GRID_OPERATOR_DIDS` with Henry's real Portal DID (from the existing `@henry` account) + an `op:<uuid>`. Until then, fail-closed = operator routes 403 (safe, but Steward actions blocked — set the env as part of deploy).
