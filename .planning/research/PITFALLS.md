# PITFALLS — Sprint 14 Dashboard (Observability)

**Domain:** Real-time observability for an AI-agent simulation (Noēsis)
**Milestone context:** ADDING WebSocket streaming + browser observer to a system with 944+ passing TS tests, 226 Python tests, Sprint 13 complete.
**Researched:** 2026-04-17
**Confidence:** HIGH for generic WS/Node pitfalls (Fastify + ws are well-trodden); MEDIUM for Noēsis-specific concerns (derived from PHILOSOPHY.md + chain.ts inspection).

The prime directive for this sprint: **Do not regress what works.** AuditChain integrity, REST API stability, and `docker compose up` ergonomics are load-bearing. Every pitfall below is scored against those.

---

## Critical Pitfalls

These cause data corruption, privacy violations, or silent regressions of existing tests. They must be addressed in the phase they surface in — not deferred.

### C1. Listener throws → append() throws → tick handler crashes → simulation halts

**Category:** AuditChain modifications
**Symptom:** A single broken WebSocket listener (or a buggy subscriber) causes `AuditChain.append()` to throw. That throw propagates up through the tick loop in `NousRunner`/`GridCoordinator`, ending the simulation. Tests that append audit events also start failing.
**Root cause:** Naively attaching listeners synchronously inside `append()` — e.g. `for (const l of listeners) l(entry)` — means any listener exception aborts the append call. The current chain.ts has no listeners at all (pure synchronous push); adding them naively is the exact way to lose the current "append never throws" invariant.
**Prevention:**
- Emit AFTER `this.entries.push()` and `this.lastHash = eventHash` — the entry is committed before any observer runs.
- Wrap every listener call in try/catch; log and swallow. Use a dedicated `safeEmit()` helper. Never let an observer reach into `append()`'s control flow.
- Treat the listener interface as "fire-and-forget notification," not "hook." Document it.
- Add a regression test: a listener that throws must not affect chain length, hash, or return value of `append()`.
**Detection:** New flaky tests in `grid/tests/audit/`. Tick loop logs "listener error" in production but chain remains intact.
**Phase:** Phase 1 (AuditChain instrumentation) — MUST ship with the listener API in the same commit.

---

### C2. Broadcasting Nous private memory / LLM reasoning through the audit stream

**Category:** Agent-simulation-specific / Noēsis sovereignty
**Symptom:** Observer dashboard displays a Nous's private wiki contents, reflection-engine raw LLM output, emotional state deltas, or goal internals that were never meant to leave the Brain process. Violates PHILOSOPHY §1 ("No central system reads its thoughts") and §4 ("Memory must be earned" — curated, not exposed).
**Root cause:** Two converging mistakes:
1. Temptation to add `audit.append('reflection.completed', did, { prompt, response, wikiDelta })` because "it's just for the dashboard."
2. Payloads in AuditChain are `Record<string, unknown>` (chain.ts:23) — there's no schema enforcement. Whatever someone stuffs into `payload` gets hashed, persisted to MySQL, and — once Sprint 14 lands — broadcast to every connected browser.
**Prevention:**
- **Rule:** AuditChain records *public-observable events* only: movements, trades, message-sent (not message-content unless the message was public), law-proposed, reputation-change. Mirror the Human Channel's consent model.
- Maintain an explicit allowlist of event types the WS broadcaster forwards. Default-deny: if a new event type appears that isn't in the allowlist, it stays server-side and is logged.
- For any payload field that might contain inner life (reasoning, wiki pages, raw emotion vectors), require a sanitizer: the Brain publishes a redacted summary, the raw form never reaches the chain.
- Add a test fixture: a "private event" (e.g. `brain.reflection.internal`) exists in the chain but is filtered out of the WS broadcast; the frontend receives nothing for it.
- Document the boundary in a header comment on the broadcast allowlist — future contributors need to see PHILOSOPHY.md referenced at the point of decision.
**Detection:** Review of what each Phase emits. Privacy audit: grep the chain for any event whose payload includes `prompt`, `response`, `wiki`, `reflection`, `thought`, `emotion_delta`.
**Phase:** Phase 1 (define the allowlist + sanitizer pattern BEFORE brain integration in Phase 4/later). If brain integration happens this sprint, enforce before wiring.

---

### C3. Broadcast on the tick hot path adds LLM-scale latency to every append

**Category:** WebSocket implementation / Performance
**Symptom:** Tick duration inflates. Nous feel sluggish. Python `Brain` side starts timing out on JSON-RPC because the Grid is slow to ack. Existing E2E tests (Sprint 11) that measure tick throughput regress.
**Root cause:** Calling `ws.send()` synchronously (or worse, `await`ing each client sequentially) inside the listener fired from `append()`. With N connected browsers, each append now blocks for N network round-trips. Nous brains are already LLM-bound; adding any synchronous per-client I/O in the append path is a second-order latency explosion.
**Prevention:**
- Listener does only: push entry ref into an in-memory ring buffer + `queueMicrotask` / `setImmediate` a flush. Never I/O inside the listener.
- Broadcaster flushes asynchronously on a separate tick (e.g. every 50ms or on buffer threshold), batching multiple entries into one WS frame.
- Benchmark: measure `append()` p99 before and after listener wiring. Budget: <100µs added. If it exceeds that, something is wrong.
- `ws.send()` uses callback form with backpressure check (see C4) — never block.
**Detection:** Benchmark task in Phase 1. If tick loop's audit-append time visibly grows, bisect.
**Phase:** Phase 1 (listener API) — bake in async decoupling from day one.

---

### C4. Slow client causes head-of-line blocking for all other clients

**Category:** WebSocket implementation
**Symptom:** One browser tab on a laggy Wi-Fi connection → all other observers stop receiving events → server memory grows unbounded as buffered sends pile up → eventually OOM or the slow client's socket is never drained.
**Root cause:** `ws.send()` in Node's `ws` library (or `@fastify/websocket`) queues unsent data in `ws.bufferedAmount`. If you naively iterate all clients and call `send()`, a single slow consumer backs up its own buffer indefinitely while you keep stuffing it, and a shared broadcast queue can serialize everyone behind the laggard.
**Prevention:**
- Per-client bounded outbound queue (e.g. 1000 events or 1MB). On overflow, *drop* events and send the client a `{type: 'resync', lastId: N}` marker telling it to re-fetch via REST.
- Before every `send`, check `ws.bufferedAmount`. If above threshold, mark client as "lagging" and skip further events until drained.
- Each client has its own send loop, not a shared one. A slow client slows only itself.
- Document "slow-client policy: drop + resync" as a first-class behavior, not a failure mode.
**Detection:** Load test with an artificially throttled client (use `tc` or a proxy). Verify other clients' latency is unaffected. Check RSS stays flat.
**Phase:** Phase 2 (WS server implementation).

---

### C5. Listener fires before MySQL persistence completes

**Category:** AuditChain modifications / consistency
**Symptom:** Dashboard shows event #1234. User refreshes the browser, REST query returns entries 1-1233. Event "disappeared." Or worse: Grid crashes between broadcast and persist — observers saw an event that never existed in the durable chain.
**Root cause:** After Sprint 12, AuditChain lives in memory and is snapshotted to MySQL. If the broadcast listener fires synchronously in `append()` but the MySQL write is async and happens later (or in `snapshot()`), there's a window where observers have seen an event the DB hasn't. On crash, the chain restored from MySQL is shorter than what observers remember.
**Root cause (secondary):** Current chain.ts `append()` is pure in-memory (line 43-44). Persistence is orchestrated elsewhere. Broadcast hooked into `append()` would fire before any persistence by design.
**Prevention:**
- Decide and document the semantics: "The audit stream is best-effort; MySQL is the source of truth. Observers may see events that roll back on crash." This is acceptable IF the frontend treats stream events as transient and always reconciles against REST on reconnect.
- Broadcast message includes the event's `id` and `eventHash`. Frontend, on reconnect, calls `GET /audit?sinceId=...` to verify it hasn't drifted. Missing IDs → resync.
- If stronger guarantees are needed (Phase 12+ territory), move broadcast to *after* persistence — but this couples dashboard latency to MySQL write latency and should be explicit.
**Detection:** Kill-9 test: crash the Grid between emit and persist; restart; confirm frontend reconciles.
**Phase:** Phase 2 (WS broadcaster design) — document the consistency model. Phase 3 (frontend) — implement reconciliation on reconnect.

---

### C6. Lost events between disconnect and reconnect

**Category:** WebSocket implementation / UX
**Symptom:** Dashboard shows events 1-500, browser tab backgrounded for 30s, WS drops, auto-reconnects. Dashboard resumes with event 800. Events 501-799 silently missing — user has no idea.
**Root cause:** Naive broadcast has no client cursor. Server doesn't know what each client has seen; client doesn't tell the server where to resume.
**Prevention:**
- Every WS message includes the audit entry's `id` (monotonic, already present in `AuditEntry.id`).
- Client tracks `lastSeenId`. On reconnect, sends `{type: 'subscribe', sinceId: lastSeenId}`. Server replays missed entries from its in-memory chain (cheap — it's already there, see `chain.query()`).
- Bound the replay: if `lastSeenId` is older than the oldest retained entry (post-snapshot truncation, eventually), server responds with `{type: 'resync-full'}` and the client refetches via REST.
- Heartbeat every 15s so disconnects are detected fast and the reconnect cursor doesn't drift.
**Detection:** Test: kill the WS connection mid-broadcast, reconnect, assert no gaps in the received event IDs.
**Phase:** Phase 2 (WS protocol design) + Phase 3 (frontend client).

---

## Moderate Pitfalls

Cause real bugs but not silent corruption. Prevention is straightforward once identified.

### M1. Unbounded DOM growth in the event feed

**Category:** Browser-side
**Symptom:** Leaving the dashboard open for an hour, browser tab freezes. DevTools show 50,000 DOM nodes in the event log component.
**Root cause:** Appending every event as a new DOM node forever.
**Prevention:** Virtualized list (windowing) OR ring buffer of last N (e.g. 500) events in memory + DOM. Older events accessible via "load older" button that hits REST `/audit?beforeId=...`.
**Phase:** Phase 3 (frontend).

### M2. Multiple tabs → multiplied WS connections → multiplied server load

**Category:** Browser-side / Resource
**Symptom:** Dev opens 5 tabs. Grid is now broadcasting every event 5x to the same browser.
**Root cause:** No coordination across tabs.
**Prevention:**
- Acceptable for v1 — document as known limitation.
- Phase 3+: use a `SharedWorker` or `BroadcastChannel` so one tab holds the WS and fans out to siblings. Only worth doing if it's a real problem.
- Server-side: enforce a per-IP max connection count (e.g. 10) as a DoS guard.
**Phase:** Phase 2 (server caps). Phase 3 (accept as known-limit; don't over-engineer).

### M3. Autoreconnect loop hammers the server during restart

**Category:** Browser-side
**Symptom:** `docker compose restart grid` → every open tab reconnects 100x/sec until Grid is up, pegging CPU and spamming logs.
**Root cause:** Naive `ws.onclose = () => new WebSocket(...)` with no backoff.
**Prevention:** Exponential backoff with jitter: 250ms → 500ms → 1s → 2s → ... cap at 30s. Reset on successful connect. A simple 10-line `reconnect.ts` utility, tested.
**Phase:** Phase 3 (frontend).

### M4. JSON.parse on every message blocks the main thread

**Category:** Browser-side
**Symptom:** Under high event rate (100+ events/sec during a busy tick), UI jank, dropped frames on region map animation.
**Root cause:** Parsing + React re-rendering on every event.
**Prevention:**
- Batch: server sends arrays of events in one frame (`{type: 'batch', events: [...]}`) flushed every 50ms. Client parses once per batch.
- Throttle re-renders (e.g. `requestAnimationFrame` coalescing).
- For very high volumes, consider binary encoding (msgpack) — but only if measured need.
**Phase:** Phase 2 (server batching) + Phase 3 (client render throttling).

### M5. CORS / Origin handling with Fastify WS

**Category:** Docker / deployment
**Symptom:** WS connection refused in browser: "failed WebSocket handshake." REST works fine.
**Root cause:** `@fastify/cors` handles HTTP but NOT the WebSocket upgrade. The upgrade handler needs its own origin check. Also: `ws://` vs `wss://` mismatch if TLS terminates at a proxy.
**Prevention:**
- Explicit `verifyClient` / origin check on the WS route. Allowlist local origins for dev (`http://localhost:*`), configurable for prod.
- Frontend connects via same-origin when possible (`new WebSocket(\`ws${location.protocol === 'https:' ? 's' : ''}://${location.host}/ws\`)`).
- Document the rules in the Grid server README section for DASH-01.
**Phase:** Phase 2 (server) + Phase 4 (Docker).

### M6. docker-compose port / networking mismatch

**Category:** Docker / deployment
**Symptom:** `docker compose up` starts fine, dashboard loads, but WS connection fails: "localhost:8080 refused."
**Root cause:** Common footguns:
- Grid's Fastify binds `127.0.0.1` inside the container → not reachable from host. Must bind `0.0.0.0`.
- `ports: ["8080:8080"]` missing or mismatched in `docker-compose.yml`.
- Dashboard (Next.js) running on host tries to hit `localhost:8080` which works, but if dashboard is also containerized, it must hit `grid:8080` (service name) not `localhost`.
**Prevention:**
- Grid server: always `host: '0.0.0.0'` when `NODE_ENV !== 'test'`. Configurable env var.
- Document both host-dev (`localhost:8080`) and container-to-container (`grid:8080`) modes in the dashboard README.
- Add a tiny `docker compose up` smoke test script to CI or as a manual checklist: curl REST, open WS, receive one event, exit 0.
**Phase:** Phase 4 (Docker integration).

### M7. Reverse proxy strips WS Upgrade headers

**Category:** Docker / deployment (production)
**Symptom:** Works in dev (`docker compose up`), fails in staging behind nginx/Caddy/Traefik with 400 or hangs forever.
**Root cause:** Default nginx config doesn't forward `Upgrade` and `Connection: upgrade` headers. HTTP/1.1 required.
**Prevention:** Document the required proxy snippet in deployment docs:
```nginx
location /ws {
    proxy_pass http://grid:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```
**Phase:** Phase 4 (deployment docs). Not blocking for v1 local-dev.

### M8. Memory leak from unclosed sockets / forgotten listeners

**Category:** WebSocket implementation
**Symptom:** Grid RSS climbs steadily over hours. `process.memoryUsage().heapUsed` grows.
**Root cause:** WS `close` handler doesn't remove the client from the broadcast set. AuditChain listener added per connection (anti-pattern) and never removed.
**Prevention:**
- Single chain-level listener feeds a shared `clients: Set<WsClient>` — per-connection listeners are forbidden.
- `ws.on('close', () => clients.delete(client))` is mandatory. Also `on('error', ...)` → same cleanup.
- Long-running test: connect/disconnect 10,000 times, assert `clients.size === 0` and heap stable.
**Phase:** Phase 2 (WS server).

---

## Minor Pitfalls

Cheap to prevent once named; easy to skip accidentally.

### m1. Event ordering across multiple listeners

**Category:** AuditChain modifications
**Symptom:** If two listeners both broadcast (e.g. a metrics listener + a WS listener), a frontend occasionally receives events out of order, or sees event N's metrics before event N.
**Prevention:** Listeners invoked in registration order, synchronously (but outside the append mutation). Document this. Single broadcast listener is simpler; resist the urge to multiply listeners.
**Phase:** Phase 1.

### m2. Causal-order confusion for the viewer

**Category:** Agent-simulation-specific
**Symptom:** Dashboard shows "Hermes accepted trade" before "Sophia proposed trade" because message latency differed or events batched out of order after client-side parsing.
**Prevention:** Events carry `id` (monotonic append order). Frontend sorts by `id` before rendering, never by receive-time. Clock-based ordering is forbidden — PHILOSOPHY §"Simulation should be invisible" says ticks are explicit; trust the tick number.
**Phase:** Phase 3 (frontend event buffer).

### m3. Observer effect — does broadcasting alter simulation behavior?

**Category:** Agent-simulation-specific
**Symptom:** Tick durations with 0 observers differ from tick durations with 20 observers. Nous behavior should not differ, but timing-dependent decisions (if any exist) might drift.
**Prevention:**
- The async-decoupled broadcast (C3) ensures observer count does not affect tick duration beyond a noise floor.
- Add a test: run simulation seed S for 100 ticks with 0 observers, then again with 10 observers connected. Snapshot chains must be byte-identical. If they aren't, there's a hidden coupling — find it.
- Nous decisions must be deterministic given (seed, tick, inputs). They must not read from wall-clock or network state influenced by observers.
**Phase:** Phase 1 (determinism test) + Phase 2 (measured).

### m4. Authentication / authorization not scoped in v1

**Category:** Security
**Symptom:** Anyone on the network who can reach port 8080 can open the WS and read the full audit stream — which, per C2, may include sensitive operational info even if not Nous private memory.
**Prevention:**
- Local-dev default: bind `127.0.0.1`, no auth.
- When binding to `0.0.0.0` (Docker, VPS): require a shared-secret token via `Sec-WebSocket-Protocol` or a query param. Read from env.
- Document clearly: v1 is not a public-internet-safe deployment. Full auth is out-of-scope (PROJECT.md Out of Scope: "Real cryptographic signing" — Phase 4).
**Phase:** Phase 2 (server) — document and stub. Phase 4 (deployment) — enforce.

### m5. Dashboard tries to use old AuditEntry shape after schema change

**Category:** Version drift
**Symptom:** Future sprint adds a field to `AuditEntry`; old dashboard builds crash.
**Prevention:** Frontend treats unknown fields as additive. Zod schema on parse with `.passthrough()`. Never destructure required fields without defaults.
**Phase:** Phase 3 (frontend).

---

## Phase-Specific Warnings

| Phase | Primary Risk | Must Address Pitfalls |
|-------|--------------|----------------------|
| **Phase 1: AuditChain listener API** | Break 944-test invariant | C1, C2 (allowlist), C3 (async decouple), m1, m3 (determinism) |
| **Phase 2: WS server (Fastify + ws)** | Introduce memory / backpressure bugs | C4, C5 (consistency doc), C6 (resume protocol), M5, M8, m4 |
| **Phase 3: Browser frontend** | UX degrades over time, reconnect storms | M1, M2, M3, M4, m2, m5 |
| **Phase 4: Docker / compose integration** | "Works on my host" | M6, M7 |
| **Phase 5 (if in-scope): Brain integration** | Sovereignty violation | C2 (hardest here — reflection/wiki/emotions) |

---

## Integrity Non-Negotiables

Before merge, the following must still be true:

1. `AuditChain.verify()` returns `{valid: true}` after any number of appends with listeners attached. Hash chain unchanged.
2. `AuditChain.all()` and `loadEntries()` roundtrip unchanged (persistence is untouched).
3. A listener throwing does not affect `append()` return value or chain state.
4. Snapshot + restore (Sprint 12) still works — broadcasting is NOT part of the durable state.
5. Tick throughput (E2E benchmark, Sprint 11) regresses by less than 2% with 10 observers connected.
6. `docker compose up` from a clean checkout launches Grid + Brain and the dashboard connects on first attempt.
7. All 944 existing TS tests still pass. New tests cover: listener-safety, WS resume, broadcast allowlist, reconnect backoff.

---

## Sources

- `grid/src/audit/chain.ts` — current implementation (no listeners; pure synchronous push).
- `PHILOSOPHY.md` §1 Sovereignty, §4 Memory Must Be Earned, §7 Humans Are Guardians — basis for C2 and the allowlist pattern.
- `.planning/PROJECT.md` — scope: DASH-01 through DASH-05, constraint "extend existing REST API."
- Fastify WebSocket plugin docs (`@fastify/websocket`) — MEDIUM confidence for header-handling specifics, verify at implementation time.
- `ws` library README — backpressure semantics (`bufferedAmount`). HIGH confidence (well-documented pattern in Node ecosystem).
- General WS production patterns (head-of-line, resume cursor, exponential backoff) — HIGH confidence, well-established.
