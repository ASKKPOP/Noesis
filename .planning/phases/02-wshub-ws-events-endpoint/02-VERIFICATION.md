---
phase: 02-wshub-ws-events-endpoint
verified: 2026-04-18T01:15:00Z
status: passed
score: 6/6 must-haves verified
---

# Phase 2: WsHub + `/ws/events` Endpoint Verification Report

**Phase Goal:** The Grid server streams allowlisted audit events to any connected WebSocket client in real time, with backpressure that can never slow the simulation.
**Verified:** 2026-04-18T01:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| SC#1 | A developer can open a WebSocket connection to `ws://localhost:{PORT}/ws/events` and receive a `hello` frame followed by live `event` frames | ✓ VERIFIED | `grid/src/api/server.ts:138-181` mounts `/ws/events`; `WsHub.onConnect` in `ws-hub.ts:274-309` sends HelloFrame immediately. Integration test `ws client connects and receives HelloFrame` passes against a real ws client on ephemeral port. |
| SC#2 | Every allowlisted AuditChain event appears on every connected socket within one tick of `append()` returning | ✓ VERIFIED | Single `this.audit.onAppend` subscription in `ws-hub.ts:262` fans out via `onAuditEvent` (`ws-hub.ts:345-355`) with `isAllowlisted` gate. Unit test `allowlisted event reaches connected client` + integration test `live event after audit.append arrives on connected client` both pass. Non-allowlisted path verified by `non-allowlisted event is dropped silently` and `non-allowlisted event does NOT arrive`. |
| SC#3 | Multiple clients connect simultaneously; each receives the full filtered event stream without cross-contamination | ✓ VERIFIED | `_clients: Set<ClientConnection>` fan-out (`ws-hub.ts:347-354`). Unit tests `two clients with different filters receive disjoint streams` and integration `two concurrent clients receive the same event` both pass. Per-client RingBuffer and filter isolate state. |
| SC#4 | Slow client with full send buffer does NOT slow `append()` — events drop to a 256-entry ring buffer; on overflow, server emits `{type:"dropped", sinceId, latestId}` | ✓ VERIFIED | `ClientConnection` owns `new RingBuffer<AuditEntry>(256)` (`ws-hub.ts:96`), default capacity 256, watermark 1 MB. Overflow tracked in `droppedMin/droppedMax` and emitted via `DroppedFrame` in `tryDrain`. Listener NEVER calls `ws.send` — only `client.enqueue` wrapped in try/catch. Unit tests: `ring-buffer overflow emits DroppedFrame with correct sinceId/latestId on drain`, `slow client: high bufferedAmount causes enqueue without immediate send`, `fast client: when bufferedAmount === 0, send happens synchronously during append`, `throwing socket.send does not propagate out of append`. |
| SC#5 | On Grid restart, clients receive a clean `bye` frame or 1001 close code; reconnecting with `{type:"subscribe", sinceId: N}` replays missed events from in-memory chain or tells client to use REST | ✓ VERIFIED | `REPLAY_WINDOW = 512` exported in `ws-hub.ts:61`. `replayForClient` (`ws-hub.ts:318-339`) honors bound and enforces `isAllowlisted` on replayed entries. `close()` emits ByeFrame then socket.close(1001) with setImmediate yield for flush. Three unit tests (`subscribe with recent sinceId replays missed events`, `subscribe with stale sinceId emits DroppedFrame`, `subscribe with current sinceId is a no-op`) + integration `reconnect with lastSeenId receives replay` + `wsHub.close() sends ByeFrame and closes ws with code 1001`. |
| SC#6 | 10k connect/disconnect cycles leave `WsHub.clients.size === 0` | ✓ VERIFIED | Integration test `10_000 connect/disconnect cycles leave hub.clientCount === 0` runs real ws client loop × 10,000, then asserts `wsHub.clientCount === 0`. Completes in ~1.8s. |

**Score:** 6/6 ROADMAP Success Criteria verified.

### Plan-level Additional Truths (Verified)

- GRID_WS_SECRET auth gate (M5 scope): ✓ VERIFIED — `server.ts:140-157` checks `Authorization: Bearer` header and `?token=` query param; mismatch → `socket.close(1008, 'unauthorized')`. Integration test `GRID_WS_SECRET env gates the upgrade` covers both paths.
- Single AuditChain subscription (PITFALLS M8): ✓ VERIFIED — `grep -c "this.audit.onAppend" ws-hub.ts` returns exactly 1. Replay path is a synchronous scan of `audit.all()`, not a new subscription. Unit test `construction subscribes to audit.onAppend exactly once` enforces.
- Listener never throws back into `append()`: ✓ VERIFIED — `onAuditEvent` and `replayForClient` wrap `client.enqueue` in try/catch; `trySend` wraps socket.send in try/catch. Unit test `throwing socket.send does not propagate out of append` confirms end-to-end.
- Transport-agnostic hub: ✓ VERIFIED — `grep -c "from 'ws'" ws-hub.ts` = 0; `grep -c "from '@fastify/websocket'" ws-hub.ts` = 0. The hub only knows `ServerSocket`.
- M5 (Origin/CORS) explicit deferral: ✓ VERIFIED — literal `M5:` comment present in `server.ts:130` pointing at Phase 4 hardening.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `grid/package.json` | Declares `@fastify/websocket@^11` | ✓ VERIFIED | `"@fastify/websocket": "^11.2.0"` in dependencies; `fastify@^5.0.0` peer satisfied. |
| `grid/src/api/ws-protocol.ts` | Exports HelloFrame/EventFrame/DroppedFrame/PingFrame/PongFrame/ByeFrame/SubscribeFrame/UnsubscribeFrame/ServerFrame/ClientFrame/parseClientFrame | ✓ VERIFIED | All 10 identifiers exported with exact shapes from 02-CONTEXT.md Wire Protocol. `parseClientFrame` never throws — try/catch around JSON.parse + defensive narrowing. No runtime deps on fastify/ws. |
| `grid/src/api/ws-hub.ts` | Exports WsHub, WsHubOptions, ServerSocket, globMatch, REPLAY_WINDOW; internal ClientConnection | ✓ VERIFIED | All required exports present; ClientConnection is module-private. Single `this.audit.onAppend` subscription; `isAllowlisted` called in both live (onAuditEvent) and replay (replayForClient) paths; per-client RingBuffer; backpressure via `bufferedAmount < watermarkBytes` check with microtask drain; `close()` two-phase (ByeFrame broadcast → setImmediate yield → socket.close(1001)). |
| `grid/src/api/server.ts` | Registers @fastify/websocket once; mounts GET /ws/events; constructs WsHub; binds lifecycle | ✓ VERIFIED | Plugin registered with `maxPayload: 1_048_576`. Route mounted inside `app.register(async instance => ...)`. WsHub constructed with optional overrides. GRID_WS_SECRET gate on upgrade. M5 deferral comment present. buildServer signature preserved (backward-compatible); buildServerWithHub is the new overload returning `{ app, wsHub }`. |
| `grid/test/ws-hub.test.ts` | ≥15 unit tests with inline FakeSocket | ✓ VERIFIED | 30 `it(...)` tests (2× the minimum). Covers construction, hello, allowlist gate, topic filter, cross-client isolation, fast/slow paths, overflow→DroppedFrame ordering, disconnect cleanup, close() drain, unsubscribe, send-throw resilience, malformed-frame tolerance, globMatch, AND the three sinceId scenarios. FakeSocket defined inline (no real ws). |
| `grid/test/ws-integration.test.ts` | End-to-end coverage with real ws clients on ephemeral ports | ✓ VERIFIED | 9 integration tests using `WebSocket as WsClient` from `ws`, bound to `127.0.0.1:0` with dynamic port discovery. Covers hello, live event, non-allowlisted drop, topic filter, two concurrent clients, close/Bye+1001, GRID_WS_SECRET both paths, 10k leak guard, reconnect-with-lastSeenId replay. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `ws-hub.ts` | `audit/chain.ts` | `audit.onAppend((e) => onAuditEvent(e))` | ✓ WIRED | `ws-hub.ts:262` — exactly one subscription. |
| `ws-hub.ts` | `audit/broadcast-allowlist.ts` | `isAllowlisted(entry.eventType)` | ✓ WIRED | Called in `onAuditEvent` (live) AND `replayForClient` (sinceId) — 5 references in ws-hub.ts. |
| `ws-hub.ts` | `util/ring-buffer.ts` | `new RingBuffer<AuditEntry>(capacity)` | ✓ WIRED | Per-ClientConnection instance at `ws-hub.ts:96`. |
| `ws-hub.ts` | `ws-protocol.ts` | `import { HelloFrame, EventFrame, DroppedFrame, ByeFrame, ServerFrame, parseClientFrame }` | ✓ WIRED | `ws-hub.ts:25-32` imports all required frames and the runtime guard. |
| `ws-hub.ts` | `audit/chain.ts` | `audit.all()` for replay scan | ✓ WIRED | `ws-hub.ts:327` inside replayForClient. Bounded by REPLAY_WINDOW check at `:323`. |
| `server.ts` | `@fastify/websocket` | `app.register(fastifyWebsocket, { options: { maxPayload: 1_048_576 } })` | ✓ WIRED | `server.ts:119-121`. |
| `server.ts` | `ws-hub.ts` | `new WsHub({ audit, gridName })` | ✓ WIRED | `server.ts:123-128`. |
| `server.ts` | `ws-hub.ts` | `app.addHook('preClose', () => wsHub.close())` | ✓ WIRED (deviation from plan — see Anti-Patterns) | `server.ts:191-193` — uses `preClose` instead of `onClose` because `@fastify/websocket` moves sockets into CLOSING during its own onClose teardown, which would swallow the ByeFrame. Documented inline at `server.ts:183-190`. |
| `ws-integration.test.ts` | `ws` package | `new WsClient('ws://127.0.0.1:' + port + '/ws/events')` | ✓ WIRED | Real ws client on ephemeral port binding. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| WsHub.onAuditEvent | `entry: AuditEntry` | AuditChain.onAppend listener (Phase 1 primary source) | Yes — live events written by NousRunner/ticker/etc. | ✓ FLOWING |
| WsHub.replayForClient | `entries` | `audit.all()` | Yes — returns all historical entries in-memory | ✓ FLOWING |
| ClientConnection.enqueue | `entry` (fed to `trySend` or buffer) | Hub fan-out (live or replay) | Yes | ✓ FLOWING |
| WsHub.onConnect | `HelloFrame { lastEntryId: audit.length }` | `audit.length` getter | Yes — reflects real chain head | ✓ FLOWING |
| server.ts /ws/events handler | `adapter` (ServerSocket impl) | real `@fastify/websocket` socket | Yes — real transport, integration tests exercise end-to-end | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full grid test suite passes | `cd grid && npm test` | 21 files, 289/289 tests pass in 3.30s | ✓ PASS |
| WS integration tests pass | Same run; `test/ws-integration.test.ts (9 tests) 2983ms` | All 9 integration tests pass including the 10k leak guard in 1.8s | ✓ PASS |
| WsHub unit tests pass | Same run; `test/ws-hub.test.ts` | 30 unit tests pass | ✓ PASS |
| `@fastify/websocket` resolvable at runtime | Import chain via `server.ts` then `npm test` | No module-not-found failures; tests that exercise the plugin pass | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| ACT-01 | 02-01, 02-03 | Developer can connect to a WebSocket endpoint on the Grid server and receive live events | ✓ SATISFIED | Plugin dep installed (02-01). `/ws/events` mounted in `server.ts`. Integration test `ws client connects and receives HelloFrame` passes. |
| ACT-02 | 02-02, 02-03 | Activity stream broadcasts all AuditChain events in real-time | ✓ SATISFIED | WsHub fan-out with allowlist gate (02-02). Integration test `live event after audit.append arrives on connected client` + `two concurrent clients receive the same event` confirm real-time fan-out. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `grid/src/api/server.ts` | 191 | Uses `app.addHook('preClose', ...)` instead of `app.addHook('onClose', ...)` as specified in 02-03-PLAN | ℹ️ Info | **Intentional deviation with documented rationale.** @fastify/websocket's own onClose hook moves all sockets into CLOSING (readyState=2) during its teardown, so any send() after that point is a no-op and the ByeFrame would never reach the client. The `preClose` hook runs BEFORE the plugin's close, preserving the ByeFrame→1001 contract. This deviation is load-bearing for SC#5's graceful shutdown semantics (verified by the `wsHub.close() sends ByeFrame and closes ws with code 1001` integration test). Comment block at `server.ts:183-190` explains the choice. Not a gap. |

No TODOs, FIXMEs, placeholder returns, or stub patterns found in any Phase 2 source or test file. No hardcoded empty returns. Listener bodies are real code paths that call real dependencies.

### Human Verification Required

None. All Phase 2 Success Criteria are programmatically verified by unit + integration tests running against real ws clients on real sockets. No UI, visual, or external-service components in this phase.

### Gaps Summary

No gaps. The phase meets every ROADMAP v2.0 Dashboard Phase 2 Success Criterion and every plan-declared must-have truth. The integration test suite exercises the full stack end-to-end: real Fastify server on an ephemeral port, real `ws` library clients, real AuditChain with per-test isolation, real GRID_WS_SECRET gating, 10k connect/disconnect cycles with leak assertion, and the reconnect-with-lastSeenId replay path. The plan-to-code deviation (preClose vs onClose) is technically necessary to preserve the ByeFrame-before-close contract and is documented inline with a comment block citing the interaction with @fastify/websocket's internal teardown order.

**Recommendation:** Phase 2 is complete. Ready to advance to Phase 3 (Dashboard v1 — Firehose + Heartbeat + Region Map), which consumes the `/ws/events` endpoint, HelloFrame/EventFrame/DroppedFrame wire protocol, and the sinceId replay semantics established here.

---

*Verified: 2026-04-18T01:15:00Z*
*Verifier: Claude (gsd-verifier)*
