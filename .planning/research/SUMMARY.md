# Research Summary — Sprint 14 Dashboard (v2.0 Milestone)

**Milestone:** DASH-01 through DASH-05 — First observable window into the Genesis Grid
**Synthesized:** 2026-04-17
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, PROJECT.md

---

## 1. TL;DR — Decisions Already Made

- **Transport is WebSocket, not SSE.** One `/ws/events` socket per client, JSON frames, client-side topic filtering via glob patterns (`nous.*`, `trade.*`). SSE rejected — dashboard needs bidirectional subscribe/unsubscribe from day one.
- **AuditChain is the event bus.** A minimal synchronous `onAppend(listener)` hook mirroring `WorldClock.onTick` — no EventEmitter library, no Redis, no NATS, no Kafka. Brain does NOT emit events; NousRunner already translates every brain action into `audit.append(...)`.
- **Backpressure is drop-oldest + REST refill.** 256-entry ring buffer per client; on overflow, send `{type:"dropped", sinceId, latestId}` marker and let the browser fill the gap via the existing `GET /api/v1/audit/trail` REST endpoint. Producer never blocks on slow observers.
- **Privacy is default-deny via allowlist.** Only explicitly-whitelisted event types reach the WebSocket. Raw LLM prompts, wiki contents, emotion deltas, and reflection output must never be appended to AuditChain — sanitize at the NousRunner boundary.
- **Stack is Next.js + `@fastify/websocket` + `@fastify/static`.** Two new npm deps in `grid/`, scaffold Next.js in the existing empty `dashboard/` workspace. Stay same-origin in dev (Fastify serves WS; Next.js runs on :3001 with `@fastify/cors` allowlist).

---

## 2. Stack — Exact Install List

### Install (server, `grid/`)

```bash
cd grid
npm install @fastify/websocket@^11 @fastify/static@^8
```

| Package | Version | Purpose |
|---------|---------|---------|
| `@fastify/websocket` | `^11.0.0` | WS endpoint at `/ws/events`. v11 is the Fastify 5-aligned major. |
| `@fastify/static` | `^8.0.0` | Fallback static serving + optional vanilla-HTML escape hatch. |

### Install (dashboard, `dashboard/`)

```bash
cd dashboard
npm init -y
npm install next@^15 react@^18 react-dom@^18 typescript @types/react @types/node
npm install partysocket  # optional — reconnecting WS wrapper
```

### Already present (lockfile-verified)

- `fastify` 5.8.5, `@fastify/cors` 10.1.0, `@fastify/rate-limit` 10.3.0, `ws` 8.20.0 (transitive)

### Do NOT install for v1

| Package | Why Not |
|---------|---------|
| `socket.io` | Custom protocol + rooms we don't need. ~40 KB. |
| `msgpackr` | At ~3 evt/sec × 300 B, JSON's debuggability wins. |
| `reconnecting-websocket` | Effectively abandoned. Use `partysocket` or 30 lines inline. |
| Redis / NATS / Kafka | No federation. AuditChain is the bus. |
| `@tanstack/react-query` | WS push is source of truth; no cache to invalidate. |
| State libs (`zustand`, `jotai`) | Array + ring buffer is enough. |
| `tailwindcss` | Plain CSS fine for v1. |
| Playwright E2E for dashboard | DevTools + vitest on server is enough for v1. |

### Verification gap

Before install, confirm Fastify 5 compatibility:

```bash
npm view @fastify/websocket@latest peerDependencies
npm view @fastify/static@latest peerDependencies
```

If Fastify 6 has shipped, pin the last 5-compatible release.

---

## 3. Architecture — The Critical Seam

### Data flow

1. `NousRunner` / `GridCoordinator` / `GenesisLauncher` call `audit.append(type, actor, payload)` — unchanged.
2. Inside `AuditChain.append()`, AFTER `entries.push` and `lastHash` commit, a synchronous `for (l of listeners) safeEmit(l, entry)` fan-out runs.
3. `WsHub` (registered once at server startup via `audit.onAppend`) receives the entry, applies a broadcast **allowlist**, then fans out to each `ClientConnection`.
4. Each `ClientConnection` checks its topic filter; if matched and `ws.bufferedAmount < watermark`, calls `ws.send(JSON.stringify(frame))`; otherwise pushes to ring buffer.
5. Browser reads `lastEventId` from each frame; on reconnect or `dropped` frame, calls `GET /api/v1/audit/trail?offset=sinceId` to refill.

### Component inventory

**NEW**

| Component | Path | Responsibility |
|-----------|------|---------------|
| `AuditChain.onAppend()` | `grid/src/audit/chain.ts` (add) | ~15 line listener hook, mirrors `WorldClock.onTick`. |
| `RingBuffer<T>` | `grid/src/api/ring-buffer.ts` | ~30 line bounded FIFO. |
| `WsHub` + `ClientConnection` | `grid/src/api/ws-hub.ts` | Owns `Set<ClientConnection>`, subscribes once to `audit.onAppend`, enforces allowlist, owns backpressure state machine. |
| WS route | `grid/src/api/server.ts` (add ~20 lines) | `app.register(fastifyWebsocket)` + `/ws/events` handler. |
| Dashboard WS client | `dashboard/src/lib/ws.ts` | Reconnecting WS + `lastSeenId` cursor + REST catch-up. |
| Dashboard live feed | `dashboard/src/app/grid/page.tsx` | Firehose with ring-buffer of last 500 entries. |

**MODIFIED**

| Component | File | Change |
|-----------|------|--------|
| `AuditChain` | `grid/src/audit/chain.ts` | Add listener set + `onAppend()`. `loadEntries()` must NOT fire listeners. |
| `buildServer` | `grid/src/api/server.ts` | Constructs `WsHub`. Registers WS plugin. `onClose` hook for graceful shutdown. |

**UNCHANGED**: Python brain, JSON-RPC bridge, WorldClock, SpatialMap, LogosEngine, NousRegistry, GridStore, MySQL schema, all existing REST endpoints, all existing event producers.

### The critical seam

```
AuditChain.append(type, actor, payload)
  ├── entries.push(entry)                   ← commit to chain
  ├── this.lastHash = eventHash             ← commit hash
  └── for (l of listeners) safeEmit(l, e)   ← FAN-OUT (new)
                                 │
                                 └──→ WsHub.broadcast(entry)
                                        ├── allowlistFilter(entry.type)
                                        └── for (c of clients) c.enqueue(entry)
                                                                    │
                                                                    └──→ ws.send(...) | ringBuffer.push(...)
```

**Invariants:**

1. `append()` returns BEFORE any observer I/O happens.
2. A listener throwing is swallowed.
3. `loadEntries()` does NOT fire listeners (restore path).
4. `AuditChain.verify()` still returns `{valid: true}` with listeners attached.

---

## 4. v1 Feature Set

### Table stakes — ship in Sprint 14 (ordered)

| # | Feature | Code | Justification |
|---|---------|------|---------------|
| 1 | Tick heartbeat + liveness | TS-5 | Without this, every other signal is suspect. Trivial. |
| 2 | AuditChain firehose (WS live tail) | DASH-01, DASH-04 | The `strace` view. Proves Grid is alive. |
| 3 | Region map + Nous positions | DASH-02 | Position is the cheapest "I see it" signal. |
| 4 | Economy snapshot (balances + trades) | DASH-05 | Validates free-economy pillar in <5 seconds. |
| 5 | Per-Nous inspector (Psyche + Telos + Thymos + last action) | DASH-03 | Turns world-monitor into mind-monitor. Noēsis-defining view. |

### Differentiators — Phase 2+ (defer)

- **D-1:** Per-Nous "current thought" / reasoning trace — distinguishes Noēsis from any trace tool. Requires brain introspection + sovereignty gating.
- **D-2:** Event-type + actor filter on firehose — essential at 10+ Nous.
- **D-3:** Memory highlights per Nous — top-K retrievals. Sovereignty constraints.
- **D-4:** Telos timeline — goal evolution across ticks.
- **D-5:** Law trigger highlights — break out visually from firehose noise.

### Anti-features — never ship

| Anti-feature | Why |
|---|---|
| Population-level KPIs (avg reputation, trades/hour) | Aggregation **hides** emergence. |
| Gamified UI (XP, cute avatars) | Frames Nous as game characters, not minds. |
| Cross-Nous memory inspection without consent | Violates sovereignty pillar. |
| Puppet controls ("move Sophia to Agora") | Violates Human Channel consent model. |
| Auto-summarization by narrator LLM | Lossy interpreter wasn't in the simulation. |
| Headline LLM cost meter | Correct for LLMOps; wrong for a world. |
| Polished onboarding / tutorial | v1 audience is one developer. |

---

## 5. Critical Pitfalls (Top 6)

| # | Pitfall | Symptom | Prevention | Phase |
|---|---------|---------|------------|-------|
| 1 | **Listener throws → append() throws → simulation halts** | Tick loop dies when WS handler has a bug. | Emit AFTER commit. Wrap in `safeEmit()`. Regression test: throwing listener mustn't corrupt chain. | Phase 1 |
| 2 | **Privacy leak: broadcasting LLM prompts / wiki / reflection** | Browser receives inner monologue; sovereignty violated. | Default-deny allowlist. Never append raw prompts/emotions to AuditChain — sanitize at NousRunner. Grep: no `prompt`, `response`, `wiki`, `thought` in payloads. | Phase 1 + enforced every phase |
| 3 | **Synchronous WS send on tick hot path adds LLM-scale latency** | Tick duration balloons with N observers. | Listener does only `enqueue` — no `ws.send()` inside. Budget: <100µs p99 on `append()`. Determinism test: 0 vs 10 observers → identical chain hash. | Phase 1 |
| 4 | **Slow client → head-of-line blocking + unbounded memory** | One laggy tab freezes all observers; Grid OOM. | Per-client 256-entry ring buffer. Check `ws.bufferedAmount`; drop-oldest on overflow + emit `dropped`. Escape: stuck >30s → close 1013. | Phase 2 |
| 5 | **Lost events between disconnect and reconnect** | Background tab reconnects, silently misses events. | Monotonic `entry.id` in every frame. Client tracks `lastSeenId`. Reconnect: send `subscribe {sinceId}`; server replays or tells client to refill via REST. 15s heartbeat. | Phase 2 + Phase 3 |
| 6 | **Reconnect storm on `docker compose restart`** | Every open tab retries 100×/sec, pegs CPU. | Exponential backoff with jitter: 250ms → 30s cap. Reset on success. ~10 line utility. | Phase 3 |

---

## 6. Open Questions — Planner Decides

1. **Next.js from day one vs vanilla HTML first?** — Recommend Next.js. `dashboard/` workspace exists, PROJECT.md constraints require it, doing it twice is waste. Keep `@fastify/static` for fallback.
2. **Broadcast-before-persist consistency?** — Recommend broadcast before persist, document "stream is best-effort; REST is source of truth." Frontend reconciles via `lastEventId`.
3. **Initial broadcast allowlist set?** — Allow: `nous.spawned`, `nous.moved`, `nous.spoke`, `nous.direct_message` (metadata only), `trade.proposed`, `trade.settled`, `law.triggered`, `tick`, `grid.started`, `grid.stopped`. Deny fields matching `/prompt|response|wiki|reflection|thought|emotion_delta/`.
4. **Auth on `/ws/events` for v1?** — Bind `127.0.0.1` default; shared-secret env var when binding `0.0.0.0`. Full auth deferred to Phase 4+.
5. **Brain introspection for DASH-03?** — Does `get_current_state(nous_id)` RPC exist, or does Phase 4 add it?
6. **Dashboard workspace scaffolding?** — Empty shell exists. Phase 3 owns the Next.js init.

---

## 7. Recommended Milestone Shape — 4 Phases

### Phase 1 — AuditChain listener API + broadcast allowlist

**Goal:** Make audit chain observable without changing its contract or performance.

**Deliverable:**
- `AuditChain.onAppend(fn): () => void` — sync fan-out with per-listener try/catch, fires only after commit.
- `loadEntries()` does NOT fire listeners (restore path).
- `grid/src/audit/broadcast-allowlist.ts` — default-deny set of safe event types.
- `RingBuffer<T>` utility + tests.
- **Regression gate:** All 944 TS tests pass. `AuditChain.verify()` valid. Determinism test: 100-tick simulation with 0 vs 10 listeners produces byte-identical chains. Benchmark: `append()` p99 adds <100µs.

### Phase 2 — WsHub + `/ws/events` endpoint

**Goal:** Real-time event delivery with backpressure that can't hurt the simulation.

**Deliverable:**
- `WsHub` + `ClientConnection` in `grid/src/api/ws-hub.ts`.
- 256-entry ring buffer per client, drop-oldest, `dropped` marker.
- WS route in `buildServer`; `onClose` hook drains cleanly.
- Wire protocol: `hello`, `event`, `dropped`, `ping/pong`, `bye`.
- Topic-filter glob matching.
- Local-dev auth: `127.0.0.1` default; shared-secret env var for `0.0.0.0`.
- **Tests:** connect/subscribe/receive; queue fill → `dropped`; two clients with disjoint filters; 10k connect/disconnect → `clients.size === 0` and heap stable.

### Phase 3 — Next.js dashboard v1: firehose, heartbeat, region map

**Goal:** First view of the Grid a developer can stare at and believe.

**Deliverable:**
- Scaffold `dashboard/package.json` (Next.js 15, app router, TypeScript).
- `dashboard/src/lib/ws.ts`: reconnecting client with exponential backoff + jitter, `lastSeenId` cursor, REST refill on `dropped`.
- `/grid` route: live firehose (last 500 events in DOM).
- Tick heartbeat widget: current tick + "last event N seconds ago" with stale threshold.
- `/grid` route: region map rendering `GET /api/v1/grid/regions`, updating on `nous.moved`. SVG or react-flow.
- **Tests (manual):** refresh → events stream; background tab → reconnect no gaps; kill Grid → backoff; restart → auto-reconnect.

### Phase 4 — Economy, inspector, Docker polish

**Goal:** Complete the five table-stakes views; `docker compose up` ships clean.

**Deliverable:**
- Economy panel: balances + recent trade list, filtered on `trade.*`.
- Per-Nous inspector: `GET /api/v1/nous/:did` + tick-boundary updates. **Blocked on Q5** — brain introspection RPC.
- Docker: Grid binds `0.0.0.0` in container; compose exposes WS port; dashboard service → `grid:8080`.
- Smoke test: clean `docker compose up` → dashboard connects first attempt.
- **Gate:** all PITFALLS.md integrity non-negotiables hold.

---

## 8. Confidence

| Area | Level |
|------|-------|
| Stack versions | MEDIUM-HIGH (lockfile verified; plugin Fastify 5 alignment needs `npm view` confirmation) |
| Feature ranking | MEDIUM |
| Architecture | HIGH |
| Pitfalls (generic) | HIGH |
| Pitfalls (Noēsis-specific sovereignty) | MEDIUM |

**Gaps for planner:**
- Brain introspection RPC feasibility (DASH-03 blocker).
- Trade event taxonomy in AuditChain (offer/counter/accept split).
- Consistency model documentation in Phase 2.
- Next.js vs vanilla HTML decision — recommend Next.js but planner owns.
