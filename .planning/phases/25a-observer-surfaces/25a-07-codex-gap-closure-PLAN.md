---
phase: 25a-observer-surfaces
plan: 7
type: execute
wave: 1
depends_on: ["25a-01", "25a-02", "25a-03", "25a-04", "25a-05", "25a-06"]
files_modified:
  - grid/src/api/operator/cognitive-snapshot.ts
  - grid/src/api/operator/cognitive-snapshot-client.ts
  - grid/test/operator/cognitive-snapshot.test.ts
  - grid/test/operator/cognitive-snapshot-client.test.ts
  - steward/src/app/nous/[id]/page.tsx
autonomous: true
gap_closure: true
requirements: [OBS-COGNITIVE-INSPECTOR]

must_haves:
  truths:
    - "POST /api/v1/operator/nous/:did/cognitive-snapshot derives tier from the x-operator-tier request header (server-trusted), not from request body"
    - "POST /api/v1/operator/nous/:did/cognitive-snapshot derives operator_id from the x-operator-id request header (server-trusted), not from request body"
    - "A request whose body claims {tier:'H3', operator_id:'op:<uuid-v4>'} but whose headers lack/under-specify the H3 tier is rejected (401 tier_missing or 403 tier_too_low)"
    - "The audit event operator.inspected emitted on success carries the header-derived operator_id; body-supplied operator_id is ignored"
    - "The Steward Cognitive Inspector fetch on /nous/[did] sends NO body.tier and NO body.operator_id; H3 tier and operator_id are carried in x-operator-tier and x-operator-id request headers"
    - "Drive bars on /nous/[did] read drive_levels[drive.toLowerCase()] — the lowercase keys the Brain returns — and continue to display the uppercase DRIVE_NAMES labels"
    - "fetchCognitiveSnapshot rejects any Brain response whose drive_levels keys are not exactly the lowercase set {boredom, curiosity, hunger, loneliness, safety} (already enforced) and the assertion is covered by a regression test"
    - "Zero new audit events introduced (allowlist delta = 0); operator.inspected remains the sole emission, now with header-derived operator_id"
  artifacts:
    - path: "grid/src/api/operator/cognitive-snapshot.ts"
      provides: "Route reads x-operator-tier + x-operator-id headers; body fields tier/operator_id ignored"
      contains: "x-operator-tier"
    - path: "steward/src/app/nous/[id]/page.tsx"
      provides: "Cognitive Inspector fetch sends headers, no body; drive lookup is lowercase"
      contains: "x-operator-tier"
    - path: "grid/test/operator/cognitive-snapshot.test.ts"
      provides: "Tests assert header-derived auth; body-supplied tier/operator_id is ignored"
      contains: "x-operator-tier"
    - path: "grid/test/operator/cognitive-snapshot-client.test.ts"
      provides: "Test asserts drive_levels lowercase-keys contract"
      contains: "EXPECTED_DRIVE_KEYS"
  key_links:
    - from: "grid/src/api/operator/cognitive-snapshot.ts"
      to: "request.headers['x-operator-tier'] / ['x-operator-id']"
      via: "FastifyRequest.headers read at route entry"
      pattern: "x-operator-tier"
    - from: "steward/src/app/nous/[id]/page.tsx"
      to: "POST /api/v1/operator/nous/:did/cognitive-snapshot"
      via: "fetch with x-operator-tier:'3' + x-operator-id:'op:<uuid-v4>' headers, empty body"
      pattern: "x-operator-tier"
    - from: "steward/src/app/nous/[id]/page.tsx"
      to: "cognitive.drive_levels (lowercase keys)"
      via: "drive_levels[drive.toLowerCase()] index expression"
      pattern: "toLowerCase\\(\\)"
---

<objective>
Close the 3 gaps Codex surfaced in Phase 25a post-merge:

- **GAP-25a-1 (P1):** H3 tier-bypass in `grid/src/api/operator/cognitive-snapshot.ts:61` — tier/operator_id were read from the POST body, so a caller could self-claim H3.
- **GAP-25a-2 (P1):** Steward Cognitive Inspector at `steward/src/app/nous/[id]/page.tsx:221` posts `operator_id:'op:steward:default'` — fails OPERATOR_ID_REGEX (UUID-v4) once any server-side check is enforced.
- **GAP-25a-3 (P2):** Steward drive bars at `steward/src/app/nous/[id]/page.tsx:544` index `drive_levels[name]` with uppercase keys but Brain returns lowercase — all 5 bars render at 0.

Purpose: Restore the H3 gate the route's docstring already promises (D-25a-04), and make the Cognitive Inspector display real data. Allowlist invariant preserved — no new audit events.

Output: One server route hardened to trust headers (matching the existing governance `validateTierAtLeast` pattern), one Steward page that sends correct headers + reads correct drive keys, and regression tests that pin the new contract.

Per CLAUDE.md "Surgical Changes": touch ONLY the 3 listed source files and their 2 test files. No formatting churn, no refactors, no "improvements" to adjacent code.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/25a-observer-surfaces/25a-CONTEXT.md
@.planning/phases/25a-observer-surfaces/25a-VERIFICATION.md
@.planning/phases/25a-observer-surfaces/25a-HUMAN-UAT.md

# Source files touched by this plan — read before editing
@grid/src/api/operator/cognitive-snapshot.ts
@grid/src/api/operator/cognitive-snapshot-client.ts
@grid/src/api/operator/_validation.ts
@grid/src/api/governance/_validation.ts
@grid/test/operator/cognitive-snapshot.test.ts
@grid/test/operator/cognitive-snapshot-client.test.ts
@steward/src/app/nous/[id]/page.tsx
@brain/src/noesis_brain/http/cognitive_snapshot.py

<interfaces>
<!-- The header-auth pattern this plan replicates — already exists for governance GET routes. -->

From grid/src/api/governance/_validation.ts (canonical header-auth helper to mirror):
```typescript
export function validateTierAtLeast(
    request: FastifyRequest,
    minTier: 1 | 2 | 3 | 4 | 5,
): { ok: true } | { ok: false; status: 401 | 403; error: 'tier_missing' | 'tier_too_low' };
// Reads request.headers['x-operator-tier'], parses as integer, compares >= minTier.
// Returns 401 tier_missing if header absent/non-numeric, 403 tier_too_low if < minTier.
```

From grid/src/api/types.ts:
```typescript
export const OPERATOR_ID_REGEX = /^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type HumanAgencyTier = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';
```

From grid/src/api/operator/cognitive-snapshot-client.ts:
```typescript
const EXPECTED_DRIVE_KEYS = ['boredom', 'curiosity', 'hunger', 'loneliness', 'safety'] as const;
// Already enforced by the closed-tuple validator — this plan adds a regression test to pin it.
```

From brain/src/noesis_brain/http/cognitive_snapshot.py:60:
```python
drive_levels: dict[str, float] = {d.value: 0.0 for d in DriveName}
# DriveName enum .value is lowercase: 'hunger', 'curiosity', 'safety', 'boredom', 'loneliness'.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>T1: Replace body-trust with header-trust in cognitive-snapshot route (GAP-25a-1)</name>
  <files>grid/src/api/operator/cognitive-snapshot.ts</files>
  <read_first>
    - grid/src/api/operator/cognitive-snapshot.ts (current implementation — lines 56-67 are the bug site)
    - grid/src/api/governance/_validation.ts:84-108 (validateTierAtLeast — the canonical x-operator-tier header reader to mirror)
    - grid/src/api/operator/_validation.ts (existing OperatorBody validator — DO NOT modify; we just stop using it here)
    - grid/src/api/types.ts (OPERATOR_ID_REGEX + HumanAgencyTier definitions)
  </read_first>
  <behavior>
    - Header tier missing/non-numeric → 401 {error:'tier_missing'}, no Brain call, no audit emit
    - Header tier < 3 → 403 {error:'tier_too_low'}, no Brain call, no audit emit
    - Header x-operator-id missing or not matching OPERATOR_ID_REGEX → 400 {error:'invalid_operator_id'}, no Brain call, no audit emit
    - Body containing {tier:'H3', operator_id:'op:<valid-uuid>'} alone (no headers) → still rejected with 401 tier_missing
    - All headers valid + downstream succeeds → 200, audit emits operator.inspected with payload.operator_id === header value (NOT body value, even if body had a different one)
    - 404 / 410 / 503 paths preserved exactly as before (tombstone check, runner lookup, Brain proxy errors)
  </behavior>
  <action>
    Edit `grid/src/api/operator/cognitive-snapshot.ts` to derive tier and operator_id from request headers instead of body:

    1. Remove the import of `validateTierBody` and the `OperatorBody` type usage. Replace with:
       ```typescript
       import { OPERATOR_ID_REGEX } from '../types.js';
       ```

    2. Delete the `interface CognitiveSnapshotBody extends OperatorBody {}` line. Change the route generic from `Body: CognitiveSnapshotBody` to `Body: never` (or remove the Body generic entirely — body is unused).

    3. Replace the existing step "1. Tier + operator_id gate" (lines ~59-66) with header-based resolution that mirrors `validateTierAtLeast` from governance/_validation.ts:

       ```typescript
       // 1. Tier gate — read from server-trusted x-operator-tier header (D-25a-04).
       //    Mirrors grid/src/api/governance/_validation.ts validateTierAtLeast.
       //    GAP-25a-1 fix: body fields tier/operator_id are NOT trusted.
       const tierHeader = req.headers['x-operator-tier'];
       if (typeof tierHeader !== 'string') {
           reply.code(401);
           return { error: 'tier_missing' } satisfies ApiError;
       }
       const tierNum = parseInt(tierHeader, 10);
       if (!Number.isFinite(tierNum)) {
           reply.code(401);
           return { error: 'tier_missing' } satisfies ApiError;
       }
       if (tierNum < 3) {
           reply.code(403);
           return { error: 'tier_too_low' } satisfies ApiError;
       }

       // 1b. Operator-id gate — read from server-trusted x-operator-id header.
       const opIdHeader = req.headers['x-operator-id'];
       if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
           reply.code(400);
           return { error: 'invalid_operator_id' } satisfies ApiError;
       }
       const resolvedTier: 'H3' = 'H3';
       const resolvedOperatorId = opIdHeader;
       ```

    4. Update the audit emit at the success path (was lines 126-137) to use the resolved values:
       ```typescript
       appendOperatorEvent(
           services.audit,
           'operator.inspected',
           resolvedOperatorId,
           {
               tier: resolvedTier,
               action: 'cognitive_snapshot',
               operator_id: resolvedOperatorId,
               target_did: targetDid,
           },
           targetDid,
       );
       ```

    5. Update the docstring's ERROR LADDER section to reflect:
       - 400 — malformed DID or operator_id header
       - 401 — tier_missing (x-operator-tier header absent/non-numeric)
       - 403 — tier_too_low (header tier < 3)
       - 404 / 410 / 503 / 200 unchanged

    6. Remove the now-unused `body` const (`const body = req.body ?? {};`) — the body is not read.

    DO NOT add any new audit events. DO NOT change any other operator route in this file or in peer files (clock-pause-resume.ts, telos-force.ts, etc.) — that is out of scope for this gap closure.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/operator/cognitive-snapshot.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "validateTierBody" grid/src/api/operator/cognitive-snapshot.ts` → ZERO matches
    - `grep -n "x-operator-tier" grid/src/api/operator/cognitive-snapshot.ts` → at least 1 match
    - `grep -n "x-operator-id" grid/src/api/operator/cognitive-snapshot.ts` → at least 1 match
    - `grep -n "req.body" grid/src/api/operator/cognitive-snapshot.ts` → ZERO matches (body unused)
    - `grep -nE "appendOperatorEvent|audit\\.append" grid/src/api/operator/cognitive-snapshot.ts | wc -l` → exactly 1 (sole-producer preserved)
    - `cd grid && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    Route trusts only x-operator-tier + x-operator-id headers. Body is ignored. operator.inspected audit payload carries the header-derived operator_id. All other behavior (404/410/503 ladder, sole-producer invariant) preserved verbatim.
  </done>
</task>

<task type="auto" tdd="true">
  <name>T2: Update cognitive-snapshot route tests to assert header-trust contract</name>
  <files>grid/test/operator/cognitive-snapshot.test.ts</files>
  <read_first>
    - grid/test/operator/cognitive-snapshot.test.ts (current tests — they currently send body-supplied tier/operator_id)
    - grid/src/api/operator/cognitive-snapshot.ts (post-T1 implementation)
  </read_first>
  <behavior>
    - Existing happy-path test (200 with body tier/operator_id) → must be REWRITTEN to send headers, not body
    - New test: request with only body {tier:'H3', operator_id:'<valid-uuid>'} and NO headers → 401 tier_missing
    - New test: request with x-operator-tier:'2' header → 403 tier_too_low
    - New test: request with x-operator-tier:'3' but no x-operator-id → 400 invalid_operator_id
    - New test: request with x-operator-tier:'3' but x-operator-id:'op:steward:default' (non-UUID) → 400 invalid_operator_id
    - New test: request with valid headers AND body{operator_id:'op:<DIFFERENT-uuid>'} → 200, audit payload.operator_id === header value (NOT body)
  </behavior>
  <action>
    Edit `grid/test/operator/cognitive-snapshot.test.ts`:

    1. For every existing test case that sends `body: JSON.stringify({tier:'H3', operator_id:'...'})`, change it to:
       - Send empty body (or omit body entirely)
       - Add headers: `'x-operator-tier': '3', 'x-operator-id': '<valid-uuid-v4-op-id>'`
       Pick a single shared constant at top-of-file like:
       ```typescript
       const VALID_OPERATOR_ID = 'op:12345678-1234-4234-8234-123456789abc';
       ```

    2. Add the following NEW test cases (use the existing test harness/inject pattern from this file):

       ```typescript
       it('rejects body-supplied tier when headers are missing (GAP-25a-1 regression)', async () => {
           const res = await app.inject({
               method: 'POST',
               url: `/api/v1/operator/nous/${VALID_DID}/cognitive-snapshot`,
               payload: { tier: 'H3', operator_id: VALID_OPERATOR_ID }, // body claim — must be ignored
           });
           expect(res.statusCode).toBe(401);
           expect(res.json()).toEqual({ error: 'tier_missing' });
       });

       it('rejects header tier below 3 with 403 tier_too_low', async () => {
           const res = await app.inject({
               method: 'POST',
               url: `/api/v1/operator/nous/${VALID_DID}/cognitive-snapshot`,
               headers: { 'x-operator-tier': '2', 'x-operator-id': VALID_OPERATOR_ID },
           });
           expect(res.statusCode).toBe(403);
           expect(res.json()).toEqual({ error: 'tier_too_low' });
       });

       it('rejects missing or malformed x-operator-id header with 400', async () => {
           const res = await app.inject({
               method: 'POST',
               url: `/api/v1/operator/nous/${VALID_DID}/cognitive-snapshot`,
               headers: { 'x-operator-tier': '3', 'x-operator-id': 'op:steward:default' },
           });
           expect(res.statusCode).toBe(400);
           expect(res.json()).toEqual({ error: 'invalid_operator_id' });
       });

       it('audit payload.operator_id uses header value, not body value (GAP-25a-1 regression)', async () => {
           const headerOpId  = 'op:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
           const bodyOpId    = 'op:11111111-2222-4333-8444-555555555555';
           const res = await app.inject({
               method: 'POST',
               url: `/api/v1/operator/nous/${VALID_DID}/cognitive-snapshot`,
               headers: { 'x-operator-tier': '3', 'x-operator-id': headerOpId },
               payload: { tier: 'H3', operator_id: bodyOpId }, // attacker body
           });
           expect(res.statusCode).toBe(200);
           const inspectedEvents = audit.query({ eventType: 'operator.inspected', actorDid: VALID_DID });
           expect(inspectedEvents).toHaveLength(1);
           expect((inspectedEvents[0].payload as { operator_id: string }).operator_id).toBe(headerOpId);
       });
       ```

       Adapt the harness names (`app`, `audit`, `VALID_DID`) to whatever the file already uses — DO NOT invent a new harness.

    3. Preserve all existing 404 / 410 / 503 tests — they still apply, just send headers instead of body.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/operator/cognitive-snapshot.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run test/operator/cognitive-snapshot.test.ts` exits 0 with all tests passing
    - `grep -c "x-operator-tier" grid/test/operator/cognitive-snapshot.test.ts` → at least 4 (one per new test case plus rewritten existing happy-path)
    - `grep -nE "body.*tier.*H3.*operator_id" grid/test/operator/cognitive-snapshot.test.ts` ONLY appears inside the explicit regression test asserting body is ignored
    - One new test name contains "GAP-25a-1" string for traceability
  </acceptance_criteria>
  <done>
    Tests pin the header-trust contract. Any future regression to body-trust will fail the "audit payload.operator_id uses header value" test or the "rejects body-supplied tier when headers are missing" test.
  </done>
</task>

<task type="auto" tdd="true">
  <name>T3: Add drive_levels lowercase-keys regression test in client validator (GAP-25a-3 part 1)</name>
  <files>grid/test/operator/cognitive-snapshot-client.test.ts</files>
  <read_first>
    - grid/src/api/operator/cognitive-snapshot-client.ts (EXPECTED_DRIVE_KEYS const at lines 63-70 already enforces lowercase; we add a regression test)
    - grid/test/operator/cognitive-snapshot-client.test.ts (existing test patterns / mock-fetch harness)
  </read_first>
  <behavior>
    - A Brain response with lowercase drive_levels keys → fetchCognitiveSnapshot returns the parsed object successfully
    - A Brain response with UPPERCASE drive_levels keys (e.g. {HUNGER:0.5, CURIOSITY:..., ...}) → fetchCognitiveSnapshot throws BrainMalformedResponseError
    - The error message references the expected key set (`["boredom","curiosity","hunger","loneliness","safety"]`)
  </behavior>
  <action>
    Add the following test to `grid/test/operator/cognitive-snapshot-client.test.ts` (place inside the existing `describe('fetchCognitiveSnapshot', ...)` block, adapt mock-fetch helper to match the file's existing style):

    ```typescript
    it('GAP-25a-3 regression: rejects drive_levels with uppercase keys', async () => {
        const badBody = {
            drive_levels: {
                HUNGER: 0.5,
                CURIOSITY: 0.4,
                SAFETY: 0.3,
                BOREDOM: 0.2,
                LONELINESS: 0.1,
            },
            last_sleep_tick: 100,
            reflexion_count: 1,
            rule_count: 1,
            skill_titles_topk: [],
        };
        const fetchMock = makeMockFetch(200, badBody); // use whatever helper this file already has
        await expect(
            fetchCognitiveSnapshot('http://brain:8090', 'did:noesis:nous:test', fetchMock),
        ).rejects.toThrow(BrainMalformedResponseError);
    });

    it('GAP-25a-3 regression: accepts drive_levels with the exact lowercase contract keys', async () => {
        const goodBody = {
            drive_levels: {
                hunger: 0.5,
                curiosity: 0.4,
                safety: 0.3,
                boredom: 0.2,
                loneliness: 0.1,
            },
            last_sleep_tick: 100,
            reflexion_count: 1,
            rule_count: 1,
            skill_titles_topk: [],
        };
        const fetchMock = makeMockFetch(200, goodBody);
        const result = await fetchCognitiveSnapshot('http://brain:8090', 'did:noesis:nous:test', fetchMock);
        expect(result.drive_levels.hunger).toBe(0.5);
        expect(result.drive_levels.loneliness).toBe(0.1);
    });
    ```

    Adapt the mock-fetch helper name to whatever the file uses. DO NOT modify cognitive-snapshot-client.ts itself — the assertion already exists at lines 147-155; this task just pins it with a regression test that names the gap.

    The grep-verifiable assertion this provides: any future PR that loosens the EXPECTED_DRIVE_KEYS tuple (e.g. to support uppercase aliases) will fail the uppercase-keys test.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run test/operator/cognitive-snapshot-client.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run test/operator/cognitive-snapshot-client.test.ts` exits 0 with all tests passing
    - `grep -c "GAP-25a-3" grid/test/operator/cognitive-snapshot-client.test.ts` → at least 2
    - `grep -n "EXPECTED_DRIVE_KEYS\\|drive_levels" grid/src/api/operator/cognitive-snapshot-client.ts` shows the original validator unchanged (no edits to source)
  </acceptance_criteria>
  <done>
    Drive-key casing contract is now pinned by tests. Future drift between Brain (lowercase) and any UI/client assumption (uppercase) fails fast.
  </done>
</task>

<task type="auto">
  <name>T4: Fix Steward Cognitive Inspector — send headers, drop body, lowercase drive lookup (GAP-25a-2 + GAP-25a-3 part 2)</name>
  <files>steward/src/app/nous/[id]/page.tsx</files>
  <read_first>
    - steward/src/app/nous/[id]/page.tsx (current — lines 213-238 for cognitive fetch, line 540-546 for drive bars)
    - grid/src/api/operator/cognitive-snapshot.ts (post-T1 — confirms header names + tier '3' format)
    - brain/src/noesis_brain/http/cognitive_snapshot.py:60 (confirms drive_levels keys are lowercase: hunger/curiosity/safety/boredom/loneliness)
  </read_first>
  <behavior>
    - Network panel for the cognitive-snapshot fetch shows headers `x-operator-tier: 3` and `x-operator-id: op:<uuid-v4>` and an empty request body
    - With Brain returning drive_levels:{hunger:0.5, curiosity:0.4, safety:0.3, boredom:0.2, loneliness:0.1}, the 5 drive bars render 50% / 40% / 30% / 20% / 10% (NOT 0)
    - UI label text remains uppercase HUNGER / CURIOSITY / SAFETY / BOREDOM / LONELINESS — only the index key is lowercased
    - With Brain offline / 503 from Grid → existing "Cognitive snapshot unavailable — Brain offline." branch still renders (unchanged)
    - With Grid responding 403 → existing "H3+ operator tier required" branch still renders (unchanged)
  </behavior>
  <action>
    Edit `steward/src/app/nous/[id]/page.tsx` — exactly two surgical changes:

    **Change A (GAP-25a-2) — at the cognitive-snapshot fetch (currently lines 215-223):**

    Replace:
    ```typescript
    const res = await fetch(
        `${GRID_ORIGIN}/api/v1/operator/nous/${encodeURIComponent(did)}/cognitive-snapshot`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tier: 'H3', operator_id: 'op:steward:default' }),
        }
    );
    ```

    With:
    ```typescript
    // GAP-25a-1/2 fix: tier + operator_id are now derived server-side from
    // x-operator-tier / x-operator-id headers. Body is unused.
    // The Steward Console runs as a trusted internal surface; in a future phase
    // these headers will be injected by an auth proxy / SIWE session middleware.
    // For now, send the H3 default the Steward operator already implicitly assumes.
    const res = await fetch(
        `${GRID_ORIGIN}/api/v1/operator/nous/${encodeURIComponent(did)}/cognitive-snapshot`,
        {
            method: 'POST',
            headers: {
                'x-operator-tier': '3',
                'x-operator-id': process.env.NEXT_PUBLIC_STEWARD_OPERATOR_ID
                    ?? 'op:00000000-0000-4000-8000-000000000001',
            },
        }
    );
    ```

    The fallback UUID `op:00000000-0000-4000-8000-000000000001` is a valid UUID-v4 shape so OPERATOR_ID_REGEX accepts it. It is a placeholder until v2.5 SIWE-derived operator IDs land — this is consistent with the existing implicit Steward-as-default-operator assumption already encoded in the route (no behavior change for the operator, only a format fix).

    **Change B (GAP-25a-3) — at the drive bar render (currently line 544):**

    Replace:
    ```typescript
    level={cogLoading ? 0 : (cognitive?.drive_levels?.[drive] ?? 0)}
    ```

    With:
    ```typescript
    // GAP-25a-3 fix: Brain returns lowercase drive keys (hunger/curiosity/...);
    // DRIVE_NAMES constant is uppercase for display only. Lowercase the lookup key.
    level={cogLoading ? 0 : (cognitive?.drive_levels?.[drive.toLowerCase()] ?? 0)}
    ```

    Do NOT change the `DRIVE_NAMES` const (display labels stay uppercase).
    Do NOT change the `DRIVE_COLORS` map (keyed by uppercase display name — correct).
    Do NOT touch the Brain Health 2x2 grid's mini drive bars (Card C, lines 668-685) — those read from `ananke.drive_crossed` payloads where the `drive` field already gets `.toUpperCase()` applied at line 680; that surface is unaffected by the Brain HTTP contract.
    Do NOT modify any other state, fetch, or render block in this file.
  </action>
  <verify>
    <automated>cd steward &amp;&amp; npx tsc --noEmit &amp;&amp; npx eslint src/app/nous/\[id\]/page.tsx --max-warnings 0</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "op:steward:default" steward/src/app/nous/[id]/page.tsx` → ZERO matches
    - `grep -n "x-operator-tier" steward/src/app/nous/[id]/page.tsx` → exactly 1 match
    - `grep -n "x-operator-id" steward/src/app/nous/[id]/page.tsx` → exactly 1 match
    - `grep -nE "JSON.stringify.*tier.*H3" steward/src/app/nous/[id]/page.tsx` → ZERO matches (no more body-supplied tier)
    - `grep -n "drive.toLowerCase()" steward/src/app/nous/[id]/page.tsx` → exactly 1 match
    - `grep -n "DRIVE_NAMES = \\['HUNGER'" steward/src/app/nous/[id]/page.tsx` → still 1 match (display labels unchanged)
    - `cd steward && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    Cognitive Inspector fetch sends server-trusted headers and no body; drive bars index the correct lowercase keys while continuing to display uppercase labels. The two coupled gaps GAP-25a-2 and GAP-25a-3 are closed at the Steward layer.
  </done>
</task>

<task type="auto">
  <name>T5: Run full automated verification (vitest + pytest + CI plaintext gate + rebuild Grid)</name>
  <files>(verification only — no edits)</files>
  <read_first>
    - .planning/STATE.md (confirm allowlist invariant — no new audit events)
    - grid/src/audit/broadcast-allowlist.ts (confirm operator.inspected still single emission point in cognitive-snapshot.ts)
  </read_first>
  <behavior>
    - Grid vitest suite green (all cognitive-snapshot + cognitive-snapshot-client tests pass)
    - Brain pytest suite green (cognitive_snapshot tests still pass — we did not touch Brain code, but confirm no regression)
    - CI plaintext gate `scripts/check-cognitive-snapshot-plaintext.mjs` exits 0
    - Grid TypeScript compile clean; Steward TypeScript compile clean
    - Grep audit confirms exactly ONE `appendOperatorEvent` call site in cognitive-snapshot.ts (sole-producer preserved)
    - Grep audit confirms ZERO new entries in `grid/src/audit/broadcast-allowlist.ts` (allowlist delta = 0)
    - Grid Docker container rebuilt and running on the new image (per CLAUDE.md auto-rebuild rule)
  </behavior>
  <action>
    Run the following commands and confirm each exits 0:

    1. **Grid vitest (targeted, then full):**
       ```bash
       cd grid && npx vitest run test/operator/cognitive-snapshot.test.ts test/operator/cognitive-snapshot-client.test.ts
       cd grid && npx vitest run
       ```

    2. **Brain pytest (regression — we did not touch Brain code):**
       ```bash
       cd brain && uv run pytest test/test_cognitive_snapshot.py -x
       ```

    3. **CI plaintext gate:**
       ```bash
       node scripts/check-cognitive-snapshot-plaintext.mjs
       ```
       Must print "0 violations across all scopes" and exit 0.

    4. **TypeScript compile checks:**
       ```bash
       cd grid && npx tsc --noEmit
       cd steward && npx tsc --noEmit
       ```

    5. **Allowlist invariant grep:**
       ```bash
       git diff grid/src/audit/broadcast-allowlist.ts
       ```
       Must show NO diff (zero new audit events).

    6. **Sole-producer grep:**
       ```bash
       grep -cE "appendOperatorEvent|services\\.audit\\.append" grid/src/api/operator/cognitive-snapshot.ts
       ```
       Must print `1`.

    7. **Rebuild Grid Docker (CLAUDE.md mandate — auto-rebuild after every Grid source change):**
       ```bash
       docker compose build grid && docker compose up -d grid
       ```

    If ANY step fails, stop and report — do not proceed to T6 until everything above is green.
  </action>
  <verify>
    <automated>cd grid &amp;&amp; npx vitest run &amp;&amp; cd ../brain &amp;&amp; uv run pytest test/test_cognitive_snapshot.py -x &amp;&amp; cd .. &amp;&amp; node scripts/check-cognitive-snapshot-plaintext.mjs</automated>
  </verify>
  <acceptance_criteria>
    - All commands in &lt;action&gt; exit 0
    - `git diff grid/src/audit/broadcast-allowlist.ts` produces empty output
    - `grep -cE "appendOperatorEvent" grid/src/api/operator/cognitive-snapshot.ts` prints `1`
    - `docker ps --filter name=grid` shows the grid container as Up after rebuild
  </acceptance_criteria>
  <done>
    All automated gates pass. The gap closure does not regress any existing suite, does not add audit events, and does not break the sole-producer invariant. Grid container is running on the fixed image.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>T6: Manual UAT re-run for items #3 and #4 (Cognitive Inspector + Brain Health live data)</name>
  <what-built>
    After T1–T5 land, the Cognitive Inspector at `/nous/[did]` should now succeed end-to-end against a running Brain (with BRAIN_HTTP_SECRET configured). The 5 drive bars should render real percentages (not 0). The audit event `operator.inspected` should fire on success and carry the header-derived operator_id `op:00000000-0000-4000-8000-000000000001` (or whatever NEXT_PUBLIC_STEWARD_OPERATOR_ID resolves to).

    UAT items #1, #2, #5 from 25a-HUMAN-UAT.md are NOT affected by this gap-closure (they cover Firehose, Allowlist Monitor, and /humans deep-link respectively — orthogonal surfaces). They remain in their existing "human-needed" state.
  </what-built>
  <how-to-verify>
    1. Confirm Grid is running on the rebuilt container: `docker compose ps grid` shows status "running" and the image was rebuilt within the last few minutes.
    2. Confirm Brain is running with `BRAIN_HTTP_SECRET` set in env.
    3. Open the Steward Console at `/nous/[id]` for any Nous that has been ticking (e.g. a Nous from the seeded roster).
    4. **UAT item #3 re-run — Cognitive Inspector:**
       - Open browser DevTools → Network tab. Reload the page.
       - Find the POST to `/api/v1/operator/nous/.../cognitive-snapshot`. Inspect request headers:
         - Confirm `x-operator-tier: 3` is present
         - Confirm `x-operator-id` is present and matches `op:<uuid-v4>` shape (default `op:00000000-0000-4000-8000-000000000001`)
         - Confirm request body is empty (NOT `{tier:'H3', operator_id:'op:steward:default'}`)
       - Inspect response: status 200, body has 5 drive_levels keys all lowercase.
       - On the page itself, the Cognitive Inspector card should show:
         - 5 drive bars labeled HUNGER / CURIOSITY / SAFETY / BOREDOM / LONELINESS with NON-ZERO percentages reflecting real Brain state
         - skill_titles_topk list populated (or "No skills recorded." if the Nous has learned nothing — both are acceptable)
         - NO plaintext reflexion / creed / rule text anywhere on the card
    5. **UAT item #4 re-run — Brain Health 2x2 grid:**
       - On the same `/nous/[id]` page, the Brain Health 2x2 grid below the Cognitive Inspector should show the 4 cards (Tick Performance, Memory Stores, Drive & Sleep, Coherence) with live data exactly as before this plan. This surface was NOT modified by T4 (only the Cognitive Inspector drive bars were), but it shares the same page so re-verify it did not regress.
       - Tick Performance: p50/p95 numbers visible (or "Tick metrics unavailable." if NousRunner not yet sampling).
       - Memory Stores: 3 counts populated.
       - Drive & Sleep: mini drive bars + sleep stats.
       - Coherence: creed_violation_count visible.
    6. **Negative path spot-check:** Open DevTools console, run:
       ```javascript
       fetch('/api/v1/operator/nous/did:noesis:nous:any-running-did/cognitive-snapshot', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ tier: 'H3', operator_id: 'op:00000000-0000-4000-8000-000000000001' }),
       }).then(r => console.log(r.status));
       ```
       Expected: `401` (body-only request rejected because x-operator-tier header is missing).

    If all six checks pass → mark UAT items #3 and #4 as passing in 25a-HUMAN-UAT.md.
    If any check fails → block, capture the failure, and report back; do not mark UAT passing.
  </how-to-verify>
  <resume-signal>Type "uat-3-4-approved" if both UAT items #3 and #4 pass live; otherwise describe the failure (which check failed, what was observed) so a follow-up can be planned.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| HTTP client → Grid `/operator/*` route | Untrusted body crosses here; only server-trusted headers (`x-operator-tier`, `x-operator-id`) may set auth context |
| Grid → Brain HTTP `/cognitive-snapshot/{did}` | Brain trusts X-Brain-Secret; Grid trusts the closed-tuple key validator |
| Grid → Audit chain | Only the resolved (header-derived) operator_id may be written into `operator.inspected` payload |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25a-07-01 | Elevation of Privilege | `grid/src/api/operator/cognitive-snapshot.ts` | mitigate | T1 — read tier from `x-operator-tier` header only; reject if header missing/non-numeric (401) or < 3 (403). Body fields tier/operator_id ignored. T2 — regression test "rejects body-supplied tier when headers are missing" pins the contract. |
| T-25a-07-02 | Spoofing | `grid/src/api/operator/cognitive-snapshot.ts` audit emit | mitigate | T1 — audit payload.operator_id sourced from `x-operator-id` header, not body. T2 — regression test "audit payload.operator_id uses header value, not body value" pins it. |
| T-25a-07-03 | Tampering | `grid/src/api/operator/cognitive-snapshot-client.ts` Brain response parser | accept (already mitigated by Phase 25a-03) | Closed-tuple key validator at lines 130-155 already rejects any non-lowercase or extra drive_levels key. T3 adds explicit GAP-25a-3 regression tests to pin lowercase contract. |
| T-25a-07-04 | Information Disclosure | Audit payload for `operator.inspected` | accept (already mitigated by Phase 6) | Closed payload tuple `{tier, action, operator_id, target_did}` enforced by `appendOperatorEvent`; no cognitive state content. Plan does not change payload shape — only the source of operator_id. |
| T-25a-07-05 | Denial of Service | New 401/403 paths could be hot-looped by an unauthenticated caller | accept | 401/403 paths return immediately before any Brain call or DB query — cheapest possible path. No new resources allocated. Rate-limit is out of scope for this gap closure (orthogonal middleware concern). |
</threat_model>

<verification>
**Goal-backward check — does this plan close all 3 gaps?**

| Gap | Closed by | Verification |
|-----|-----------|--------------|
| GAP-25a-1 (H3 tier bypass) | T1 + T2 | Vitest tests assert body-supplied tier is rejected; header-derived operator_id appears in audit payload |
| GAP-25a-2 (invalid operator_id from Steward) | T4 (change A) | grep for `op:steward:default` returns zero matches; Steward sends valid UUID-v4 in `x-operator-id` header |
| GAP-25a-3 (uppercase drive index) | T4 (change B) + T3 (regression test) | grep for `drive.toLowerCase()` returns 1 match in Steward page; client validator regression test pins lowercase keys |

**Invariants preserved:**
- Allowlist delta = 0 → T5 step 5 grep
- Sole-producer for `operator.inspected` = 1 call site → T5 step 6 grep
- CI plaintext gate still 0 violations → T5 step 3
- All other operator routes (clock, governance, telos, delete, memory-query, export) NOT touched → only 5 files in `files_modified`
</verification>

<success_criteria>
1. All 3 Codex gaps closed and pinned by automated tests (T1+T2+T3+T4).
2. Full grid vitest suite green; full brain pytest suite green for cognitive_snapshot; CI plaintext gate green (T5).
3. Allowlist invariant holds: zero new audit events added (T5 step 5).
4. Sole-producer invariant holds: exactly one `appendOperatorEvent` call in cognitive-snapshot.ts (T5 step 6).
5. Grid Docker container rebuilt and running on the patched image (T5 step 7).
6. Manual UAT items #3 and #4 re-verified in a live Steward + Grid + Brain environment (T6).
7. CLAUDE.md "Surgical Changes" rule honored: only 5 files modified (3 source + 2 test), no formatting churn, no unrelated edits.
8. Documentation Sync Rule: when this plan lands, update STATE.md current focus + ROADMAP.md Phase 25a plan list to include `25a-07-codex-gap-closure-PLAN.md`, and update VERIFICATION.md status from `gaps_found` → `verified` (in the SUMMARY step).
</success_criteria>

<output>
After completion, create `.planning/phases/25a-observer-surfaces/25a-07-SUMMARY.md` documenting:
- Which 3 gaps were closed and how
- Regression tests added (3 new test cases in cognitive-snapshot.test.ts, 2 in cognitive-snapshot-client.test.ts)
- Confirmation that allowlist + sole-producer invariants held
- UAT item #3 and #4 result (from T6)
- Note that body-trust → header-trust migration is scoped to cognitive-snapshot only; peer operator routes (clock, governance, telos, delete, memory-query, export) still use the body-trust pattern and will need a coordinated follow-up phase to migrate uniformly. That coordination is out of scope for 25a gap closure.
</output>
