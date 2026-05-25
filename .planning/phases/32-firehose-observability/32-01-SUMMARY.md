---
phase: 32
plan: 01
subsystem: grid/audit
tags: [observability, firehose, metrics, frame-counters]
requirements: [OBS-05]

dependency_graph:
  requires: []
  provides:
    - WsFirehoseHub.stats() returning FirehoseStats (5-field cross-phase API contract)
    - HubMetricsSink interface (D-32-A2 callback protocol)
    - FirehoseStats interface (D-32-A4 cross-phase read contract)
  affects:
    - grid/src/audit/firehose-hub.ts (modified — new exports + wiring)
    - grid/test/firehose-frame-counters.test.ts (new — regression pin)
    - Plan 04 /health/detailed (consumes WsFirehoseHub.stats())
    - Phase 34 Steward UI (reads FirehoseStats via /health/detailed)

tech_stack:
  added: []
  patterns:
    - HubMetricsSink callback injection (keeps ClientConnection from reaching into hub internals)
    - size===capacity pre-check pattern for enqueue-side drop counting (D-32-A1)
    - Counter placement after socket.send inside try block (D-32-A3 / R-32-03)
    - Private metrics object mutated only via HubMetricsSink closures (D-32-A2)

key_files:
  modified:
    - grid/src/audit/firehose-hub.ts
  created:
    - grid/test/firehose-frame-counters.test.ts

decisions:
  - "hello frame (direct socket.send in onConnect) is NOT routed through trySend — frames_sent_total starts at 0 after connect, increments only on audit-event sends via ClientConnection.trySend"
  - "FakeSocket in test is self-contained (not imported) — matches existing firehose-hub.test.ts convention"
  - "Test corrected: plan task behavior description said frames_sent_total===1 after connect+1-event; hello frame exclusion is correct per D-32-A3 (only trySend path increments counter)"

metrics:
  duration: ~25 minutes
  completed: "2026-05-25T00:14:09Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 1
  files_created: 1
---

# Phase 32 Plan 01: Frame Counters on WsFirehoseHub Summary

Frame counters (`frames_sent_total`, `frames_dropped_total`, `last_frame_at`) plus `client_count` and `watermark_bytes` added to `WsFirehoseHub` via a new `stats(): FirehoseStats` method, wired through `HubMetricsSink` callbacks injected into `ClientConnection` at construction time.

## What Was Built

**`grid/src/audit/firehose-hub.ts` — modified**

Two new exported interfaces added after the import block:

- `HubMetricsSink` — callback protocol (`incrementSent`, `incrementDropped`, `touchLastFrame`) that keeps `ClientConnection` from reaching into hub internals (D-32-A2).
- `FirehoseStats` — locked 5-field read-only snapshot shape: `{ client_count, frames_sent_total, frames_dropped_total, last_frame_at, watermark_bytes }` (D-32-A4). This is the cross-phase API contract consumed by Plan 04's `/health/detailed` route and Phase 34's Steward UI.

Modifications to `ClientConnection`:
- Constructor gains a 4th parameter `metrics: HubMetricsSink`; stored as `private readonly metrics`.
- `trySend`: calls `this.metrics.incrementSent()` and `this.metrics.touchLastFrame()` AFTER `socket.send(...)` succeeds, BEFORE the `catch` (D-32-A3). Counters are never incremented if `socket.send` throws — satisfies R-32-03.
- `enqueue`: adds `if (this.buffer.size === this.buffer.capacity)` pre-check BEFORE `buffer.push()` that fires `this.metrics.incrementDropped()` (D-32-A1). The `tryDrain` re-queue path (`for (; i < items.length; i++) buffer.push(items[i])`) is **untouched** — Pitfall 3 enforced.

Modifications to `WsFirehoseHub`:
- Private `metrics` field: `{ frames_sent_total: 0, frames_dropped_total: 0, last_frame_at: null as number | null }`.
- `stats(): FirehoseStats` method: O(1) snapshot reading `this.metrics` and `this._clients.size`.
- `onConnect`: passes `HubMetricsSink` closures binding to `this.metrics` as the 4th constructor argument.

**`grid/test/firehose-frame-counters.test.ts` — created**

Four test cases (all pass GREEN):

1. All-zeros sentinel — fresh hub returns `{ client_count: 0, frames_sent_total: 0, frames_dropped_total: 0, last_frame_at: null, watermark_bytes: 1_048_576 }`.
2. `frames_sent_total + last_frame_at` — after `onConnect` + one allowlisted audit event, `frames_sent_total === 1` and `last_frame_at` is a recent ms-epoch.
3. `frames_dropped_total` — with `bufferedAmount > watermark` and buffer at capacity, each additional `audit.append` increments drop counter exactly once.
4. Pitfall 3 enforcement — after priming buffer to overflow once (drop=1), running 5 microtask drain cycles with `bufferedAmount` still above watermark leaves `frames_dropped_total` pinned at 1 (tryDrain re-queue path does not call `incrementDropped`).

## Pitfall 3 Enforcement

The `tryDrain` method at lines 97-99 calls `this.buffer.push(items[i])` to re-queue items that couldn't be sent because `bufferedAmount` was still above watermark mid-drain. This path was intentionally left untouched — the `incrementDropped` callback is **only** wired in `enqueue`'s `size === capacity` pre-check. Test 4 pins this invariant.

Verification: `awk '/tryDrain\(\): void/,/^    }/' grid/src/audit/firehose-hub.ts | grep -c "incrementDropped"` returns `0`.

## Public Surface Delta

| Export | Type | Cross-Phase Contract |
|--------|------|---------------------|
| `HubMetricsSink` | interface | Used by ClientConnection constructor — internal to firehose layer |
| `FirehoseStats` | interface | **FROZEN** — Plan 04 and Phase 34 consume this shape; additive changes only |
| `WsFirehoseHub.stats()` | method | Returns `FirehoseStats` snapshot; O(1); consumed by /health/detailed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test expectation corrected: hello frame excluded from frames_sent_total**

- **Found during:** Task 2 (test run)
- **Issue:** The plan's `<behavior>` block for Task 1 said: "After `onConnect(sock)` + one allowlisted event — `frames_sent_total === 1`". The initial test implementation assumed the hello frame (sent via direct `socket.send()` in `onConnect`, NOT via `ClientConnection.trySend`) would increment the counter, writing `expect(afterHello.frames_sent_total).toBe(1)` after connect. This failed because `onConnect` sends the hello frame directly via `socket.send(...)` (bypassing `trySend`), so the counter stays 0 until the first `trySend` call.
- **Fix:** Corrected test to assert `frames_sent_total === 0` after `onConnect` and `frames_sent_total === 1` after one audit event. This matches D-32-A3 intent — only `ClientConnection.trySend` increments the counter; the hello frame path is intentionally excluded.
- **Files modified:** `grid/test/firehose-frame-counters.test.ts`
- **Commit:** e0f6f22

## Verification Results

```
cd grid && npx tsc --noEmit                                          ✓ (exit 0)
cd grid && npx vitest run test/firehose-frame-counters.test.ts       ✓ 4/4 pass
cd grid && npx vitest run test/audit/firehose-hub.test.ts            ✓ 7/7 pass
grep -c "export interface HubMetricsSink" src/audit/firehose-hub.ts  = 1
grep -c "export interface FirehoseStats" src/audit/firehose-hub.ts   = 1
grep -c "stats(): FirehoseStats" src/audit/firehose-hub.ts           = 1
grep -c "this.metrics.incrementSent()" src/audit/firehose-hub.ts     = 1
grep -c "this.metrics.incrementDropped()" src/audit/firehose-hub.ts  = 1 (enqueue only)
tryDrain body | grep -c "incrementDropped"                           = 0 (Pitfall 3 clean)
```

Pre-existing test failures (39 files / 110 tests in api/portal/economy suites) were present before this plan and are unrelated to Plan 01 changes — they involve full server stack with DB dependencies.

## Cross-Phase Notes

- `FirehoseStats` shape is **frozen as of this plan**. Plan 04 (`/health/detailed`) and Phase 34 (Steward `/system` cards) consume this contract. Changes after Phase 32 ships require coordinated migration of all consumers.
- The `WsFirehoseHub.stats()` method is the sole production source for firehose metrics — no alternative access path exists.
- Allowlist unchanged at 53 (Plan 01 adds zero audit events — `stats()` is a getter, not an emitter).

## Self-Check: PASSED

- FOUND: grid/src/audit/firehose-hub.ts
- FOUND: grid/test/firehose-frame-counters.test.ts
- FOUND: commit 58cc37d (feat — Task 1)
- FOUND: commit e0f6f22 (test — Task 2)
