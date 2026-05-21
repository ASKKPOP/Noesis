---
phase: 25a
plan: 05
type: execute
wave: 3
depends_on: [25a-01, 25a-03]
files_modified:
  - grid/src/api/operator/cognitive-snapshot-client.ts
  - grid/src/api/operator/cognitive-snapshot.ts
  - grid/src/api/server.ts
  - grid/test/operator/cognitive-snapshot-client.test.ts
  - grid/test/operator/cognitive-snapshot.test.ts
autonomous: true
requirements: [OBS-COGNITIVE-INSPECTOR]
tags: [cognitive-snapshot, h3-proxy, operator-inspected, brain-http-client]
user_setup: []
must_haves:
  truths:
    - "POST /api/v1/operator/nous/:did/cognitive-snapshot is H3+ gated via validateTierBody"
    - "Endpoint returns 400 invalid_did, 404 unknown_nous, 410 tombstoned, 503 brain_unavailable per the ladder"
    - "Endpoint emits operator.inspected with action='cognitive_snapshot' on SUCCESS only"
    - "operator.inspected emission uses the existing appendOperatorEvent — sole-producer invariant preserved"
    - "Response merges Brain endpoint 5 keys + Grid-computed creed_violation_count = 6 total keys"
    - "fetchCognitiveSnapshot validates response is exactly the 5 expected keys (closed-tuple structural plaintext defense)"
    - "BrainUnreachableError / BrainUnknownDidError / BrainMalformedResponseError map to 503"
  artifacts:
    - path: "grid/src/api/operator/cognitive-snapshot-client.ts"
      provides: "fetchCognitiveSnapshot(brainBaseUrl, did, brainFetch, timeoutMs) — injectable HTTP client"
      contains: "fetchCognitiveSnapshot"
    - path: "grid/src/api/operator/cognitive-snapshot.ts"
      provides: "registerCognitiveSnapshotRoute — H3+ Fastify route handler"
      contains: "registerCognitiveSnapshotRoute"
  key_links:
    - from: "grid/src/api/operator/cognitive-snapshot.ts"
      to: "grid/src/audit/operator-events.ts appendOperatorEvent"
      via: "import + emit on success path"
      pattern: "appendOperatorEvent.*operator\\.inspected"
    - from: "grid/src/api/operator/cognitive-snapshot.ts"
      to: "grid/src/api/operator/cognitive-snapshot-client.ts fetchCognitiveSnapshot"
      via: "Grid → Brain HTTP proxy"
      pattern: "fetchCognitiveSnapshot"
    - from: "grid/src/api/operator/cognitive-snapshot.ts"
      to: "grid/src/audit/chain.ts AuditChain.query"
      via: "compute creed_violation_count via query({eventType: 'nous.creed_violation', actorDid: did})"
      pattern: "nous\\.creed_violation"
---

<objective>
Bridge the Brain HTTP endpoint (shipped in Plan 03) to the Steward UI (Plan 06) by adding the Grid-side proxy with H3+ tier gate, DID validation, tombstone check, sole-producer `operator.inspected` emission, and Grid-computed `creed_violation_count` field.

Purpose: Steward NEVER calls Brain directly (D-25a-04 architectural lock). All cognitive snapshot reads go through this Grid endpoint, which:
- enforces H3+ tier
- audits every read via `operator.inspected` (existing event — no allowlist delta)
- combines the Brain's 5-key response with a Grid-computed 6th field (`creed_violation_count` aggregated from `nous.creed_violation` audit events) before returning to Steward
- structurally validates the Brain response via closed-tuple schema check (Pitfall defense against accidental plaintext leak)

Output: HTTP client + route + integration tests with mock Brain.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/25a-observer-surfaces/25a-CONTEXT.md
@.planning/phases/25a-observer-surfaces/25a-RESEARCH.md
@.planning/phases/25a-observer-surfaces/25a-PATTERNS.md
@.planning/phases/25a-observer-surfaces/25a-01-foundation-PLAN.md
@.planning/phases/25a-observer-surfaces/25a-03-brain-http-server-PLAN.md
@grid/src/api/operator/memory-query.ts
@grid/src/api/operator/brain-hash-state-client.ts
@grid/src/api/operator/brain-http-errors.ts
@grid/src/api/operator/_validation.ts
@grid/src/audit/operator-events.ts
@grid/src/registry/tombstone-check.ts

<interfaces>
<!-- Brain endpoint response (from Plan 03 — exact 5 keys, sorted) -->
```typescript
type BrainCognitiveSnapshot = {
  drive_levels: { hunger: number; curiosity: number; safety: number; boredom: number; loneliness: number };
  last_sleep_tick: number;
  reflexion_count: number;
  rule_count: number;
  skill_titles_topk: string[];
};
const EXPECTED_BRAIN_KEYS = ['drive_levels', 'last_sleep_tick', 'reflexion_count', 'rule_count', 'skill_titles_topk'] as const; // sorted
```

<!-- Grid endpoint final response (6 keys) -->
```typescript
type CognitiveSnapshotResponse = BrainCognitiveSnapshot & { creed_violation_count: number };
```

<!-- Existing helpers (REUSE — do not redeclare) -->
import { validateTierBody } from './_validation.js';            // returns {ok, error, tier, operator_id} | {ok: false, error}
import { tombstoneCheck, TombstonedDidError } from '../../registry/tombstone-check.js';
import { appendOperatorEvent } from '../../audit/operator-events.js';
import { BrainUnreachableError, BrainUnknownDidError, BrainMalformedResponseError } from './brain-http-errors.js';
import { DID_REGEX } from '../server.js';

<!-- Endpoint contract -->
POST /api/v1/operator/nous/:did/cognitive-snapshot
  body: { tier: 'H3', operator_id: string }
  200: CognitiveSnapshotResponse (6 keys)
  400: { error: 'invalid_did' } | { error: 'invalid_tier' } | { error: 'invalid_operator_id' }
  404: { error: 'unknown_nous' }
  410: { error: 'tombstoned' }
  503: { error: 'brain_unavailable' }
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: fetchCognitiveSnapshot HTTP client with closed-tuple schema validation</name>
  <read_first>
    - grid/src/api/operator/brain-hash-state-client.ts (full file — pattern to clone: injectable brainFetch, AbortController timeout, error class mapping, schema validation)
    - grid/src/api/operator/brain-http-errors.ts (shipped in Plan 01 — confirm imports)
    - .planning/phases/25a-observer-surfaces/25a-PATTERNS.md §"cognitive-snapshot-client.ts" (lines 207-256)
    - .planning/phases/25a-observer-surfaces/25a-03-brain-http-server-PLAN.md (response shape reference)
  </read_first>
  <behavior>
    - `fetchCognitiveSnapshot(brainBaseUrl, did, brainFetch, timeoutMs=5000)` returns `Promise<BrainCognitiveSnapshot>`
    - GET request to `${brainBaseUrl}/cognitive-snapshot/${encodeURIComponent(did)}`
    - Sends `X-Brain-Secret` header from `process.env.BRAIN_HTTP_SECRET ?? ''`
    - AbortController timeout (default 5s)
    - Network error / abort → throws `BrainUnreachableError`
    - HTTP non-200 → throws `BrainUnknownDidError(did, status)`
    - JSON parse failure → throws `BrainMalformedResponseError`
    - Closed-tuple schema check: sorted keys MUST equal exactly `['drive_levels', 'last_sleep_tick', 'reflexion_count', 'rule_count', 'skill_titles_topk']`; any extra/missing key → `BrainMalformedResponseError`
    - Type-level validation: `drive_levels` is object with 5 numeric keys; `skill_titles_topk` is string array
  </behavior>
  <action>
    1. Create `grid/src/api/operator/cognitive-snapshot-client.ts`. Clone the structure of `brain-hash-state-client.ts`. Key changes:
       - Import errors from `./brain-http-errors.js`
       - URL builder: `const url = \`${brainBaseUrl}/cognitive-snapshot/${encodeURIComponent(did)}\`;`
       - Header: `'X-Brain-Secret': process.env.BRAIN_HTTP_SECRET ?? ''`
       - `EXPECTED_KEYS` constant: `['drive_levels', 'last_sleep_tick', 'reflexion_count', 'rule_count', 'skill_titles_topk'] as const` (alphabetical/sorted)
       - After JSON parse: sort `Object.keys(body)` and compare element-wise to EXPECTED_KEYS
       - Validate `drive_levels` is object with exactly `['boredom','curiosity','hunger','loneliness','safety']` keys
       - Validate `skill_titles_topk` is `Array<string>`
    2. Add JSDoc:
       ```
       /**
        * Fetch a Brain cognitive snapshot via HTTP.
        *
        * SECURITY: The closed-tuple key check (EXPECTED_KEYS) is the STRUCTURAL defense against
        * accidental plaintext leak from the Brain endpoint (D-25a-05). If the Brain response includes
        * an extra key (e.g., 'reflexion_text'), this client throws BrainMalformedResponseError and
        * the Grid proxy returns 503. Do NOT relax this check.
        */
       ```
    3. Create `grid/test/operator/cognitive-snapshot-client.test.ts`:
       - Inject mock `brainFetch` returning 200 + valid 5-key response → resolves with shape match
       - Inject mock returning 401 → throws BrainUnknownDidError
       - Inject mock throwing → throws BrainUnreachableError
       - Inject mock returning 200 + invalid JSON → throws BrainMalformedResponseError
       - Inject mock returning 200 + 6 keys (extra `reflexion_text`) → throws BrainMalformedResponseError (CRITICAL test — the structural plaintext defense)
       - Inject mock returning 200 + missing key (only 4) → throws BrainMalformedResponseError
       - Inject mock returning 200 + drive_levels missing a drive → throws BrainMalformedResponseError
       - Timeout: mock fetch hangs > timeoutMs → throws BrainUnreachableError
       - Confirms X-Brain-Secret header is sent (assert on mock call args)
    4. Run: `cd grid && npx vitest run test/operator/cognitive-snapshot-client.test.ts --reporter=verbose`
    5. Run plaintext gate: `node scripts/check-cognitive-snapshot-plaintext.mjs` — must exit 0
  </action>
  <verify>
    <automated>cd grid && npx vitest run test/operator/cognitive-snapshot-client.test.ts --reporter=verbose && cd .. && node scripts/check-cognitive-snapshot-plaintext.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `test -f grid/src/api/operator/cognitive-snapshot-client.ts`
    - `grep -c "fetchCognitiveSnapshot" grid/src/api/operator/cognitive-snapshot-client.ts` returns ≥1
    - `grep -n "EXPECTED_KEYS" grid/src/api/operator/cognitive-snapshot-client.ts` shows the closed-tuple constant
    - `grep -nE "drive_levels.*last_sleep_tick.*reflexion_count.*rule_count.*skill_titles_topk" grid/src/api/operator/cognitive-snapshot-client.ts` confirms sorted ordering in EXPECTED_KEYS
    - `grep -n "X-Brain-Secret" grid/src/api/operator/cognitive-snapshot-client.ts` confirms header
    - `grep -E "reflexion_text|creed_text|skill_body|lore_body|whisper_plaintext|rule_text" grid/src/api/operator/cognitive-snapshot-client.ts` returns ZERO matches (no forbidden keys in client code)
    - vitest passes
    - check-cognitive-snapshot-plaintext.mjs exits 0
  </acceptance_criteria>
  <done>HTTP client shipped with closed-tuple structural plaintext defense; full error-class coverage; CI gate green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: H3+ Grid proxy route with operator.inspected emission</name>
  <read_first>
    - grid/src/api/operator/memory-query.ts (entire file — the H2 analog; clone the structure for H3)
    - grid/src/api/operator/_validation.ts (full file — validateTierBody signature and return type)
    - grid/src/audit/operator-events.ts (full file — appendOperatorEvent signature)
    - grid/src/registry/tombstone-check.ts (full file — tombstoneCheck signature, TombstonedDidError shape)
    - grid/src/audit/chain.ts (find query method — confirm `{eventType, actorDid}` filter works for counting `nous.creed_violation`)
    - grid/src/api/server.ts (find GridServices type and where operator routes are registered)
    - .planning/phases/25a-observer-surfaces/25a-PATTERNS.md §"cognitive-snapshot.ts" (lines 165-203)
  </read_first>
  <behavior>
    - Route: `POST /api/v1/operator/nous/:did/cognitive-snapshot`
    - Body validation via `validateTierBody(body, 'H3')` — 400 with returned error if invalid
    - DID validation via `DID_REGEX.test(did)` — 400 `invalid_did`
    - Tombstone check via `tombstoneCheck(services.registry, did)` — 410 `tombstoned`
    - Runner existence check (optional per pattern; recommended for parity with memory-query) — 404 `unknown_nous`
    - Proxy to Brain via `fetchCognitiveSnapshot(brainBaseUrl, did, brainFetch)`
      - `brainBaseUrl` source: `services.brainBaseUrlFor(did)` if exists, else fallback to env (`BRAIN_HTTP_BASE_URL`); confirm via reading server.ts
      - `brainFetch` injected via `services.brainFetch ?? fetch` (test injectability)
      - Brain errors → 503 `brain_unavailable`
    - Compute `creed_violation_count`: `services.audit.query({eventType: 'nous.creed_violation', actorDid: did}).length`
    - Emit `operator.inspected` via `appendOperatorEvent(services.audit, 'operator.inspected', v.operator_id, { tier: v.tier, action: 'cognitive_snapshot', operator_id: v.operator_id, target_did: did }, did)` — ONLY on success path, AFTER Brain call succeeds and creed count computed
    - Return 200 with `{ ...brainSnapshot, creed_violation_count }`
    - Error ladder: 400 / 404 / 410 / 503 only — NO 500 (matches memory-query.ts:18-24 discipline)
    - Audit emit ONLY on success — error paths must NOT emit
  </behavior>
  <action>
    1. Create `grid/src/api/operator/cognitive-snapshot.ts` exporting `registerCognitiveSnapshotRoute(app: FastifyInstance, services: GridServices): void`. Clone the structure of `grid/src/api/operator/memory-query.ts` block-by-block:
       - Lines 39-46 (route registration) → POST `/api/v1/operator/nous/:did/cognitive-snapshot`
       - Lines 48-53 (validateTierBody) → change `'H2'` to `'H3'`
       - Lines 56-60 (DID regex) → keep as-is, error `invalid_did`
       - Lines 63-73 (tombstoneCheck) → keep as-is, error `tombstoned`
       - Lines 76-91 (body validation for `query` field) → DELETE (cognitive-snapshot has no extra body fields beyond tier+operator_id)
       - Lines 94-98 (runner lookup) → keep, 404 `unknown_nous`
       - Lines 101-109 (bridge health) → adapt: instead of checking RPC bridge, we check Brain HTTP. Wrap fetch in try/catch.
       - Lines 113-124 (RPC call) → REPLACE with: `const brainSnapshot = await fetchCognitiveSnapshot(brainBaseUrl, did, services.brainFetch ?? fetch);` inside try/catch that maps Brain errors → 503 `brain_unavailable`
       - NEW block (after Brain success): compute creed_violation_count via audit query
       - Lines 127-138 (appendOperatorEvent) → change `action: 'inspect'` → `action: 'cognitive_snapshot'`; tier from `v.tier` (will be `'H3'`)
       - Line 141 (return) → `return { ...brainSnapshot, creed_violation_count };`
    2. Register the route in `grid/src/api/server.ts`: `registerCognitiveSnapshotRoute(app, services);`
    3. Decision: brainBaseUrl resolution mechanism. Default rule: read `process.env.BRAIN_HTTP_BASE_URL` (e.g., `http://brain-${gridName}:8090`). If a per-Nous Brain base URL exists in services (look for analog in `brain-hash-state-client.ts` call sites — likely `services.brainBaseUrl` or env), reuse. Document the resolved choice in SUMMARY. Auth mechanism: shared secret per Plan 03 (CONTEXT D-25a Claude's Discretion: shared secret `BRAIN_HTTP_SECRET` matching the GRID_WS_SECRET pattern).
    4. Create `grid/test/operator/cognitive-snapshot.test.ts`:
       - 400 on invalid tier (e.g., body `{tier: 'H2', operator_id: 'op:foo'}`)
       - 400 on invalid operator_id format
       - 400 on invalid DID
       - 410 on tombstoned DID
       - 404 on unknown_nous (no runner)
       - 503 when mock brainFetch throws (BrainUnreachableError)
       - 503 when mock brainFetch returns malformed (BrainMalformedResponseError)
       - 200 with merged 6-key response when Brain returns valid 5 keys
       - **operator.inspected ONLY on success:** with valid 200 call → confirm 1 new `operator.inspected` entry in audit chain with payload `{tier: 'H3', action: 'cognitive_snapshot', operator_id, target_did}`
       - **No emission on error:** with mock brainFetch throwing → confirm ZERO new `operator.inspected` entries
       - **creed_violation_count merge:** seed audit with 3 `nous.creed_violation` entries actorDid=did → response.creed_violation_count === 3
    5. Run: `cd grid && npx vitest run test/operator/cognitive-snapshot.test.ts --reporter=verbose`
    6. Full suite: `cd grid && npm run test`
    7. Plaintext gate: `node scripts/check-cognitive-snapshot-plaintext.mjs` exits 0
  </action>
  <verify>
    <automated>cd grid && npx vitest run test/operator/cognitive-snapshot.test.ts --reporter=verbose && npm run test 2>&1 | tail -10 && cd .. && node scripts/check-cognitive-snapshot-plaintext.mjs</automated>
  </verify>
  <acceptance_criteria>
    - `test -f grid/src/api/operator/cognitive-snapshot.ts`
    - `grep -n "validateTierBody.*'H3'" grid/src/api/operator/cognitive-snapshot.ts` returns a match
    - `grep -n "action: 'cognitive_snapshot'" grid/src/api/operator/cognitive-snapshot.ts` returns 1 match (single emission point)
    - `grep -c "appendOperatorEvent" grid/src/api/operator/cognitive-snapshot.ts` returns 1 (single sole-producer call — Pitfall 4)
    - `grep -n "nous.creed_violation" grid/src/api/operator/cognitive-snapshot.ts` confirms creed count aggregation
    - `grep -n "registerCognitiveSnapshotRoute" grid/src/api/server.ts` shows import + invocation
    - `grep -E "reflexion_text|creed_text|skill_body|lore_body|whisper_plaintext|rule_text" grid/src/api/operator/cognitive-snapshot.ts` returns ZERO matches
    - vitest passes new test file
    - `cd grid && npm run test` exits 0
    - `cd grid && npx tsc --noEmit` exits 0
    - `node scripts/check-cognitive-snapshot-plaintext.mjs; echo $?` prints 0
  </acceptance_criteria>
  <done>H3 proxy ships with full ladder; operator.inspected emitted only on success; creed count merged; no allowlist delta; CI gate green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Steward → Grid (HTTP) | H3 operator query crosses here; tier + operator_id validated |
| Grid → Brain (HTTP) | Internal-network call; X-Brain-Secret header for authentication |
| Audit chain ← appendOperatorEvent | Every successful query writes one `operator.inspected` event |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25a-05-01 | Elevation of Privilege | Non-H3 operator accesses cognitive-snapshot | mitigate | `validateTierBody(body, 'H3')` rejects with 400; mirrored from memory-query.ts H2 pattern; tested |
| T-25a-05-02 | Information Disclosure | Brain endpoint accidentally returns plaintext key (D-25a-05) | mitigate | Closed-tuple schema check in cognitive-snapshot-client.ts throws BrainMalformedResponseError on any unexpected key → 503; structural defense independent of regex |
| T-25a-05-03 | Repudiation | Operator queries cognitive-snapshot without audit trail | mitigate | `appendOperatorEvent('operator.inspected', ..., {tier, action: 'cognitive_snapshot', operator_id, target_did})` on SUCCESS path; tested both inclusion (on success) and exclusion (on error) |
| T-25a-05-04 | Tampering | Duplicate `operator.inspected` emitter created (violates sole-producer) | mitigate | Reuse existing `appendOperatorEvent` from `grid/src/audit/operator-events.ts`; CI test asserts single import + single call site in this file (Pitfall 4) |
| T-25a-05-05 | Denial of Service | Brain HTTP server down → 503 floods | accept | Standard 503 ladder; client should backoff; not blocking other operator flows |
| T-25a-05-06 | Information Disclosure | Tombstoned DID's cognitive state queried | mitigate | tombstoneCheck enforces 410 before Brain call; tested |
| T-25a-05-07 | Information Disclosure | Error paths emit `operator.inspected` (false audit trail) | mitigate | appendOperatorEvent called ONLY after Brain success + creed count; test asserts zero emissions on error paths |
| T-25a-05-08 | Spoofing | Steward sends fake operator_id to bypass audit attribution | accept | operator_id is operator-self-declared; matches existing H1-H5 pattern; tier still required; out-of-scope for 25a to introduce stronger auth |
</threat_model>

<verification>
- POST /api/v1/operator/nous/:did/cognitive-snapshot ships with full 400/404/410/503 ladder
- operator.inspected emitted ONLY on success path
- Single appendOperatorEvent call site (sole-producer invariant — Pitfall 4)
- creed_violation_count merged from Grid audit chain
- Closed-tuple schema check enforced in client
- Zero allowlist delta (reuses existing operator.inspected)
- All tests green, CI plaintext gate green
</verification>

<success_criteria>
- D-25a-04 (H3 gate + audit emission): SHIPPED
- D-25a-02 (Grid proxy to Brain): SHIPPED
- D-25a-05 (structural plaintext defense via closed-tuple): SHIPPED at client layer
- Allowlist delta still 0 (verified — no new event types in allowlist)
- Sole-producer invariant preserved
</success_criteria>

<output>
After completion, create `.planning/phases/25a-observer-surfaces/25a-05-SUMMARY.md` documenting:
- Endpoint URL + body shape + response shape (6 keys)
- Auth choice for Grid↔Brain: shared secret `BRAIN_HTTP_SECRET` (per CONTEXT Claude's Discretion + RESEARCH recommendation)
- brainBaseUrl resolution mechanism chosen
- Decision IDs implemented: D-25a-02, D-25a-04, D-25a-05 (structural)
- operator.inspected sole-producer confirmation (grep count = 1)
- Allowlist enumeration unchanged (verified)
</output>
