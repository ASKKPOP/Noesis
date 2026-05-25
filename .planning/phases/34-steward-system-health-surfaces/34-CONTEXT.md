# Phase 34: Steward `/system` Health Surfaces — Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Make pipeline health visible on the Steward Console so an operator looking at `/system` knows immediately if any of the three pipelines (in-memory chain, MySQL persistence, firehose fan-out) is degraded. Four deliverables:

1. **Audit Pipeline Health card** (OBS-11) on `/system`, above the existing Allowlist Monitor. Polls `/health/detailed` every 5s; renders divergence big-number with green (0) / amber (1-10) / red (>10) banding + reasons sub-line when status != 'ok'.
2. **Firehose Diagnostics card** (OBS-12) on `/system`, same hook. Renders client_count gauge, frames-sent / frames-dropped 12-point sparkline (5s × 12 = 1m window), time-since-last-frame (red when >60s AND clients>0), reasons sub-line.
3. **Events per Minute by Family sparkline** (OBS-13) on `/system`. **REST-driven** — polls `GET /api/v1/audit/trail?limit=200` (NOT the WebSocket firehose) so it survives firehose failure. Buckets events by event-type prefix family.
4. **Client-side firehose watchdog** (OBS-14) on `/firehose`. Tracks `last_frame_at`; forces WebSocket reconnect when `Date.now() - last_frame_at > 60_000 AND /health/detailed.firehose.client_count > 0`. Prevents the "WS opens, never delivers, browser thinks it's healthy forever" failure mode.

**Closes:** REQ OBS-11, OBS-12, OBS-13, OBS-14 (the operator-visibility leg of v2.6).

**Foundational dependencies (already shipped):**
- Phase 31 — `PersistentAuditChain` wiring + reconcile loop + Pino logging
- Phase 32 — `WsFirehoseHub.stats()`, `GET /health/detailed`, `HealthWatchdog` (the contracts Phase 34 consumes)
- Phase 33 — `portal.auth.*` + `human.identified` producers (the events the family sparkline visualizes)

**Cross-workspace minor touches (folded in this phase per discussion):**
- `grid/src/diagnostics/health-watchdog.ts` + `grid/src/api/routes/health-detailed.ts` — additive `reasons: string[]` field on `HealthDetailedPayload` (D-34-B1). Phase 32 D-32-C2 explicitly anticipated this path; non-breaking.
- `steward/src/app/system/page.tsx` — inline fix of `ALLOWLIST_STATIC` from 45 to 56 entries (D-34-C1).

**Does NOT touch:** Phase 32 `WsFirehoseHub.stats()` shape (frozen); Phase 32 `HealthWatchdog.computeStatus()` predicate logic (frozen); allowlist (stays at 56); zero-diff invariant; Pino redact list; existing `/health` route (Docker SLA); `/firehose` page rendering / event-row visual (only WS plumbing gains a watchdog hook).

</domain>

<decisions>
## Implementation Decisions

### Area A — Sparkline rendering technique

- **D-34-A1:** **Mixed rendering primitive** — `EventsPerMinuteSparkline.tsx` uses **raw inline SVG** (multi-family stacked geometry); the frame-counter sparkline on the Firehose Diagnostics card uses **CSS flex divs** (simpler one-color-per-row line). Two visual conventions, each optimized for its job. The SVG choice extends the v2.4 culture-dashboard invariant ("raw SVG only — no d3 / no recharts / no react-flow / no cytoscape") to the new chart surface in Phase 34. CSS-div bars for the frame-counter sparkline are a deliberate exception because the single-signal bar shape doesn't need SVG paths.

- **D-34-A2:** **60 buckets at 5s each** for `EventsPerMinuteSparkline` (NOT 5 × 1m, NOT 30 × 10s). 5-minute window = 60 buckets, one per `/health/detailed` poll interval. Tightest correlation with the Firehose Diagnostics frame-counter sparkline timing. Filter the 200-entry `/api/v1/audit/trail` response to entries within `now - 300_000` ms; bucket by `floor((now - createdAt) / 5000)`. Older buckets stay empty during sparse activity; near-end buckets densify during bursts. Trade-off accepted: thin bars (~5px wide at 300px total width) make individual bars hard to read, but the operator gets maximum temporal resolution.

- **D-34-A3:** **Frame-counter sparkline = two stacked rows of CSS-div bars** (top row = `frames_sent` delta, bottom row = `frames_dropped` delta) at 12 × 5s = 1-minute window. Both signals visible side-by-side at the same granularity. Implementation pulls `frames_sent_total` and `frames_dropped_total` from `/health/detailed.firehose` on each 5s poll, computes deltas client-side from the previous poll value, maintains a ring of the last 12 deltas in component state. Color: `var(--terracotta)` for dropped row (warning palette), neutral muted for sent row.

### Area B — Reasons-array display (cross-workspace payload extension)

- **D-34-B1:** **Extend `HealthDetailedPayload`** with `readonly reasons: readonly string[]` (additive, non-breaking). Phase 32 D-32-C2 explicitly carried this decision into Phase 34: "if Phase 34 wants WHY a status is degraded, expose `computeStatus().reasons` via an additional `/health/detailed` response field." Server is single source of truth; client just renders. Touch sites:
  - `grid/src/diagnostics/health-watchdog.ts` — extend `HealthDetailedPayload` interface; `snapshot()` returns `reasons` from `computeStatus()` result (already computed, just propagated).
  - `grid/src/api/routes/health-detailed.ts` — no logic change (route handler is `return launcher.healthWatchdog!.snapshot();` per Phase 32 D-32-C3).
  - `grid/test/health-detailed-route.test.ts` — extend payload shape assertions to include `reasons`.
  - Empty array (`reasons: []`) when status is 'ok'; populated array when 'degraded' or 'critical'.

- **D-34-B2:** **Snake_case keys** (matches `HealthWatchdog.computeStatus()` current output, matches the Pino `health_status_changed` warn-log shape from Phase 32 D-32-B3). Steward maps to human labels client-side. Known keys: `grace_period`, `divergence_above_critical`, `persist_error_with_divergence`, `divergence_above_degraded`, `no_frames_with_clients`, `stale_frames`, `reconcile_stale`. Mapping table lives in `steward/src/lib/health-reason-labels.ts`.

- **D-34-B3:** **Visible sub-line under status banner** when status != 'ok'. Comma-separated muted text. Empty array on 'ok' renders nothing. No hover/tooltip required; no expandable panel. Operator sees the WHY immediately at glance distance. Display location: directly beneath the divergence big-number banner inside the Audit Pipeline Health card AND beneath the connected-clients gauge inside the Firehose Diagnostics card. Both cards consume the same `reasons` array — Steward filters which reasons render on which card by key prefix (audit-related → audit card, firehose-related → firehose card; cross-cutting reasons render on both).

### Area C — Stale Allowlist Monitor (in-phase fix)

- **D-34-C1:** **Fix `ALLOWLIST_STATIC` inline from 45 to 56 entries** in `steward/src/app/system/page.tsx`. Adds positions 46-56 with their producer-file paths from `grid/src/audit/broadcast-allowlist.ts`:
  - 46: `operator.muted` → Phase 25b sanction producer
  - 47: `operator.slashed` → Phase 25b sanction producer
  - 48: `operator.quarantined` → Phase 25b sanction producer
  - 49: `operator.forced_sleep` → Phase 25b sanction producer
  - 50: `operator.human_banned` → Phase 25b sanction producer
  - 51: `operator.human_frozen` → Phase 25b sanction producer
  - 52: `human.spoke` → Phase 27 producer
  - 53: `nous.spawned_by_human` → Phase 28 producer
  - 54: `portal.auth.login` → `grid/src/audit/append-portal-auth-login.ts` (Phase 33)
  - 55: `portal.auth.register` → `grid/src/audit/append-portal-auth-register.ts` (Phase 33)
  - 56: `human.identified` → `grid/src/audit/append-human-identified.ts` (Phase 33)
  - Executor looks up exact producer-file paths from the actual files in `grid/src/audit/` (Claude's Discretion below).

  Also updates the comment header on `ALLOWLIST_STATIC` from `// (45 events as of Phase 24)` to `// (56 events as of Phase 33)` and the badge text in the static reference table header. Trade-off acknowledged: list will go stale again on next allowlist growth. CI gate to prevent this is **deferred** to a future phase (would require new script + workflow integration; not in REQUIREMENTS.md). Phase 35 doc-sync rule already requires touching this kind of stale ref, so the discipline of revisiting it on every milestone close is already established.

### Claude's Discretion

The following implementation choices were deliberately left to planner / executor / researcher:

- **Hook architecture for `use-health-detailed.ts`** — SWR-shape (`{ data, error, isLoading, refresh }`) without the SWR library, vs plain `useState + useEffect + setInterval` mirroring the existing drift-alert pattern at `steward/src/app/system/page.tsx:249`. Either is acceptable; planner picks whichever reads cleaner. Steward currently has zero hook-library dependencies — keep that.
- **Watchdog refactor extent for `/firehose`** — REQ OBS-14 names `steward/src/lib/use-firehose-ws.ts` as a "refactor" target, but `/firehose/page.tsx` has 110+ lines of inline WS logic (current `connect()`, `scheduleReconnect()`, refs). Planner's call: extract all WS code to the lib hook (clean separation), add watchdog inline on `/firehose/page.tsx` (smallest blast radius), or extract just the watchdog hook. Surgical Changes rule biases toward smaller surface, but a clean `use-firehose-ws()` hook would also serve future consumers.
- **Card design & layout** — User explicitly skipped this area. Three separate cards or one combined Pipeline Health section; reuse of `steward-stat-card` vs `steward-card`; big-number vs full-breakdown layout; sparkline width relative to existing stat cards. Planner mirrors existing Steward visual idioms (serif headings, mono labels, CSS-var palette, inline styles). Cards sit ABOVE existing Allowlist Monitor per REQ-locked ordering.
- **Snake_case → human label mapping table contents** — exact label strings in `steward/src/lib/health-reason-labels.ts` (e.g., `'reconcile_stale'` → "Reconcile loop stale" vs "MySQL reconcile has not run recently"). Keep them short enough to fit comma-separated on one sub-line.
- **Exact producer-file paths for the 11 new ALLOWLIST_STATIC entries** — Executor reads `grid/src/audit/append-*.ts` files and matches the path conventions used in the existing 45 entries (some use `grid/src/<subsystem>/` directories, some use `grid/src/audit/append-*.ts`).
- **Sparkline hover/tooltip behavior** — `title=` attributes on individual bars (operator hovers → "12 events at 14:35:00") vs no tooltips. Matches existing Steward minimalism if title= is sufficient.
- **Frame-counter sparkline color exact** — `var(--terracotta)` confirmed for dropped row (warning palette); sent row neutral palette choice (e.g., `var(--ink)` muted at 40% opacity, or `var(--vellum)` filled) at planner's discretion.
- **Empty-state copy** — what each card shows when `/health/detailed` returns 503, or when cold-start grace period is active (status='ok' + `reasons: ['grace_period']`), or when client_count=0 (last_frame_at can be null without degradation). Existing Steward pattern: muted mono text ("Could not load X" / "Waiting for first reconcile…").
- **UAT shape** — Phase 34's `34-HUMAN-UAT.md` mirrors the Phase 31/32 playbook structure: `docker compose build steward && docker compose up -d steward`, then steps for each card observable behavior + the watchdog-triggering scenario from REQ OBS-14 success criterion 5 (`docker stop noesis-mysql` → cards turn red within 60s → `docker start noesis-mysql` → cards turn green within 60s).
- **Where to compute frame-counter deltas** — inside the `use-health-detailed` hook (returns `{ data, sentDelta, droppedDelta }`) vs in the Firehose Diagnostics card component itself. Either works; the hook is more reusable.

### Folded Todos

None — no pending todos matched Phase 34 scope at discuss time (gsd-sdk query todo.match-phase 34 returned zero matches).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning or implementing.**

### v2.6 Source-of-Truth

- `.planning/REQUIREMENTS.md` §"OBS — Steward Console Health Surfaces (Phase 34)" — OBS-11/12/13/14 lock file paths, poll cadence (5s), color bands (green 0 / amber 1-10 / red >10), watchdog trigger (>60s AND clients>0), REST-not-WS rule for sparkline
- `.planning/ROADMAP.md` §"Phase 34: Steward `/system` Health Surfaces" — goal, 5 success criteria, R-34-01..03 risks (multi-tab polling, REST-not-WS, reconnect storm), allowlist delta 0
- `.planning/STATE.md` §"v2.6 Key Decisions (locked 2026-05-24)" — observability stack (Pino + in-process counters + `/health/detailed` JSON polling); no Prometheus / Datadog / Honeycomb / New Relic
- `.planning/STATE.md` §"v2.6 allowlist additions (planned — Phase 33 only)" — the 11-entry delta (45→56) that justifies D-34-C1
- `.planning/research/v2.6/OBSERVABILITY-HARDENING.md` §"Phase 34 — Steward `/system` Health Surfaces" — file targets, success criteria, dependency chain rationale; §"Pitfall 8" (silent watchdog death)

### Phase 32 Inherited Contracts (FROZEN)

- `.planning/phases/32-firehose-observability/32-CONTEXT.md` §D-32-C3 (route shape), D-32-C2 (status logic), D-32-C1 (HEALTH_THRESHOLDS frozen module-level), D-32-B1..B5 (pure-pull HealthWatchdog design), §"Cross-phase API stability" — the contracts Phase 34 reads
- `.planning/phases/32-firehose-observability/32-CONTEXT.md` §"Deferred Ideas — Carried into Phase 34" — lists `use-health-detailed.ts`, `EventsPerMinuteSparkline.tsx`, `use-firehose-ws.ts`, reasons-array extension explicitly
- `grid/src/diagnostics/health-watchdog.ts` — `HealthDetailedPayload` interface (lines 65-82, Phase 34 extends with `reasons`), `computeStatus()` (lines 107+, reasons array already computed), `HEALTH_THRESHOLDS` (line 39, frozen)
- `grid/src/api/routes/health-detailed.ts` — Phase 34 propagates the existing reasons through the route (no logic change)
- `grid/src/audit/firehose-hub.ts` — `WsFirehoseHub.stats()` returning `FirehoseStats` (Phase 32 D-32-A4 frozen shape)

### Phase 33 Inherited Surfaces

- `.planning/phases/33-portal-auth-producers/33-CONTEXT.md` §"Deferred Ideas — Carried into Phase 34" — notes Steward `/users` consumer adaptation is Phase 34 territory (but the Phase 34 REQs themselves don't require this; consumer adaptation is /users page work, not /system)
- `grid/src/audit/broadcast-allowlist.ts` — authoritative 56-entry list; Steward `ALLOWLIST_STATIC` fix (D-34-C1) mirrors this

### Project-Wide Invariants

- `PHILOSOPHY.md` §1 (sovereignty — no Prometheus / Datadog / external observability SaaS; in-process counters + REST polling only); §7 (broadcast allowlist frozen at 56 — Phase 34 adds zero events)
- `CLAUDE.md` §"Documentation Sync Rule (user-mandated, 2026-04-20)" — Phase 35 will sync; Phase 34 touches `.planning/PROJECT.md` only if any invariant changes
- `CLAUDE.md` §"Surgical Changes" — every changed line traces to OBS-11/12/13/14, the reasons-array extension (D-34-B1), or the allowlist staleness fix (D-34-C1)
- v2.4 Culture Dashboard invariant ("raw SVG only — no d3 / no recharts / no react-flow / no cytoscape") — extends to D-34-A1 SVG choice for the Events-per-Minute sparkline
- v2.1 frontend invariant: Steward stays at Next.js 15.3.2 + React 19 only (no SWR library, no chart library, no hook utility libs) — see `steward/package.json`

### Code Anchors (existing — Phase 34 modifies or aligns with)

- `steward/src/app/system/page.tsx` — primary target. Add 3 cards above the existing Allowlist Monitor section (line 484). Fix `ALLOWLIST_STATIC` (lines 7-53) from 45 to 56 entries. Update badge `{ALLOWLIST_STATIC.length} events` (line 599) auto-updates with array length. Existing drift-poll pattern at line 249 (`setInterval(fetchDriftAlerts, 5000)`) is the reference shape for the new `/health/detailed` 5s poll.
- `steward/src/app/firehose/page.tsx` — add client-side watchdog (D-34 watchdog hook). Existing WS logic at lines 88-167 may or may not be extracted to `steward/src/lib/use-firehose-ws.ts` per Claude's Discretion. `EVENT_FAMILY_COLORS` palette at lines 9-21 is reusable for `EventsPerMinuteSparkline` (consider extracting to `steward/src/lib/event-family-colors.ts` if both consume it — planner's call).
- `steward/src/components/StewardShell.tsx` — `--ink`, `--rule`, `--mono`, `--serif`, `--parchment`, `--vellum`, `--muted`, `--terracotta` CSS vars are the canonical palette
- `steward/src/app/api/health/route.ts` — existing simple GET; NOT modified (steward-level health, not grid-level). Phase 34 calls `${GRID_ORIGIN}/health/detailed` directly per the existing direct-fetch pattern for read-only endpoints.
- `grid/src/diagnostics/health-watchdog.ts` — `HealthDetailedPayload` interface gets `readonly reasons: readonly string[]` (additive); `snapshot()` already has access to reasons via `computeStatus()` return; one-line propagation
- `grid/test/health-detailed-route.test.ts` — extend assertions to confirm `reasons: []` on ok and populated on degraded/critical

### Files Created by Phase 34

- `steward/src/lib/use-health-detailed.ts` (NEW) — polling hook for `/health/detailed`, 5s cadence, abort-on-unmount, returns shape with frame-counter deltas (D-34-A3)
- `steward/src/lib/use-firehose-ws.ts` (NEW, scope per Claude's Discretion) — at minimum the watchdog hook; possibly the full WS extraction from `/firehose/page.tsx`
- `steward/src/components/EventsPerMinuteSparkline.tsx` (NEW) — raw inline SVG, 60×5s buckets, REST-driven from `/api/v1/audit/trail?limit=200`
- `steward/src/components/FrameCounterSparkline.tsx` (NEW, possibly merged into Firehose Diagnostics card) — CSS-div two-row bar layout (D-34-A3)
- `steward/src/lib/health-reason-labels.ts` (NEW) — snake_case → human label mapping table (D-34-B2)
- `.planning/phases/34-steward-system-health-surfaces/34-HUMAN-UAT.md` — operator cutover playbook mirroring Phase 31/32 pattern

### Files NOT to Touch in Phase 34

- `grid/src/audit/chain.ts` — base `AuditChain.append` and listener fan-out order (zero-diff invariant since 29c3516)
- `grid/src/db/persistent-chain.ts` — Phase 31 territory
- `grid/src/db/audit-reconcile.ts` — Phase 31 territory
- `grid/src/audit/broadcast-allowlist.ts` — Phase 34 adds zero events; allowlist stays at 56
- `grid/src/audit/firehose-hub.ts` — Phase 32 territory; `stats()` shape frozen
- `grid/src/diagnostics/health-watchdog.ts` predicate logic (`computeStatus`, `HEALTH_THRESHOLDS`) — Phase 32 frozen; Phase 34 only adds the optional `reasons` field to the OUTPUT interface
- Existing `app.get('/health', ...)` (Docker healthcheck SLA, Phase 31/32 untouched)
- `grid/src/api/portal/auth.ts` — Phase 33 territory

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Existing drift-alert polling pattern** (`steward/src/app/system/page.tsx:249`) — `setInterval(fetchDriftAlerts, 5000)` with `useState` + cleanup on unmount. Direct reference shape for `use-health-detailed.ts` if the planner picks the plain-`useEffect` route.
- **Existing WebSocket reconnect machinery** (`steward/src/app/firehose/page.tsx:88-167`) — `connect()`, `scheduleReconnect()` with exponential backoff (1s → 2s → 4s … → 30s cap), `wsRef`, `retryTimerRef`, `countdownTimerRef`. The Phase 34 watchdog adds a `last_frame_at` check that calls `wsRef.current?.close()` to trigger the existing reconnect path — no new reconnect logic needed.
- **`EVENT_FAMILY_COLORS` palette** (`steward/src/app/firehose/page.tsx:9-21`) — 10 prefixes (`operator.`, `nous.`, `trade.`, `law.`, `iris.`, `skill.`, `norm.`, `lore.`, `human.`, `ananke.`) + `unknown` fallback. Phase 34 EventsPerMinuteSparkline consumes this same palette. If both `/firehose/page.tsx` and `EventsPerMinuteSparkline.tsx` import it, extract to `steward/src/lib/event-family-colors.ts`. Add `portal.` and `bios.` / `iris.` etc. families as needed for the 56-event set (currently the palette has 10 prefixes; the 56-event allowlist has more families — verify coverage during planning).
- **`steward-stat-card` and `steward-card` CSS classes** (referenced in `/system/page.tsx`) — visual idioms for big-number cards and section cards. Reuse for the 3 new cards rather than inventing new container patterns.
- **CSS variable palette** — `--ink`, `--muted`, `--terracotta`, `--parchment`, `--vellum`, `--rule`, `--mono`, `--serif` (referenced throughout `/system/page.tsx` and `StewardShell.tsx`). Color bands: green (`#2d7a2d`, `rgba(45,122,45,0.10)` bg, `rgba(45,122,45,0.3)` border — already in firehose page status pill); amber (TBD, `--terracotta` adjacent); red (`var(--terracotta)`, `rgba(184,84,47,0.08)` bg, `rgba(184,84,47,0.3)` border).
- **Direct-fetch pattern for read-only endpoints** — `/system/page.tsx` fetches `${GRID_ORIGIN}/api/v1/grid/status`, `/grid/clock`, `/grid/regions`, `/audit/drift-alerts` all directly. Phase 34 follows the same pattern for `/health/detailed` and `/api/v1/audit/trail?limit=200`. The `steward/src/app/api/operator/[...path]/route.ts` proxy is only for operator WRITE actions (because `x-operator-id` is server-only).
- **`HealthWatchdog.computeStatus()`** (`grid/src/diagnostics/health-watchdog.ts:107+`) — already returns `{ status, reasons }`. Phase 34's D-34-B1 just propagates the existing `reasons` array through `snapshot()` into the route payload. No new logic.

### Established Patterns

- **5s poll cadence + 1s 'seconds-ago' display** — drift-alert pattern uses two intervals: one for the data fetch (5s), one for `secondsAgo` re-render (1s). Phase 34 cards likely reuse this dual-interval pattern if they want to display "last updated Ns ago" mini-labels.
- **Status pill convention** — `/firehose/page.tsx` has a 3-state status pill (connecting / connected / disconnected) with green / muted / terracotta palette. Reusable visual for status banners on the new cards.
- **Mono fontFamily for tabular data** (`fontFamily: 'var(--mono)'`), **serif for headings** (`fontFamily: 'var(--serif)'`), **mono for muted metadata labels** at small font sizes with letter-spacing — consistent across all Steward pages.
- **`role="alert"` + `aria-live="polite"` for status changes** — existing drift-alerts panel uses this (line 497 + 521). Phase 34 status-changed surfaces should follow suit for screen-reader operators.

### Integration Points

- `steward/src/app/system/page.tsx` — three new card components rendered ABOVE the Allowlist Monitor section (line 484, `<div style={{ marginTop: 28 }}>`). Suggested order: Audit Pipeline Health, Firehose Diagnostics, Events per Minute by Family.
- `steward/src/app/firehose/page.tsx` — watchdog hook called inside the existing `connect()` flow OR via a separate `useFirehoseWatchdog()` hook that holds a ref to the WS connection.
- `grid/src/diagnostics/health-watchdog.ts` — single one-line additive change to `HealthDetailedPayload` interface (`readonly reasons: readonly string[]`) + one-line propagation in `snapshot()` method.
- `grid/test/health-detailed-route.test.ts` — extend the parametrized payload-shape assertions to include `reasons: []` (ok) and populated reasons (degraded/critical) cases.

### Files Created by Phase 34

(See `<canonical_refs>` §"Files Created by Phase 34" for the full list.)

</code_context>

<specifics>
## Specific Ideas

- **"Mixed primitive for sparklines" rationale** — the operator's eye reads stacked-family geometry differently from a single-color delta line. SVG geometry handles the former; CSS bars handle the latter cleanly. Two surfaces, two purposes, two tools. Same overall card visual language because both use the existing Steward palette + Card containers.
- **Reasons sub-line as a "no-click diagnostic"** — the operator at `/system` should never have to click into logs to know why something turned amber. The sub-line saying "Reconcile loop stale" tells them where to look next without the extra step. Mirrors the existing `/system` drift-alerts panel which already shows event types inline rather than requiring a drill-down.
- **Static-list discipline carries forward** — the `ALLOWLIST_STATIC` constant grows with every milestone close per CLAUDE.md Documentation Sync Rule. v2.6 Phase 35 should add this file to the Documentation Sync Rule's checklist so it's caught structurally going forward (deferred to Phase 35 / Phase 36 as a doc-sync-rule extension; not a Phase 34 deliverable).
- **REST-not-WS for Events-per-Minute** — this is the cleanest expression of "Phase 32's silence-is-signal philosophy" extended into the UI: when the WebSocket is broken (exactly when the operator opens `/system`), the sparkline still updates from the audit trail REST endpoint. Phase 34 surfaces don't depend on Phase 32 surfaces working correctly — they're orthogonal observation channels.
- **Watchdog as the closing piece of the "WS opens but never delivers" failure mode** — Phase 32 added `frames_sent_total` / `last_frame_at` on the server. Phase 34 D-34 watchdog reads those via `/health/detailed` and forces reconnect. Together they close the loop: server measures, client acts.
- **Cutover dance** — per user persistent memory ("Rebuild Grid Docker after every source change" + "Rebuild Steward Docker after every Steward source change" implied by parity): `34-HUMAN-UAT.md` step 0 should call out `docker compose build steward && docker compose up -d steward` (and `docker compose build grid` for the reasons-payload extension), mirroring Phase 31/32 cutover sections.
- **Cross-phase API extension discipline** — D-34-B1 extends `HealthDetailedPayload` (Phase 32 D-32-C3 contract). This is permitted because it's additive (existing consumers see `reasons` as an extra field they may ignore). The Phase 32 contract-test (`health-detailed-route.test.ts`) was explicitly designed to assert exact shape — Phase 34 updates this test to include the new field, locking the new shape going forward. No silent shape drift.

</specifics>

<deferred>
## Deferred Ideas

### Carried into Phase 35 (UAT + Doc Sync)

- 25a-HUMAN-UAT items #1 (firehose color rendering live) and #5c (`/users` deep-link) re-verification — Phase 34 establishes the surfaces operators need to verify health visually; Phase 35 closes the original UAT loop
- Atomic doc sync across MILESTONES, PROJECT, PHILOSOPHY, README, CLAUDE.md (OBS-15)
- Update `ALLOWLIST_STATIC` discipline — consider adding `steward/src/app/system/page.tsx` to the Documentation Sync Rule's checklist so future milestone closes catch the staleness structurally (Phase 35 territory or a v2.7 cleanup phase)

### Carried into v2.7+ if warranted

- **CI gate `scripts/check-steward-allowlist-sync.mjs`** — would grep `ALLOWLIST_STATIC` in `steward/src/app/system/page.tsx` against the production allowlist array in `grid/src/audit/broadcast-allowlist.ts` and fail build on drift. Decided against for Phase 34 (one more gate to maintain; not in REQUIREMENTS.md). Revisit if the static list goes stale again post-v2.6.
- **Dynamic `/api/v1/audit/allowlist` endpoint** — a new Grid endpoint returning the live allowlist array; Steward fetches on mount instead of hardcoding. Decided against for Phase 34 (new Grid endpoint = cross-workspace scope creep; would require sole-producer + CI gate + payload privacy check). Revisit if dashboards need allowlist introspection beyond what `/system` provides.
- **OpenTelemetry self-hosted via `@fastify/otel` + OTLP collector** (OBS-FUTURE-OTEL-01) — still deferred; only if operators ask
- **`buffer_high_water_mark` per-client metric in `stats()`** (carried from Phase 32 deferred) — Phase 34 Steward Firehose Diagnostics card does NOT need this; revisit if a future card wants per-client backpressure visibility
- **Structured reasons objects with context** (e.g., `{ code: 'reconcile_stale', context: { stale_ms: 120000 } }`) — Phase 34 picked snake_case keys for simplicity. Revisit only if reasons sub-lines need live numbers ("stale for 2m" instead of "Reconcile loop stale")
- **Expandable details panel for reasons** — visible sub-line was chosen for glance-distance reading. Revisit if reasons arrays grow large (>3 entries) and sub-lines get crowded
- **Steward `/users` consumer adaptation** (carried from Phase 33 deferred) — Phase 34 does NOT touch `/users`. That work belongs to a future `/users` page enhancement phase or is folded into Phase 35 UAT close-out
- **Reasons ordering by severity** — Phase 34 reasons render in the array order produced by `computeStatus()` (critical conditions evaluated first per Phase 32 D-32-C2). If operators want explicit severity badging per reason, that's a future enhancement

### Scope-creep ideas redirected during discussion

- "Should we also add CI gate for steward allowlist sync?" — Deferred. User picked the simpler "fix to 56 statically" option without the gate. Captured as v2.7+ idea above.
- "Should we convert ALLOWLIST_STATIC to dynamic fetch?" — Deferred. Same reason. New Grid endpoint is its own phase.
- "Should reasons render in a hover tooltip instead?" — Decided against in favor of always-visible sub-line. Glance-distance reading > one extra interaction step.

### Reviewed Todos (not folded)

No pending todos matched Phase 34 scope at discuss time (gsd-sdk query todo.match-phase 34 returned `todo_count: 0`).

</deferred>

---

*Phase: 34-steward-system-health-surfaces*
*Context gathered: 2026-05-25*
