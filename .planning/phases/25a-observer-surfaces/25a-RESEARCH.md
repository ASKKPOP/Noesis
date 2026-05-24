# Phase 25a: Observer Surfaces — Research

**Researched:** 2026-05-21
**Domain:** Steward Console expansion — read-only observability surfaces (5 surfaces, 0 new audit events)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-25a-01:** Phase 25a is sub-phase 1 of 3 (25a → 25b → 25c). Ships first. Allowlist delta = 0.
- **D-25a-02:** Cognitive inspector: new Brain HTTP endpoint `GET /brain/<did>/cognitive-snapshot`. First read endpoint outside the tick RPC contract.
- **D-25a-03:** Brain endpoint contract: `{reflexion_count, rule_count, skill_titles_topk: string[], drive_levels: {hunger, curiosity, safety, boredom, loneliness}: float, last_sleep_tick: int, creed_violation_count: int}`. Skill titles (not bodies) are the ONLY Brain-internal text exposed; they appear only at this endpoint, never on the broadcast wire.
- **D-25a-04:** Steward access: H3+ gated. Steward backend → Grid proxy → Brain (Steward NEVER calls Brain directly). Every cognitive-snapshot query emits the existing `operator.inspected` event (no allowlist delta).
- **D-25a-05:** Brain endpoint must be grep-gated. Forbidden plaintext keys: `reflexion_text`, `rule_text`, `creed_text`, `skill_body`, `lore_body`, `whisper_plaintext`. `skill_title` is exempt. New CI script: `scripts/check-cognitive-snapshot-plaintext.mjs`.
- **D-25a-06:** Brain health page: 4 metric families, all from existing allowlisted events. (1) Tick latency p50/p95 + queue depth — Grid-side only. (2) Reflexion buffer fill, skill store size, rule count — from audit event aggregation. (3) Drive levels from `ananke.drive_crossed` + sleep cadence from `nous.sleep.entered`/`nous.sleep.completed` deltas. (4) Coherence violations from `nous.creed_violation` count.
- **D-25a-14:** Live firehose: new `/firehose` route distinct from `/audit`. WebSocket tail, no filters, no JSON expand, color-coded by event family. New Grid endpoint `GET /audit/firehose` (WebSocket upgrade). Component sharing with `/audit` is non-goal.
- **D-25a-15:** `/audit` unchanged. Two routes, different jobs.
- **D-25a-16:** Allowlist monitor: static reference (event name, payload schema, sole-producer file path) + runtime drift detection (Grid-side hook on `AuditChain.onAppend`). New Grid endpoint `GET /audit/drift-alerts` reading from a Grid-side ring buffer.
- **D-25a-17:** Static reference sourced from `grid/src/audit/broadcast-allowlist.ts` at Steward build time (no runtime TypeScript parsing). Ring buffer size ≥256 entries / ≥1h retention (Claude's Discretion on exact values).
- **D-25a-18:** `/humans/[did]` drill-down: KYC-ish profile pane (wallet, joined-at, region, last-active, Nous count, coin balance) + transaction history (SIWE sessions, Cyber Coin transfers in/out, whispers sent, regions visited) + per-human Nous roster (humanOwner field).
- **D-25a-19:** Existing `/users` route retained for index view. `/humans/[did]` is drill-down. `/users` row click → `/humans/[did]` deep-link (Claude's Discretion on wiring).

### Claude's Discretion

- Visual styling, layout, color palettes — follow existing StewardShell patterns (commit `becc6e7`).
- WebSocket reconnection / backpressure behavior for `/firehose` tail.
- Brain endpoint authentication mechanism (shared secret, mTLS, signed request) — planner decides based on existing Grid↔Brain auth pattern.
- Ring buffer size + retention for `GET /audit/drift-alerts`.
- Color palette for event-family color coding on `/firehose`.
- `/users` ↔ `/humans/[did]` deep-link wiring detail.

### Deferred Ideas (OUT OF SCOPE)

- Inline replay scrubber on `/audit` rows — 25c
- CI report card on allowlist monitor — future
- Component sharing between `/audit` and `/firehose` — non-goal for 25a
- Sanction controls on `/humans/[did]` — explicit 25b bolt-on
- Time-window slider on `/culture` — 25c
- Always-on `/replay` route — 25c
</user_constraints>

---

## Summary

Phase 25a ships five read-only operator-facing observability surfaces on the Steward Console. All five surfaces draw on existing allowlisted audit events or existing Brain state; zero new audit events are added. The phase's most significant architectural addition is the FIRST Brain HTTP endpoint (`GET /brain/<did>/cognitive-snapshot`), which must be bolted onto a Python process that currently exposes only a Unix-domain-socket JSON-RPC server.

The Grid already has a robust WebSocket infrastructure (`@fastify/websocket` + `WsHub`) that can be extended for the firehose. The AuditChain already has a public `onAppend` listener mechanism usable for the drift detector. The Steward pages follow a consistent Next.js client-component pattern that fetches directly from the Grid's Fastify API; the cognitive-snapshot proxy follows the same pattern as the existing `brain-hash-state-client.ts`.

**Primary recommendation:** Add a lightweight `aiohttp` HTTP server alongside the existing Unix-socket RPC server in the Brain process; use a `GRID_BRAIN_SECRET` shared-secret header for auth (matching the Grid's GRID_WS_SECRET pattern). Do not invent mTLS — the Brain already uses no TLS internally.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Firehose WebSocket tail | API / Grid (WsHub extension) | Steward frontend (WS client) | AuditChain + WsHub already live in Grid; new filtered-hub variant |
| Cognitive inspector UI | Steward frontend | Grid proxy endpoint | Display only; Grid endpoint is the H3+ gate and audit emitter |
| Cognitive-snapshot data | Brain (new HTTP endpoint) | Grid (proxy + auth gate) | Data lives in Brain; Grid proxies to preserve Brain-private invariant |
| Brain health metrics | Steward frontend (aggregation over REST) | Grid (audit trail read) | All metrics sourced from `GET /api/v1/audit/trail` queries |
| Allowlist monitor — static | Steward frontend | None | Static JSON baked at build time from broadcast-allowlist.ts |
| Allowlist monitor — drift | Grid (AuditChain onAppend hook + ring buffer) | Steward frontend (poll) | Hook must be in Grid where AuditChain lives |
| `/humans/[did]` profile | Steward frontend | Grid HumanRegistry + audit | HumanRecord in HumanRegistry; history from audit trail queries |
| Plaintext grep gate | CI scripts | None | `check-cognitive-snapshot-plaintext.mjs` runs in pre-commit / CI |

---

## Standard Stack

### Core (confirmed from codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@fastify/websocket` | `^11.2.0` | WebSocket upgrade on Fastify routes | Already used for `/ws/events`; `fastifyWebsocket` registered in `buildServerWithHub` [VERIFIED: grid/package.json] |
| `vitest` | `^2.0.0` | Grid + Brain test runner | Already installed; `npm run test` runs `vitest run` [VERIFIED: grid/package.json] |
| `next.js` | 15.3.2 | Steward frontend (Next.js App Router) | Already installed [VERIFIED: steward/package.json] |
| `aiohttp` | latest stable (~3.10) | New Brain HTTP server for cognitive-snapshot | Not yet installed; matches asyncio-native pattern; Brain uses Python 3.11+ [ASSUMED — recommended; alternatives: starlette/uvicorn, bare asyncio.start_server] |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `httpx` | `>=0.27.0` | Grid-side HTTP client to Brain | Already in Brain's pyproject.toml for AAU fetcher; reuse for test mocking |
| `@fastify/cors` | `^10.0.0` | CORS for Steward (port 3002) | Already registered in `buildServerWithHub`; port 3002 already in origin list [VERIFIED: grid/src/api/server.ts:183] |
| `fastify` | (current) | REST API framework | Already in use for all Grid endpoints |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| aiohttp HTTP server in Brain | Starlette + uvicorn | Starlette is more capable but aiohttp is lighter; either works, aiohttp has simpler asyncio integration alongside the existing RPC loop |
| aiohttp HTTP server in Brain | bare asyncio.start_server | Too low-level; no routing, no request parsing |
| Shared-secret auth (GRID_BRAIN_SECRET) | mTLS | mTLS requires cert management; shared-secret matches the existing GRID_WS_SECRET pattern and is appropriate for internal same-host or same-network communication |

---

## Architecture Patterns

### System Architecture Diagram

```
Steward Browser
  |
  |-- fetch("GET /api/steward/cognitive-snapshot/<did>")  [H3+ tier gate]
  |
Steward Next.js (port 3002)  [route handler or server component]
  |
  |-- fetch("GET /api/v1/operator/nous/<did>/cognitive-snapshot")  [H3 body: tier, operator_id]
  |
Grid Fastify (port 8080)
  |-- validateTierBody('H3') + tombstoneCheck + appendOperatorEvent("operator.inspected")
  |
  |-- fetch("http://brain-<name>:<port>/cognitive-snapshot")  + GRID_BRAIN_SECRET header
  |
Brain aiohttp (new, per-process HTTP on a fixed port or socket)
  |-- returns {reflexion_count, rule_count, skill_titles_topk, drive_levels, last_sleep_tick, creed_violation_count}
  |-- plaintext gate: forbidden keys never returned
```

```
Steward Browser
  |-- WebSocket ws://localhost:8080/api/v1/audit/firehose
  |
Grid WsFirehoseHub (new, similar to WsHub)
  |-- subscribes to AuditChain.onAppend — forwards ALL allowlisted events
  |-- no filter support (density-optimized: every event passes)
  |-- color-family metadata added to outgoing EventFrame (or client-side derived)
```

```
Steward Browser (allowlist monitor page, polling)
  |-- fetch("GET /api/v1/audit/drift-alerts")
  |
Grid DriftDetector (new onAppend hook)
  |-- intercepts non-allowlisted event_type → pushes to ring buffer
  |-- ring buffer: FIFO, capacity 256, evicts oldest on overflow
  |
Grid REST endpoint
  |-- returns ring buffer snapshot
```

### Recommended Project Structure (new files only)

```
grid/src/
  audit/
    firehose-hub.ts          # New WsFirehoseHub (like WsHub but unfiltered, all allowlisted events)
    drift-detector.ts        # New DriftDetector (onAppend hook + ring buffer)
  api/
    operator/
      cognitive-snapshot.ts  # New H3+ proxy endpoint (GET /api/v1/operator/nous/:did/cognitive-snapshot)
    routes/
      audit-firehose.ts      # New WebSocket route registration
      audit-drift-alerts.ts  # New drift-alerts REST route registration

brain/src/noesis_brain/
  http/
    __init__.py
    server.py                # New aiohttp HTTP server (coexists with RPCServer)
    cognitive_snapshot.py    # New endpoint handler (assembles response from handler internals)

steward/src/app/
  firehose/
    page.tsx                 # New /firehose page
  humans/
    [did]/
      page.tsx               # New /humans/[did] drill-down page
  nous/
    [id]/
      page.tsx               # MODIFIED — add cognitive inspector + brain health cards

scripts/
  check-cognitive-snapshot-plaintext.mjs  # New CI grep gate (mirrors check-whisper-plaintext.mjs)
```

---

## Surface 1: Live Firehose (`/firehose`)

### Existing Patterns to Extend / Clone
- `grid/src/api/ws-hub.ts` — `WsHub` class. The firehose is a simpler version: no filter support, no sinceId replay (density-first). The `ClientConnection` ring-buffer / backpressure pattern is reusable verbatim. [VERIFIED: read in session]
- `grid/src/api/server.ts` lines 455-518 — `@fastify/websocket` registration pattern. The `/ws/events` route shows the exact adapter shape needed to bridge a fastify/ws socket into a `WsHub`-style object. [VERIFIED: read in session]
- `steward/src/app/audit/page.tsx` — fetch pattern for `/api/v1/audit/trail`. The firehose page is simpler: no pagination, no filters. The `eventType` field is the source for color-coding. [VERIFIED: read in session]

### Specific Files to Read First
1. `grid/src/api/ws-hub.ts` — full WsHub; copy `ClientConnection.enqueue()` pattern
2. `grid/src/api/server.ts` lines 455-518 — fastify WebSocket adapter boilerplate
3. `grid/src/api/ws-protocol.ts` — wire frame types (`HelloFrame`, `EventFrame`, etc.)
4. `grid/src/audit/broadcast-allowlist.ts` — `ALLOWLIST_MEMBERS` for color-family derivation at build time

### Architectural Decisions to Confirm During Planning
- **New WsFirehoseHub vs. extend WsHub:** Lean recommendation is a separate `WsFirehoseHub` in `grid/src/audit/firehose-hub.ts`. WsHub has filter complexity that firehose explicitly discards; keeping them separate avoids the risk of a filter bug affecting the density view.
- **WebSocket route path:** `GET /api/v1/audit/firehose` (matches the CONTEXT integration point). Registerable as an additional fastify websocket route alongside the existing `/ws/events`.
- **Reconnect / backpressure (Claude's Discretion):** Recommend exponential backoff (1s, 2s, 4s, cap 30s) with auto-reconnect on close. Client pauses auto-scroll on hover; resumes on mouse-leave.
- **Color-family derivation:** Derive client-side from `event_type` prefix (operator → terracotta, nous → sage, trade → gold, law → indigo, iris → teal, skill → amber, norm → slate, lore → muted). No additional server field needed.
- **GRID_WS_SECRET gating:** The existing GRID_WS_SECRET check (lines 472-490 of server.ts) applies to `/ws/events`; apply the same check to `/api/v1/audit/firehose`. Copy the pattern verbatim.

### Risk / Landmine Notes
- WsHub uses `queueMicrotask` for drain scheduling. If WsFirehoseHub is initialized before `await app.ready()`, drain races can occur. Follow the same lifecycle pattern as WsHub (register in `preClose` hook).
- The new `/api/v1/audit/firehose` route must be registered INSIDE the `app.register(fastifyWebsocket, ...)` scope, not at top level, or the WebSocket upgrade will not work.
- The firehose intentionally includes ALL allowlisted events (no operator suppression). That's by design — it is an operator-only surface. However, the `isAllowlisted()` gate must still be applied to ensure non-allowlisted internal events never leak.

---

## Surface 2: Cognitive Inspector

### Existing Patterns to Extend / Clone
- `grid/src/api/operator/memory-query.ts` — H2 Reviewer operator proxy pattern (validate tier, tombstone check, proxy to Brain via runner, emit `operator.inspected`, return data). Cognitive-snapshot is H3 but follows the same skeleton. [VERIFIED: read in session]
- `grid/src/api/operator/brain-hash-state-client.ts` — `fetchBrainHashState()` — shows how Grid calls Brain over HTTP: base URL from env or config, injectable `brainFetch` for tests, structured error classes (`BrainUnreachableError`, `BrainMalformedResponseError`). The cognitive-snapshot client follows this exact pattern. [VERIFIED: read in session]
- `grid/src/api/operator/_validation.ts` — `validateTierBody('H3')` — reuse as-is.
- `grid/src/audit/operator-events.ts` — `appendOperatorEvent()` — reuse to emit `operator.inspected` with payload `{tier: 'H3', action: 'cognitive_snapshot', operator_id, target_did}`. [VERIFIED: read in session]
- `scripts/check-whisper-plaintext.mjs` — full pattern for new `check-cognitive-snapshot-plaintext.mjs`. Clone file, change scope (scan `brain/src/**/http/cognitive_snapshot.py` + test files) and forbidden keys. [VERIFIED: read in session]

### Specific Files to Read First
1. `grid/src/api/operator/brain-hash-state-client.ts` — injectable `brainFetch`, error classes, key validation pattern
2. `grid/src/api/operator/memory-query.ts` — full H2 operator proxy skeleton to clone for H3 cognitive-snapshot
3. `grid/src/audit/operator-events.ts` — `appendOperatorEvent` signature
4. `brain/src/noesis_brain/rpc/handler.py` — `BrainHandler` fields to expose in cognitive-snapshot
5. `brain/src/noesis_brain/skills/store.py` — `SkillStore.list_all()` + `count()` for skill_titles_topk and store size
6. `brain/src/noesis_brain/ananke/runtime.py` + `ananke/types.py` — `DriveState.values` dict for drive_levels
7. `brain/src/noesis_brain/rpc/types.py` — `ActionType.SLEEP_ENTERED/SLEEP_COMPLETED` — confirms `_last_sleep_tick` in handler

### Brain Data Sources for the Cognitive-Snapshot Response

| Response Field | Brain Source | API |
|----------------|-------------|-----|
| `reflexion_count` | `ReflexionBuffer` entries in `MemoryStore` (MemoryType.REFLECTION) | Query MemoryStore for REFLECTION type count |
| `rule_count` | `RuleStore` wiki pages (WikiCategory.SELF_MODEL, title starts with "self_model_rule_") | Count matching wiki pages in MemoryStore |
| `skill_titles_topk` | `SkillStore.list_all()` → sort by `last_used_at DESC` → take top K names | `SkillStore.list_all()[:K]` names field |
| `drive_levels` | `_ananke_runtimes[did].state.values` dict — all 5 drives | Access via `BrainHandler._ananke_runtimes` |
| `last_sleep_tick` | `BrainHandler._last_sleep_tick` | Direct attribute access |
| `creed_violation_count` | Grid-side count of `nous.creed_violation` audit events for this DID | Aggregate from Grid audit chain, NOT from Brain |

**Key finding:** `creed_violation_count` is NOT stored in Brain — it is emitted as an audit event `nous.creed_violation` (pos 30) by Grid when Brain sends the action. The cognitive-snapshot Grid proxy must compute this count by querying the audit chain for `nous.creed_violation` events matching the DID, then include it in the response to Steward. The Brain endpoint returns the other 5 fields; Grid assembles the final response.

**Alternative finding:** `drive_levels` from Brain returns floats (internal values). The CONTEXT specifies `drive_levels: {ananke: float, eros: float, logos: float, ...}` but the actual drive names are `{hunger, curiosity, safety, boredom, loneliness}` (5 drives per `DriveName` enum). The endpoint should return these 5 keys as floats. This is the ONE place where internal float values are permitted to cross out of Brain (by explicit D-25a-03 exception), unlike the broadcast wire (D-10a-07 DRIVE_FORBIDDEN_KEYS).

### Architectural Decisions to Confirm During Planning
- **K for skill_titles_topk:** Recommend K=10 (matches CONTEXT "5-10 entries" hint). Document in endpoint spec.
- **Brain HTTP server port:** Recommend each Brain process listens on a deterministic port derived from its Unix socket path (e.g., `BRAIN_HTTP_PORT` env var, default e.g. `8090`). Grid passes this via `BRAIN_HTTP_BASE_URL` env var per DID or a fixed convention. OR: expose a single HTTP server colocated on the same socket using HTTP-over-Unix-socket (avoids port management). Recommend HTTP-over-TCP with env config for simplicity.
- **Auth mechanism (Claude's Discretion):** Grid currently uses `GRID_WS_SECRET` for WS. Recommend `BRAIN_HTTP_SECRET` (shared secret header `X-Brain-Secret`). Grid sends header; Brain validates. No mTLS — the Brain is currently not TLS-capable and runs same-host or on a private Docker network.
- **Grid proxy endpoint path:** `GET /api/v1/operator/nous/:did/cognitive-snapshot` (matches CONTEXT integration point). Note: the CONTEXT also listed `GET /steward/cognitive-snapshot/<did>` — these are the same route under different names. Use the operator-namespace convention.

### Risk / Landmine Notes
- `drive_levels` uses internal float values — this IS the allowed exception per D-25a-03. Do NOT add drive keys to `FORBIDDEN_KEY_PATTERN` for this endpoint. The forbidden-key check applies to the ENDPOINT RESPONSE SHAPE, not to the values themselves.
- The Brain process does not currently have an HTTP server. Adding `aiohttp` requires adding it to `pyproject.toml` and the Docker image. Plan Wave 0 or Plan 1 must include: `pyproject.toml` dependency update, `brain/Dockerfile` rebuild, `aiohttp` import.
- `ananke_runtimes` is keyed by `nous_did`. If the Brain process serves multiple Nous (unlikely but possible in test harnesses), the endpoint must accept a DID parameter and look up the correct runtime.
- `creed_violation_count` is Grid-side. The Grid proxy endpoint must query `audit.query({eventType: 'nous.creed_violation', actorDid: did})` and return `.length`. This DOES NOT require Brain access for that field.

---

## Surface 3: Brain Health Metrics

### Existing Patterns to Extend / Clone
- `steward/src/app/nous/[id]/page.tsx` — existing detail page structure (brain state card). New metric cards mount alongside this pattern. [VERIFIED: read in session]
- `steward/src/app/audit/page.tsx` — `fetch` calls to `GET /api/v1/audit/trail?type=<event_type>`. Brain health metrics are derived by querying specific event types for a given `nous_did` actor. [VERIFIED: read in session]

### Metric Family Implementation Map

| Family | Source Events | Query Pattern | Grid Endpoint |
|--------|--------------|---------------|---------------|
| Tick latency p50/p95, queue depth | Grid-internal instrumentation | `GET /api/v1/grid/nous/<did>/tick-metrics` (NEW) — Grid records tick duration per NousRunner tick | New endpoint; no audit events needed |
| Reflexion buffer fill, skill store size, rule count | Aggregate audit events: `nous.reflection_authored` (pos 28), `skill.taught`/`skill.inferred` (pos 37,38), `nous.self_model_revised` (pos 29) per DID | `GET /api/v1/audit/trail?type=nous.reflection_authored&actor=<did>` etc. | Existing endpoint with filters |
| Drive levels, sleep cadence | `ananke.drive_crossed` (pos 19), `nous.sleep.entered` (pos 31), `nous.sleep.completed` (pos 32) | Query last N `ananke.drive_crossed` for DID; compute sleep cadence from delta of sleep events | Existing endpoint with filters |
| Coherence violations | `nous.creed_violation` (pos 30) | `GET /api/v1/audit/trail?type=nous.creed_violation&actor=<did>` | Existing endpoint with filters |

**Tick latency:** The Grid audit trail does NOT currently record per-tick latency. Brain health metric family #1 requires either: (a) a new Grid-side in-memory metric store populated during tick dispatch, or (b) accepting that tick latency is unavailable for 25a and surface only what exists. Recommendation: Add lightweight in-memory tick-latency ring buffer in `NousRunner.sendTick()` path (no new audit events, no new audit chain writes — purely in-memory observability). Expose via `GET /api/v1/nous/<did>/tick-metrics`.

### Architectural Decisions to Confirm During Planning
- **Tick latency storage:** In-memory ring buffer per NousRunner (not persisted). `p50`/`p95` computed on the last N=100 ticks. Queue depth = `WorldClock.pendingTicks` if that concept exists, or omit if not instrumentable without audit events.
- **Brain health panel placement:** Mount on `/nous/[id]` page as additional cards (D-25a-06 mentions per-Nous page). The CONTEXT also mentions `/system` for allowlist monitor. Brain health is per-Nous, so `/nous/[id]` is correct.

### Risk / Landmine Notes
- `nous.reflection_authored` (pos 28) and `nous.self_model_revised` (pos 29) use `actorDid = nous_did`. The audit trail query `actor=<did>` correctly filters by Nous DID.
- `ananke.drive_crossed` payload is `{did, tick, drive, level, direction}` — the `actorDid` on the audit entry is the Nous DID. Query works via `actor=<did>`.
- `skill.taught` (pos 37) payload has `learner_did` in payload, `actorDid` in audit entry is the Grid system DID or teacher DID — need to verify which actor emits this. The sole-producer `grid/src/skills/appendSkillTaught.ts` determines `actorDid`. Verify before writing the query filter.

---

## Surface 4: Allowlist Monitor

### Existing Patterns to Extend / Clone
- `grid/src/audit/chain.ts` — `AuditChain.onAppend(listener)` — the drift detector hooks here exactly like `WsHub`. The `appendListeners` fire AFTER commit, with exceptions swallowed. [VERIFIED: read in session]
- `grid/src/audit/broadcast-allowlist.ts` — `ALLOWLIST_MEMBERS`, `isAllowlisted()`. The drift detector calls `isAllowlisted(entry.eventType)`; if false, pushes to ring buffer. [VERIFIED: read in session]
- `grid/src/api/server.ts` — pattern for optional-service registration (if present, register route). Drift detector is always active; ring buffer always wired.
- `grid/src/util/ring-buffer.ts` — `RingBuffer<T>` already exists and is used by WsHub. Reuse for drift alerts ring buffer. [VERIFIED: ws-hub.ts imports it]

### Static Reference Data

The static reference for the allowlist monitor (event name, payload schema, sole-producer file path) must be generated at Steward build time from `broadcast-allowlist.ts`. Strategy:

1. Extract `ALLOWLIST_MEMBERS` at build time via a Node.js script (e.g., `scripts/generate-allowlist-static.mjs`) that imports the module and produces a JSON file.
2. Steward imports the generated JSON as a static import.
3. Payload shapes are manually documented in the JSON (from STATE.md — the authoritative payload shape source), since they are not machine-readable from the TypeScript source.

Alternatively: hardcode as a TypeScript constant in Steward using `ALLOWLIST_MEMBERS` copy + manually maintained payload schema. Given that 25a does not extend the allowlist, this is acceptable for now.

### Architectural Decisions to Confirm During Planning
- **Ring buffer capacity:** Recommend 256 entries (matches WsHub's `DEFAULT_BUFFER_CAPACITY`). Retention: timestamp on each entry; Steward display shows "X drift alerts (oldest: <age>)".
- **Drift alert entry shape:** `{event_type: string, actor_did: string, tick: number, detected_at: number}`. Keep small; `emitter_file_path` is not detectable at runtime without stack introspection (skip it for 25a).
- **Polling interval:** Recommend Steward polls `GET /api/v1/audit/drift-alerts` every 5s (not WebSocket — polling is simpler and adequate for a rare-event alert).

### Risk / Landmine Notes
- The drift detector MUST NOT extend the broadcast allowlist. It uses the existing `isAllowlisted()` function — read-only call.
- The drift detector is a defense-in-depth layer; it does not prevent the non-allowlisted event from being appended to the chain. The chain append already succeeded when the listener fires. The purpose is visibility, not prevention.
- `loadEntries()` (restore path) does NOT fire append listeners per chain.ts documentation. The drift detector will not see historical non-allowlisted events from before startup. That is acceptable — drift detection is live-only.
- CI grep gate `scripts/check-state-doc-sync.mjs` asserts 41 events (position 41 = `norm.crystallized`). Currently the allowlist has 45 entries (positions 42-45: `lore.contributed`, `lore.cited`, `human.joined`, `human.transferred`). The check-state-doc-sync.mjs count assertion may be stale. Verify before writing plans — do NOT update the allowlist count gate in 25a (that would be a 25b concern).

---

## Surface 5: `/humans/[did]`

### Existing Patterns to Extend / Clone
- `steward/src/app/users/page.tsx` — current roster. Derives user list from `portal.auth.login` / `portal.auth.register` audit events. The `/humans/[did]` page is the drill-down from this roster. Add a `Link` to `/humans/[did]` on each row. [VERIFIED: read in session]
- `steward/src/app/nous/[id]/page.tsx` — drill-down layout pattern (StewardShell + header card + tabbed sections). Clone this structure for the human drill-down. [VERIFIED: read in session]
- `grid/src/human/types.ts` — `HumanRecord` interface: `{did, eth_address, email, grid_name, region, created_at}`. This is the KYC-ish profile source. [VERIFIED: read in session]

### Data Sources for `/humans/[did]`

| Section | Data Source | Grid Endpoint |
|---------|------------|---------------|
| Profile: wallet (eth_address) | `HumanRegistry.findByDid(did)` → `HumanRecord.eth_address` | New: `GET /api/v1/humans/:did` |
| Profile: joined-at | `HumanRecord.created_at` | Same |
| Profile: region | `HumanRecord.region` | Same |
| Profile: last-active | Latest `createdAt` of any audit entry where `actorDid === did` | Same endpoint or `GET /api/v1/audit/trail?actor=<did>&limit=1` |
| Profile: Nous count | Count of Nous where `humanOwner === did` (NousRegistry) | `GET /api/v1/grid/nous` then filter client-side (or new endpoint) |
| Profile: coin balance | Not currently in `HumanRecord`; Phase 24 added `human.transferred` events but wallet balance is on-chain, not Grid-side. Surface "N transfers" count instead for 25a. | Audit query for `human.transferred` actor=did |
| Transaction history: SIWE sessions | `portal.auth.login` events with `actorDid === did` — but CAUTION: `portal.auth.*` events are NOT allowlisted (they're internal audit events used by the /users page query) | `GET /api/v1/audit/trail?type=portal.auth.login&actor=<did>` |
| Transaction history: Cyber Coin transfers | `human.transferred` (pos 45) — `{asset, grid_name, human_did, tick}` — actor is Grid, human_did is in payload | Need new query by payload field, OR a dedicated humans history endpoint |
| Transaction history: whispers sent | `nous.whispered` (pos 22) — `{ciphertext_hash, from_did, tick, to_did}` — `from_did` is in payload, not `actorDid` | Same issue: need payload-field query or dedicated endpoint |
| Transaction history: regions visited | `nous.moved` for Nous owned by this human? Or portal-specific movement events? | Unclear — see Open Questions |
| Per-human Nous roster | `NousRegistry.active()` filter by `humanOwner === did` | `GET /api/v1/grid/nous` then client-filter (Phase 27 will populate humanOwner) |

**Critical finding:** `AuditChain.query()` only supports filtering by `eventType`, `actorDid`, and `targetDid` — NOT by arbitrary payload fields. For `human.transferred` (where `human_did` is in payload, not `actorDid`) and `nous.whispered` (where `from_did` is in payload), the existing query API is insufficient. Options:
1. Add a new `payloadField` filter to `AuditChain.query()` (surgical change, but modifies core).
2. Add a dedicated `GET /api/v1/humans/:did/history` Grid endpoint that does the payload-level filtering server-side.
3. Fetch all events of those types and filter client-side (not scalable but workable for 25a MVP if event count is low).

Recommendation: Option 2 — a new dedicated `GET /api/v1/humans/:did/history` endpoint. This avoids modifying AuditChain and is the cleanest approach.

**`portal.auth.*` events:** The current `/users` page queries `portal.auth.login` and `portal.auth.register` events. These event types are NOT in the allowlist — they are internal audit events readable only via the REST trail endpoint (not broadcast via WebSocket). This is fine for the `/humans/[did]` profile (REST fetch, not WebSocket).

### Architectural Decisions to Confirm During Planning
- **New `GET /api/v1/humans/:did` endpoint:** Returns `HumanRecord` fields + derived last-active. Must add to `GridServices` a `humanRegistry` accessor path (already exists — `services.humanRegistry` is present in `GridServices` type).
- **`GET /api/v1/humans/:did/history` endpoint:** New. Returns `{siwe_sessions: [], transfers: [], whispers_sent: [], regions_visited: []}`. Aggregates from audit chain with payload-level filtering.
- **Coin balance:** Skip for 25a — on-chain balance is not stored in Grid. Surface "N transfer events" count as a proxy.
- **`humanOwner` field:** Phase 27 will populate this. For 25a, the Nous roster section will typically be empty or partially populated. Render gracefully with "0 owned Nous".

### Risk / Landmine Notes
- `HumanRecord.eth_address` is stored as lowercase. The CONTEXT specifies the DID scheme is `did:noesis:human:<checksummed-eth-address>`. Do NOT display the raw eth_address to the operator without noting it's lowercase.
- The `/users` page currently queries `portal.auth.login` events — these are internal, non-allowlisted events that exist in the audit chain. Confirm with Grid that these events continue to be appended in v2.5.

---

## Brain Endpoint Deep-Dive

### Current Brain Communication Model (VERIFIED)

The Brain communicates with Grid exclusively via **Unix-domain-socket JSON-RPC 2.0** (newline-delimited). The RPC server is `brain/src/noesis_brain/rpc/server.py` (`RPCServer` class using `asyncio.start_unix_server`). Socket path: `/tmp/noesis-nous-<name>.sock`.

Brain has **NO existing HTTP server**. The `httpx` dependency is used only by the `AAUFetcher` (academic article fetching), not for serving requests.

Grid calls Brain via `BrainBridge` (in `protocol/src/noesis/bridge/brain-bridge.ts`) which uses an `RPCClient` over the same Unix socket. The `brain-hash-state-client.ts` in the Grid's operator folder calls a Brain HTTP endpoint (`/api/v1/nous/<did>/state_hash`) — but this endpoint does NOT currently exist in the Python Brain. It is called only during H5 Nous deletion and may be mocked in production (or the Brain actually exposes an HTTP endpoint already; this needs verification at plan time).

**CRITICAL clarification needed:** `brain-hash-state-client.ts` calls `http://brain.local/api/v1/nous/<did>/state_hash`. The test passes a mock `brainFetch`. In production, this URL must resolve to a real Brain HTTP endpoint. Search `brain/src` for `state_hash` reveals `brain/src/noesis_brain/state_hash.py` — this is a computation module, NOT an HTTP endpoint. It is likely that Brain DOES already have an HTTP server for the deletion flow, or this is currently only tested with mocks and not integration-tested in production. **The planner must verify this before planning Plan 1.** [ASSUMED — needs verification]

### Recommended New Brain HTTP Server Architecture

```python
# brain/src/noesis_brain/http/server.py
import aiohttp.web

class BrainHttpServer:
    def __init__(self, handler: BrainHandler, secret: str, port: int):
        ...
    
    async def handle_cognitive_snapshot(self, request):
        # Validate X-Brain-Secret header
        # Extract DID from path
        # Assemble response from handler internals
        # Apply forbidden-key check before returning
        ...
    
    async def start(self):
        ...  # runs alongside asyncio event loop
```

The aiohttp server runs on the SAME asyncio event loop as the existing RPC server. Both are started in `BrainApp.start()`. This avoids threading complexity.

### Brain Endpoint Forbidden-Key Contract

The `FORBIDDEN_KEY_PATTERN` in Grid's `broadcast-allowlist.ts` must be extended for 25a with:
```
reflexion_text|rule_text|creed_text|skill_body|lore_body|whisper_plaintext
```
Note: `skill_body` and `rule_text` are ALREADY in `FORBIDDEN_KEY_PATTERN` from Phase 18/19. Only `reflexion_text`, `creed_text`, `lore_body` (already in from Phase 20), `whisper_plaintext` are new additions. Check the existing pattern before extending — avoid duplicates.

Current pattern (from source): `...skill_body|skill_text|rule_text|norm_text|fingerprint_text|rule_content|lore_body|lore_content|title_text|summary_text`

New additions needed: `reflexion_text|creed_text|whisper_plaintext` (the others are already covered).

The new `scripts/check-cognitive-snapshot-plaintext.mjs` gate scans:
- `brain/src/**/http/cognitive_snapshot.py`
- Any test files for the cognitive-snapshot endpoint
- Grid's cognitive-snapshot proxy route handler

---

## WebSocket Pattern in Grid (VERIFIED)

Grid uses `@fastify/websocket` (`^11.2.0`) with `fastifyWebsocket` plugin. The WebSocket upgrade is registered as:

```typescript
app.register(async (instance) => {
    instance.get('/ws/events', { websocket: true }, (socket, req) => { ... });
});
```

The `socket` object from fastify-websocket exposes `socket.bufferedAmount`, `socket.send()`, `socket.close()`, `socket.on('message' | 'close' | 'error', ...)`. The `WsHub` wraps this with a `ServerSocket` adapter interface for testability.

**For `/api/v1/audit/firehose`:** Register a second WebSocket route inside the same fastify plugin scope. The `WsFirehoseHub` follows the same `ServerSocket` adapter pattern. Auth check via `GRID_WS_SECRET` applies identically.

---

## AuditChain.append Drift Detector Design (VERIFIED)

`AuditChain.onAppend(listener)` fires AFTER each append, synchronously, with exceptions swallowed. This is the correct hook point.

```typescript
// grid/src/audit/drift-detector.ts
export class DriftDetector {
    private readonly buffer: RingBuffer<DriftAlert>;
    private readonly unsubscribe: Unsubscribe;

    constructor(audit: AuditChain, capacity: number = 256) {
        this.buffer = new RingBuffer<DriftAlert>(capacity);
        this.unsubscribe = audit.onAppend((entry) => {
            if (!isAllowlisted(entry.eventType)) {
                this.buffer.push({
                    event_type: entry.eventType,
                    actor_did: entry.actorDid,
                    tick: entry.payload['tick'] as number ?? 0,
                    detected_at: entry.createdAt,
                });
            }
        });
    }

    snapshot(): DriftAlert[] {
        return this.buffer.drain(); // or a non-destructive read variant
    }

    close(): void { this.unsubscribe(); }
}
```

`RingBuffer<T>` already exists at `grid/src/util/ring-buffer.ts` and is used by WsHub. Add `peek()` or `all()` method if needed for non-destructive reads.

---

## Steward Backend Proxy Pattern (VERIFIED)

Steward is a Next.js App Router application with no backend route handlers — all fetches hit the Grid Fastify API directly from the browser using `NEXT_PUBLIC_GRID_ORIGIN`. This is the established pattern in all existing pages (`audit/page.tsx`, `users/page.tsx`, `nous/[id]/page.tsx`). [VERIFIED: all pages read in session]

For the cognitive-snapshot proxy, the pattern is:
1. Steward browser → `fetch(`${GRID_ORIGIN}/api/v1/operator/nous/${did}/cognitive-snapshot`, {method: 'POST', body: JSON.stringify({tier: 'H3', operator_id: 'op:...'})})`
2. Grid validates, proxies to Brain, returns response.

There is NO Steward backend route layer (no Next.js `route.ts` files involved). All API calls are direct browser-to-Grid.

For the firehose WebSocket: `new WebSocket(`${GRID_ORIGIN.replace('http', 'ws')}/api/v1/audit/firehose`)`

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` (only `"workflow": {}` present) → treat as **enabled**.

### Test Framework
| Property | Value |
|----------|-------|
| Framework (Grid) | vitest `^2.0.0` |
| Config file (Grid) | `vitest.config.*` not found — `"test": "vitest run"` in package.json uses auto-discovery |
| Quick run command | `cd grid && npm run test -- --reporter=verbose` |
| Full suite command | `cd grid && npm run test` |
| Brain test runner | `pytest` (Python) |
| Brain quick command | `cd brain && python -m pytest test/ -x -q` |
| Steward | `tsc --noEmit` (typecheck only; no vitest) |

### Per-Surface Test Map

| Surface | Behavior | Test Type | Automated Command | File Exists? |
|---------|----------|-----------|-------------------|-------------|
| Firehose — WsFirehoseHub | Fires on every allowlisted append, not on non-allowlisted | unit | `vitest run --reporter=verbose grid/src/audit/firehose-hub.test.ts` | No — Wave 0 |
| Firehose — WebSocket route | `/api/v1/audit/firehose` upgrades and delivers events | integration | `vitest run grid/test/firehose-integration.test.ts` | No — Wave 0 |
| Cognitive-snapshot Brain endpoint | Returns correct 6-field shape; rejects forbidden keys | unit (pytest) | `cd brain && pytest test/test_cognitive_snapshot.py -x` | No — Wave 0 |
| Cognitive-snapshot Grid proxy | H3 gate, tombstone check, `operator.inspected` emission | unit (vitest) | `vitest run grid/test/operator/cognitive-snapshot.test.ts` | No — Wave 0 |
| Cognitive-snapshot plaintext gate | CI grep for forbidden keys in endpoint + tests | CI/grep | `node scripts/check-cognitive-snapshot-plaintext.mjs` | No — Wave 0 |
| Brain health metrics | Given known audit events → correct metric values | unit (vitest) | `vitest run grid/test/brain-health-metrics.test.ts` | No — Wave 0 |
| Drift detector — ring buffer | Non-allowlisted event → pushed to ring buffer; allowlisted → not pushed | unit | `vitest run grid/test/audit/drift-detector.test.ts` | No — Wave 0 |
| Drift detector — REST endpoint | `GET /audit/drift-alerts` returns ring buffer snapshot | integration | `vitest run grid/test/api/drift-alerts.test.ts` | No — Wave 0 |
| `/humans/[did]` data | Missing human → 404; known human → profile fields correct | unit | `vitest run grid/test/api/humans.test.ts` | No — Wave 0 |
| Allowlist monitor static ref | `ALLOWLIST_MEMBERS` count == 45 (current v2.5 state) | regression | `node scripts/check-state-doc-sync.mjs` (existing) | Yes ✅ |

### Sampling Rate
- **Per task commit:** `cd grid && npm run test` (vitest run, ~30s)
- **Per wave merge:** `cd grid && npm run test && cd ../brain && pytest test/ -q`
- **Phase gate:** Full green before `/gsd-verify-work`

### Wave 0 Gaps
- `grid/src/audit/firehose-hub.test.ts` — unit tests for WsFirehoseHub (clone from ws-hub.test.ts)
- `grid/test/operator/cognitive-snapshot.test.ts` — Grid proxy route tests
- `brain/test/test_cognitive_snapshot.py` — Brain HTTP endpoint unit tests
- `grid/test/audit/drift-detector.test.ts` — DriftDetector unit tests
- `grid/test/brain-health-metrics.test.ts` — metric derivation tests
- `scripts/check-cognitive-snapshot-plaintext.mjs` — CI grep gate

---

## Common Pitfalls

### Pitfall 1: Brain Has No HTTP Server
**What goes wrong:** Planner writes Grid proxy code that calls `http://brain.../cognitive-snapshot` but Brain has no HTTP server → 503 in production.
**Why it happens:** `brain-hash-state-client.ts` suggests Brain has an HTTP endpoint but it's mock-only in tests.
**How to avoid:** Plan 1 of Brain work must add `aiohttp` HTTP server to Brain (`pyproject.toml` + `Dockerfile` + `http/server.py`). This is a prerequisite for all cognitive inspector work.
**Warning signs:** If `brain/src` has no `http/` directory, the HTTP server hasn't been built yet.

### Pitfall 2: `content_hash` Exemption in FORBIDDEN_KEY_PATTERN
**What goes wrong:** The current `FORBIDDEN_KEY_PATTERN` has `content(?!_hash)` — `content_hash` is NOT forbidden. Adding `lore_body` or `creed_text` requires precise regex addition.
**How to avoid:** Read the exact pattern string before modifying. The negative lookahead `(?!_hash)` is critical — do not break it.

### Pitfall 3: AuditChain.query() Cannot Filter by Payload Fields
**What goes wrong:** `/humans/[did]` history needs `human.transferred` events filtered by `human_did` payload field, but `query()` only supports `actorDid`, `eventType`, `targetDid`.
**How to avoid:** Add a dedicated `GET /api/v1/humans/:did/history` Grid endpoint that does payload-level filtering in application code.

### Pitfall 4: `operator.inspected` is the Sole Allowlisted Producer for Cognitive Inspector
**What goes wrong:** A new emitter duplicates `operator.inspected` — violates sole-producer invariant.
**How to avoid:** Reuse `appendOperatorEvent(audit, 'operator.inspected', {...})` — the existing function in `grid/src/audit/operator-events.ts`. Do not create a new emitter file.

### Pitfall 5: WebSocket Route Registration Scope
**What goes wrong:** `/api/v1/audit/firehose` registered outside the `app.register(fastifyWebsocket, ...)` scope → WebSocket upgrade fails silently (returns 400 or 404).
**How to avoid:** Register ALL WebSocket routes inside `app.register(async (instance) => { instance.get(..., {websocket: true}, ...) })`.

### Pitfall 6: `loadEntries()` Does Not Fire Drift Detector
**What goes wrong:** On Grid restart, historical non-allowlisted events in a restored chain do not appear in the drift ring buffer.
**How to avoid:** This is acceptable behavior per design. Document in PLAN: drift detector is live-only, not retroactive.

### Pitfall 7: `skill_titles_topk` Field Name in Forbidden-Key Check
**What goes wrong:** Adding `skill_title` to `FORBIDDEN_KEY_PATTERN` would incorrectly block the one permitted Brain-internal text field.
**How to avoid:** NEVER add `skill_title` to `FORBIDDEN_KEY_PATTERN`. The D-25a-05 exemption is explicit. The grep gate checks that forbidden keys (`skill_body`, `reflexion_text`, etc.) do NOT appear — it does NOT check for `skill_title`.

---

## Code Examples

### Pattern: Registering a New WebSocket Route (Grid)
```typescript
// Source: grid/src/api/server.ts:455-518 (existing /ws/events pattern)
app.register(async (instance) => {
    instance.get('/api/v1/audit/firehose', { websocket: true }, (socket, req) => {
        const secret = process.env.GRID_WS_SECRET;
        if (secret) {
            const token = (req.query as {token?: string}).token;
            if (token !== secret) {
                socket.close(1008, 'unauthorized');
                return;
            }
        }
        const adapter: ServerSocket = {
            get bufferedAmount() { return socket.bufferedAmount; },
            send: (data: string) => socket.send(data),
            close: (code?, reason?) => socket.close(code, reason),
            on: (event, cb) => { /* ...same adapter as /ws/events... */ },
        };
        firehoseHub.onConnect(adapter);
    });
});
```

### Pattern: Tier Validation + Operator.inspected Emission (Grid H3 proxy)
```typescript
// Source: grid/src/api/operator/memory-query.ts (H2 pattern — adapt to H3)
const v = validateTierBody(body, 'H3');  // change from 'H2'
if (!v.ok) { reply.code(400); return { error: v.error }; }
// ... tombstoneCheck ...
// proxy to Brain HTTP
const snapshot = await fetchCognitiveSnapshot(brainBaseUrl, did, brainFetch);
// emit operator.inspected AFTER successful Brain call
appendOperatorEvent(services.audit, 'operator.inspected', {
    tier: 'H3',
    action: 'cognitive_snapshot',
    operator_id: v.operator_id,
    target_did: did,
});
return snapshot;
```

### Pattern: AuditChain.onAppend Hook (DriftDetector)
```typescript
// Source: grid/src/api/ws-hub.ts:261 (existing onAppend hook pattern)
this.unsubscribeAudit = this.audit.onAppend((entry) => {
    if (!isAllowlisted(entry.eventType)) {
        this.buffer.push({
            event_type: entry.eventType,
            actor_did: entry.actorDid,
            detected_at: Date.now(),
        });
    }
});
```

### Pattern: Brain HTTP endpoint (Python aiohttp)
```python
# Source: new file brain/src/noesis_brain/http/cognitive_snapshot.py [ASSUMED pattern]
from aiohttp import web

async def handle_cognitive_snapshot(request: web.Request, handler: BrainHandler) -> web.Response:
    secret = request.headers.get('X-Brain-Secret', '')
    if secret != BRAIN_HTTP_SECRET:
        raise web.HTTPUnauthorized()
    did = request.match_info['did']
    ananke_runtime = handler._ananke_runtimes.get(did)
    drive_levels = {}
    if ananke_runtime:
        drive_levels = {k.value: v for k, v in ananke_runtime.state.values.items()}
    return web.json_response({
        'reflexion_count': ...,
        'rule_count': ...,
        'skill_titles_topk': [...],  # handler._skill_store.list_all()[:10] names
        'drive_levels': drive_levels,
        'last_sleep_tick': handler._last_sleep_tick,
        # creed_violation_count is Grid-side — NOT returned here
    })
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Brain only via Unix socket RPC | Brain adds HTTP for cognitive-snapshot (25a) | Phase 25a | First Brain HTTP surface; requires aiohttp addition |
| Allowlist enforcement CI-only | Allowlist enforcement CI + runtime drift detector (25a) | Phase 25a | Defense-in-depth; runtime visibility of violations |
| WsHub (filtered, with sinceId replay) | WsFirehoseHub (unfiltered, density-optimized, no replay) | Phase 25a | Separate hub for different operator use-case |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Brain `brain-hash-state-client.ts` calls a Brain HTTP endpoint at `http://brain.local/api/v1/nous/<did>/state_hash` — but this may be mock-only in production and Brain may NOT have an existing HTTP server | Brain Endpoint Deep-Dive | If Brain already has HTTP, the aiohttp addition is simpler (extend existing server); if not, plan must include full HTTP server addition |
| A2 | `aiohttp` is the recommended library for new Brain HTTP server | Standard Stack | If project has existing conventions against it, starlette/uvicorn or bare asyncio may be preferred |
| A3 | `_last_sleep_tick` is the correct field name in `BrainHandler` for last sleep tick | Cognitive Inspector data sources | Verified `_last_sleep_tick: int = 0` in handler.py:135 — HIGH confidence |
| A4 | `creed_violation_count` should be computed Grid-side from `nous.creed_violation` events, not from Brain | Cognitive Inspector | If Brain tracks this internally (not found in code), it could return it directly |
| A5 | Static allowlist reference for the monitor is best generated at build time from a script | Allowlist Monitor | Alternative: hardcode JSON in Steward; either works for 25a |
| A6 | `/users` page queries `portal.auth.login` which is not in the allowlist — these are internal audit events that DO exist in the chain | `/humans/[did]` data sources | [VERIFIED: users/page.tsx fetches with type=portal.auth.login] — HIGH confidence the events exist |
| A7 | Tick latency metrics require new in-memory instrumentation in `NousRunner.sendTick()` | Brain Health metrics | No existing tick-latency metric found in Grid; adding it is low-risk |

---

## Open Questions

1. **Does Brain already have an HTTP server?**
   - What we know: `brain-hash-state-client.ts` calls `http://brain.local/api/v1/nous/<did>/state_hash`. `brain/src/noesis_brain/state_hash.py` is a computation module with no HTTP handling.
   - What's unclear: Is this endpoint live in production (served by an aiohttp server we haven't found yet)? Or is it test-mock only?
   - Recommendation: Before planning Wave 1, run `grep -r "aiohttp\|HTTPServer\|web.Application\|asyncio.start_server" brain/src/ --include="*.py"` to confirm.

2. **What is the `actorDid` for `skill.taught` and `skill.inferred` in the audit chain?**
   - What we know: sole-producer is `grid/src/skills/appendSkillTaught.ts`. The `actorDid` is set by the emitter, likely the Grid system DID or the teacher DID.
   - What's unclear: Querying by `actorDid = nous_did` for brain health metric #2 may not work if actorDid is a Grid system DID.
   - Recommendation: Read `grid/src/skills/appendSkillTaught.ts` before planning.

3. **`humanOwner` field on NousRegistry records — does it exist in Phase 24/25a?**
   - What we know: CONTEXT says "per-human Nous roster (humanOwner field — currently mostly empty; useful when Phase 27 ships)".
   - What's unclear: Whether `NousRegistry` records include `humanOwner` at all in the current schema.
   - Recommendation: Read `grid/src/registry/registry.ts` to confirm field exists.

4. **Color-family for `/firehose` — should it include human.* events?**
   - What we know: CONTEXT specifies families: operator/nous/trade/law/iris/skill/norm/lore. `human.joined` (pos 44) and `human.transferred` (pos 45) are allowlisted events that don't fit these families.
   - Recommendation: Add a `human` family (Cyber Coin color) to the color palette. Default to `var(--muted)` for unrecognized families.

5. **Ring buffer for DriftDetector — destructive drain or non-destructive snapshot?**
   - What we know: `RingBuffer.drain()` is destructive. The drift-alerts endpoint needs to return current alerts without clearing them (so repeated polls see the same alerts until they age out).
   - Recommendation: Add a non-destructive `peek()` or `all()` method to RingBuffer, or implement a separate all-entries snapshot on DriftDetector.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Grid, Steward build | ✓ | v20+ (inferred from vitest v2) | — |
| Python 3.11+ | Brain aiohttp HTTP server | ✓ | 3.11+ (per pyproject.toml `requires-python = ">=3.11"`) | — |
| aiohttp | Brain HTTP server | ✗ | — | Install via `pyproject.toml` addition |
| vitest | Grid tests | ✓ | `^2.0.0` | — |
| pytest | Brain tests | ✓ | (dev dep in pyproject.toml) | — |
| Docker | Integration testing | ✓ (inferred from Dockerfiles in repo) | — | — |

**Missing with no fallback:** None blocking — `aiohttp` is easy to add.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (H-tier operator gating) | `validateTierBody` + `OPERATOR_ID_REGEX` — existing pattern |
| V3 Session Management | No | Read-only surfaces; no new sessions |
| V4 Access Control | Yes (H3+ gate for cognitive-snapshot) | `validateTierBody('H3')` — same as existing H3 operator routes |
| V5 Input Validation | Yes (Brain HTTP endpoint DID param) | Validate DID with `DID_REGEX` on Grid proxy; Brain validates X-Brain-Secret header |
| V6 Cryptography | No | No new crypto; shared secret is internal-network only |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cognitive-snapshot exposes skill titles (first Brain-private text to cross wire) | Information Disclosure | Grep gate CI script; `FORBIDDEN_KEY_PATTERN` extension; `skill_title` explicitly exempted and documented |
| Non-operator accessing cognitive-snapshot | Elevation of Privilege | `validateTierBody('H3')` rejects non-H3 requests |
| Drift detector ring buffer overflows, losing alerts | Denial of Service | Fixed 256-entry ring with eviction; acceptable for defense-in-depth visibility tool |
| Brain HTTP server accessible without auth | Information Disclosure | `X-Brain-Secret` header required; Brain runs on internal Docker network |

---

## File Map

### New Files to Create

```
# Brain
brain/src/noesis_brain/http/__init__.py
brain/src/noesis_brain/http/server.py          # aiohttp HTTPServer class
brain/src/noesis_brain/http/cognitive_snapshot.py  # endpoint handler
brain/test/test_cognitive_snapshot.py              # endpoint unit tests

# Grid — audit infrastructure
grid/src/audit/firehose-hub.ts                 # WsFirehoseHub
grid/src/audit/drift-detector.ts              # DriftDetector + DriftAlert type
grid/src/api/routes/audit-firehose.ts         # WebSocket route registration
grid/src/api/routes/audit-drift-alerts.ts     # REST drift-alerts route
grid/src/api/operator/cognitive-snapshot.ts   # H3+ Brain proxy + operator.inspected emit
grid/src/api/routes/humans.ts                 # GET /api/v1/humans/:did + /humans/:did/history

# Grid — tests
grid/test/audit/firehose-hub.test.ts
grid/test/audit/drift-detector.test.ts
grid/test/operator/cognitive-snapshot.test.ts
grid/test/api/drift-alerts.test.ts
grid/test/api/humans.test.ts

# Steward
steward/src/app/firehose/page.tsx             # New /firehose route
steward/src/app/humans/[did]/page.tsx         # New /humans/[did] route

# Scripts
scripts/check-cognitive-snapshot-plaintext.mjs  # CI grep gate (clone check-whisper-plaintext.mjs)
```

### Files to Modify

```
# Brain
brain/src/noesis_brain/__main__.py            # Wire HTTP server alongside RPCServer in BrainApp.start()
brain/pyproject.toml                          # Add aiohttp dependency

# Grid
grid/src/api/server.ts                        # Register firehose WS route, drift-alerts route, humans routes, cognitive-snapshot route; wire DriftDetector
grid/src/api/server.ts                        # Add drift_detector, humans route deps to GridServices type
grid/src/audit/broadcast-allowlist.ts         # Extend FORBIDDEN_KEY_PATTERN with reflexion_text|creed_text|whisper_plaintext (NOT skill_title; NOT existing keys)

# Steward
steward/src/components/StewardShell.tsx       # Add /firehose and /humans nav items to sidebar
steward/src/app/users/page.tsx                # Add Link to /humans/[did] on each user row
steward/src/app/nous/[id]/page.tsx            # Add cognitive inspector card + brain health metric cards
steward/src/app/system/page.tsx               # Add allowlist monitor card group
```

---

## Sources

### Primary (HIGH confidence)
- `grid/src/audit/chain.ts` — AuditChain.onAppend, append contract [VERIFIED]
- `grid/src/audit/broadcast-allowlist.ts` — complete 45-event list, FORBIDDEN_KEY_PATTERN, all forbidden-key sets [VERIFIED]
- `grid/src/api/ws-hub.ts` — WsHub pattern, ClientConnection, backpressure, RingBuffer usage [VERIFIED]
- `grid/src/api/server.ts` — Fastify server, fastifyWebsocket registration, GridServices type [VERIFIED]
- `grid/src/api/operator/memory-query.ts` — H2 operator proxy pattern [VERIFIED]
- `grid/src/api/operator/brain-hash-state-client.ts` — Brain HTTP client pattern, injectable brainFetch [VERIFIED]
- `grid/src/api/operator/_validation.ts` — validateTierBody [VERIFIED]
- `grid/src/audit/operator-events.ts` — appendOperatorEvent [VERIFIED]
- `grid/src/human/types.ts` — HumanRecord shape [VERIFIED]
- `brain/src/noesis_brain/__main__.py` — BrainApp, RPCServer, no HTTP server [VERIFIED]
- `brain/src/noesis_brain/rpc/server.py` — Unix-socket JSON-RPC only [VERIFIED]
- `brain/src/noesis_brain/skills/store.py` — SkillStore.list_all(), count() [VERIFIED]
- `brain/src/noesis_brain/ananke/types.py` — DriveName enum: hunger, curiosity, safety, boredom, loneliness [VERIFIED]
- `brain/src/noesis_brain/rpc/handler.py` — _last_sleep_tick:int=0 [VERIFIED]
- `brain/src/noesis_brain/rpc/types.py` — ActionType enum, SLEEP_ENTERED/COMPLETED [VERIFIED]
- `brain/pyproject.toml` — no aiohttp; httpx present; Python >= 3.11 [VERIFIED]
- `steward/src/app/audit/page.tsx` — fetch pattern, GRID_ORIGIN, client-component structure [VERIFIED]
- `steward/src/app/users/page.tsx` — portal.auth.login query, deriveUsers [VERIFIED]
- `steward/src/app/nous/[id]/page.tsx` — drill-down layout pattern, H5 delete form [VERIFIED]
- `steward/src/components/StewardShell.tsx` — sidebar nav structure [VERIFIED]
- `scripts/check-whisper-plaintext.mjs` — full CI grep gate pattern to clone [VERIFIED]

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — allowlist enumeration (41 events + v2.5 additions to 45), payload shapes [CITED]
- `.planning/phases/25a-observer-surfaces/25a-CONTEXT.md` — locked decisions [CITED]

### Tertiary (LOW confidence — ASSUMED)
- Brain aiohttp recommendation — training knowledge on asyncio-compatible HTTP libraries [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — verified from package.json and imports
- Architecture: HIGH — verified from all major source files
- Brain HTTP server status: MEDIUM — circumstantial evidence; planner must verify before Wave 1
- Pitfalls: HIGH — derived from direct code inspection

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable codebase; only invalidated if Brain gains HTTP server before 25a lands)
