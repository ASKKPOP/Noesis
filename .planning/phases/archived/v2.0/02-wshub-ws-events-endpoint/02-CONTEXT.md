# Phase 2: WsHub + `/ws/events` Endpoint - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Source:** Milestone research synthesis (.planning/research/SUMMARY.md) + Phase 1 artifacts

<domain>
## Phase Boundary

This phase exposes the Phase 1 `AuditChain.onAppend()` stream over WebSocket. The Grid's existing Fastify server gains a `/ws/events` route; a new `WsHub` owns connected clients and broadcasts allowlisted events with per-client ring-buffered backpressure. Testable end-to-end with a CLI `ws` client — no UI required.

**In scope:**
- Install `@fastify/websocket@^11` in `grid/` workspace
- New file `grid/src/api/ws-hub.ts` (WsHub + ClientConnection)
- New file `grid/src/api/ws-protocol.ts` (wire frame types)
- Modify `grid/src/api/server.ts` to register the WS plugin, mount the route, own WsHub lifecycle
- Unit tests for WsHub (connect, broadcast, drop-oldest, disconnect, leak-free)
- Integration test: real `ws` client connects → receives `hello` → receives live events after AuditChain append
- Graceful shutdown hook — `onClose` drains clients and calls `WsHub.close()`

**Explicitly out of scope:**
- Any dashboard / Next.js code (Phase 3)
- Nous inspector or economy views (Phase 4)
- Auth beyond `127.0.0.1`-bind default (full auth deferred)
- Reverse proxy config for production (Phase 4+ polish)
- Brain-side event emission (NousRunner already translates brain actions → audit.append)

</domain>

<decisions>
## Implementation Decisions (locked from research + Phase 1)

### Transport
- **WebSocket only**, no SSE — dashboard needs bidirectional subscribe/unsubscribe from day one
- **Single endpoint:** `GET /ws/events` — client-side topic filtering via glob patterns
- **Plugin:** `@fastify/websocket@^11` (Fastify-5 aligned major). Confirm at install time: `npm view @fastify/websocket@latest peerDependencies`

### Wire protocol (JSON, newline-delimited not required)
Frame types exchanged on the socket:
```ts
type HelloFrame = { type: 'hello'; serverTime: number; gridName: string; lastEntryId: number };
type EventFrame = { type: 'event'; entry: AuditEntry };
type DroppedFrame = { type: 'dropped'; sinceId: number; latestId: number };
type PingFrame = { type: 'ping'; t: number };
type PongFrame = { type: 'pong'; t: number };
type ByeFrame = { type: 'bye'; reason: string };

// client → server
type SubscribeFrame = { type: 'subscribe'; filters?: string[]; sinceId?: number };
type UnsubscribeFrame = { type: 'unsubscribe' };
```

### WsHub
- **Single instance per Grid server**, constructed inside `buildServer()` from `services.audit`
- Subscribes **once** to `audit.onAppend(...)` — all fan-out happens through WsHub
- Owns `Set<ClientConnection>` for connected clients
- On every audit event: check `isAllowlisted(entry.eventType)` — drop if not allowlisted (Phase 1 allowlist is the sole enforcement point)
- For each allowlisted event, fan out to each ClientConnection

### ClientConnection
- Owns: the raw `WebSocket`, per-client `RingBuffer<AuditEntry>` (capacity 256), topic filter globs, `lastSeenId`, flush-in-progress flag
- **Enqueue semantics:**
  - If `ws.bufferedAmount < WATERMARK` (e.g. 1 MB) AND ring buffer empty → send directly
  - Else → push to ring buffer; schedule a microtask drain when `bufferedAmount` drops
  - If ring buffer overflows (drop-oldest returns evicted entry) → mark client dirty, emit a `dropped` frame on next flush with the smallest and largest `id` dropped
- **Never** blocks `append()` — the listener only calls `enqueue`, never `ws.send` from inside the listener
- **Escape hatch:** if `bufferedAmount` stuck >30s OR 3 overflow events/minute → close with code 1013 (Try Again Later) and server-side `clients.delete()`

### Topic filter
- Client sends `{type:"subscribe", filters:["nous.*","trade.*","tick"]}` — globs matched against `entry.eventType`
- Empty/undefined filters = receive all allowlisted events
- Matching happens in ClientConnection.enqueue — reject at the earliest point

### Resume protocol (lastSeenId)
- Client on reconnect sends `{type:"subscribe", sinceId: N, filters: ...}`
- Server behavior:
  - If chain head - N ≤ REPLAY_WINDOW (e.g. 512 entries) → replay from in-memory chain (use `AuditChain.query({offset: N})` style API — may need an `entriesSince(id)` helper; implement if absent)
  - Else → send `{type:"dropped", sinceId: N, latestId: head}` — client refills via `GET /api/v1/audit/trail?offset=N`
- **Consistency model:** stream is best-effort, REST is authoritative. Document in SUMMARY.

### Local-dev auth posture
- Default bind: `127.0.0.1` — no auth required
- If binding `0.0.0.0`, require env `GRID_WS_SECRET` — client must include `Authorization: Bearer <secret>` on WS upgrade OR `?token=<secret>` query param
- If `GRID_WS_SECRET` is set but request misses/mismatches → 401 on upgrade, NOT accept-then-close

### Lifecycle / shutdown
- `buildServer()` returns a Fastify instance; the caller (Grid main entrypoint) calls `app.close()` on SIGTERM
- WsHub must register `app.addHook('onClose', async () => wsHub.close())`
- `WsHub.close()` sends `{type:"bye", reason:"shutting down"}` to each client then `ws.close(1001)`
- After close, `WsHub.clients.size === 0`

### Leak-free guarantees (regression tests)
- 10,000 connect/disconnect cycles leave `clients.size === 0` and heap within ±2% of pre-loop RSS
- Server restart sends clean close frames, not silent hang

### Not in this phase (enforce in plans)
- NO dashboard code, NO Next.js, NO React, NO CSS — phase 3
- NO changes to `AuditChain` (Phase 1 surface)
- NO changes to `broadcast-allowlist.ts` (Phase 1 surface) — consume it, don't modify
- NO changes to existing REST routes — only additions

### File naming + locations
- `grid/src/api/ws-hub.ts` — new, exports `WsHub`, `ClientConnection`
- `grid/src/api/ws-protocol.ts` — new, exports frame type unions
- `grid/src/api/server.ts` — modify: register plugin, wire route, own WsHub construction
- `grid/test/ws-hub.test.ts` — new, unit tests for hub + client
- `grid/test/ws-integration.test.ts` — new, spins a Fastify instance on an ephemeral port, connects a real `ws` client, asserts end-to-end

### Dependencies (claim-before-install)
- Install `@fastify/websocket@^11` (confirm with `npm view` before committing the install)
- Dev-only: `ws` is already transitive via Fastify. For tests that need a raw client, import from `@fastify/websocket`'s peer or add `ws` as explicit dev dep if needed

### Claude's Discretion
- Exact watermark values (suggest 1 MB `bufferedAmount`, 256 ring-buffer capacity, 512 replay window) — tune with rationale if first run shows problems
- Whether `ClientConnection` holds its own RingBuffer or takes one injected (prefer own, but open)
- Whether ping/pong is driven by Fastify plugin defaults or an app-level 15s interval (prefer plugin defaults + explicit 15s app-level timeout to detect dead sockets)
- Integration test strategy: ephemeral port + real `ws` client vs Fastify's `inject` for WS (prefer real ws client — ws semantics need the network path)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (milestone-level)
- `.planning/research/SUMMARY.md` — §3 Architecture (the critical seam), §5 Pitfalls #4 slow-client, #5 resume cursor
- `.planning/research/ARCHITECTURE.md` — §"Build Order" step 3 (WsHub), §"Wire protocol", §"Backpressure policy"
- `.planning/research/PITFALLS.md` — C4 (head-of-line blocking), C5 (lost events across reconnect), M5 (CORS on upgrade), M8 (socket leak)
- `.planning/research/STACK.md` — §"Install (server side)" for exact versions

### Phase 1 artifacts (consume, don't modify)
- `grid/src/audit/chain.ts:76-79` — `AuditChain.onAppend()` — subscribe here in WsHub constructor
- `grid/src/audit/broadcast-allowlist.ts` — `isAllowlisted()` called on every event pre-fan-out
- `grid/src/util/ring-buffer.ts` — per-client backpressure buffer
- `grid/src/audit/types.ts` — `AppendListener`, `Unsubscribe`, `AuditEntry`

### Existing code patterns
- `grid/src/api/server.ts` — current Fastify setup to extend (plugin registration, service injection)
- `grid/src/clock/ticker.ts` — listener pattern precedent (not reused directly but shape matches)

### Project philosophy (sovereignty)
- `PHILOSOPHY.md` §4 (sovereign memory) — rationale for strictly honoring the allowlist in fan-out

</canonical_refs>

<specifics>
## Specific Ideas

- **Registration example:** `await app.register(fastifyWebsocket, { options: { maxPayload: 1_048_576 } })` before mounting routes.
- **Route mounting:** `app.get('/ws/events', { websocket: true }, (socket, req) => wsHub.onConnect(socket, req))` — WsHub owns connection logic, server.ts is a thin wire-up.
- **Fan-out loop:** in `wsHub.onAuditEvent(entry)`: `if (!isAllowlisted(entry.eventType)) return; for (const c of clients) c.enqueue(entry);` — never awaits, never throws.
- **Integration test shape:** spin `buildServer()` on port 0, read assigned port, open `new WebSocket('ws://127.0.0.1:PORT/ws/events')`, wait for `hello`, then trigger `services.audit.append('tick', ...)` and assert `event` frame arrives with matching entry.id.
- **Leak test shape:** connect → close loop × 10_000, then assert `wsHub.clients.size === 0` and `process.memoryUsage().heapUsed` within budget.

</specifics>

<deferred>
## Deferred Ideas

- **Message compression** (permessage-deflate) — defer until event rate justifies it (currently ~3 evts/sec).
- **Binary frame types / MessagePack** — JSON wins at this rate; revisit if Phase 4 adds high-rate events.
- **Per-client rate limiting beyond backpressure** — `@fastify/rate-limit` covers the HTTP upgrade itself; in-socket rate limiting is a Phase 4+ concern.
- **Resume replay window tuning** — fixed 512 for v1; make configurable if observed lost-event rate is non-trivial.
- **Listener-error observability** — Phase 1 swallows silently; a counter/log sink is a separate phase.
- **WS auth hardening beyond shared secret** — JWT / session-cookie auth is Phase 4+ when multi-user access lands.

</deferred>

---

*Phase: 02-wshub-ws-events-endpoint*
*Context gathered: 2026-04-18 from milestone research + Phase 1 completion*
