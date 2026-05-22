---
phase: 25b-sanctions-and-spawn-wizard
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - grid/src/api/operator/ban-human.ts
  - grid/src/api/operator/clock-pause-resume.ts
  - grid/src/api/operator/delete-nous.ts
  - grid/src/api/operator/export-replay.ts
  - grid/src/api/operator/force-sleep.ts
  - grid/src/api/operator/freeze-wallet.ts
  - grid/src/api/operator/governance-laws.ts
  - grid/src/api/operator/index.ts
  - grid/src/api/operator/memory-query.ts
  - grid/src/api/operator/mute-broadcast.ts
  - grid/src/api/operator/quarantine.ts
  - grid/src/api/operator/slash-coin.ts
  - grid/src/api/operator/spawn-system-nous.ts
  - grid/src/api/operator/telos-force.ts
  - grid/src/api/portal/check-frozen.ts
  - grid/src/api/portal/index.ts
  - grid/src/api/server.ts
  - grid/src/audit/append-operator-forced-sleep.ts
  - grid/src/audit/append-operator-human-banned.ts
  - grid/src/audit/append-operator-human-frozen.ts
  - grid/src/audit/append-operator-muted.ts
  - grid/src/audit/append-operator-quarantined.ts
  - grid/src/audit/append-operator-slashed.ts
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/db/schema.ts
  - grid/src/integration/nous-runner.ts
  - grid/src/registry/registry.ts
  - grid/src/registry/types.ts
  - grid/test/audit/broadcast-allowlist.test.ts
  - grid/test/operator/ban-human.test.ts
  - grid/test/operator/clock-pause-resume.test.ts
  - grid/test/operator/delete-nous.test.ts
  - grid/test/operator/export-replay.test.ts
  - grid/test/operator/force-sleep.test.ts
  - grid/test/operator/freeze-wallet.test.ts
  - grid/test/operator/governance-laws.test.ts
  - grid/test/operator/memory-query.test.ts
  - grid/test/operator/mute-broadcast.test.ts
  - grid/test/operator/quarantine.test.ts
  - grid/test/operator/slash-coin.test.ts
  - grid/test/operator/spawn-system-nous.test.ts
  - grid/test/operator/telos-force.test.ts
  - grid/test/portal/check-frozen.test.ts
  - scripts/check-operator-sanctions-plaintext.mjs
  - steward/src/app/humans/[did]/page.tsx
  - steward/src/app/nous/[id]/page.tsx
  - steward/src/app/system/spawn/page.tsx
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 25b: Code Review Report

**Reviewed:** 2026-05-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 47
**Status:** issues_found

## Summary

Phase 25b introduces operator sanction routes (mute, slash, quarantine, force-sleep, ban-human, freeze-wallet), a system-Nous spawn wizard, and the portal frozen/banned enforcement preHandler. The audit emitter discipline (closed-tuple, sole-producer, reason-hash-only-in-audit) is consistently applied across all six new sanction emitters and their route handlers. The header-auth migration (D-25b-NEW-1) is uniformly implemented across all reviewed routes.

Two critical issues were found. First, the Steward Console sends H3/H4/H5 operator tier headers directly from the browser with a hardcoded fallback operator-id; there is no credential gate preventing any browser client from forging these headers. Second, the Force Telos form in the Nous detail page posts to the wrong URL and omits the required auth headers entirely, making it completely non-functional and unauthenticated.

Five warnings cover: a silent quarantine-flag no-op when the registry record is missing after a successful runner lookup (a state inconsistency), SHA-256 of an empty string being accepted as a valid reason hash, missing idempotency enforcement on ban/freeze (no 409 on double-apply), mute-flag not surviving Grid restarts (no persistence gap warning to operator UI), and the `extractEntries` dead-code function in the Nous detail page that is assigned but immediately voided.

---

## Critical Issues

### CR-01: Steward Console sends operator-tier/id headers directly from the browser — no credential gate

**File:** `steward/src/app/nous/[id]/page.tsx:376-379`, `steward/src/app/nous/[id]/page.tsx:405-408`, `steward/src/app/nous/[id]/page.tsx:433-436`, `steward/src/app/nous/[id]/page.tsx:464-467`, `steward/src/app/humans/[did]/page.tsx:194-198`, `steward/src/app/humans/[did]/page.tsx:224-228`, `steward/src/app/system/spawn/page.tsx:119-123`

**Issue:** All sanction actions (mute, force-sleep, quarantine, slash, ban, freeze, spawn) are submitted from a `'use client'` React component running in the browser. The `x-operator-tier` and `x-operator-id` headers are set directly in `fetch()` calls using `process.env.NEXT_PUBLIC_STEWARD_OPERATOR_ID` — a public env var that is embedded in the client bundle. Any browser user who can reach the Grid API endpoint (CORS is open to `localhost:3002`) can forge these headers. The header-auth model (D-25b-NEW-1) is explicitly designed for server-trusted headers, meaning this surface works correctly only if the Steward Console is a server-side proxy rather than a direct browser client.

The comment in the code acknowledges this: "The Steward Console runs as a trusted internal surface; in a future phase these headers will be injected by an auth proxy". However, as shipped, this is an authentication bypass: H5 sanctions (ban, freeze, spawn) can be issued by any client that can reach the Grid's operator API. The CORS config in `server.ts:255` lists `http://localhost:3002` explicitly, so the attack is limited to local environments. If the Grid is exposed on `0.0.0.0`, this becomes externally exploitable.

**Fix:** Either:
1. Move the operator fetch calls to a Next.js Server Action or API route (`/api/operator/*`) so the operator-id and tier are injected server-side from a server-only env var (`STEWARD_OPERATOR_ID`, not `NEXT_PUBLIC_*`), or
2. Add an explicit warning in the Steward Console UI that these actions require the Grid to be bound to 127.0.0.1 and document that deploying with `0.0.0.0` requires the auth-proxy layer before any Steward Console action forms are usable.

The quickest safe fix is renaming the env var from `NEXT_PUBLIC_STEWARD_OPERATOR_ID` to `STEWARD_OPERATOR_ID` and moving the fetch to a server action, so the value is never embedded in the client bundle.

---

### CR-02: Force Telos form posts to wrong URL and sends no auth headers

**File:** `steward/src/app/nous/[id]/page.tsx:488-493`

**Issue:** The `handleForceTelos` function posts to `/api/v1/operator/nous/${did}/telos` (line 488), but the actual endpoint registered in the Grid is `/api/v1/operator/nous/:did/telos/force` (see `telos-force.ts:59`). Additionally, the request sends no `x-operator-tier` or `x-operator-id` headers (line 490-492 only sets `Content-Type`). The body also sends `{ telos: telosText, reason: telosReason }` rather than the required `{ new_telos: <object> }` body shape expected by the route.

This means:
- The force-telos action always fails with 404 (wrong URL).
- Even if the URL were corrected, it would return 401 (missing tier header).
- Even if auth were corrected, it would return 400 (wrong body key: `telos` vs `new_telos`).

The form appears in the Nous detail page Danger Zone section and provides the operator no indication that it is broken.

**Fix:**
```typescript
// In handleForceTelos:
const res = await fetch(
    `${GRID_ORIGIN}/api/v1/operator/nous/${encodeURIComponent(did)}/telos/force`,  // correct URL
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-operator-tier': '4',  // H4 required
            'x-operator-id': process.env.NEXT_PUBLIC_STEWARD_OPERATOR_ID
                ?? 'op:00000000-0000-4000-8000-000000000001',
        },
        // new_telos must be an object; telosText (a plain string) must be parsed
        // or restructured per the telos YAML format the Brain expects.
        body: JSON.stringify({ new_telos: { goals: [telosText] } }),
    }
);
```

Note: the telos body shape must also be verified against what `TelosManager.from_yaml` on the Python Brain side accepts.

---

## Warnings

### WR-01: Quarantine applies silently when registry record is missing post-runner-lookup

**File:** `grid/src/api/operator/quarantine.ts:125-129`

**Issue:** After a successful runner lookup (step 4, line 99), the quarantine application at step 7 re-fetches `services.registry.get(targetDid)` and silently does nothing if the record is absent (line 127 checks `if (record)`). This creates a state inconsistency: the route returns `{ ok: true }` and emits `operator.quarantined` even though no `quarantineFlag` was set on any registry record. A Nous could have been tombstoned between the runner-lookup check and the registry-get at step 7 (though the tombstone check at step 3 reduces this window). The audit event would then be a false record of a sanction that had no effect.

**Fix:** Return 410 (gone) or re-check the tombstone at step 7, before emitting the audit event:
```typescript
// Step 7 — apply quarantine
if (services.registry) {
    const record = services.registry.get(targetDid);
    if (!record || record.status === 'deleted') {
        reply.code(410);
        return { error: 'gone' } satisfies ApiError;
    }
    (record as unknown as { quarantineFlag: boolean }).quarantineFlag = true;
}
```

The same pattern applies to `slash-coin.ts:137-141` — if the registry record is absent, the balance debit silently does nothing but `operator.slashed` is still emitted.

---

### WR-02: SHA-256 of empty string is accepted as a valid reason_hash

**File:** `grid/src/api/operator/mute-broadcast.ts:102-103`, `force-sleep.ts:107-108`, `quarantine.ts:106-107`, `slash-coin.ts:119-120`, `ban-human.ts:95-96`, `freeze-wallet.ts:99-100`

**Issue:** All sanction routes compute `reasonHash = createHash('sha256').update(reasonPlain).digest('hex')` where `reasonPlain` defaults to `''` when no `reason` field is in the request body. SHA-256 of an empty string is `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, a well-known value. This means an operator can submit any sanction without a reason — the audit record carries a hash that trivially identifies an empty reason. The route docstrings describe reason as plaintext stored for audit lookup, but no minimum-length enforcement exists server-side (only the Steward Console UI enforces `minLength={10}`). A direct API call bypasses this.

**Fix:** Add a minimum-length check on `reasonPlain` in the route handler, returning 400 if the reason is absent or fewer than N characters:
```typescript
const reasonPlain = typeof req.body?.reason === 'string' ? req.body.reason : '';
if (reasonPlain.length < 10) {
    reply.code(400);
    return { error: 'reason_required' } satisfies ApiError;
}
```

---

### WR-03: Ban and freeze are not idempotent — double-applying emits a second audit event with no effect

**File:** `grid/src/api/operator/ban-human.ts:112`, `grid/src/api/operator/freeze-wallet.ts:117`

**Issue:** `setBanned` and `setFrozen` are called unconditionally (no check whether the flag is already set). The route returns `{ ok: true }` and emits `operator.human_banned` / `operator.human_frozen` even if the human was already banned or frozen. This means repeated calls produce multiple audit events for a single state change, polluting the audit trail and confusing audit-trail consumers that count events. The error ladder lists no 409 for already-sanctioned, and the DB schema uses `TINYINT(1) DEFAULT 0` — setting it to 1 again is a no-op at the DB level, but the audit emission is not suppressed.

**Fix:** Either read the current flags before applying and short-circuit with a 200 + no audit emit (idempotent semantics), or add a 409 response code to the error ladder:
```typescript
// After existence check, before reason hash:
const flags = await services.humanSanctionStore.getFlags(targetDid);
if (flags && flags.banned === 1) {
    return { ok: true };  // idempotent — already banned, no duplicate event
}
```

---

### WR-04: Mute flag is not persisted and silently resets on Grid restart with no operator warning

**File:** `grid/src/integration/nous-runner.ts:149`, `grid/src/api/operator/mute-broadcast.ts:120`

**Issue:** `muteFlag` is an in-memory boolean on `NousRunner` (initialized to `false` at line 149). The route sets it at runtime via `(runner as unknown as { muteFlag: boolean }).muteFlag = true` but there is no persistence layer. On any Grid restart, all mute sanctions are silently lost. The `operator.muted` audit event records the action, but no recovery path reads the audit chain to re-apply mute flags on startup. This is noted in the route's docstring ("Not persisted across Grid restarts (sanction must be re-applied after restart)") but the Steward Console UI provides no indication of this limitation.

The same concern applies to `quarantineFlag` on registry records (also in-memory).

**Fix (UI-side):** Add a visible warning to the Sanctions panel in the Nous detail page:
```tsx
<p style={{ color: 'var(--muted)', fontSize: 12 }}>
    Note: Mute and quarantine sanctions are in-memory only and are cleared on Grid restart.
    Re-apply after any restart.
</p>
```

**Fix (server-side, longer term):** Add a `sanctions` table to the schema that is read on Grid startup to re-apply active mute/quarantine flags before Nous runners are registered.

---

### WR-05: Dead `extractEntries` function in Nous detail page

**File:** `steward/src/app/nous/[id]/page.tsx:305-312`

**Issue:** The `extractEntries` function is declared at line 305 and immediately voided at line 326 (`void extractEntries;`) to silence the TypeScript unused-variable warning. The actual parsing uses the `parseAudit` async function defined at line 316. The `extractEntries` function also contains a bug: it calls `result.value.json().then(...).catch(...)` and casts the resulting Promise to `AuditTrailEntry[]` with `as unknown as AuditTrailEntry[]`, which will always be a Promise object, not an array. This is dead code but demonstrates a logic error pattern: `extractEntries` would return a Promise (never the resolved value) if called.

**Fix:** Delete `extractEntries` entirely. The `parseAudit` function (lines 316-324) handles all the same cases correctly.

---

## Info

### IN-01: CORS policy in server.ts allows `localhost:3002` in a constant list — no env-based override

**File:** `grid/src/api/server.ts:254-258`

**Issue:** The CORS origin list is hardcoded to `['http://localhost:3001', 'http://localhost:3000', 'http://localhost:3002']`. If the Steward Console or Dashboard run on a different port in CI or staging, this list must be changed in source. A `GRID_CORS_ORIGINS` env var would allow per-environment configuration without source changes.

**Fix:** Read allowed origins from an environment variable:
```typescript
const corsOrigins = process.env.GRID_CORS_ORIGINS
    ? process.env.GRID_CORS_ORIGINS.split(',')
    : ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:3002'];
```

---

### IN-02: `spawn-system-nous.ts` leaves `resolvedOperatorId` commented out and unused

**File:** `grid/src/api/operator/spawn-system-nous.ts:117-119`

**Issue:** Lines 117-119 comment out `resolvedTier` and `resolvedOperatorId` with a forward-compat note. The `opIdHeader` variable is validated and assigned (`const opIdHeader = req.headers['x-operator-id']`) but then the operator-id is never stored in a usable variable. If a future phase adds an `operator.*` event for spawn, someone will need to re-derive the operator-id from the header rather than just un-commenting the dead variables.

**Fix:** Either keep the commented-out variables uncommented (TypeScript will complain if unused, which is the signal), or keep a no-assignment comment that clearly marks the insertion point:
```typescript
// resolvedOperatorId available for Phase N operator.* event: opIdHeader satisfies OPERATOR_ID_REGEX
```

---

### IN-03: HUMAN_DID_REGEX is defined twice with identical patterns in different files

**File:** `grid/src/api/operator/ban-human.ts:41`, `grid/src/api/operator/freeze-wallet.ts:45`

**Issue:** Both files define `const HUMAN_DID_REGEX = /^did:noesis:[a-z0-9_:\-]+$/i;` locally rather than importing a shared constant. The same regex also appears in the audit emitters (`append-operator-human-banned.ts:29`, `append-operator-human-frozen.ts:30`) as `DID_RE`. Four copies of the same pattern exist. If the DID format changes, all four must be updated in sync.

**Fix:** Extract to a shared module (e.g., `grid/src/api/types.ts` already exports `OPERATOR_ID_REGEX`) and import it:
```typescript
// In types.ts:
export const HUMAN_DID_REGEX = /^did:noesis:[a-z0-9_:\-]+$/i;
```

---

### IN-04: `nous-runner.ts` direct_message action appends payload with `text` key — FORBIDDEN_KEY_PATTERN catches `text`

**File:** `grid/src/integration/nous-runner.ts:293-299`

**Issue:** The `direct_message` case at line 293-299 appends to the audit chain with a payload that includes `text: action.text.slice(0, 100)`. The `FORBIDDEN_KEY_PATTERN` in `broadcast-allowlist.ts:433` explicitly includes `text` as a forbidden keyword. While `isAllowlisted('nous.direct_message')` returns true (the event is allowlisted), `payloadPrivacyCheck` would flag this payload if called on it. The `nous.direct_message` comment in `broadcast-allowlist.ts:83` says "metadata only — payload must not contain message body", which suggests the `text` key is intentionally pre-existing but the privacy invariant is already violated: the truncated message text crosses the wire to WebSocket clients.

This is a pre-existing issue (not introduced in phase 25b), but it is worth noting since the phase adds the `payloadPrivacyCheck` gate to the new sanction emitters.

**Fix:** Replace `text` with `text_hash` or remove it from the `direct_message` payload:
```typescript
this.audit.append('nous.direct_message', this.nousDid, {
    targetDid,
    channel: action.channel,
    // text removed — message body must not cross the wire
    tick,
});
```

---

_Reviewed: 2026-05-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
