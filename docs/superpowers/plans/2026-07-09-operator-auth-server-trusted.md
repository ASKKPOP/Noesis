# Server-trusted Operator Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the spoofable `x-operator-tier` / `x-operator-id` request headers as an auth source across `grid/src/api/operator/*` + `admin/*`, deriving operator tier + identity server-side from the authenticated Portal-session DID checked against an env allowlist (fail-closed).

**Architecture:** A new `operator_only` route policy routes every operator endpoint through the existing global `onRequest` hook, which runs `requirePortalSession` → `resolveOperator(did, allowlist)` and attaches server-trusted `operatorTier` + `operatorId` to `req.didContext`. Handlers keep their per-route min-tier gate but read the trusted values instead of headers. The `operator.*` audit contract is untouched — `operator_id` stays `op:<uuid>`, now sourced from the allowlist entry. Admin routes keep their `GRID_ADMIN_ENABLED` kill-switch and swap only the internal header read for `resolveOperator`.

**Tech Stack:** TypeScript, Fastify, `jose` (ES256 JWT), Vitest, Node ESM. CI gate is a plain `.mjs` script wired into the root `pretest`.

**Spec:** `docs/superpowers/specs/2026-07-09-operator-auth-server-trusted-design.md`

**Branch:** `security/operator-header-escalation` (already checked out; spec already committed).

---

## Reference: per-route min-tier catalogue (source of truth for the migration)

| File (`grid/src/api/operator/`) | Route(s) | Min tier | Audit tier literal |
|---|---|---|---|
| `ban-human.ts` | POST `/humans/:did/ban` | 5 | `'H5'` |
| `freeze-wallet.ts` | POST `/humans/:did/freeze` | 5 | `'H5'` |
| `delete-nous.ts` | POST `/nous/:did/delete` | 5 | `'H5'` |
| `export-replay.ts` | POST `/replay/export` | 5 | `'H5'` |
| `spawn-system-nous.ts` | POST `/spawn-system-nous` | 5 | (no audit id used) |
| `slash-coin.ts` | POST `/nous/:did/slash` | 4 | `'H4'` |
| `quarantine.ts` | POST `/nous/:did/quarantine` | 4 | `'H4'` |
| `telos-force.ts` | POST `/nous/:did/telos/force` | 4 | `'H4'` |
| `fork-nous.ts` | POST `/fork/:nousDid` | 4 | (tier+id in manifest) |
| `clock-pause-resume.ts` | POST `/clock/pause`, `/clock/resume` | 3 | `'H3'` (×2) |
| `governance-laws.ts` | POST/PUT/DELETE `/governance/laws[/:id]` | 3 | `'H3'` (×3) |
| `cognitive-snapshot.ts` | POST `/nous/:did/cognitive-snapshot` | 3 | `'H3'` |
| `mute-broadcast.ts` | POST `/nous/:did/mute` | 3 | `'H3'` |
| `force-sleep.ts` | POST `/nous/:did/force-sleep` | 3 | `'H3'` |
| `memory-query.ts` | POST `/nous/:did/memory/query` | 2 | `'H2'` |
| `relationships.ts` | GET `/relationships/:edge_key/events` (2); POST `/nous/:did/relationships/inspect` (5) | 2 / 5 | — |

Admin (`grid/src/api/admin/`): `config.ts` (GET tier 4 / PUT tier 5), `restart.ts`, `notifications.ts`.
Secondary cleanup: `grid/src/api/routes/account-endowment.ts` (tier 5), `grid/src/api/portal/portal-manager.ts` (tier 5, two handlers).

---

## Phase A — Foundation: allowlist + context + gate (the security core)

### Task 1: `operatorAuth.ts` — parse allowlist + resolve operator

**Files:**
- Create: `grid/src/api/preHandlers/operatorAuth.ts`
- Test: `grid/test/api/operator-auth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// grid/test/api/operator-auth.test.ts
import { describe, it, expect } from 'vitest';
import { parseOperatorAllowlist, resolveOperator } from '../../src/api/preHandlers/operatorAuth.js';

const DID = 'did:noesis:human:0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const OP = 'op:11111111-1111-4111-8111-111111111111';

describe('parseOperatorAllowlist', () => {
  it('parses a single DID|op|tier entry', () => {
    const m = parseOperatorAllowlist(`${DID}|${OP}|5`);
    expect(m.get(DID)).toEqual({ operatorId: OP, tier: 5 });
  });

  it('defaults tier to 5 when omitted', () => {
    const m = parseOperatorAllowlist(`${DID}|${OP}`);
    expect(m.get(DID)).toEqual({ operatorId: OP, tier: 5 });
  });

  it('parses multiple comma-separated entries', () => {
    const DID2 = 'did:noesis:human:0xbbbb';
    const OP2 = 'op:22222222-2222-4222-9222-222222222222';
    const m = parseOperatorAllowlist(`${DID}|${OP}|5,${DID2}|${OP2}|3`);
    expect(m.size).toBe(2);
    expect(m.get(DID2)).toEqual({ operatorId: OP2, tier: 3 });
  });

  it('returns an empty map for undefined / empty (fail-closed)', () => {
    expect(parseOperatorAllowlist(undefined).size).toBe(0);
    expect(parseOperatorAllowlist('').size).toBe(0);
    expect(parseOperatorAllowlist('   ').size).toBe(0);
  });

  it('skips malformed entries (bad DID, bad op-id, bad tier) without granting access', () => {
    const m = parseOperatorAllowlist(
      `not-a-did|${OP}|5,${DID}|not-an-op|5,${DID}|${OP}|9,${DID}|${OP}|5`,
    );
    // only the last (valid) entry survives
    expect(m.size).toBe(1);
    expect(m.get(DID)).toEqual({ operatorId: OP, tier: 5 });
  });
});

describe('resolveOperator', () => {
  const allow = parseOperatorAllowlist(`${DID}|${OP}|4`);
  it('returns the grant for an allowlisted DID', () => {
    expect(resolveOperator(DID, allow)).toEqual({ operatorId: OP, tier: 4 });
  });
  it('returns null for a non-allowlisted DID', () => {
    expect(resolveOperator('did:noesis:human:0xstranger', allow)).toBeNull();
  });
  it('returns null for undefined DID', () => {
    expect(resolveOperator(undefined, allow)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd grid && npx vitest run test/api/operator-auth.test.ts`
Expected: FAIL — module `operatorAuth.js` not found.

- [ ] **Step 3: Write the implementation**

```ts
// grid/src/api/preHandlers/operatorAuth.ts
/**
 * Server-trusted operator identity — replaces the spoofable x-operator-tier/-id
 * header pattern (SECURITY-CRITICAL 2026-07-09). The operator's tier + audit id
 * are resolved from an env allowlist keyed on the authenticated Portal-session
 * DID (req.didContext.operatorDid), NOT from any client header.
 *
 * Env format `GRID_OPERATOR_DIDS`: comma-separated entries, each `DID|op:UUID|tier`.
 *   DID  — operator Portal existence-DID (DID_RE)
 *   op:UUID — server-trusted audit id (OPERATOR_ID_RE)
 *   tier — 1..5 (optional, default 5)
 * Malformed entries are skipped (fail-safe). Empty/unset ⇒ empty map (fail-closed).
 */
import { OPERATOR_ID_REGEX } from '../types.js';

/** Human existence-DID shape (mirrors DID_RE in append-human-joined.ts). */
const DID_RE = /^did:noesis:[a-z0-9_:\-]+$/i;

export interface OperatorGrant {
    readonly operatorId: string;
    readonly tier: number;
}

/** Parse GRID_OPERATOR_DIDS into a DID→grant map. Never throws. */
export function parseOperatorAllowlist(raw: string | undefined): Map<string, OperatorGrant> {
    const out = new Map<string, OperatorGrant>();
    if (!raw || raw.trim().length === 0) return out;
    for (const entry of raw.split(',')) {
        const parts = entry.trim().split('|');
        if (parts.length < 2 || parts.length > 3) continue;
        const did = parts[0].trim();
        const operatorId = parts[1].trim();
        const tierRaw = parts[2]?.trim();
        if (!DID_RE.test(did)) continue;
        if (!OPERATOR_ID_REGEX.test(operatorId)) continue;
        let tier = 5;
        if (tierRaw !== undefined && tierRaw !== '') {
            const n = Number.parseInt(tierRaw, 10);
            if (!Number.isInteger(n) || n < 1 || n > 5) continue;
            tier = n;
        }
        out.set(did, { operatorId, tier });
    }
    return out;
}

/** Resolve the operator grant for an authenticated DID, or null if not an operator. */
export function resolveOperator(
    operatorDid: string | undefined,
    allowlist: Map<string, OperatorGrant>,
): OperatorGrant | null {
    if (!operatorDid) return null;
    return allowlist.get(operatorDid) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd grid && npx vitest run test/api/operator-auth.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add grid/src/api/preHandlers/operatorAuth.ts grid/test/api/operator-auth.test.ts
git commit -m "feat(security): operator allowlist parse + resolve (server-trusted identity)"
```

---

### Task 2: DIDContext fields + `GridServices.operatorAllowlist` + build at boot

**Files:**
- Modify: `grid/src/api/preHandlers/types.ts` (add `operatorTier`, `operatorId` to `DIDContext`)
- Modify: `grid/src/api/server.ts` (add `operatorAllowlist` to `GridServices`; build it in `buildServerWithHub`)

- [ ] **Step 1: Extend DIDContext**

In `grid/src/api/preHandlers/types.ts`, replace the `DIDContext` interface (currently lines 28–32) with:

```ts
export interface DIDContext {
    readonly did: string;
    readonly tier: VisitorTier;
    readonly operatorDid?: string;
    /** Server-trusted operator tier (1..5). Set ONLY by the operator_only gate. */
    readonly operatorTier?: number;
    /** Server-trusted operator audit id (op:<uuid>). Set ONLY by the operator_only gate. */
    readonly operatorId?: string;
}
```

- [ ] **Step 2: Add `operatorAllowlist` to `GridServices`**

In `grid/src/api/server.ts`, inside the `GridServices` interface (after the `govStore?` field near line 424), add:

```ts
    /**
     * Server-trusted operator allowlist (SECURITY 2026-07-09). Maps operator
     * Portal-DID → { operatorId, tier }. When absent, buildServerWithHub parses
     * it from process.env.GRID_OPERATOR_DIDS. Empty ⇒ all operator routes 403
     * (fail-closed). Tests inject a fixture map here to avoid touching env.
     */
    operatorAllowlist?: Map<string, import('./preHandlers/operatorAuth.js').OperatorGrant>;
```

- [ ] **Step 3: Build the allowlist once in `buildServerWithHub`**

In `grid/src/api/server.ts`, add the import near the other preHandler imports (around line 70):

```ts
import { parseOperatorAllowlist, resolveOperator } from './preHandlers/operatorAuth.js';
```

Then inside `buildServerWithHub`, immediately after `const app = Fastify({ logger: false });` (line 447), add:

```ts
    // Server-trusted operator allowlist — parsed once at boot (or injected by tests).
    // Fail-closed: an empty map means every operator_only route returns 403.
    const operatorAllowlist =
        services.operatorAllowlist ?? parseOperatorAllowlist(process.env.GRID_OPERATOR_DIDS);
```

- [ ] **Step 4: Typecheck**

Run: `cd grid && npx tsc --noEmit`
Expected: PASS (no type errors; `resolveOperator` import is unused until Task 3 — if the build flags unused imports, add `resolveOperator` usage in Task 3 within the same commit, or import it in Task 3 instead). To avoid an unused-import error now, import only `parseOperatorAllowlist` here and add `resolveOperator` to the import in Task 3.

- [ ] **Step 5: Commit**

```bash
git add grid/src/api/preHandlers/types.ts grid/src/api/server.ts
git commit -m "feat(security): DIDContext operatorTier/operatorId + boot-time operator allowlist"
```

---

### Task 3: `operator_only` policy + global-hook gate + gate integration test

**Files:**
- Modify: `grid/src/api/policy.ts` (add policy value; retag operator routes)
- Modify: `grid/src/api/server.ts` (add `operator_only` branch to the onRequest hook)
- Test: `grid/test/api/operator-gate.test.ts`

- [ ] **Step 1: Write the failing gate integration test**

```ts
// grid/test/api/operator-gate.test.ts
import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { OperatorGrant } from '../../src/api/preHandlers/operatorAuth.js';

const OPERATOR_DID = 'did:noesis:human:0xoperator';
const OP_ID = 'op:11111111-1111-4111-8111-111111111111';
const STRANGER_DID = 'did:noesis:human:0xstranger';

function buildApp(allow: Map<string, OperatorGrant>) {
  return buildServer({
    clock: new WorldClock({ tickRateMs: 100_000 }),
    space: new SpatialMap(),
    logos: new LogosEngine(),
    audit: new AuditChain(),
    gridName: 'genesis',
    operatorAllowlist: allow,
  });
}

async function cookie(did: string): Promise<string> {
  const { privateKey } = await keyPairPromise;
  return new SignJWT({ did, grid_name: 'genesis' })
    .setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
}

const ALLOW = new Map<string, OperatorGrant>([[OPERATOR_DID, { operatorId: OP_ID, tier: 5 }]]);
// A tier-5 route used as the probe. Body/target are irrelevant — we only assert the gate outcome.
const URL = '/api/v1/operator/nous/did:noesis:NONEXISTENT/delete';

describe('operator_only gate', () => {
  it('401 portal_session_required for an anonymous caller', async () => {
    const app = buildApp(ALLOW); await app.ready();
    const res = await app.inject({ method: 'POST', url: URL });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('portal_session_required');
    await app.close();
  });

  it('REGRESSION: 401 for forged x-operator-tier:5 + x-operator-id with NO session cookie (the closed hole)', async () => {
    const app = buildApp(ALLOW); await app.ready();
    const res = await app.inject({
      method: 'POST', url: URL,
      headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
    });
    expect(res.statusCode).toBe(401);
    expect(res.statusCode).not.toBe(200);
    await app.close();
  });

  it('403 not_operator for a logged-in DID that is not on the allowlist', async () => {
    const app = buildApp(ALLOW); await app.ready();
    const res = await app.inject({
      method: 'POST', url: URL,
      cookies: { [COOKIE_NAME]: await cookie(STRANGER_DID) },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('not_operator');
    await app.close();
  });

  it('403 not_operator for an allowlisted operator when the allowlist is empty (fail-closed)', async () => {
    const app = buildApp(new Map()); await app.ready();
    const res = await app.inject({
      method: 'POST', url: URL,
      cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('not_operator');
    await app.close();
  });

  it('an allowlisted operator PASSES the gate (status is not 401/403 — reaches the handler)', async () => {
    const app = buildApp(ALLOW); await app.ready();
    const res = await app.inject({
      method: 'POST', url: URL,
      cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
    });
    // Gate passed → handler ran → 404 unknown_did (nonexistent target), never 401/403.
    expect(res.statusCode).not.toBe(401);
    expect(res.statusCode).not.toBe(403);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd grid && npx vitest run test/api/operator-gate.test.ts`
Expected: FAIL — operator routes are still `'public'`; anonymous caller reaches the handler (not 401), and the forged-header case still passes to the handler.

- [ ] **Step 3: Add the `operator_only` policy value + retag routes**

In `grid/src/api/policy.ts`, add `'operator_only'` to `ROUTE_DID_POLICY_VALUES` (after `'police_only'`):

```ts
export const ROUTE_DID_POLICY_VALUES = [
    'public',
    'portal_session_required',
    'civic_did_required',
    'business_did_required',
    'government_only',
    'police_only',
    'operator_only',
] as const;
```

Then change every operator route entry from `'public'` to `'operator_only'`. These are the lines currently under the "Operator routes" block (≈219–239), the fork entries (≈403–404), the cognitive-snapshot entry (≈234), and the operator relationship entries (≈237). Concretely, set these keys to `'operator_only'`:

```ts
    'POST /api/v1/operator/clock/pause': 'operator_only',
    'POST /api/v1/operator/clock/resume': 'operator_only',
    'GET /api/v1/operator/governance/laws': 'operator_only',
    'POST /api/v1/operator/governance/laws': 'operator_only',
    'PUT /api/v1/operator/governance/laws/:id': 'operator_only',
    'DELETE /api/v1/operator/governance/laws/:id': 'operator_only',
    'POST /api/v1/operator/humans/:did/ban': 'operator_only',
    'POST /api/v1/operator/humans/:did/freeze': 'operator_only',
    'POST /api/v1/operator/nous/:did/delete': 'operator_only',
    'POST /api/v1/operator/nous/:did/mute': 'operator_only',
    'POST /api/v1/operator/nous/:did/quarantine': 'operator_only',
    'POST /api/v1/operator/nous/:did/slash': 'operator_only',
    'POST /api/v1/operator/nous/:did/force-sleep': 'operator_only',
    'POST /api/v1/operator/nous/:did/telos/force': 'operator_only',
    'POST /api/v1/operator/nous/:did/cognitive-snapshot': 'operator_only',
    'POST /api/v1/operator/nous/:did/memory/query': 'operator_only',
    'GET /api/v1/operator/relationships/:edge_key/events': 'operator_only',
    'POST /api/v1/operator/replay/export': 'operator_only',
    'POST /api/v1/operator/spawn-system-nous': 'operator_only',
    'POST /api/v1/nous/:did/relationships/inspect': 'operator_only',
    'POST /api/v1/operator/fork/:nousDid': 'operator_only',
    'GET /api/v1/operator/fork/:nousDid/download': 'operator_only',
```

> Note: `GET /api/v1/operator/fork/:nousDid/download` uses a one-time token in the query string, not operator auth, but routing it through the gate is safe — the download handler runs after the gate and its own token check still applies. If any existing fork-download test breaks because it has no operator session, keep that ONE entry `'public'` and rely on its token check. Decide during Task 6 when the fork tests run.

- [ ] **Step 4: Add the `operator_only` branch to the onRequest hook**

In `grid/src/api/server.ts`, update the Task 2 import to include `resolveOperator`:

```ts
import { parseOperatorAllowlist, resolveOperator } from './preHandlers/operatorAuth.js';
```

In the global `onRequest` hook, add this branch AFTER the `portal_session_required` branch and BEFORE the `government_only` branch (i.e. after line 511):

```ts
        // SECURITY 2026-07-09: operator routes derive tier + identity SERVER-SIDE
        // from the authenticated Portal-session DID checked against the allowlist —
        // never from x-operator-tier/-id headers. Fail-closed (empty allowlist ⇒ 403).
        if (policy === 'operator_only') {
            const ctx = await requirePortalSession(req, reply, { didStore: services.didStore });
            if (!ctx) return; // 401 portal_session_required already sent
            const grant = resolveOperator(ctx.operatorDid, operatorAllowlist);
            if (!grant) {
                return reply.code(403).send({ error: 'not_operator' });
            }
            req.didContext = { ...ctx, operatorTier: grant.tier, operatorId: grant.operatorId };
            return;
        }
```

- [ ] **Step 5: Run the gate test to verify it passes**

Run: `cd grid && npx vitest run test/api/operator-gate.test.ts`
Expected: PASS (all 5 cases, including the forged-header regression).

- [ ] **Step 6: Commit**

```bash
git add grid/src/api/policy.ts grid/src/api/server.ts grid/test/api/operator-gate.test.ts
git commit -m "feat(security): operator_only policy + server-trusted gate in onRequest hook"
```

---

## Phase B — Migrate the 16 operator route handlers

### Task 4: test helper `withOperatorContext`

**Files:**
- Create: `grid/test/helpers/operator-session.ts`

- [ ] **Step 1: Write the helper**

```ts
// grid/test/helpers/operator-session.ts
/**
 * Test helper — simulates the operator_only gate for per-route unit tests that
 * register a single handler on a bare Fastify instance (no global onRequest hook).
 * Install BEFORE registering the route so the preHandler applies. Sets the same
 * server-trusted fields the real gate sets (operatorTier + operatorId).
 *
 * End-to-end gate behavior (401/403, allowlist, forged-header regression) is
 * covered by grid/test/api/operator-gate.test.ts against the full buildServer.
 */
import type { FastifyInstance } from 'fastify';

/** Default fixture identity. Matches the `OPERATOR` constant used by legacy operator tests. */
export const TEST_OPERATOR_ID = 'op:11111111-1111-4111-8111-111111111111';
export const TEST_OPERATOR_DID = 'did:noesis:human:0xoperator';

export function withOperatorContext(
    app: FastifyInstance,
    opts?: { tier?: number; operatorId?: string; operatorDid?: string },
): void {
    const tier = opts?.tier ?? 5;
    const operatorId = opts?.operatorId ?? TEST_OPERATOR_ID;
    const operatorDid = opts?.operatorDid ?? TEST_OPERATOR_DID;
    app.addHook('preHandler', async (req) => {
        req.didContext = {
            did: operatorDid,
            tier: 'human_visitor',
            operatorDid,
            operatorTier: tier,
            operatorId,
        };
    });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd grid && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add grid/test/helpers/operator-session.ts
git commit -m "test(security): withOperatorContext helper for per-route operator tests"
```

---

### Task 5: migrate `ban-human` (the exemplar — handler + test)

**Files:**
- Modify: `grid/src/api/operator/ban-human.ts`
- Modify: `grid/test/operator/ban-human.test.ts`

- [ ] **Step 1: Update the test first (RED)**

In `grid/test/operator/ban-human.test.ts`:

(a) Add the helper import after the existing imports:

```ts
import { withOperatorContext, TEST_OPERATOR_ID } from '../helpers/operator-session.js';
```

(b) Change the `OPERATOR` constant to reuse the helper's id (keeps every `operator_id` assertion valid):

```ts
const OPERATOR = TEST_OPERATOR_ID;
```

(c) In `buildTestApp`, add an `operatorTier` option and install the context BEFORE registering the route. Change the signature + body:

```ts
function buildTestApp(opts: {
    humanExists?: boolean;
    sanctionReasonStore?: GridServices['sanctionReasonStore'];
    operatorTier?: number;
}): { app: FastifyInstance; audit: AuditChain; bannedFlags: Map<string, boolean>; insertCalls: Array<Record<string, unknown>> } {
    // ...unchanged setup through `const app = Fastify({ logger: false });`
    withOperatorContext(app, opts.operatorTier !== undefined ? { tier: opts.operatorTier } : undefined);
    registerBanHumanRoute(app, services as GridServices);
    return { app, audit, bannedFlags, insertCalls };
}
```

(d) DELETE the three header-gate cases that no longer live in the handler (moved to `operator-gate.test.ts`):
- `'returns 401 tier_missing when x-operator-tier header is absent'`
- `'returns 401 tier_missing when x-operator-tier is non-numeric'`
- `'returns 400 invalid_operator_id when x-operator-id header is badly formatted'`

(e) REPLACE the `tier_too_low` case to drive tier via the context:

```ts
it('returns 403 tier_too_low when operator tier is 4 (< 5)', async () => {
    ({ app } = buildTestApp({ operatorTier: 4 }));
    await app.ready();
    const res = await app.inject({
        method: 'POST',
        url: `/api/v1/operator/humans/${HUMAN_DID}/ban`,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('tier_too_low');
});
```

(f) In EVERY remaining case, remove `headers: { 'x-operator-tier': '5', 'x-operator-id': OPERATOR }` from the `inject(...)` calls (identity now comes from the context). Keep `payload` unchanged.

(g) REPLACE the sole-producer error-path case to trigger a non-auth error:

```ts
it('does NOT emit audit events on error paths (sole-producer invariant)', async () => {
    let audit: AuditChain;
    ({ app, audit } = buildTestApp({}));
    await app.ready();
    // Malformed DID → 400 invalid_did, no audit emission.
    await app.inject({ method: 'POST', url: '/api/v1/operator/humans/not-a-did/ban', payload: { reason: 'x'.repeat(12) } });
    expect(audit.query({ eventType: 'operator.human_banned' })).toHaveLength(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd grid && npx vitest run test/operator/ban-human.test.ts`
Expected: FAIL — handler still reads headers, so tier-from-context cases mismatch.

- [ ] **Step 3: Migrate the handler**

In `grid/src/api/operator/ban-human.ts`:

(a) Remove the now-unused import:

```ts
// DELETE: import { OPERATOR_ID_REGEX } from '../types.js';
```

(b) Replace the auth block (currently lines 51–74, the `// 1. Tier gate` through `const resolvedOperatorId = opIdHeader;`) with:

```ts
            // 1. Tier gate — server-trusted operator context (set by the operator_only gate).
            const tier = req.didContext?.operatorTier ?? 0;
            if (tier < 5) {
                reply.code(403);
                return { error: 'tier_too_low' } satisfies ApiError;
            }
            const resolvedTier: 'H5' = 'H5';
            const resolvedOperatorId = req.didContext?.operatorId;
            if (!resolvedOperatorId) {
                reply.code(403);
                return { error: 'not_operator' } satisfies ApiError;
            }
```

Leave everything from `// 2. DID shape gate` onward unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd grid && npx vitest run test/operator/ban-human.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add grid/src/api/operator/ban-human.ts grid/test/operator/ban-human.test.ts
git commit -m "refactor(security): ban-human reads server-trusted operator context (retire header)"
```

---

### Task 6: migrate the remaining 15 operator handlers + their tests (same recipe)

Apply the **exact recipe from Task 5** to each file below. Do them one at a time, run that file's test(s), commit per file (or per small group). The recipe is identical; only the min-tier number `N` and the audit tier literal (`'H2'..'H5'`) change per the catalogue table above.

**Handler recipe (per handler block):** replace the header auth block

```ts
const tierHeader = req.headers['x-operator-tier'];
if (typeof tierHeader !== 'string') { reply.code(401); return { error: 'tier_missing' } ...; }
const tierNum = parseInt(tierHeader, 10);
if (!Number.isFinite(tierNum)) { reply.code(401); return { error: 'tier_missing' } ...; }
if (tierNum < N) { reply.code(403); return { error: 'tier_too_low' } ...; }
const opIdHeader = req.headers['x-operator-id'];
if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) { reply.code(400); return { error: 'invalid_operator_id' } ...; }
const resolvedTier: 'HN' = 'HN';
const resolvedOperatorId = opIdHeader;
```

with

```ts
const tier = req.didContext?.operatorTier ?? 0;
if (tier < N) { reply.code(403); return { error: 'tier_too_low' } satisfies ApiError; }
const resolvedTier: 'HN' = 'HN';
const resolvedOperatorId = req.didContext?.operatorId;
if (!resolvedOperatorId) { reply.code(403); return { error: 'not_operator' } satisfies ApiError; }
```

Then remove the `OPERATOR_ID_REGEX` import if it is now unused in the file (grep the file first). Preserve any variable names the rest of the handler already uses (`resolvedTier`, `resolvedOperatorId`).

**Test recipe (per test file):** import `withOperatorContext, TEST_OPERATOR_ID`; set the file's `OPERATOR`/op-id constant to `TEST_OPERATOR_ID`; install `withOperatorContext(app, {tier})` before the `register…Route(app, …)` call in the test's app-builder; delete the `tier_missing` + `invalid_operator_id` header cases; convert `tier_too_low` to drive `operatorTier` via the builder; strip `x-operator-tier`/`x-operator-id` from all `inject` calls; retarget any "no audit on error path" case to a non-auth error (bad DID / unknown target).

- [ ] **Step 1: `slash-coin.ts` (N=4, 'H4')** — migrate handler + `grid/test/operator/slash-coin.test.ts`. Run `npx vitest run test/operator/slash-coin.test.ts`. Commit.
- [ ] **Step 2: `quarantine.ts` (N=4, 'H4')** — + `grid/test/operator/quarantine.test.ts`. Run + commit.
- [ ] **Step 3: `telos-force.ts` (N=4, 'H4')** — + `grid/test/operator/telos-force.test.ts` and `grid/test/api/operator/telos.test.ts`. Run both + commit.
- [ ] **Step 4: `mute-broadcast.ts` (N=3, 'H3')** — + `grid/test/operator/mute-broadcast.test.ts`. Run + commit.
- [ ] **Step 5: `force-sleep.ts` (N=3, 'H3')** — + `grid/test/operator/force-sleep.test.ts`. Run + commit.
- [ ] **Step 6: `cognitive-snapshot.ts` (N=3, 'H3')** — + `grid/test/operator/cognitive-snapshot.test.ts`. Run + commit.
- [ ] **Step 7: `memory-query.ts` (N=2, 'H2')** — + `grid/test/operator/memory-query.test.ts` and `grid/test/api/operator/memory.test.ts`. Run both + commit.
- [ ] **Step 8: `clock-pause-resume.ts` (N=3, 'H3', TWO handlers)** — apply the recipe to both the pause and resume handlers + `grid/test/operator/clock-pause-resume.test.ts` and `grid/test/api/operator/clock.test.ts`. Run both + commit.
- [ ] **Step 9: `governance-laws.ts` (N=3, 'H3', THREE handlers POST/PUT/DELETE)** — apply to all three + `grid/test/operator/governance-laws.test.ts` and `grid/test/api/operator/governance.test.ts`. Note: the GET governance route uses `grid/src/api/governance/_validation.ts::validateTierAtLeast` (reads the header) — migrate that helper too: change its signature to read `req.didContext?.operatorTier ?? 0` instead of `request.headers['x-operator-tier']`, returning `{ ok:false, status:403, error:'tier_too_low' }` when below `minTier` (drop the `tier_missing` 401 path — the gate handles absence). Update `grid/test/api/governance-history-tier.test.ts` and `grid/test/api/governance-body-tier.test.ts` accordingly. Run all + commit.
- [ ] **Step 10: `delete-nous.ts` (N=5, 'H5')** — + `grid/test/operator/delete-nous.test.ts`, `grid/test/api/delete-nous.test.ts`, `grid/test/api/operator/delete-nous-bios-death.test.ts`, `grid/test/api/tombstone-410.test.ts` (whichever inject operator headers). Run each + commit.
- [ ] **Step 11: `freeze-wallet.ts` (N=5, 'H5')** — + `grid/test/operator/freeze-wallet.test.ts`. Run + commit.
- [ ] **Step 12: `export-replay.ts` (N=5, 'H5')** — + `grid/test/operator/export-replay.test.ts`. Run + commit.
- [ ] **Step 13: `spawn-system-nous.ts` (N=5)** — this handler validates tier + op-id but does not emit an operator audit event; keep the `tier < 5` gate reading `req.didContext?.operatorTier`, and drop the op-id header read entirely (no `resolvedOperatorId` needed unless the handler uses it — grep first). + `grid/test/operator/spawn-system-nous.test.ts`. Run + commit.
- [ ] **Step 14: `fork-nous.ts` (N=4)** — the handler uses tier + operator id for the fork manifest/token and calls `services.checkOperatorOwnsNous`. Replace the header reads with `req.didContext?.operatorTier` (gate `< 4`) and `req.didContext?.operatorId` (used as the operator identity for `checkOperatorOwnsNous` + manifest). + `grid/test/api/operator/fork-nous.test.ts`. This test injects a stub `checkOperatorOwnsNous`; ensure the app it builds runs the context (if it uses `buildServer`, set `operatorAllowlist` + a cookie like `operator-gate.test.ts`; if it registers the route directly, use `withOperatorContext`). Run + commit.
- [ ] **Step 15: `relationships.ts` (GET events N=2; POST inspect N=5)** — two handlers, migrate both + `grid/test/api/relationships-privacy.test.ts`. Run + commit.

- [ ] **Step 16: Run the whole operator test folder**

Run: `cd grid && npx vitest run test/operator test/api/operator`
Expected: PASS across all migrated files.

---

## Phase C — Admin routes + secondary-header cleanup

### Task 7: admin routes read server-trusted context

**Files:**
- Modify: `grid/src/api/admin/config.ts`, `grid/src/api/admin/restart.ts`, `grid/src/api/admin/notifications.ts`
- Test: `grid/test/api/admin-*.test.ts` (whichever exist — grep `admin` under `grid/test`)

Admin routes stay `'public'` in `policy.ts` (preserving the `GRID_ADMIN_ENABLED` 503-first kill-switch). The `'public'` hook branch already sets `req.didContext` from the cookie via `tryDid`, but does NOT resolve the allowlist — so admin needs the allowlist too.

- [ ] **Step 1:** In `grid/src/api/server.ts`, pass the allowlist to admin registrars. Change the three admin registration calls (≈lines 1003–1005) to accept it, e.g. `registerAdminConfigRoutes(app, operatorAllowlist);` (update each registrar signature to `(app, allowlist)`).
- [ ] **Step 2:** In each admin file, replace the header-reading `tierGate(req, minTier)` with a resolve-based gate:

```ts
import { resolveOperator, type OperatorGrant } from '../preHandlers/operatorAuth.js';

function tierGate(req: FastifyRequest, allowlist: Map<string, OperatorGrant>, minTier: number): ApiError | null {
    const grant = resolveOperator(req.didContext?.operatorDid, allowlist);
    if (!grant) return { error: 'not_operator' };
    if (grant.tier < minTier) return { error: 'tier_too_low' };
    return null;
}
```

Thread `allowlist` from the registrar into each `tierGate(...)` call; map `not_operator` → 403 (adjust the `reply.code(...)` ladder: `not_operator`/`tier_too_low` → 403). Replace the audit `operator_id: req.headers['x-operator-id']` (config.ts PUT log, ≈line 205) with `grant.operatorId`.
- [ ] **Step 3:** Update admin tests: build the full `buildServer` with `operatorAllowlist` + a portal cookie (mirror `operator-gate.test.ts`), OR pass the allowlist to the registrar in the unit harness. Set `GRID_ADMIN_ENABLED='true'` where the enabled path is under test. Remove header injection; a non-operator cookie → 403 `not_operator`.
- [ ] **Step 4:** Run: `cd grid && npx vitest run test/api` (admin-touching files). Expected: PASS.
- [ ] **Step 5:** Commit: `git commit -m "refactor(security): admin routes gate on operator allowlist, not headers"`

### Task 8: secondary-header cleanup (`account-endowment`, `portal-manager`)

**Files:**
- Modify: `grid/src/api/routes/account-endowment.ts`, `grid/src/api/portal/portal-manager.ts`
- Test: `grid/test/api/account-endowment-route.test.ts`, `grid/test/api/portal-manager-registrations.test.ts`, `grid/test/api/portal-manager-did-issuance.test.ts`, `grid/test/api/portal-manager-audit-chain.test.ts`

Both already run `operatorScope` (server-trusted). Replace their secondary `x-operator-tier >= 5` header check with an allowlist membership + tier check on the session DID.

- [ ] **Step 1:** These routes' registrars must receive the allowlist. Thread `operatorAllowlist` from `server.ts` into `registerAccountEndowmentRoute` and the portal-manager registrar (extend signatures), OR read `req.didContext.operatorDid` + a module-level allowlist obtained via a small accessor. Prefer threading it through the registrar (consistent with Task 7).
- [ ] **Step 2:** Replace, in each handler, the block:

```ts
const tierHeader = req.headers['x-operator-tier'];
// ...tier_missing / tier_too_low ladder...
```

with:

```ts
const grant = resolveOperator(req.didContext?.operatorDid, allowlist);
if (!grant || grant.tier < 5) {
    return reply.code(403).send({ error: 'not_operator' });
}
```

(Keep `operatorScope` and the feature-flag gates `GRID_ENDOWMENT_ENABLED` / `GRID_PORTAL_MANAGER_ENABLED` exactly as-is.)
- [ ] **Step 3:** Update the four tests: they already mint a portal cookie via `makePortalCookie`. Make that cookie's DID an allowlisted operator (inject `operatorAllowlist` with `{[OPERATOR_DID]: {operatorId, tier:5}}`). DELETE the "secondary header" ladder cases (`tier_missing` / `tier_too_low` / `invalid_operator_id` with a session) — replaced by "non-operator session → 403 not_operator". Keep the spoofed-header-only regression (still 401/503). Remove `x-operator-tier`/`x-operator-id` from the happy-path injects.
- [ ] **Step 4:** Run: `cd grid && npx vitest run test/api/account-endowment-route.test.ts test/api/portal-manager-registrations.test.ts test/api/portal-manager-did-issuance.test.ts test/api/portal-manager-audit-chain.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `git commit -m "refactor(security): account-endowment + portal-manager gate on allowlist not header"`

---

## Phase D — CI gate, client, docs, final verification

### Task 9: CI gate `check-operator-header-auth.mjs`

**Files:**
- Create: `scripts/check-operator-header-auth.mjs`
- Modify: root `package.json` (`scripts` + `pretest`)

- [ ] **Step 1: Write the gate**

```js
// scripts/check-operator-header-auth.mjs
// CI gate: no route under grid/src/api/operator/ or grid/src/api/admin/ may read
// x-operator-tier / x-operator-id from request headers as an auth source.
// (SECURITY 2026-07-09 — server-trusted operator identity, header retired.)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['grid/src/api/operator', 'grid/src/api/admin'];
const FORBIDDEN = /headers\s*\[\s*['"]x-operator-(tier|id)['"]\s*\]/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const offenders = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (FORBIDDEN.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
    });
  }
}

if (offenders.length > 0) {
  console.error('❌ operator/admin routes must NOT read x-operator-tier/-id from headers:');
  for (const o of offenders) console.error('   ' + o);
  console.error('\nUse the server-trusted operator context (req.didContext.operatorTier / operatorId).');
  process.exit(1);
}
console.log('✅ check-operator-header-auth: no header-trust auth in operator/admin routes');
```

- [ ] **Step 2: Run it against the migrated tree**

Run: `node scripts/check-operator-header-auth.mjs`
Expected: `✅ ...` (exit 0). If it lists offenders, migrate those lines (they were missed in Phase B/C).

- [ ] **Step 3: Wire into `pretest`**

In root `package.json`, add to `scripts`:

```json
"check:operator-header-auth": "node scripts/check-operator-header-auth.mjs",
```

and append `&& npm run check:operator-header-auth` to the end of the existing `pretest` chain.

- [ ] **Step 4: Verify the gate actually fails on a violation**

Run: create a throwaway file `grid/src/api/operator/__gate_probe.ts` containing `const x = req.headers['x-operator-tier'];`, run `node scripts/check-operator-header-auth.mjs`, expect exit 1 listing it, then delete the probe and re-run (expect exit 0).

- [ ] **Step 5: Commit**

```bash
git add scripts/check-operator-header-auth.mjs package.json
git commit -m "ci(security): gate forbidding x-operator-tier/-id header-trust in operator/admin"
```

### Task 10: Steward Console proxy — forward a server-held operator credential

**Files:**
- Modify: `steward/src/app/api/operator/[...path]/route.ts`

- [ ] **Step 1: Verify the credential path against a running Grid FIRST.** Confirm the Grid signs portal-session JWTs with `keyPairPromise` (ES256) and that a cookie `noesis_portal_token` carrying `{ did: <operatorDID> }` resolves through `tryDid`. Mint one operator token offline (same `SignJWT` shape as `portal/auth.ts`) for Henry's Portal DID and confirm a `curl` with that cookie passes the gate on a local Grid (`POST /api/v1/operator/clock/pause` → not 401/403). Record the token in the Steward server env as `STEWARD_OPERATOR_PORTAL_TOKEN`.
- [ ] **Step 2: Rewrite the proxy** to attach the credential as a cookie and drop the `x-operator-*` headers:

```ts
const GRID_ORIGIN = process.env.GRID_ORIGIN ?? process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
const OPERATOR_TOKEN = process.env.STEWARD_OPERATOR_PORTAL_TOKEN ?? '';

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
    const gridUrl = `${GRID_ORIGIN}/api/v1/operator/${path.join('/')}`;
    const headers: Record<string, string> = {};
    if (OPERATOR_TOKEN) headers['cookie'] = `noesis_portal_token=${OPERATOR_TOKEN}`;
    const contentType = req.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;
    const body = req.method === 'POST' ? await req.text() : undefined;
    const upstream = await fetch(gridUrl, { method: req.method, headers, body });
    const responseBody = await upstream.text();
    return new NextResponse(responseBody, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
}
```

Remove `STEWARD_OPERATOR_ID` and the `x-operator-tier`/`x-operator-id` header wiring.
- [ ] **Step 3:** Run the Steward build/lint: `cd steward && npm run lint` (or `npm run build`). Expected: PASS.
- [ ] **Step 4:** Commit: `git commit -m "fix(security): steward operator proxy forwards portal-session credential, drops header"`

> If the server-held-token approach is rejected during Step 1 review, the fallback is to forward the interactive operator's own `noesis_portal_token` cookie (`headers['cookie'] = req.headers.get('cookie') ?? ''`) — requires the operator to be logged into a Grid Portal session in the same browser. Note the choice in STATE.md.

### Task 11: documentation sync (mandatory — same PR, per CLAUDE.md doc-sync rule)

**Files:**
- Modify: `wiki/1-design/decisions.md`, `wiki/1-design/civic-architecture.md`
- Modify: `.planning/STATE.md`
- Modify: `.gstack/qa-reports/SECURITY-CRITICAL-operator-header-escalation-2026-07-09.md`

- [ ] **Step 1:** Add a new decision to `wiki/1-design/decisions.md` (next free `D-*` id): operator auth is Portal-session + env allowlist (`GRID_OPERATOR_DIDS`); `x-operator-tier`/`x-operator-id` are retired as an auth source across `operator/*` + `admin/*`; fail-closed default; CI-enforced by `check-operator-header-auth.mjs`. Reference the prior header-trust decision (D-25b-NEW-1) as superseded.
- [ ] **Step 2:** In `wiki/1-design/civic-architecture.md`, in the operator framework section (D-V3-18 / D-V3-36), note operator identity is now server-trusted (Portal-session DID ∈ allowlist), not header-derived.
- [ ] **Step 3:** In `.planning/STATE.md` Accumulated Context, record: the vuln is fixed; the fail-closed invariant (empty `GRID_OPERATOR_DIDS` ⇒ operator routes 403); the prod deploy step (set `GRID_OPERATOR_DIDS` with Henry's `@henry` Portal DID + an `op:<uuid>`); the CI gate name.
- [ ] **Step 4:** Update the SECURITY-CRITICAL report header: `Status: FIXED` with the branch/commit ref and a one-line summary of the fix.
- [ ] **Step 5:** Run the doc-sync CI gate if present: `node scripts/check-state-doc-sync.mjs` (and `node scripts/check-wiki.mjs`). Expected: PASS. Commit: `git commit -m "docs(security): sync decisions + civic-architecture + STATE + report for operator-auth fix"`

### Task 12: full verification + branch wrap-up

- [ ] **Step 1:** Run the full grid suite (includes `pretest` gates): `cd grid && npm test`. Expected: PASS. If the local toolchain can't run vitest (see memory `project_local_test_toolchain_broken`), run via the docker rebuild path or push the branch and let CI run — do NOT claim green without one of these.
- [ ] **Step 2:** Run every check script touched: `node scripts/check-operator-header-auth.mjs && npm run --prefix . check:state-doc-sync`. Expected: all ✅.
- [ ] **Step 3:** Grep the whole `grid/src` for any residual header-trust: `grep -rn "x-operator-tier\|x-operator-id" grid/src/api/operator grid/src/api/admin`. Expected: no `req.headers[...]` auth reads (comments are fine, but prefer removing stale ones you touched).
- [ ] **Step 4:** Confirm the diff is surgical: `git diff main --stat`. Every changed file should trace to this fix.
- [ ] **Step 5:** Push the branch and open a PR (only when the user asks). Do NOT deploy — deploy requires setting `GRID_OPERATOR_DIDS` on prod first (fail-closed will otherwise 403 all operator actions, which is safe but blocks the Steward Console). Surface the deploy step in the PR body.

---

## Self-review notes (author)

- **Spec coverage:** allowlist (T1), context+boot (T2), gate+regression (T3), 16 operator handlers (T5–T6), admin (T7), secondary cleanup (T8), CI gate (T9), Steward client (T10), docs (T11), verify (T12). All spec §3.x mapped.
- **Audit contract:** untouched — `operator_id` stays `op:<uuid>` sourced from `req.didContext.operatorId` (the allowlist entry); every `appendOperator*` guard still holds.
- **Type consistency:** `OperatorGrant { operatorId, tier }`, `resolveOperator(did, allowlist)`, `parseOperatorAllowlist(raw)`, `req.didContext.operatorTier/operatorId`, `withOperatorContext(app, {tier,operatorId,operatorDid})` used consistently across tasks.
- **Known uncertainty:** Task 10 Step 1 (Steward credential) is verify-first with a documented fallback — the only non-mechanical piece.
