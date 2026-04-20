# Phase 4: Nous Inspector + Economy + Docker Polish — Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Mode:** `--auto` (all gray areas auto-selected with recommended defaults; see Discussion Log below and `04-DISCUSSION-LOG.md`)
**Source:** ROADMAP.md Phase 4 · REQUIREMENTS.md NOUS-01..03 + ECON-01..03 · Phases 1-3 artifacts · research/*.md · live code scout

<domain>
## Phase Boundary

This phase closes the v2.0 Dashboard milestone by landing the last user-visible surfaces and the one-command developer experience: per-Nous introspection (Psyche / Telos / Thymos / memory), an economy overview (balances, recent trades, shops), and a `docker compose up` that brings the full stack (MySQL + Grid + Brain + **Dashboard**) to life with the dashboard connecting to the Grid WebSocket on first attempt.

**In scope:**
- **Inspector panel** opened from a click on any Nous surface (firehose row `actorDid`, region-map marker) rendering Big Five personality scores, active goals, emotional state, and the 5 most recent episodic memory entries
- **Brain introspection RPC** — extend the existing `handler.get_state()` method so it returns Big Five scores and a bounded window of recent memories in addition to the current name/mood/goals/location. Consumed by the Grid via the existing JSON-RPC-over-Unix-socket bridge
- **Grid per-Nous state endpoint** — `GET /api/v1/nous/:did/state` proxying the brain RPC; single network hop for the dashboard
- **Grid roster endpoint** — `GET /api/v1/grid/nous` returning `[{did, name, region, ousia, lifecyclePhase}]` for the economy panel's balance grid
- **Grid economy endpoints** — `GET /api/v1/economy/trades?limit=20` (reads audit chain filtered by `eventType: trade.*`) and `GET /api/v1/economy/shops` (reads a new in-grid `ShopRegistry` seeded with a minimal example set)
- **Trade event emission** — wire `NousRunner.handleBrainAction()` so that `BrainAction.action_type === 'trade_request'` settles into `services.audit.append('trade.settled', ...)` with a privacy-lint-safe payload `{counterparty, amount, nonce}` — no free-text body, no prompt
- **Shop registry** — minimal `grid/src/economy/shop-registry.ts` seeded from `GenesisConfig.shops` (new optional field); in-memory, no DB writes
- **Dashboard Inspector component** — side-sheet / drawer pattern (not a route change) so context-switch back to the firehose is cheap; selected Nous persisted in URL hash `#nous=did:noesis:<name>`
- **Dashboard Economy panel** — second `/grid` sub-view (route `/economy`) with balance grid, recent-trades table, shops list; economy subscribes to `trade.settled` WS events to invalidate balance and re-fetch trades; shop list is one-shot
- **Docker polish** — new `docker/Dockerfile.dashboard` (multi-stage `node:22-alpine`, Next.js standalone output, port 3001), a `dashboard` service in `docker-compose.yml`, `NEXT_PUBLIC_GRID_ORIGIN=http://localhost:${GRID_PORT:-8080}` so the browser hits the host-mapped Grid (not the internal `grid:8080` DNS name), healthcheck on `/api/dash/health` (add a trivial route), `depends_on: grid: service_healthy`

**Explicitly out of scope:**
- Whisper / pause / intervene controls (CTRL-01..03 are v2) — Inspector is READ-ONLY
- Consent grants / Human Channel gating on the Inspector endpoint — dev-observer posture per REQUIREMENTS.md "Out of Scope / Authentication" (bind 127.0.0.1). Sovereignty-gated access is a Phase 5 requirement tracked in ADV-01
- Memory graph visualization (ADV-02) — recent 5 episodic entries only, rendered as a list; no edges, no semantic joins
- Relationship network (ADV-03), Telos timeline (ADV-04), thought stream (ADV-01)
- Historical replay / scrubber (v2)
- Multi-user auth, TLS, reverse proxy — Phase 5+
- Full `/nous/[id]` route — the scaffolded directory stays scaffolded; inspector ships as a client-side drawer layered on `/grid`
- Rich trade taxonomy (`trade.proposed` / `trade.countered` separate views) — single `trade.settled` row suffices for v1 economy panel; `trade.proposed` stays in the firehose but not in the panel
- Payment rails for dashboard image hosting, telemetry, remote logging — zero 3rd-party network egress

</domain>

<decisions>
## Implementation Decisions (locked; all `--auto`-selected per recommended options)

### D1 — Inspector data path: Grid proxies Brain, dashboard calls Grid only
**Selected:** `dashboard → GET /api/v1/nous/:did/state → grid → brainClient.call('get_state') → brain → JSON response`
**Rejected:** direct dashboard → brain (violates architecture — brain speaks only JSON-RPC over Unix socket, not HTTP). Direct dashboard → brain also bypasses the CORS allowlist that Phase 3 locked to `localhost:3001`.
**Rationale:** Single network hop preserves the Phase 3 mental model (dashboard talks to Grid, Grid is the sovereign boundary). NousRunner already holds the `brainClient` handle — reuse.

### D2 — Brain `get_state()` extension (resolves ROADMAP Open Question #1)
**Selected:** Extend the existing `NousHandler.get_state()` in `brain/src/noesis_brain/rpc/handler.py` (line 128) to return the superset:
```python
{
    "name": str,
    "archetype": str,
    "did": str,                           # NEW — for UI join
    "psyche": {                           # NEW — Big Five scores from self.psyche
        "openness": float,                # 0..1
        "conscientiousness": float,
        "extraversion": float,
        "agreeableness": float,
        "neuroticism": float,
        "archetype": str,
    },
    "thymos": {                           # NEW — structured, not just describe()
        "mood": str,                      # current_mood() dominant
        "emotions": {                     # joy: 0.3, fear: 0.1, ...
            # all tracked emotion names → intensity
        },
    },
    "telos": {                            # NEW — full goal records, not just descriptions
        "active_goals": [
            {"id": str, "description": str, "priority": float, "created_tick": int}
        ],
    },
    "memory_highlights": [                # NEW — last 5 episodic entries, oldest→newest
        {"tick": int, "kind": str, "summary": str, "salience": float}
    ],
    "location": str,                      # existing
}
```
**Rejected:** Add a second RPC method `get_full_state`. Two methods duplicate the assembly code and add surface area to keep in sync.
**Rationale:** Backward-compatible widening (existing callers that read `name/mood/active_goals/location` still work — those fields stay at the top level OR a second pass can move them under `psyche/thymos/telos` with a compat shim; lock details in plan). `memory_highlights` pulls from `self.memory.recent(limit=5)` — must exist or be added on `EpisodicMemoryStream`.

### D3 — Inspector UX: side drawer, not route change
**Selected:** Client-side right drawer component (~420px wide) that overlays the `/grid` view; dismissible via Escape key, backdrop click, or explicit close button. Selected DID persisted in URL hash (`#nous=did:noesis:sophia`) so a browser refresh keeps the panel open.
**Rejected:** Dedicated `/nous/[id]` route. Would require full page mount per-click, lose the firehose continuity, and double the code path. The scaffolded `dashboard/src/app/nous/[id]/` directory stays empty for a potential v2 deep-link landing; not built in Phase 4.
**Rationale:** Dashboard is a single-session observer tool; context-switch back to the firehose should be cheap. Drawer pattern is the Grafana / Honeycomb idiom this project has explicitly aligned with (see Phase 3 UI-SPEC "Honeycomb voice, not Slack voice").

### D4 — Inspector realtime policy: on-demand snapshot, not subscription
**Selected:** On drawer open, fire one `GET /api/v1/nous/:did/state` → render → done. No WS subscription per-Nous, no polling.
**Rejected:** Live subscription via a new `nous.state_changed` WS frame. Requires broadcast-allowlist widening (Psyche doesn't change, but Thymos decays every tick — would flood the firehose), and inner-life fields are privacy-sensitive (PITFALLS §C2). On-demand isolates the read from the broadcast plane.
**Rationale:** Snapshot-on-open matches the "inspector" mental model and sidesteps allowlist expansion. User can close/reopen the drawer to refresh.

### D5 — Inspector click trigger: firehose row actor + region-map marker
**Selected:** Both surfaces wire a single `onSelectNous(did)` callback threaded through the store context from Phase 3. Click a `firehose-row`'s actor badge OR click a `nous-marker` `<g>` → drawer opens with that DID. Keyboard: `Enter` on focused row/marker does the same.
**Rejected:** Only one surface (simpler but discoverability is poor on a developer tool).
**Rationale:** Both are equally idiomatic; the unified callback keeps the branching to one place.

### D6 — Economy data path: Grid REST endpoints + WS invalidation
**Selected:**
- `GET /api/v1/grid/nous` → `[{did, name, region, ousia, lifecyclePhase}]` (reads `NousRegistry`)
- `GET /api/v1/economy/trades?limit=20&offset=0` → `[{id, tick, createdAt, proposer, counterparty, amount, nonce}]` (reads audit chain filtered by `eventType: trade.settled`, newest-first)
- `GET /api/v1/economy/shops` → `[{id, ownerDid, name, region, listings: [{kind, price}]}]` (reads `ShopRegistry`)
Dashboard Economy panel subscribes to the already-flowing `trade.settled` WS events (Phase 2 allowlist already includes it) and re-runs the two writable queries on each event; shops endpoint is fetched once per drawer mount.
**Rejected:** WebSocket-only model (no REST) — cold-start empty state is worse UX; economy panel needs an initial hydration.
**Rationale:** Mirror the Phase 3 pattern (`/api/v1/grid/regions` REST hydrate + WS deltas). REST is the authoritative path; WS is the invalidation signal.

### D7 — Shop registry: minimal in-grid registry seeded from `GenesisConfig.shops`
**Selected:** New `grid/src/economy/shop-registry.ts` with `ShopRegistry` class: `listAll()`, `getByDid(did)`, `register(shop)`. Plumbed into `GenesisLauncher.bootstrap()` to seed from an optional `config.shops: ShopSeed[]` field. `TEST_CONFIG` seeds 2 example shops (`sophia.library`, `hermes.courier`) so the panel is non-empty in dev.
**Rejected:**
- Defer ECON-03 entirely to v2. Violates the phase's stated success criterion #5.
- Derive shops from audit events (`shop.listed` / `shop.closed`). Those event types don't exist yet and would need allowlist additions. Out of scope for Phase 4.
**Rationale:** Smallest change that satisfies ECON-03 ("Dashboard shows active shops and their service listings"). A real shop economy (live listing/closing flows) is Phase 5+.

### D8 — Trade event emission wiring (resolves ROADMAP Open Question #2)
**Selected:** In `grid/src/integration/nous-runner.ts`, when processing a returned `BrainAction` with `action_type === 'trade_request'`, the runner:
1. Parses `action.metadata` as `{counterparty_did: string, amount: number, nonce: string}` (schema-validate; reject if malformed)
2. Performs the bilateral Ousia transfer via `NousRegistry` (atomically debit proposer / credit counterparty) — existing registry semantics
3. Emits `services.audit.append('trade.settled', action.actor_did, {counterparty, amount, nonce})` (lint-safe payload — all numeric/DID fields)
- `trade.proposed` / `trade.countered` stay deferred (v2) per REQUIREMENTS Out of Scope drift commentary: single settled-event is enough for the economy view's recent-trades table.
**Rejected:** Full three-phase handshake (`proposed → countered → settled`). Requires a pending-trade ledger, timeout logic, multi-listener state machine — explicit out-of-scope.
**Rationale:** Gets real trade events into the audit chain (enables AUDIT-02 to show trades, populates the economy panel) without building a negotiation engine this sprint.

### D9 — Privacy / allowlist posture: NO allowlist changes
**Selected:** The broadcast allowlist stays frozen at its Phase 1 members. Inspector reads Psyche/Telos/Thymos/memory via a direct REST endpoint → brain RPC; those payloads never touch the WS broadcast plane, so the allowlist lint doesn't apply.
**Rejected:** Add `nous.state_exposed` or similar to the allowlist. Broadcast-plane publication of inner-life data would violate PITFALLS §C2; the whole point of allowlist minimalism is sovereignty.
**Rationale:** Phase 4 keeps the two planes cleanly separated — broadcast (public, allowlisted, realtime) vs introspection (pull-only, developer-only, 127.0.0.1). Revisit when multi-user auth lands (Phase 5+).

### D10 — Docker scope: one new Dockerfile + one new compose service
**Selected:**
- `docker/Dockerfile.dashboard` — multi-stage: `deps` (`node:22-alpine` + `npm ci` at root workspace) → `builder` (`npm run build -w dashboard` using Next.js `output: 'standalone'`) → `runner` (`node:22-alpine`, `dashboard/.next/standalone` + static + public; `USER nextjs` non-root; `EXPOSE 3001`; `CMD ["node", "server.js"]`)
- `docker-compose.yml` adds:
  ```
  dashboard:
    build: { context: ., dockerfile: docker/Dockerfile.dashboard }
    depends_on: { grid: { condition: service_healthy } }
    ports: ["${DASHBOARD_PORT:-3001}:3001"]
    environment:
      NEXT_PUBLIC_GRID_ORIGIN: "http://localhost:${GRID_PORT:-8080}"   # browser-facing, host-mapped
      PORT: 3001
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/api/dash/health"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 20s
    restart: unless-stopped
  ```
- Dashboard exposes `/api/dash/health` via a Next.js route handler (`src/app/api/dash/health/route.ts` returning `{status:"ok"}`)
- Update root `README.md` quick-start to mention `http://localhost:3001/grid` after `docker compose up`
**Rejected:**
- Serving the dashboard from inside the Grid (Fastify static) — mixes concerns and breaks dev-mode HMR.
- Docker Compose profiles to make dashboard optional — every contributor should see it on first boot.
**Rationale:** `NEXT_PUBLIC_GRID_ORIGIN` is **browser-facing** (baked at build-time, embedded in the shipped JS); it must be an origin the browser can reach. Inside compose the Grid is reachable as `grid:8080` only between containers — the browser sees the host port mapping. This is the single subtle trap in a Next.js + backend-in-compose deployment and is called out explicitly here so the planner locks it into the Dockerfile's `ARG NEXT_PUBLIC_GRID_ORIGIN`.

### D11 — Inspector ↔ Firehose ↔ Region-map data coupling
**Selected:** Create a new `SelectionStore` (framework-agnostic, pattern identical to Phase 3 stores in `dashboard/src/lib/stores/`) with state `{selectedDid: string | null, setSelected, clear}`. Wired to URL hash via a tiny hook (`useHashSync('nous')`). All three surfaces (firehose row, region-map marker, drawer close button) mutate through this store.
**Rationale:** Matches the Phase 3 store architecture so new code is visually identical to existing.

### D12 — Economy panel placement & layout
**Selected:** Add a tab bar to `/grid` with two tabs: `Firehose + Map` (default) and `Economy`. Tab state in URL via `?tab=economy`. No route change.
**Rejected:** Separate `/economy` route — again preserves scaffolded URL surface but costs a full React tree remount on every switch.
**Rationale:** Tabs are lighter than routes; the dashboard is already a single-page tool.

### D13 — Test surface & coverage strategy
**Selected:**
- **Grid (Vitest)** — new tests: `server.nous-state.test.ts` (proxy endpoint mock brain client), `server.economy-trades.test.ts`, `server.economy-shops.test.ts`, `shop-registry.test.ts`, `nous-runner.trade-settled.test.ts` (BrainAction → audit.append flow), plus extending `server.cors.test.ts` with new routes.
- **Brain (pytest)** — new tests: `test_handler.py::test_get_state_full_shape` (asserts the new payload superset), `test_memory_highlights::test_recent_returns_bounded` (5-entry window).
- **Dashboard (Vitest + RTL)** — new tests: `inspector.test.tsx` (drawer mount, close, URL hash sync, error boundary), `economy.test.tsx` (balance grid, trades table, shops list, WS invalidation), `selection-store.test.ts`, `use-hash-sync.test.ts`.
- **Dashboard (Playwright)** — extend `grid-page.spec.ts` or add `inspector.spec.ts` to cover click-a-marker → drawer-opens → close-with-escape. Deferred to local/CI (same sandbox constraint as Phase 3).
- **Docker (shell-level smoke)** — new `scripts/docker-smoke.sh` (not executed in CI, documented) that runs `docker compose up -d`, waits for healthchecks, curls `http://localhost:3001/api/dash/health`, asserts 200.
**Rationale:** Preserve the Phase 3 discipline of Nyquist per-task verification; Phase 4 planner must author `04-VALIDATION.md` with the same rigor.

### D14 — `/api/dash/health` implementation
**Selected:** Next.js route handler `dashboard/src/app/api/dash/health/route.ts` returning `{status:"ok", gridOrigin: process.env.NEXT_PUBLIC_GRID_ORIGIN}`. Deliberately does NOT probe the Grid (health endpoint must not cascade-fail).
**Rationale:** Standard Next.js 15 App Router route handler; zero dependencies.

### D15 — File naming & module layout (Claude's discretion but locked here)
- `grid/src/economy/shop-registry.ts` + `grid/src/economy/types.ts` (extend)
- `grid/src/api/server.ts` — add 4 routes (`/api/v1/grid/nous`, `/api/v1/nous/:did/state`, `/api/v1/economy/trades`, `/api/v1/economy/shops`)
- `grid/src/integration/nous-runner.ts` — extend `handleBrainAction()` case for `trade_request`
- `grid/src/genesis/presets.ts` — extend `TEST_CONFIG` with `shops: [...]`
- `brain/src/noesis_brain/rpc/handler.py` — widen `get_state()`
- `brain/src/noesis_brain/memory/stream.py` — add `recent(limit: int)` if missing
- `dashboard/src/lib/stores/selection-store.ts` — new
- `dashboard/src/lib/hooks/use-hash-sync.ts` — new
- `dashboard/src/app/grid/components/inspector.tsx` — new drawer component
- `dashboard/src/app/grid/components/inspector-sections/{psyche,thymos,telos,memory}.tsx` — 4 sub-panels
- `dashboard/src/app/grid/components/economy/{balance-grid,trades-table,shops-list}.tsx` — 3 sub-panels
- `dashboard/src/app/grid/components/tab-bar.tsx` — new
- `dashboard/src/app/api/dash/health/route.ts` — new
- `docker/Dockerfile.dashboard` — new
- `docker-compose.yml` — extend (append `dashboard:` service)

### D16 — Claude's Discretion (tuning; planner may adjust with rationale)
- Drawer width (420px) vs. 380px vs. 460px
- Memory highlight count fixed at 5 per NOUS-03 — can widen to 10 if layout demands
- Tab bar position (top vs. sidebar) — top is lighter-weight
- URL hash schema (`#nous=<did>` vs `?nous=<did>` — chose hash to avoid triggering Next.js server re-render on selection change)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research & Requirements
- `REQUIREMENTS.md` — NOUS-01..03, ECON-01..03 (primary requirement sources)
- `.planning/research/SUMMARY.md` §6 Q1 (brain introspection RPC), Q2 (trade taxonomy)
- `.planning/research/FEATURES.md` — Table Stakes vs anti-features (Inspector / Economy are table-stakes; no gamification)
- `.planning/research/ARCHITECTURE.md` §"Component inventory" (dashboard panels), §"Build Order" step 5 (Phase 4)
- `.planning/research/PITFALLS.md` §C2 (privacy leak — consulted for Inspector endpoint), §M2 (multi-tab), §m4 (CORS)
- `PHILOSOPHY.md` §1, §4 — sovereign memory / observed-without-controlled (Inspector is OBSERVE only; no mutations)

### Phase 1-3 artifacts (consume, do not modify without explicit justification)
- `grid/src/audit/broadcast-allowlist.ts` — frozen set; Phase 4 does NOT modify (D9)
- `grid/src/audit/chain.ts` — `AuditChain.query({eventType: 'trade.settled', limit, offset})` is the economy trade feed
- `grid/src/registry/registry.ts` — `NousRegistry` is the balance source of truth
- `grid/src/api/server.ts:46-50, 80-85` — CORS allowlist & region endpoint patterns to replicate
- `grid/src/integration/nous-runner.ts` — existing `handleBrainAction()` to extend
- `brain/src/noesis_brain/rpc/handler.py:128-137` — existing `get_state()` to widen
- `brain/src/noesis_brain/memory/stream.py` — episodic memory access point
- `dashboard/src/lib/stores/{firehose,presence,heartbeat}-store.ts` — framework-agnostic store pattern (new `SelectionStore` mirrors this)
- `dashboard/src/app/grid/grid-client.tsx:89-91` — `flushSync` wrap pattern (reuse when Inspector subscribes)
- `dashboard/src/app/grid/components/region-map.tsx` — marker click wiring extension point
- `dashboard/src/app/grid/components/firehose-row.tsx` — actor badge click wiring extension point

### Docker + deploy artifacts
- `docker/Dockerfile.grid` — multi-stage pattern to mirror for dashboard
- `docker/Dockerfile.brain` — arg-forwarding pattern for build-time env
- `docker-compose.yml` — healthcheck + depends_on pattern

### Project philosophy
- `REQUIREMENTS.md` "Out of Scope" — explicitly forbids whisper/pause/intervene controls (Inspector stays READ-ONLY)

</canonical_refs>

<specifics>
## Specific Implementation Notes

- **Grid route order matters.** Add all four new routes BEFORE `app.register(fastifyWebsocket, ...)` so the REST surface is consistent with the existing pattern (`/api/v1/*` before WS).
- **Brain RPC contract.** The brain `get_state` reply must be JSON-serializable and deterministic — no `datetime` objects (convert to epoch int), no numpy types (cast to Python float). Existing handler already follows this convention; extend carefully.
- **Grid proxy error shape.** If brainClient.call raises (brain dead), `/api/v1/nous/:did/state` returns `503 {error:"brain unreachable", did}`. Inspector renders an error state, not a spinner.
- **Economy trades query.** `AuditChain.query({eventType:'trade.settled', limit:20, offset:0})` returns newest-first per Phase 1 contract. Map each entry to `{id, tick, createdAt, proposer:entry.actorDid, counterparty:entry.payload.counterparty, amount:entry.payload.amount, nonce:entry.payload.nonce}`.
- **Shop seed example (`TEST_CONFIG`):**
  ```ts
  shops: [
    { id: 'sophia.library', ownerDid: 'did:noesis:sophia', name: 'Sophia\u2019s Library', region: 'agora', listings: [{kind:'dialectic-session', price:5}] },
    { id: 'hermes.courier',  ownerDid: 'did:noesis:hermes',  name: 'Hermes\u2019 Courier',  region: 'agora', listings: [{kind:'message-delivery',   price:2}] },
  ]
  ```
  Themis is a judge, not a merchant — no seeded shop. Consistent with the canonical-characters lore in `brain/data/nous/themis.yaml`.
- **Drawer keyboard trap.** Per WAI-ARIA drawer pattern: focus moves into the drawer on open, focus returns to the click-origin on close, Tab cycles within, Escape closes. React 19 supports `useEffect` + `useRef` focus trap without a library at this scale — do not add `react-focus-lock`.
- **URL hash parser.** `#nous=<did>` must validate against `/^did:noesis:[a-z0-9_\-]+$/i` before being accepted into the store (prevents XSS via hash).
- **Dashboard standalone build.** `dashboard/next.config.mjs` must declare `output: 'standalone'` for the Dockerfile `runner` stage to copy the minimal bundle. Add this in Plan 1 of the phase.
- **`NEXT_PUBLIC_GRID_ORIGIN` baking time.** Because it's a `NEXT_PUBLIC_*` var it's read at **build** time, not runtime. The Dockerfile must accept it as a build `ARG` and forward via `ENV` before `npm run build`. In compose, set it in the service `environment:` block for dev-iteration override via `docker compose build --build-arg NEXT_PUBLIC_GRID_ORIGIN=http://localhost:8080`.
- **Inspector Empty states.** No brain process running (brain dead): "Brain unreachable — is the `noesis-nous-<name>` container up?" / No active goals: "No active goals. Telos is quiescent." / No memory yet: "No episodic memories recorded. Nous has lived <N> ticks."
- **Economy no-data states.** No trades yet: "No settled trades. Nous have lived <N> ticks without trade activity." (Truthful about emergent sparsity — this is a dev tool.)
- **Privacy lint at the producer.** Per broadcast-allowlist.ts docstring, sanitization happens at NousRunner, not at the allowlist. When implementing D8, the `trade.settled` payload MUST contain only `{counterparty, amount, nonce}` — no memo, no free-text reason. Add a regression test asserting the payload survives `payloadPrivacyCheck()`.

</specifics>

<deferred>
## Deferred Ideas (OUT OF SCOPE — capture for v2+)

- **Inspector writes (whisper / pause)** — CTRL-01..03; Phase 5+ needs Human Channel consent gating
- **Live Inspector subscription (Thymos decay animation)** — requires `nous.state_changed` frame + allowlist expansion; privacy-risky; deferred
- **Relationship graph between Nous** — ADV-03 v2
- **Memory graph** — ADV-02 v2 (recent 5 linear list is enough for v1)
- **Telos timeline** — ADV-04 v2
- **Shops as live entities** — shop-listed / shop-closed events, allowlist expansion, shop CRUD API
- **`trade.proposed` / `trade.countered` separate streams** — full bilateral handshake; Phase 5+ economy sprint
- **Multi-Grid dashboard** — Phase 5+
- **Dashboard auth + TLS** — Phase 5+ (multi-user)
- **Playwright Inspector E2E in CI sandbox** — same blocker as Phase 3; deferred to real-env
- **`/nous/[id]` dedicated route** — scaffolded directory stays for a potential v2 landing-page deep-link; not built here
- **Shop registry persistence (MySQL migration)** — in-memory only for v1
- **Grid roster paging** — `GET /api/v1/grid/nous` returns full list (n≈3); pagination is Phase 5 when n grows

</deferred>

<discussion_log>
## Auto-mode Discussion Log

Per `--auto` mode, all gray areas were identified, the recommended option auto-selected, and no user prompts were issued. Full trace below; also committed to `04-DISCUSSION-LOG.md`.

| # | Gray area | Options considered | Auto-pick | Rationale |
|---|-----------|--------------------|-----------|-----------|
| 1 | Inspector data path | dashboard→brain direct / dashboard→grid→brain proxy | **grid proxy** (D1) | Preserves single-origin CORS model; reuses existing brainClient |
| 2 | Brain RPC scope | add new `get_full_state` / widen existing `get_state` | **widen existing** (D2) | Backward-compat; avoids method surface proliferation |
| 3 | Inspector UX | route `/nous/[id]` / side drawer | **side drawer** (D3) | Context-switch cheap; matches Grafana/Honeycomb idiom |
| 4 | Inspector updates | WS subscription / on-demand snapshot | **on-demand** (D4) | Avoids allowlist expansion for inner-life fields |
| 5 | Click trigger | marker-only / row-only / both | **both** (D5) | Discoverability; single callback |
| 6 | Economy data path | WS-only / REST+WS invalidation | **REST+WS invalidation** (D6) | Mirrors Phase 3; cold-start UX |
| 7 | Shops source | defer ECON-03 / minimal ShopRegistry | **minimal ShopRegistry** (D7) | Satisfies SC without building live shop flows |
| 8 | Trade events | three-phase handshake / settled-only | **settled-only** (D8) | Enables economy panel without negotiation engine |
| 9 | Allowlist posture | widen for inspector / keep frozen | **keep frozen** (D9) | Inspector is pull-only, different plane |
| 10 | Docker scope | dashboard-in-Fastify / separate service | **separate compose service** (D10) | Preserves HMR; matches Next.js convention |
| 11 | Selection state | prop-drilled / dedicated store | **dedicated store** (D11) | Matches Phase 3 store pattern |
| 12 | Economy placement | separate route / tab bar on /grid | **tab bar** (D12) | Lighter than full route mount |
| 13 | Test coverage | full E2E in CI / Vitest-dominant + deferred E2E | **Vitest-dominant** (D13) | Same sandbox constraint as Phase 3 |
| 14 | Health endpoint | Grid-probe / static ok | **static ok** (D14) | Prevents cascade-fail |
| 15 | File layout | flat / sub-directory per concern | **sub-directory per concern** (D15) | Matches Phase 3 components dir |

**Open Questions resolved by this CONTEXT:**
- ROADMAP #1 "`get_current_state` RPC" → **Widen existing `get_state`; add `memory_highlights`** (D2)
- ROADMAP #2 "trade taxonomy" → **Emit `trade.settled` only; `proposed`/`countered` deferred to v2** (D8)
- ROADMAP #3 "consistency model" → **Already resolved in Phase 2; Phase 4 inherits "broadcast best-effort, REST authoritative"**

</discussion_log>

---

*Phase: 04-nous-inspector-economy-docker-polish*
*Context gathered: 2026-04-18 — `--auto` mode, single-pass, all 15 gray areas auto-resolved*
*Next: `/gsd-plan-phase 4 --auto` (auto-advance per workflow step 10)*
