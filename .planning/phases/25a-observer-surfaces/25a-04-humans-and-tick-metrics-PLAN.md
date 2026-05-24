---
phase: 25a
plan: 04
type: execute
wave: 2
depends_on: [25a-01]
files_modified:
  - grid/src/api/routes/humans.ts
  - grid/src/api/routes/tick-metrics.ts
  - grid/src/integration/nous-runner.ts
  - grid/src/api/server.ts
  - grid/test/api/humans.test.ts
  - grid/test/api/tick-metrics.test.ts
  - grid/test/integration/nous-runner-tick-latency.test.ts
autonomous: true
requirements: [OBS-HUMANS, OBS-BRAIN-HEALTH]
tags: [humans, tick-metrics, ring-buffer, audit-aggregation]
user_setup: []
must_haves:
  truths:
    - "GET /api/v1/humans/:did returns HumanRecord + last_active + nous_count + transfer_count"
    - "GET /api/v1/humans/:did returns 404 {error: 'unknown_human'} when DID not in HumanRegistry"
    - "GET /api/v1/humans/:did returns 400 {error: 'invalid_did'} when DID fails DID_REGEX"
    - "GET /api/v1/humans/:did/history returns {siwe_sessions, transfers, whispers_sent, regions_visited} arrays"
    - "GET /api/v1/nous/:did/tick-metrics returns {p50, p95, queue_depth, sample_count}"
    - "NousRunner records each tick duration into an in-memory ring buffer (capacity 100 ticks per Nous)"
    - "tick-metrics endpoint computes p50/p95 from the ring buffer; returns 0/0 when no samples"
    - "No new audit events added (allowlist delta remains 0)"
  artifacts:
    - path: "grid/src/api/routes/humans.ts"
      provides: "registerHumansRoutes — GET /api/v1/humans/:did and GET /api/v1/humans/:did/history"
      contains: "registerHumansRoutes"
    - path: "grid/src/api/routes/tick-metrics.ts"
      provides: "registerTickMetricsRoute — GET /api/v1/nous/:did/tick-metrics"
      contains: "registerTickMetricsRoute"
    - path: "grid/src/integration/nous-runner.ts"
      provides: "Per-Nous tick latency ring buffer + p50/p95 computation"
      contains: "tickLatencyBuffer"
  key_links:
    - from: "grid/src/api/routes/humans.ts"
      to: "grid/src/human/HumanRegistry.ts findByDid + audit chain query"
      via: "service injection"
      pattern: "humanRegistry\\.findByDid|audit\\.query"
    - from: "grid/src/api/routes/tick-metrics.ts"
      to: "grid/src/integration/nous-runner.ts NousRunner.getTickMetrics()"
      via: "runner registry lookup"
      pattern: "getTickMetrics"
---

<objective>
Ship two backend surfaces consumed by Steward UI (Plan 06):
1. **Humans backend** — `GET /api/v1/humans/:did` (profile) and `GET /api/v1/humans/:did/history` (transactions). The history endpoint solves the "AuditChain.query cannot filter by payload field" pitfall by doing payload-level filtering server-side for `human.transferred` and `nous.whispered`.
2. **Tick-metrics backend** — `GET /api/v1/nous/:did/tick-metrics` (p50, p95, queue depth). Backed by a new in-memory ring buffer in `NousRunner.sendTick()` — no new audit events, no persistence.

Purpose: Surface 5 (`/humans/[did]`) and metric family #1 of Surface 3 (Brain health) both require Grid endpoints that don't currently exist. This plan ships both in parallel with Plans 02 + 03.

Output: 3 new routes, NousRunner instrumentation, full test coverage. Zero audit chain modifications.
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
@grid/src/api/operator/memory-query.ts
@grid/src/api/server.ts
@grid/src/human/types.ts
@grid/src/human/HumanRegistry.ts
@grid/src/integration/nous-runner.ts
@grid/src/util/ring-buffer.ts
@grid/src/audit/chain.ts

<interfaces>
<!-- HumanRecord (grid/src/human/types.ts) -->
```typescript
interface HumanRecord {
    did: string;
    eth_address: string;
    email: string | null;
    grid_name: string | null;
    region: string | null;
    created_at: number;
}
```

<!-- HumanRegistry methods (grid/src/human/HumanRegistry.ts) — confirm by reading -->
```typescript
class HumanRegistry {
    findByDid(did: string): HumanRecord | null;
    // confirm via read_first
}
```

<!-- AuditChain.query (grid/src/audit/chain.ts) -->
```typescript
query(filter: { eventType?: string; actorDid?: string; targetDid?: string; limit?: number }): AuditEntry[];
// Does NOT support payload field filtering — server-side post-filter required
```

<!-- New endpoint contracts -->
GET /api/v1/humans/:did:
  200: { did, eth_address, grid_name, region, created_at, last_active, nous_count, transfer_count }
  400: { error: 'invalid_did' }
  404: { error: 'unknown_human' }

GET /api/v1/humans/:did/history:
  200: {
    siwe_sessions: Array<{ tick: number, createdAt: number, eventType: string }>,
    transfers: Array<{ tick: number, createdAt: number, asset: string, grid_name: string }>,
    whispers_sent: Array<{ tick: number, createdAt: number, to_did: string, ciphertext_hash: string }>,
    regions_visited: Array<{ tick: number, createdAt: number, region: string }>
  }

GET /api/v1/nous/:did/tick-metrics:
  200: { p50: number, p95: number, queue_depth: number, sample_count: number }   // ms
  400: { error: 'invalid_did' }
  404: { error: 'unknown_nous' }
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Humans REST routes (profile + history)</name>
  <read_first>
    - grid/src/human/types.ts (full file — HumanRecord shape)
    - grid/src/human/HumanRegistry.ts (full file — confirm findByDid + any other accessors)
    - grid/src/api/operator/memory-query.ts (full file — route registration shape, DID_REGEX usage, error ladder discipline 400/404/410/503)
    - grid/src/audit/chain.ts (find `query(...)` method — confirm filter fields supported)
    - grid/src/api/server.ts (read GridServices type definition + where audit + humanRegistry are wired into services)
    - .planning/phases/25a-observer-surfaces/25a-RESEARCH.md §"Surface 5: /humans/[did]" + data-source table (lines 313-355)
    - .planning/phases/25a-observer-surfaces/25a-PATTERNS.md §"humans.ts" (lines 259-277)
  </read_first>
  <behavior>
    `GET /api/v1/humans/:did`:
    - 400 if DID fails `DID_REGEX.test(did)`
    - 404 if `humanRegistry.findByDid(did)` returns null
    - 200 with: HumanRecord fields + `last_active` (createdAt of newest audit entry where actorDid === did, or null) + `nous_count` (count of registry nous with `humanOwner === did`) + `transfer_count` (count of audit entries with `eventType === 'human.transferred'` AND `payload.human_did === did`)

    `GET /api/v1/humans/:did/history`:
    - 400 if DID fails DID_REGEX
    - 404 if `humanRegistry.findByDid(did)` returns null
    - 200 with 4 arrays, each max 20 entries, sorted newest-first:
      - `siwe_sessions`: `audit.query({eventType: 'portal.auth.login', actorDid: did})` + same for `portal.auth.register`, merged + sorted
      - `transfers`: `audit.query({eventType: 'human.transferred'})` → server-side filter where `entry.payload.human_did === did` → map to `{tick, createdAt, asset, grid_name}`
      - `whispers_sent`: `audit.query({eventType: 'nous.whispered'})` → server-side filter where `entry.payload.from_did === did` → map to `{tick, createdAt, to_did, ciphertext_hash}`
      - `regions_visited`: `audit.query({eventType: 'nous.moved'})` → filter Nous DIDs whose owner is this human (cross-reference NousRegistry) → map to `{tick, createdAt, region}`. If `humanOwner` field absent or no matches → empty array.
  </behavior>
  <action>
    1. Create `grid/src/api/routes/humans.ts` exporting `registerHumansRoutes(app: FastifyInstance, services: GridServices): void` with both route handlers.
    2. Implement DID validation using `DID_REGEX` from `grid/src/api/server.ts` (confirm export name during read_first).
    3. For `transfer_count` on profile: use `audit.query({eventType: 'human.transferred'})` then `.filter(e => e.payload.human_did === did).length`. Limit query to a reasonable maximum (e.g., limit 10000) if AuditChain.query supports it.
    4. For `last_active`: `audit.query({actorDid: did, limit: 1})` → take `.createdAt` of first result (queries are typically newest-first; confirm in chain.ts read).
    5. For `nous_count`: iterate `services.nousRegistry.active()` (or equivalent), count where `humanOwner === did`. If the registry method differs, adapt during implementation.
    6. For history endpoint: implement all 4 arrays. Sort each by `createdAt` DESC. Slice to 20. The `regions_visited` array MAY be empty if no Nous have `humanOwner` set for this human (Phase 27 populates this field) — render as `[]`, no error.
    7. Register the routes in `grid/src/api/server.ts` alongside other REST route registrations: `registerHumansRoutes(app, services);`
    8. Create `grid/test/api/humans.test.ts` with cases:
       - 400 on invalid DID (e.g., `"not-a-did"`)
       - 404 on unknown DID (`did:noesis:human:0xabc...` not in registry)
       - 200 with all expected profile fields populated (seed HumanRegistry + audit events)
       - transfer_count: with 3 `human.transferred` events (2 matching payload.human_did) → transfer_count === 2
       - nous_count: with 2 Nous having `humanOwner === did` → nous_count === 2
       - last_active: with audit entries for this DID at createdAt 100, 200, 300 → last_active === 300
       - History: siwe_sessions correctly populated from `portal.auth.login` + `portal.auth.register`
       - History: transfers correctly populated via payload filter
       - History: whispers_sent correctly populated via from_did payload filter
       - History: regions_visited empty when no Nous owned by human
       - History: each array sliced to 20 with 25 source entries
    9. Run: `cd grid && npx vitest run test/api/humans.test.ts --reporter=verbose`
  </action>
  <verify>
    <automated>cd grid && npx vitest run test/api/humans.test.ts --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
    - `test -f grid/src/api/routes/humans.ts`
    - `grep -c "registerHumansRoutes" grid/src/api/routes/humans.ts` returns 1 (single export)
    - `grep -n "registerHumansRoutes" grid/src/api/server.ts` shows import + invocation
    - `grep -n "/api/v1/humans/:did" grid/src/api/routes/humans.ts` returns 2 matches (profile + history)
    - `grep -n "DID_REGEX" grid/src/api/routes/humans.ts` confirms validation
    - `grep -n "human.transferred\\|nous.whispered\\|portal.auth" grid/src/api/routes/humans.ts` shows payload filtering
    - `grep -n "appendOperatorEvent\\|audit\\.append\\|AuditChain.*append" grid/src/api/routes/humans.ts` returns ZERO matches (read-only, no audit emission)
    - vitest passes humans.test.ts
    - `cd grid && npm run test` exits 0 (no regression)
    - `cd grid && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Both humans endpoints shipped; payload-level filtering correct; 400/404 ladder enforced; no audit emissions; full test coverage.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: NousRunner tick-latency ring buffer + tick-metrics route</name>
  <read_first>
    - grid/src/integration/nous-runner.ts (full file — find `sendTick()` or equivalent tick-dispatch path; identify where to insert latency timing)
    - grid/src/util/ring-buffer.ts (confirm peek() shipped from Plan 01)
    - grid/src/api/server.ts (find where NousRunner instances are stored — likely `runners: Map<did, NousRunner>` or similar)
    - grid/src/api/operator/memory-query.ts (reference for `unknown_nous` 404 pattern when runner missing — lines 94-98)
    - .planning/phases/25a-observer-surfaces/25a-RESEARCH.md §"Surface 3 Brain Health" tick latency block (lines 269-279) + Assumption A7 (line 654)
    - .planning/phases/25a-observer-surfaces/25a-PATTERNS.md §"No Analog Found / tick-metrics.ts" (lines 537-539)
  </read_first>
  <behavior>
    - NousRunner has a per-instance `RingBuffer<number>` of tick durations (ms), capacity 100
    - On each `sendTick()` call, measure duration via `performance.now()` before/after the RPC and push to the buffer
    - NousRunner exposes `getTickMetrics(): { p50: number, p95: number, queue_depth: number, sample_count: number }`
      - `p50`/`p95`: computed from current ring buffer contents (sort ascending, index at 0.5 and 0.95 percentile); if empty buffer, both are 0
      - `queue_depth`: if NousRunner has a pendingTicks concept, return it; otherwise 0 (omit gracefully)
      - `sample_count`: current buffer size
    - `GET /api/v1/nous/:did/tick-metrics`:
      - 400 on invalid DID
      - 404 `unknown_nous` if no runner for DID
      - 200 with the getTickMetrics() result
  </behavior>
  <action>
    1. Edit `grid/src/integration/nous-runner.ts`:
       - Add private field: `private readonly tickLatencyBuffer = new RingBuffer<number>(100);` (import RingBuffer from `../util/ring-buffer.js`)
       - In `sendTick()` (or whatever method dispatches a tick to Brain), wrap the await:
         ```typescript
         const t0 = performance.now();
         try {
             // ... existing tick call ...
         } finally {
             const dt = performance.now() - t0;
             this.tickLatencyBuffer.push(dt);
         }
         ```
       - Add public method:
         ```typescript
         getTickMetrics(): { p50: number; p95: number; queue_depth: number; sample_count: number } {
             const samples = [...this.tickLatencyBuffer.peek()].sort((a, b) => a - b);
             const n = samples.length;
             if (n === 0) return { p50: 0, p95: 0, queue_depth: 0, sample_count: 0 };
             const p = (q: number) => samples[Math.min(n - 1, Math.floor(q * n))];
             return {
                 p50: Math.round(p(0.5) * 100) / 100,
                 p95: Math.round(p(0.95) * 100) / 100,
                 queue_depth: 0,  // populate if pendingTicks exists; else 0
                 sample_count: n,
             };
         }
         ```
       - If a queue/pending concept exists on NousRunner (discovered in read_first), populate `queue_depth` from it; otherwise leave at 0 with a code comment: `// queue_depth populated when NousRunner gains pending-tick concept`.
    2. Create `grid/src/api/routes/tick-metrics.ts` exporting `registerTickMetricsRoute(app: FastifyInstance, services: GridServices): void`:
       - `GET /api/v1/nous/:did/tick-metrics`
       - DID validation → 400 invalid_did
       - Look up runner via `services.runners.get(did)` (or equivalent) → 404 unknown_nous
       - Return `runner.getTickMetrics()`
    3. Register the route in `grid/src/api/server.ts`: `registerTickMetricsRoute(app, services);`
    4. Create `grid/test/integration/nous-runner-tick-latency.test.ts`:
       - Construct a NousRunner with a fake Brain bridge that resolves after 10ms
       - Call sendTick() 5 times
       - `getTickMetrics().sample_count === 5`, `p50` and `p95` are positive floats (≥10ms approximate)
       - After 101 sendTick calls, sample_count remains 100 (eviction)
    5. Create `grid/test/api/tick-metrics.test.ts`:
       - 400 on invalid DID
       - 404 when no runner for DID
       - 200 with `{p50, p95, queue_depth, sample_count}` numeric fields when runner exists
       - 200 with `{p50: 0, p95: 0, sample_count: 0}` when runner has no samples yet
    6. Run: `cd grid && npx vitest run test/integration/nous-runner-tick-latency.test.ts test/api/tick-metrics.test.ts --reporter=verbose`
    7. Full suite: `cd grid && npm run test`
  </action>
  <verify>
    <automated>cd grid && npx vitest run test/integration/nous-runner-tick-latency.test.ts test/api/tick-metrics.test.ts --reporter=verbose && npm run test 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "tickLatencyBuffer\\|RingBuffer<number>" grid/src/integration/nous-runner.ts` returns matches
    - `grep -c "getTickMetrics" grid/src/integration/nous-runner.ts` returns ≥1 (method defined)
    - `grep -n "performance.now()" grid/src/integration/nous-runner.ts` shows timing instrumentation
    - `test -f grid/src/api/routes/tick-metrics.ts`
    - `grep -n "/api/v1/nous/:did/tick-metrics" grid/src/api/routes/tick-metrics.ts` returns 1 match
    - `grep -n "registerTickMetricsRoute" grid/src/api/server.ts` shows import + invocation
    - `grep -n "audit\\.append\\|appendOperatorEvent\\|AuditChain.*append" grid/src/api/routes/tick-metrics.ts grid/src/integration/nous-runner.ts | grep -v "^.*://" | grep -v "//" ` shows NO new audit calls in tick-metrics route (existing sendTick calls in nous-runner unchanged)
    - vitest passes both new test files
    - `cd grid && npm run test` exits 0 (existing tick path not broken)
    - `cd grid && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>NousRunner instruments tick latency in-memory; getTickMetrics() returns correct p50/p95; route ships with 400/404 ladder; zero new audit events; no regression in existing tick flow.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Grid Fastify | REST `/api/v1/humans/:did[/history]`, `/api/v1/nous/:did/tick-metrics` |
| AuditChain query → response | Payload fields exposed via humans/history (transfers, whispers metadata) — must NOT expose ciphertext or plaintext |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25a-04-01 | Information Disclosure | Whispers history exposes ciphertext or plaintext | mitigate | History endpoint emits ONLY `ciphertext_hash` field (already the payload shape per allowlist pos 22); never reads or returns body content; no FORBIDDEN_KEY_PATTERN keys in response |
| T-25a-04-02 | Information Disclosure | Profile leaks email or PII not intended for operators | mitigate | Response shape is explicit allowlist of fields: did, eth_address, grid_name, region, created_at, last_active, nous_count, transfer_count. Email NOT included (per UI-SPEC + RESEARCH); confirmed by response-shape test |
| T-25a-04-03 | Information Disclosure | DID typo enumerates valid humans via 404 vs 200 differential | accept | Operator-only surface; DID enumeration acceptable risk; no auth bypass beyond Grid's existing operator gating |
| T-25a-04-04 | Denial of Service | History query scans entire audit chain on every call | mitigate | Use `audit.query` with `eventType` filter (indexed); cap per-array result to 20; future: add createdAt range filter when chain supports it |
| T-25a-04-05 | Denial of Service | Tick-metrics ring buffer grows unbounded | mitigate | Capacity 100 fixed; drop-oldest eviction; <1KB per NousRunner |
| T-25a-04-06 | Tampering | Tick-latency measurement injects code into sendTick path | mitigate | Wrap existing call in try/finally; no behavior change to RPC; existing sendTick tests must remain green |
| T-25a-04-07 | Elevation of Privilege | Tick-metrics endpoint requires no operator tier | accept | Operator-tier gating not required for read-only metrics (per CONTEXT — only cognitive-snapshot is H3-gated); reconsider if abuse observed |
</threat_model>

<verification>
- Both humans routes shipped with 400/404 ladder and zero audit emissions
- Payload-level filtering for `human.transferred`, `nous.whispered` works server-side
- NousRunner tick-latency ring buffer (capacity 100) measures every sendTick
- Tick-metrics endpoint returns p50/p95/queue_depth/sample_count
- All new tests pass; existing grid suite remains green
- No new audit events introduced
</verification>

<success_criteria>
- D-25a-18 (humans drill-down profile + history): backend SHIPPED
- D-25a-06 metric family #1 (tick latency p50/p95 + queue depth): SHIPPED
- D-25a-06 metric family #2-4: covered by existing audit endpoints — confirmed in code review (no new code needed)
- Payload-field filtering pitfall (RESEARCH Pitfall 3) resolved via dedicated history endpoint
- Allowlist delta remains 0
</success_criteria>

<output>
After completion, create `.planning/phases/25a-observer-surfaces/25a-04-SUMMARY.md` documenting:
- Three new route paths + their response shapes
- NousRunner instrumentation surface (getTickMetrics signature, ring buffer capacity)
- Confirmed: no new audit events; audit chain unmodified
- Decision IDs implemented: D-25a-06 (family 1), D-25a-18
- Note: families 2/3/4 of Brain health are served by existing `/api/v1/audit/trail` filtered queries from Steward UI (Plan 06) — no Grid changes needed
</output>
