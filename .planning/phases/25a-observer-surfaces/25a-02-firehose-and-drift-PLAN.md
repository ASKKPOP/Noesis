---
phase: 25a
plan: 02
type: execute
wave: 2
depends_on: [25a-01]
files_modified:
  - grid/src/audit/firehose-hub.ts
  - grid/src/audit/drift-detector.ts
  - grid/src/api/routes/audit-firehose.ts
  - grid/src/api/routes/audit-drift-alerts.ts
  - grid/src/api/server.ts
  - grid/test/audit/firehose-hub.test.ts
  - grid/test/audit/drift-detector.test.ts
  - grid/test/api/audit-firehose.test.ts
  - grid/test/api/drift-alerts.test.ts
autonomous: true
requirements: [OBS-FIREHOSE, OBS-ALLOWLIST-MONITOR]
tags: [firehose, drift-detector, websocket, allowlist-monitor]
user_setup: []
must_haves:
  truths:
    - "WsFirehoseHub forwards every allowlisted AuditEntry to every connected client (unfiltered fan-out)"
    - "WsFirehoseHub does NOT forward non-allowlisted entries"
    - "GET /api/v1/audit/firehose WebSocket upgrades, requires GRID_WS_SECRET when set, sends a hello frame then EventFrames"
    - "DriftDetector pushes a DriftAlert when AuditChain.onAppend fires with a non-allowlisted eventType"
    - "DriftDetector does NOT push when eventType is allowlisted"
    - "GET /api/v1/audit/drift-alerts returns {alerts: DriftAlert[]} using non-destructive peek()"
    - "Drift detector listener exceptions are swallowed (do not corrupt chain state)"
  artifacts:
    - path: "grid/src/audit/firehose-hub.ts"
      provides: "WsFirehoseHub class with onConnect, close, ServerSocket adapter"
      min_lines: 200
      contains: "class WsFirehoseHub"
    - path: "grid/src/audit/drift-detector.ts"
      provides: "DriftDetector class, DriftAlert type"
      contains: "class DriftDetector"
    - path: "grid/src/api/routes/audit-firehose.ts"
      provides: "registerAuditFirehoseRoute fastify-websocket registration"
    - path: "grid/src/api/routes/audit-drift-alerts.ts"
      provides: "registerDriftAlertsRoute REST handler returning ring buffer snapshot"
  key_links:
    - from: "grid/src/audit/firehose-hub.ts"
      to: "grid/src/audit/chain.ts AuditChain.onAppend"
      via: "constructor subscription"
      pattern: "audit\\.onAppend"
    - from: "grid/src/audit/drift-detector.ts"
      to: "grid/src/audit/broadcast-allowlist.ts isAllowlisted"
      via: "import + per-entry check"
      pattern: "isAllowlisted"
    - from: "grid/src/api/server.ts"
      to: "WsFirehoseHub + DriftDetector"
      via: "construction + preClose hook"
      pattern: "new WsFirehoseHub|new DriftDetector"
---

<objective>
Ship the Grid-side machinery for two of the five 25a surfaces:
1. **Live firehose backend** — WsFirehoseHub (unfiltered AuditChain → WebSocket fan-out) + WebSocket route `GET /api/v1/audit/firehose`
2. **Allowlist monitor backend** — DriftDetector (AuditChain.onAppend hook + ring buffer of non-allowlisted entries) + REST route `GET /api/v1/audit/drift-alerts`

Purpose: Both subsystems are pure observers over the existing AuditChain. The firehose backs the `/firehose` Steward page (D-25a-14). The drift detector is the runtime defense-in-depth layer against allowlist violations (D-25a-16), complementing the CI grep gate.

Output: two new Grid services wired into server.ts, two new routes registered, full unit + integration test coverage.
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
@grid/src/api/ws-hub.ts
@grid/src/audit/chain.ts
@grid/src/audit/broadcast-allowlist.ts
@grid/src/api/server.ts
@grid/src/api/ws-protocol.ts
@grid/src/util/ring-buffer.ts

<interfaces>
<!-- From AuditChain.onAppend (grid/src/audit/chain.ts) -->
```typescript
onAppend(listener: (entry: AuditEntry) => void): Unsubscribe;
// Listener fires AFTER commit, synchronously, exceptions swallowed.
// loadEntries() (restore path) does NOT fire listeners — drift detector is live-only.
```

<!-- From broadcast-allowlist.ts -->
```typescript
export function isAllowlisted(eventType: string): boolean;
```

<!-- From ws-hub.ts ServerSocket adapter (reuse — do not redeclare) -->
```typescript
export interface ServerSocket {
    readonly bufferedAmount: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    on(event: 'message' | 'close' | 'error', cb: (...args: any[]) => void): void;
}
```

<!-- AuditEntry shape (chain.ts) -->
```typescript
interface AuditEntry {
    id: string;
    eventType: string;
    actorDid: string;
    targetDid: string | null;
    payload: Record<string, unknown>;
    createdAt: number;
    // ...
}
```

<!-- RingBuffer.peek (added in Plan 01) -->
```typescript
peek(): readonly T[]; // Non-destructive FIFO snapshot
```

<!-- GridServices type (server.ts) MUST be extended with -->
```typescript
firehoseHub: WsFirehoseHub;
driftDetector: DriftDetector;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: WsFirehoseHub + DriftDetector services</name>
  <read_first>
    - grid/src/api/ws-hub.ts (entire 387 lines — primary analog for fan-out, ClientConnection backpressure, onAppend subscription, lifecycle close())
    - grid/src/audit/chain.ts (read enough to confirm `onAppend(listener)` signature and Unsubscribe return type — search for `onAppend`)
    - grid/src/audit/broadcast-allowlist.ts (lines 1-80 for `isAllowlisted` + `ALLOWLIST_MEMBERS`)
    - grid/src/util/ring-buffer.ts (full file — confirm peek() landed from Plan 01)
    - grid/src/api/ws-protocol.ts (full file — wire frame types for hello/event frames)
    - .planning/phases/25a-observer-surfaces/25a-PATTERNS.md §"firehose-hub.ts" + §"drift-detector.ts" (lines 44-126)
    - grid/test/ (look for `ws-hub.test.ts` or similar to clone test structure)
  </read_first>
  <behavior>
    WsFirehoseHub:
    - On construct: subscribes to `audit.onAppend`
    - On each entry: if `isAllowlisted(entry.eventType)` is false → skip (no fan-out)
    - On each allowlisted entry: enqueue to every connected client (no filter, no sinceId replay)
    - On onConnect(socket): send a hello frame `{type: 'hello', serverTime, gridName}` then begin streaming
    - close(): unsubscribes from audit, sends Bye frames, closes all sockets, idempotent
    - Backpressure: ClientConnection ring buffer capacity 256; drops oldest on overflow (no DroppedFrame protocol — density-first)
    - Listener body wrapped in try/catch with swallow (defense-in-depth)

    DriftDetector:
    - On construct(audit, capacity=256): subscribes to `audit.onAppend`
    - On each entry: if `isAllowlisted(entry.eventType)` is true → skip
    - On each non-allowlisted entry: push `{event_type, actor_did, tick, detected_at}` to ring buffer
    - `tick` extracted from `entry.payload['tick']` as number; fallback to 0 if absent/non-numeric
    - `detected_at` is `entry.createdAt`
    - snapshot(): returns `RingBuffer.peek()` (non-destructive)
    - close(): unsubscribes, idempotent
    - Listener body wrapped in try/catch with swallow
  </behavior>
  <action>
    1. Create `grid/src/audit/firehose-hub.ts`. Clone `grid/src/api/ws-hub.ts` structure as follows:
       - Import `ServerSocket` from `../api/ws-hub.js` (re-use, do NOT redeclare)
       - Strip ALL filter logic: remove `filters`, `matches()`, `setFilters*`, `globMatch`, `droppedMin`, `droppedMax`, `DroppedFrame` emission
       - Strip `sinceId` replay logic (density-first design, no replay)
       - Keep: `ClientConnection` inner class with RingBuffer<AuditEntry>, `enqueue`, `tryDrain`, `trySend`
       - Keep: hello frame on connect (drop `lastEntryId` field)
       - Keep: two-phase close() (Bye → setImmediate yield → socket close)
       - Default buffer capacity: 256 (match WsHub's DEFAULT_BUFFER_CAPACITY)
       - Constructor signature: `constructor(audit: AuditChain, gridName: string)`
       - Public methods: `onConnect(socket: ServerSocket): void`, `close(): Promise<void>`, `get clientCount(): number`
    2. Create `grid/src/audit/drift-detector.ts`. Pattern per 25a-PATTERNS.md lines 85-121. Exports:
       ```typescript
       export interface DriftAlert {
         event_type: string;
         actor_did: string;
         tick: number;
         detected_at: number;
       }
       export class DriftDetector {
         constructor(audit: AuditChain, capacity?: number);
         snapshot(): readonly DriftAlert[];
         close(): void;
       }
       ```
       - Default capacity 256
       - Use the inverted allowlist check: `if (isAllowlisted(entry.eventType)) return;` THEN push
       - Wrap entire listener body in try/catch (swallow)
       - snapshot() returns `this.buffer.peek()`
    3. Create `grid/test/audit/firehose-hub.test.ts`. Test cases:
       - Subscribes to AuditChain.onAppend on construct (use a mock AuditChain with `onAppend` spy)
       - Forwards allowlisted entry to a single connected client
       - Forwards allowlisted entry to multiple connected clients
       - Does NOT forward non-allowlisted entry (e.g., eventType="invented.event")
       - Sends hello frame on connect before any data
       - close() unsubscribes audit listener and closes sockets
       - Backpressure: when client cannot drain, entries enqueue up to 256, then oldest dropped (no crash)
    4. Create `grid/test/audit/drift-detector.test.ts`. Test cases:
       - Subscribes on construct
       - Non-allowlisted entry → snapshot() includes it (verify event_type, actor_did, tick, detected_at fields)
       - Allowlisted entry (e.g., `nous.spawned`) → NOT in snapshot
       - Tick fallback: if payload.tick missing or non-numeric → DriftAlert.tick === 0
       - peek() is non-destructive (poll twice, same result)
       - Listener exception → does not propagate; buffer state preserved
       - close() unsubscribes (subsequent appends do not affect buffer)
    5. Run `cd grid && npx vitest run test/audit/firehose-hub.test.ts test/audit/drift-detector.test.ts --reporter=verbose`
  </action>
  <verify>
    <automated>cd grid && npx vitest run test/audit/firehose-hub.test.ts test/audit/drift-detector.test.ts --reporter=verbose</automated>
  </verify>
  <acceptance_criteria>
    - `test -f grid/src/audit/firehose-hub.ts && test -f grid/src/audit/drift-detector.ts`
    - `grep -c "class WsFirehoseHub" grid/src/audit/firehose-hub.ts` returns 1
    - `grep -c "class DriftDetector" grid/src/audit/drift-detector.ts` returns 1
    - `grep -n "isAllowlisted" grid/src/audit/firehose-hub.ts grid/src/audit/drift-detector.ts` shows usage in BOTH files
    - `grep -n "filters\\|matches(\\|setFilters" grid/src/audit/firehose-hub.ts` returns ZERO matches (filter logic stripped)
    - `grep -n "ServerSocket" grid/src/audit/firehose-hub.ts` shows import from `../api/ws-hub.js` (not a redeclaration)
    - `grep -nE "try \\{" grid/src/audit/drift-detector.ts` shows at least one try/catch around the listener body
    - vitest exit code 0 on both new test files
    - `cd grid && npx tsc --noEmit` passes
  </acceptance_criteria>
  <done>Two new audit services compile, unit-test green, fan-out + drift behavior verified, no filter logic in firehose hub.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: WebSocket + REST route registration in Fastify</name>
  <read_first>
    - grid/src/api/server.ts (lines 1-100 for imports/types/GridServices; lines 440-540 for `app.register(fastifyWebsocket)` + existing `/ws/events` block + preClose hook)
    - grid/src/api/operator/memory-query.ts (for the bare-minimum REST route shape)
    - .planning/phases/25a-observer-surfaces/25a-PATTERNS.md §"audit-firehose.ts" + §"audit-drift-alerts.ts" (lines 130-159, 279-291)
    - .planning/phases/25a-observer-surfaces/25a-RESEARCH.md §"WebSocket Pattern in Grid" (lines 411-425) + §"Pitfall 5: WebSocket Route Registration Scope" (lines 542-545)
  </read_first>
  <behavior>
    - `GET /api/v1/audit/firehose` upgrades to WebSocket inside the `app.register(fastifyWebsocket, ...)` scope (Pitfall 5)
    - If `GRID_WS_SECRET` env var is set, the route requires it via Bearer header OR `?token=` query param (mirrors existing `/ws/events` lines 477-494)
    - On connect, the route constructs a `ServerSocket` adapter from the fastify-websocket socket and calls `firehoseHub.onConnect(adapter)`
    - `GET /api/v1/audit/drift-alerts` returns `{alerts: DriftAlert[]}` JSON, status 200
    - If `services.driftDetector` is absent (defensive — should never happen post-wiring), returns `{alerts: []}` with 200
    - server.ts construction wires both: `firehoseHub = new WsFirehoseHub(audit, gridName)`, `driftDetector = new DriftDetector(audit)`, and the existing `preClose` hook is extended to call `await firehoseHub.close(); driftDetector.close();`
    - GridServices type extended with `firehoseHub` and `driftDetector` fields
  </behavior>
  <action>
    1. Create `grid/src/api/routes/audit-firehose.ts`:
       ```typescript
       import type { FastifyInstance } from 'fastify';
       import type { WsFirehoseHub } from '../../audit/firehose-hub.js';
       import type { ServerSocket } from '../ws-hub.js';

       export function registerAuditFirehoseRoute(instance: FastifyInstance, firehoseHub: WsFirehoseHub): void {
         instance.get('/api/v1/audit/firehose', { websocket: true }, (socket, req) => {
           // 1. GRID_WS_SECRET gate — clone server.ts lines 477-494 verbatim
           // 2. ServerSocket adapter — clone server.ts lines 496-515 verbatim
           // 3. firehoseHub.onConnect(adapter)
         });
       }
       ```
       The route MUST be called INSIDE the existing `app.register(async (instance) => { ... })` block in server.ts (the same block that registers `/ws/events`).
    2. Create `grid/src/api/routes/audit-drift-alerts.ts`:
       ```typescript
       import type { FastifyInstance } from 'fastify';
       import type { GridServices } from '../server.js';

       export function registerDriftAlertsRoute(app: FastifyInstance, services: GridServices): void {
         app.get('/api/v1/audit/drift-alerts', async () => {
           if (!services.driftDetector) return { alerts: [] };
           return { alerts: services.driftDetector.snapshot() };
         });
       }
       ```
    3. Edit `grid/src/api/server.ts`:
       - Add imports: `WsFirehoseHub`, `DriftDetector`, `registerAuditFirehoseRoute`, `registerDriftAlertsRoute`
       - Extend `GridServices` interface (or the type wherever services are typed) with `firehoseHub: WsFirehoseHub; driftDetector: DriftDetector;`
       - In `buildServerWithHub` (or wherever WsHub is instantiated), after constructing `wsHub`, also construct: `const firehoseHub = new WsFirehoseHub(audit, gridName); const driftDetector = new DriftDetector(audit);`
       - Add both to services object
       - Inside the existing `app.register(async (instance) => { ... })` plugin scope (the block that registers `/ws/events`), call `registerAuditFirehoseRoute(instance, firehoseHub);` immediately after the existing `/ws/events` block
       - At top-level (alongside other REST routes), call `registerDriftAlertsRoute(app, services);`
       - In the existing `preClose` hook, after `await wsHub.close()`, add `await firehoseHub.close(); driftDetector.close();`
    4. Create `grid/test/api/audit-firehose.test.ts` (integration test using a real Fastify instance):
       - Start `buildServerWithHub` test server
       - Open WebSocket to `/api/v1/audit/firehose` (use `ws` package — already in grid deps from existing /ws/events tests)
       - Receive hello frame
       - Append an allowlisted event via the audit chain → client receives it
       - Append a non-allowlisted event → client does NOT receive
       - With GRID_WS_SECRET set, missing token → 1008 close; correct token → connects
    5. Create `grid/test/api/drift-alerts.test.ts`:
       - Inject a non-allowlisted entry → `GET /api/v1/audit/drift-alerts` returns `{alerts: [{event_type, actor_did, tick, detected_at}]}`
       - Repeat call → same response (non-destructive peek)
       - With no drift → `{alerts: []}`
    6. Run full grid suite to confirm no regression: `cd grid && npm run test`
  </action>
  <verify>
    <automated>cd grid && npx vitest run test/api/audit-firehose.test.ts test/api/drift-alerts.test.ts --reporter=verbose && npm run test 2>&1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `test -f grid/src/api/routes/audit-firehose.ts && test -f grid/src/api/routes/audit-drift-alerts.ts`
    - `grep -n "registerAuditFirehoseRoute\\|registerDriftAlertsRoute" grid/src/api/server.ts` returns at least 2 lines (import + call sites)
    - `grep -n "firehoseHub\\|driftDetector" grid/src/api/server.ts` shows both constructed and wired into services and preClose
    - `grep -n "/api/v1/audit/firehose" grid/src/api/routes/audit-firehose.ts` returns a match (correct route path)
    - `grep -n "/api/v1/audit/drift-alerts" grid/src/api/routes/audit-drift-alerts.ts` returns a match
    - audit-firehose.test.ts and drift-alerts.test.ts both pass
    - `cd grid && npm run test` exits 0 (no regression in existing 346+ tests)
    - `cd grid && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Both routes registered correctly (WS inside plugin scope), services wired in server.ts, preClose lifecycle extended, integration tests green, no regression.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Grid Fastify | WebSocket upgrade for `/firehose`; REST poll for `/audit/drift-alerts` |
| AuditChain → DriftDetector listener | Untrusted event_type strings; listener must not crash chain |
| Untrusted code path → AuditChain | Any module appending to chain — drift detector catches non-allowlisted attempts at runtime |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25a-02-01 | Information Disclosure | Firehose WS open without auth | mitigate | GRID_WS_SECRET gate cloned verbatim from /ws/events; reject with close 1008 if mismatched (per D-25a, internal-network operator surface) |
| T-25a-02-02 | Information Disclosure | Non-allowlisted internal events leak to firehose | mitigate | `isAllowlisted(entry.eventType)` gate in WsFirehoseHub before fan-out (defense-in-depth with ALLOWLIST) |
| T-25a-02-03 | Tampering | DriftDetector listener throws → corrupts chain state | mitigate | try/catch swallow around entire listener body (matches ws-hub.ts pattern) |
| T-25a-02-04 | Denial of Service | Firehose client never reads, buffer grows unbounded | mitigate | ClientConnection RingBuffer capacity 256; drop-oldest eviction; no per-client memory growth |
| T-25a-02-05 | Denial of Service | DriftDetector ring buffer overflows under sustained drift | accept | Capacity 256 entries; eviction is FIFO; defense-in-depth visibility tool, not prevention; CI grep gate remains primary |
| T-25a-02-06 | Elevation of Privilege | Drift detector emits to audit chain (recursive corruption) | mitigate | DriftDetector has ZERO `audit.append` calls — observer-only; only `peek()` from REST endpoint |
| T-25a-02-07 | Repudiation | Drift alert lost on restart | accept | `loadEntries()` does not fire onAppend listeners (documented in chain.ts); drift detection is live-only by design — CI grep gate covers static drift |
</threat_model>

<verification>
- WsFirehoseHub: subscribes to onAppend, fans-out allowlisted only, no filters
- DriftDetector: pushes non-allowlisted only, snapshot via peek() (non-destructive)
- `/api/v1/audit/firehose` registered inside fastify-websocket plugin scope (Pitfall 5)
- GRID_WS_SECRET gate applied
- `/api/v1/audit/drift-alerts` returns ring-buffer snapshot
- server.ts preClose extended to close both services
- Full grid test suite remains green
</verification>

<success_criteria>
- 2 new services + 2 new routes shipped
- Both services wired into server.ts with correct lifecycle
- All new tests pass; no regression in existing tests
- D-25a-14 (firehose), D-25a-16 (drift detector), D-25a-17 (ring buffer 256 default) implemented
</success_criteria>

<output>
After completion, create `.planning/phases/25a-observer-surfaces/25a-02-SUMMARY.md` documenting:
- WsFirehoseHub public API
- DriftDetector public API + DriftAlert shape
- Two new route paths
- server.ts wiring (services keys added, preClose extension)
- Decision IDs implemented: D-25a-14, D-25a-16, D-25a-17
- Confirmed: zero new audit events emitted by either service (observer-only)
</output>
