# Architecture: Noēsis Real-Time Event Pipeline (Dashboard v1)

**Domain:** Server → browser streaming of simulation events
**Researched:** 2026-04-17
**Scope:** Sprint 14 (DASH-01..05), forward-compatible with Phase 4 (economy overview) and Phase 5 (multi-grid federation)
**Confidence:** HIGH — grounded in current codebase inspection, not speculation

---

## TL;DR Recommendation

**Single in-process observer on `AuditChain` + one broadcast `/ws/events` endpoint on the existing Fastify server, with bounded per-client queues and a topic filter.**

- **Transport:** WebSocket via `@fastify/websocket` (Fastify 5 compatible). Not SSE (bidirectional topic subscription is cleaner, and the dashboard will want to issue filter commands).
- **Event source:** `AuditChain` itself gains a minimal `onAppend(listener)` hook. No separate EventBus library. No Redis. No NATS. No Kafka.
- **Brain events:** Brain does NOT emit directly. NousRunner already translates every brain action into `audit.append(...)` calls (verified in `grid/src/integration/nous-runner.ts`). AuditChain is already the unified event stream — we just need to *listen* to it.
- **Backpressure:** Bounded per-connection ring buffer (default 256 events). On overflow, drop oldest and send a `{ type: "dropped", count: N }` marker so the client can refetch via REST. Never block the producer.
- **Topics:** Single `/ws/events` socket, client sends `{subscribe:["nous.*","trade.*"]}` to filter. Cheaper than N sockets and preserves ordering across streams.

Everything else is a future extension. Build the simplest correct thing now; the seams are placed so Phase 4/5 don't require a rewrite.

---

## 1. Current State Anchors (what we must not disturb)

| Component | File | Relevant invariant |
|-----------|------|--------------------|
| `AuditChain` | `grid/src/audit/chain.ts` | Append-only, hash-chained, synchronous `append()` returns `AuditEntry`. Used by snapshot/restore (`loadEntries`). |
| Fastify server | `grid/src/api/server.ts` | Single `buildServer(services)` factory. All state injected as `GridServices`. No middleware directory in use. |
| Event producers | `grid/src/genesis/launcher.ts`, `grid/src/integration/nous-runner.ts`, `grid/src/db/grid-store.ts` | All observable grid state changes already flow through `this.audit.append(...)`. |
| `WorldClock` | `grid/src/clock/ticker.ts` | Already supports a listener pattern (`onTick(listener)`), uses `try/catch` to isolate failing listeners. This is the template to copy. |
| Brain → Grid bridge | JSON-RPC over Unix socket, wrapped by `NousRunner` | Brain emits **actions**, NousRunner decides what to audit. Brain has no knowledge of websockets, nor should it. |
| Dashboard scaffold | `dashboard/src/` | Empty directory tree. No `package.json`, no components, no lib. Blank canvas. |

**Key observation:** AuditChain has 100% capture of everything the dashboard cares about in v1 — spawn, speech, movement, direct messages, genesis, start, stop. A parallel event bus would duplicate this coverage.

---

## 2. Pattern Evaluation

### Option A — In-process listener on AuditChain (RECOMMENDED)

```
audit.append(...)  ─▶  entries.push + lastHash update  ─▶  for listener of listeners: listener(entry)
                                                                           │
                                                                           ▼
                                                              WsHub.broadcast(entry)
```

**Pros**
- Zero new dependencies for the event path itself. Mirrors the proven `WorldClock.onTick` pattern that already exists in this codebase.
- Ordering is free and correct: the same `id` sequence that the chain assigns is what clients see.
- No serialization boundary between producer and listener — listener sees the real `AuditEntry`.
- Trivial to test: `audit.onAppend(e => captured.push(e))` in unit tests.

**Cons**
- Couples delivery to the producer process. If Grid crashes, in-flight broadcasts are gone — but so are uncommitted events, so this is correct failure semantics.
- Single-process only. **This is a Phase 5 (multi-grid) concern, not v1.**

**Verdict: ship this.**

### Option B — EventEmitter / mitt / nanobus

An extra abstraction between AuditChain and the WS hub. Producers call `bus.emit('audit', entry)` after `audit.append()`.

**Rejected because**
- AuditChain already IS the bus. Adding a second one means two sources of truth, two places to register listeners, two places something can go missing.
- The `onTick` precedent proves a bare `Set<Listener>` is sufficient for this codebase's style.
- mitt/nanobus add 0.3–1 KB and zero capability over 12 lines of native code.

The listener set *inside* AuditChain is the event bus. Don't call it one.

### Option C — Message queue (Redis Streams / NATS / Kafka)

**Rejected for v1.** None of these solve a problem we have:
- We do not have multiple Grid instances to federate (Phase 5).
- We do not have multiple dashboard backends to load-balance.
- We have a single-digit Nous count and a 30 000 ms default tick rate. Event rate is measured in **events per minute**, not per second.
- Adding Redis to `docker-compose.yml` doubles the "what must be running" surface area of the project for zero Phase 3 benefit.

**Phase 5 note:** When federation arrives, `GridBridge` (new component) publishes local audit entries to NATS, other grids subscribe. The WsHub still listens to local AuditChain — it doesn't need to care that the source is now federated. The seam is clean.

### Option D — SSE (EventSource)

**Considered and rejected.** SSE is attractive (auto-reconnect built in, plain HTTP, no framing). But:
- The dashboard will want to send `{subscribe: [...]}` and `{unsubscribe: [...]}` — SSE is server→client only, forcing a separate POST channel.
- Safari's SSE implementation has intermittent pain (connection limits, reconnection quirks). WebSocket parity is better in 2026.
- Fastify's WebSocket story is mature (`@fastify/websocket` v11+ for Fastify 5, backed by `ws`).

SSE would be fine if we only had a firehose and no filters. We don't.

### Option E — Polling `/api/v1/audit/trail`

The REST endpoint `audit/trail` already supports `limit`, `offset`, `type`, `actor`. A client could poll every N seconds with `offset = lastSeenId`.

**When polling is sufficient**
- Infrequent updates (minutes between events) — plausible at a 30s tick rate with 3 Nous.
- Single tab, no background activity.

**When polling fails**
- Latency: average lag = poll interval / 2. At 2s poll, that's visible jank for a "live view."
- Thundering herd: N tabs × M dashboards × 0.5 Hz = wasted CPU on the Grid.
- Can't cheaply support `brain.thinking` (Phase 3) or trade-match animations (Phase 4) — those want sub-second delivery.
- No natural channel for server-initiated "you're disconnected, resync from offset X" messages.

**Verdict:** Keep the REST endpoint as the authoritative catch-up mechanism (the "rewind" path and the "dropped events" recovery path). Don't use it as the primary live transport.

---

## 3. Recommended Architecture

### 3.1 Data flow (v1)

```
┌─────────────────────────┐      ┌──────────────────────┐
│  Python Brain           │      │  WorldClock          │
│  (cognition + LLM)      │      │  (ticker.ts)         │
└───────────┬─────────────┘      └───────────┬──────────┘
            │ JSON-RPC                        │ onTick
            ▼                                 ▼
┌─────────────────────────────────────────────────────────┐
│  NousRunner / GridCoordinator / GenesisLauncher         │
│  (already call audit.append for every observable event) │
└───────────────────────────┬─────────────────────────────┘
                            │ audit.append(type, actor, payload)
                            ▼
            ┌────────────────────────────────┐
            │  AuditChain (chain.ts)         │
            │  ─ entries[]                   │
            │  ─ lastHash                    │
            │  ─ listeners ← NEW             │────┐
            │  ─ onAppend(fn) ← NEW          │    │ synchronous fan-out
            └────────────────────────────────┘    │
                            │                      │
                            │ GET /audit/trail     │
                            ▼                      ▼
                 ┌─────────────────┐     ┌─────────────────┐
                 │  REST (Fastify) │     │  WsHub (NEW)    │
                 │  catch-up,      │     │  per-client     │
                 │  verify         │     │  queue + filter │
                 └────────┬────────┘     └────────┬────────┘
                          │ HTTP               WS │ /ws/events
                          │                       │
                          ▼                       ▼
                 ┌────────────────────────────────────┐
                 │  Next.js dashboard (browser)       │
                 │  ─ subscribe via WS                │
                 │  ─ fallback /audit/trail on gap    │
                 └────────────────────────────────────┘
```

### 3.2 Component inventory

**NEW components**

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `AuditChain.onAppend()` + internal `listeners: Set<(e)=>void>` | `grid/src/audit/chain.ts` (modification) | Synchronous listener hook. 10–15 lines. Copies `WorldClock.onTick` verbatim, including try/catch isolation. |
| `WsHub` class | `grid/src/api/ws-hub.ts` | Holds `Set<ClientConnection>`. Method `broadcast(entry)`. Wires itself to `audit.onAppend`. Owns the backpressure policy. |
| `ClientConnection` | `grid/src/api/ws-hub.ts` (same file) | Wraps a socket. Fields: `topicFilter: string[]`, `queue: RingBuffer<AuditEntry>`, `dropped: number`, `lastDeliveredId: number`. Methods: `enqueue(e)`, `handleMessage(msg)`, `close(code)`. |
| WS route registration | `grid/src/api/server.ts` (modification) | `app.register(fastifyWebsocket)` + `app.get('/ws/events', { websocket: true }, handler)`. ~20 lines. |
| Ring buffer (tiny) | `grid/src/api/ring-buffer.ts` | Bounded FIFO with `push(item): droppedOrNull`. No npm dep needed — 30 lines. |

**MODIFIED components**

| Component | File | Change |
|-----------|------|--------|
| `AuditChain` | `grid/src/audit/chain.ts` | Add `private listeners: Set<AuditListener>`, `onAppend(fn): () => void`, fan-out inside `append()` after `entries.push`. `loadEntries()` must NOT fire listeners (restore path — dashboard hasn't connected yet and shouldn't get historical replay as "live" events). |
| `GridServices` | `grid/src/api/server.ts` | Type unchanged — `WsHub` is constructed *inside* `buildServer` using `services.audit`. No new service to inject. |
| `docker-compose.yml` | `/docker-compose.yml` | Expose WS port (already exposes Grid HTTP). No new service. |

**UNCHANGED components**

- `WorldClock`, `SpatialMap`, `LogosEngine`, `NousRegistry`
- All existing REST endpoints, including `/api/v1/audit/trail` (now doubles as the "rewind" endpoint)
- `GridStore`, MySQL schema, snapshot/restore
- Python brain, JSON-RPC bridge, NousRunner
- All event producers — they continue to call `audit.append(...)` exactly as today

### 3.3 Wire protocol (`/ws/events`)

**Client → Server messages**

```jsonc
{ "type": "subscribe",   "topics": ["nous.*", "trade.matched", "grid.*"] }
{ "type": "unsubscribe", "topics": ["trade.matched"] }
{ "type": "ping" }           // client-driven keepalive
{ "type": "resume", "afterId": 1242 }  // Phase 2 — not v1
```

Topic patterns are simple glob: `*` means any single dotted segment; `nous.*` matches `nous.spoke`, `nous.moved`, `nous.spawned`, `nous.direct_message`. No regex. No nested wildcards.

**Server → Client messages**

```jsonc
{ "type": "hello",   "gridName": "Genesis", "headId": 1242, "serverTime": 1723... }
{ "type": "event",   "entry": { /* AuditEntry */ } }
{ "type": "dropped", "count": 17, "sinceId": 1225, "latestId": 1242 }
{ "type": "pong" }
{ "type": "bye",     "reason": "backpressure" | "shutdown" | "auth" }
```

On receipt of `dropped`, the browser issues `GET /api/v1/audit/trail?offset=1225&limit=100` to fill the gap. This is the fallback-to-REST recovery path — and it's why the REST endpoint stays first-class.

### 3.4 Backpressure policy (bounded queue, drop-oldest, notify)

**The rule:** The producer (`audit.append`) must NEVER block, await, or throw because a websocket is slow. The chain is the source of truth for the world; downgrading a dashboard can never corrupt the world.

**Implementation (per client)**

```
enqueue(entry):
    if ws.bufferedAmount > HIGH_WATERMARK (default 1 MiB):
        queue.pushDropOldest(entry)         # ring buffer, capacity 256
        droppedCount += 1
        markBackpressured()
    elif backpressured and ws.bufferedAmount < LOW_WATERMARK:
        flushQueue()
        sendDroppedMarker()
        clearBackpressured()
    else:
        ws.send(entry)
```

`ws.bufferedAmount` is the native `ws` library's signal — no extra plumbing required.

**Fatal escape hatch.** If a client remains backpressured for > 30 s OR the ring buffer overflows more than 3 times in a minute, send `{type:"bye",reason:"backpressure"}` and close with code 1013 (Try Again Later). The browser reconnects and uses `/audit/trail` to catch up via `lastId`. This bounds per-client memory at `256 × ~1 KB = ~256 KB worst case`.

**Why drop-oldest not drop-newest:** The newest events best represent "the world right now"; losing older events is recoverable via REST offset queries. The `dropped` marker tells the client exactly which range to refetch.

### 3.5 Single broadcast vs per-topic channels

**Single `/ws/events` with client-side filter subscription. Rejected alternatives:**

- `/ws/audit` + `/ws/brain` + `/ws/economy`: 3× connections, 3× heartbeat overhead, fragmented ordering (an event that is both a "trade match" and an "audit entry" appears on two sockets at different times — nightmare for the UI).
- One socket *per Nous* (`/ws/nous/:did`): fine for a focused inspector later, but the Grid overview needs a firehose anyway. Build the firehose first; the per-Nous view is a filter on it.

**Evolution path**

- Phase 3 (rich inner life): add `brain.thinking`, `brain.reflecting` event types. Emit them from NousRunner (it sees the brain's cognitive-phase transitions). Same socket.
- Phase 4 (economy overview): add `trade.proposed`, `trade.matched`, `trade.settled`. Same socket, same mechanism.
- Phase 5 (multi-grid): the WS endpoint stays per-Grid (`grid-A.example/ws/events`, `grid-B.example/ws/events`). A federated observer opens one WS per grid and merges client-side. If later we want server-side federation, insert a `GridBridge` between AuditChains without touching WsHub's contract with clients.

No refactor debt is being accumulated by this choice.

### 3.6 Does Brain emit events?

**No. Not now, not in Phase 4. Possibly in Phase 3 for cognitive-phase events, but still indirectly.**

Reasoning:
1. Brain is authored in Python and connected by JSON-RPC. Teaching it websockets means a second network interface, auth, reconnection, and backpressure — all duplicated.
2. Every brain output that matters for observation already traverses NousRunner, which already calls `audit.append(...)`. The conversion point exists.
3. If Phase 3 adds "Sophia is currently thinking about X," the cleanest path is: brain returns a richer JSON-RPC response including a `thinking_about` phase marker → NousRunner calls `audit.append('nous.thinking', did, {topic})`. Dashboard animations pick it up on the existing socket. Zero new infrastructure.
4. Keeps the Python/TS boundary clean: Python = cognition, TS = world. Websockets are a world concern.

The *only* reason to have the brain emit directly would be if we wanted to see raw, non-audited intermediate thoughts. That's a debugging need, solved by a separate developer tool (stdout/log tailing), not a user-facing feature.

---

## 4. Build Order (Sprint 14)

Dependencies flow strictly top-down. Each step is independently mergeable and testable.

### Step 1 — `AuditChain.onAppend` (~30 min, high confidence)

- Add `private readonly listeners: Set<(e: AuditEntry) => void> = new Set()`
- Add `onAppend(fn)` returning an unsubscribe function
- In `append()`, after `this.entries.push(entry); this.lastHash = eventHash;`, do `for (const l of this.listeners) { try { l(entry); } catch {} }`
- In `loadEntries()`, do NOT fire listeners
- **Tests:** listener fires on append; listener does not fire during restore; unsubscribe works; exception in listener does not break append or other listeners
- No consumers yet — change is dormant until Step 3

### Step 2 — `RingBuffer<T>` utility (~20 min)

- Tiny class: capacity, `push(item)` returns `T | null` (the dropped item, if any), `drainAll()`, `size`
- Unit tests for wrap-around, drop-oldest semantics

### Step 3 — `WsHub` + WebSocket route (~2–3 h)

- `npm i @fastify/websocket` (Fastify 5 compatible, v11+)
- `src/api/ws-hub.ts` defines `WsHub` and `ClientConnection`
  - On construct: `this.unsub = audit.onAppend(e => this.broadcast(e))`
  - `broadcast(e)`: for each client, if topic matches → `client.enqueue(e)`
  - `ClientConnection`: ring buffer (256), backpressure state machine, topic filter
  - `close()`: unsubscribe listener, close all clients
- `server.ts`: `app.register(fastifyWebsocket)`, `app.get('/ws/events', { websocket: true }, (socket, req) => hub.attach(socket))`, `app.addHook('onClose', () => hub.close())`
- Send `hello` on attach with `headId = audit.length`
- **Tests (Vitest):**
  - spin up server, open WS client (`ws` library), subscribe, `audit.append`, assert event received
  - fill client queue beyond 256, assert `dropped` marker with correct count
  - two clients with different filters receive disjoint events
  - unsubscribe removes listener (memory leak check)

### Step 4 — Dashboard stub: Next.js + WS client (~3–4 h)

- Initialize `dashboard/package.json` (currently absent), Next.js 15 app router, TypeScript
- `src/lib/ws.ts`: reconnecting WS client with exponential backoff, `lastEventId` tracking, on gap call `/api/v1/audit/trail?offset=lastSeenId`
- `src/app/grid/page.tsx`: live feed component that subscribes to `*` and renders entries (DASH-01, DASH-04 done)

### Step 5 — Region map and inspector (DASH-02, DASH-03)

- Map is a view over `/api/v1/grid/regions` + WS `nous.moved` events
- Inspector: `GET /api/v1/nous/:did` (new REST endpoint, not WS) for static-ish personality/goals; WS `nous.thinking` later for live emotion updates
- This is mostly UI work; the event pipeline is already paying for itself

### Step 6 — Trade/economy events (DASH-05)

- Ousia transfer machinery already calls audit (confirm in `grid/src/economy/`); if not, add `trade.proposed`/`trade.settled` calls at the existing state transitions
- Dashboard adds a trades panel filtering on `trade.*`

**Explicitly deferred**
- `resume/afterId` replay protocol — REST fallback covers it in v1
- Auth on the WS endpoint — add when the dashboard ships to non-localhost deployments
- Multi-grid federation — Phase 5

---

## 5. Integration Points (explicit)

| Existing code | New dependency it gains |
|---------------|------------------------|
| `AuditChain.append()` | Synchronous fan-out to listeners (≤ N microseconds where N = subscribed clients × matched filter; bounded by `broadcast` not blocking on WS send because we only `enqueue`). |
| `buildServer(services)` | Constructs a `WsHub` from `services.audit`. Registers `@fastify/websocket`. Adds one route. Uses existing Fastify `onClose` hook to tear down the hub. |
| `GridServices` interface | **No change.** The hub is internal to `buildServer`. If a caller wants to introspect clients (tests, metrics), we can later return `{app, hub}` from `buildServer`. |
| `audit.loadEntries(...)` (restore) | **No change and no new behavior.** Listeners do not fire during restore. Live clients that reconnect after a restore see events append with correct `id` sequence and use the REST endpoint to catch up on history. |
| Python brain | **No change.** All new events flow through NousRunner's existing `audit.append` calls. |
| `docker-compose.yml` | **No change** beyond making sure Grid's HTTP port is reachable. WebSocket upgrades use the same port. |

---

## 6. Quality Gates — verification against the brief

- ✅ Integration points with existing Fastify server and AuditChain are explicit — see §5 and §3.2.
- ✅ New vs modified components are clearly labeled — see §3.2.
- ✅ Build order considers dependencies — see §4; strictly linear, independently mergeable.
- ✅ Backpressure and disconnection are addressed — see §3.4 (bounded ring buffer, drop-oldest, `dropped` marker, fatal escape hatch at 30 s stuck or 3 overflows/minute).

---

## 7. Known risks and confidence notes

| Risk | Mitigation | Confidence |
|------|------------|-----------|
| `@fastify/websocket` version drift with Fastify 5 | v11+ is documented as Fastify 5 compatible; pin major version. Straightforward to swap if broken. | HIGH |
| Listener throws and corrupts subsequent notifications | Per-listener try/catch (precedent: `WorldClock.onTick`). | HIGH |
| Event rate spikes beyond projection | Drop-oldest + `dropped` marker + REST fallback. Worst case: dashboard shows a brief gap and auto-recovers. | HIGH |
| Restore path triggers phantom "live" events | `loadEntries()` explicitly bypasses listeners. Covered by unit test. | HIGH |
| Phase 5 federation needs a broker | Swap `audit.onAppend` wiring for a `GridBridge` that relays local + remote entries to the hub. WS contract with clients unchanged. | MEDIUM — federation design is still Phase 5 territory, but the seam is deliberately in the right place. |
| Dashboard is a blank directory, Next.js not yet initialized | Flagged — Step 4 includes scaffolding `package.json`. Blocker for DASH-01..05 but not for the server-side pipeline (Steps 1–3). | HIGH |

---

## 8. One-paragraph summary for the roadmap

Extend `AuditChain` with a synchronous `onAppend` listener (same shape as `WorldClock.onTick`). Add a `WsHub` that subscribes once, fan-outs to per-client bounded queues, and exposes a single `/ws/events` WebSocket endpoint on the existing Fastify server via `@fastify/websocket`. Clients subscribe with glob topic filters; on slow-client detection (`ws.bufferedAmount` over watermark) the hub drops oldest events and emits a `dropped` marker so the browser can refill from the existing `/api/v1/audit/trail` REST endpoint. No new services, no message broker, no changes to the Python brain, no new dependencies in `GridServices`. Build order: `onAppend` → `RingBuffer` → `WsHub` + WS route → Next.js client + live feed → map/inspector → economy panel. Federation (Phase 5) later replaces the audit subscription with a `GridBridge` without changing the client contract.
