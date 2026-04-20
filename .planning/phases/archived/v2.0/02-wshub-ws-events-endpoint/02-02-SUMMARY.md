---
phase: 02-wshub-ws-events-endpoint
plan: 02
subsystem: api
tags: [websocket, backpressure, ring-buffer, audit, resume-protocol]

requires:
  - phase: 02-wshub-ws-events-endpoint
    plan: 01
    provides: ws-protocol.ts frame types + parseClientFrame guard
  - phase: 01-auditchain-listener-api-broadcast-allowlist
    provides: AuditChain.onAppend + isAllowlisted() + RingBuffer
provides:
  - "grid/src/api/ws-hub.ts — WsHub class with per-client ring-buffered backpressure and bounded sinceId replay"
  - "grid/test/ws-hub.test.ts — 18 unit tests covering broadcast, allowlist, topic filters, overflow, close, resume"
  - "REPLAY_WINDOW = 512 constant for resume protocol gap ceiling"
  - "globMatch(pattern, eventType) helper exposed for tests"
affects: [02-03-server-integration, phase-03-dashboard-ws-client]

tech-stack:
  patterns:
    - "Transport-agnostic hub via ServerSocket interface (no direct ws/fastify imports)"
    - "Listener never calls ws.send — only enqueues to per-client RingBuffer + schedules microtask drain"
    - "Drop-oldest overflow tracks (droppedMin, droppedMax) range, flushed as one DroppedFrame on next drain"
    - "Resume gate: gap ≤ REPLAY_WINDOW replays in-memory; gap > REPLAY_WINDOW emits DroppedFrame → REST refill"

key-files:
  created:
    - grid/src/api/ws-hub.ts
    - grid/test/ws-hub.test.ts

key-decisions:
  - "ClientConnection is NOT exported — internal implementation detail of WsHub; tests exercise it via ServerSocket double"
  - "Per-client filter semantics: [] = accept-all; explicit unsubscribe uses sentinel '__no_match_reserved_sentinel__' to reject-all (enables re-subscribe later)"
  - "trySend() swallows all transport errors — a broken socket must never propagate into AuditChain listener"
  - "canDirectSend requires buffer.size===0 AND droppedMin===null AND bufferedAmount<watermark — otherwise enqueue preserves ordering"
  - "scheduleDrain uses queueMicrotask — sufficient for tests; production wires to socket 'drain' event in Plan 03"
  - "globMatch converts ** → .* and * → [^.]* to match hierarchical event types like 'nous.*' without crossing dots"

requirements-completed: [ACT-02]

must-haves-verified:
  - "WsHub.onAppend subscription count = 1 (enforced by grep in tests; unsubscribe called on close)"
  - "Non-allowlisted eventType dropped at onAuditEvent() entry — never reaches ClientConnection"
  - "Overflow emits DroppedFrame with smallest/largest evicted ids on drain"
  - "globMatch correctly narrows 'nous.*', 'trade.*', 'tick'"
  - "close() fans out ByeFrame reason='shutting down' + socket.close(1001) + clients.size===0"
  - "Listener never invokes ws.send — only enqueue() path touches the socket"
  - "sinceId resume: gap ≤ REPLAY_WINDOW replays; gap > REPLAY_WINDOW emits single DroppedFrame"

duration: 40min
completed: 2026-04-18
---

# Phase 02 Plan 02: WsHub + ClientConnection

**Per-client ring-buffered fan-out of allowlisted AuditChain events with bounded sinceId replay — 18/18 unit tests green, 280/280 grid tests green.**

## Performance

- **Duration:** ~40 min (inline sequential in main worktree)
- **Started:** 2026-04-18T00:40Z
- **Completed:** 2026-04-18T00:46Z
- **Tasks:** 2
- **Files created:** 2 (ws-hub.ts 377 lines, ws-hub.test.ts 315 lines)

## Accomplishments

- `WsHub` subscribes exactly once to `AuditChain.onAppend` in its constructor
- `ClientConnection` (internal) per-connection: RingBuffer(256) + watermark(1 MB) + filters + dropped-id range tracker
- Broadcast allowlist enforced at the single fan-out point (`onAuditEvent`)
- Topic filter glob matcher (`globMatch`) — `*` segment wildcard, `**` cross-segment
- Drop-oldest overflow surfaces as a single `DroppedFrame { sinceId, latestId }` on next drain
- Resume protocol: `{type:'subscribe', sinceId: N}` replays missed allowlisted entries when gap ≤ 512; otherwise emits a `DroppedFrame` directing client to REST refill
- `close()` sends `ByeFrame` + closes sockets with code 1001 + unsubscribes chain listener + empties clients
- All transport errors in `trySend()` swallowed — listener can never throw back into `AuditChain.append()`

## Task Commits

1. **Task 1: WsHub + internal ClientConnection implementation** — `1c6850d` (feat)
2. **Task 2: 18 unit tests with inline FakeSocket** — `51162b8` (test)

## Files Created

- `grid/src/api/ws-hub.ts` — 377 lines, exports: `WsHub`, `WsHubOptions`, `ServerSocket`, `globMatch`, `REPLAY_WINDOW`
- `grid/test/ws-hub.test.ts` — 315 lines, 18 `describe('WsHub')` scenarios

## Test Coverage (18 tests)

1. constructor subscribes to audit.onAppend exactly once
2. onConnect sends HelloFrame with serverTime, gridName, lastEntryId
3. allowlisted entry reaches a subscribed client
4. non-allowlisted eventType dropped at hub (never enqueued)
5. topic filter `nous.*` matches nous.thought, rejects trade.tick
6. two clients with disjoint filters each receive only their subset
7. fast client (bufferedAmount=0) receives synchronous send
8. slow client (bufferedAmount>watermark) enqueues without sending
9. ring-buffer overflow emits DroppedFrame with correct id range on drain
10. disconnect removes client from hub + stops delivery
11. close() sends Bye reason='shutting down' + socket.close(1001)
12. close() unsubscribes from AuditChain (no further deliveries)
13. throwing socket.send does not propagate out of the listener
14. malformed client frame silently ignored (filters untouched)
15. globMatch unit cases (wildcard + dot-boundary)
16. subscribe with recent sinceId replays missed allowlisted entries
17. subscribe with stale sinceId (gap > REPLAY_WINDOW) emits single DroppedFrame
18. subscribe with current sinceId (gap=0) is a no-op

## Decisions Made

- **ClientConnection not exported:** keeps hub internals sealed; tests exercise via `ServerSocket` double.
- **Filter semantics split:** empty `[]` = accept-all; explicit `{type:'unsubscribe'}` sets a sentinel `['__no_match_reserved_sentinel__']` so the client can later re-subscribe without rebuilding the connection.
- **Resume gap ceiling = 512:** matches `02-CONTEXT.md §Resume protocol`; keeps in-memory replay bounded so a cold client can't starve live clients.
- **globMatch via regex:** `**` → `.*`, `*` → `[^.]*`, dots escaped. Prevents `nous.*` from accidentally matching `nous.child.grandchild`.

## Deviations from Plan

Minor: overflow test expected `latestId=4` after 12 appends to a capacity-8 buffer, but the drain trigger (13th append) also evicts — so `latestId=5` and retained ids are `[6..13]`. Adjusted the test expectation; the invariant under test (DroppedFrame precedes EventFrames, range is correct at drain time) is unchanged.

## Issues Encountered

- Pre-existing tsc errors in `src/main.ts` and `src/db/repositories/*.ts` persist but are unrelated to ws-hub; confirmed `grep -c "ws-hub\|ws-protocol"` on tsc output = 0.
- Vitest `280/280` passes; zero regressions from Plan 02-01.

## Next Phase Readiness

- **Plan 03 (server.ts integration)** can now:
  - `import { WsHub, type ServerSocket } from './api/ws-hub.js'`
  - Construct one hub per server (`new WsHub({ audit, gridName })`)
  - Register `@fastify/websocket` and mount `/ws/events` route calling `hub.onConnect(ws)`
  - Adapt the `@fastify/websocket` socket shape to `ServerSocket` (trivial — `bufferedAmount`, `send`, `close`, `on('message'|'close'|'error')` are all native)

---
*Phase: 02-wshub-ws-events-endpoint / Plan 02*
*Completed: 2026-04-18*
