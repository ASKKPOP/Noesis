# Phase 32: Firehose Observability — Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Make "tick advances but zero frames delivered" impossible to go unnoticed for >60 seconds. Three deliverables:

1. **Frame counters on `WsFirehoseHub`** (`grid/src/audit/firehose-hub.ts`): `stats()` method returns `{ client_count, frames_sent_total, frames_dropped_total, last_frame_at, watermark_bytes }`. `frames_sent_total` increments AFTER successful `socket.send` (NOT before — backpressure-evicted entries do not count as "sent"). `frames_dropped_total` increments on ring-buffer overflow eviction.
2. **`GET /health/detailed`** new REST endpoint surfacing `{ status: 'ok'|'degraded'|'critical', timestamp, audit, firehose, clock }` blocks. MUST NOT block on DB — reads cached `persisted_max_id` from `launcher.auditReconcile.persistedMaxId` (populated every 60 ticks by Phase 31's reconcile loop). Cache miss returns `null`, not a 30s timeout. p95 endpoint latency <50ms regardless of DB state.
3. **`HealthWatchdog`** at `grid/src/diagnostics/health-watchdog.ts` — pure-pull helper class that computes the status snapshot on demand (no timer, no new `clock.onTick` subscription). Inherits the AuditReconcile getter API surface frozen in Phase 31.

**Closes:** REQ OBS-05, OBS-06, OBS-07 (the firehose-visibility leg of v2.6 GAP-A).

**Does NOT touch:** `portal.auth.*` producers (Phase 33), Steward `/system` UI cards (Phase 34), allowlist (stays at 53), basic `/health` route (server.ts:284 unchanged for Docker healthcheck SLA), Phase 31 AuditReconcile internals, listener fan-out order, zero-diff invariant, `PersistentAuditChain` wiring (Phase 31 territory).

**Foundational dependency:** Phase 31 must ship first (so `launcher.auditReconcile.{lastReconcileAt, persistedMaxId, lastPersistError}` getters exist and produce meaningful values — without them, the `audit` block of `/health/detailed` is empty).

**Cross-phase API surface this phase locks for Phase 34:**

- `WsFirehoseHub.stats(): FirehoseStats` — Steward `/firehose` and `/system` cards poll this via `/health/detailed`
- `HealthWatchdog.snapshot(): HealthDetailedPayload` — Steward `/system` Audit Pipeline Health card consumes the full payload shape

</domain>

<decisions>
## Implementation Decisions

### Frame Counter Plumbing (Area 1)

- **D-32-A1:** `frames_dropped_total` learns about RingBuffer eviction via a **size===capacity check inside `ClientConnection.enqueue`**. BEFORE `this.buffer.push(entry)`, check `this.buffer.size === this.buffer.capacity`; if true, fire the drop-increment callback then push. **Why this and not `onEvict` callback or before/after compare:** zero RingBuffer API change (it's a shared util used by Phase 25a NousRunner.tickLatencyBuffer and others — touching it widens blast radius); locality of the new code stays inside the firehose layer; pre-check is the simplest read of intent ("at capacity → drop is happening"); same blast radius as before/after compare but without the verbosity. **Cost:** ClientConnection now reads `buffer.size`/`buffer.capacity` — make sure RingBuffer exposes both as public accessors (it does as of Phase 25a — verify in research step).

- **D-32-A2:** Frame counters live on **`WsFirehoseHub` as private metrics, mutated via callbacks passed into `ClientConnection`**. Hub holds `private metrics = { frames_sent_total: 0, frames_dropped_total: 0, last_frame_at: null as number | null }`. `ClientConnection` constructor accepts an additional `metrics: { incrementSent: () => void; incrementDropped: () => void; touchLastFrame: () => void }` parameter (or a typed `HubMetricsSink` interface — planner choice). `stats()` reads `this.metrics` directly + computes `client_count` from `this._clients.size` and returns `watermark_bytes` from `this.watermarkBytes`. **Why this and not per-ClientConnection fields:** counters that die with disconnects lose visibility; `stats()` becoming O(N) is the same problem. **Why this and not raw object reference into ClientConnection:** callbacks keep `ClientConnection` from reaching into hub internals; the interface is the contract.

- **D-32-A3:** `frames_sent_total` and `last_frame_at` increment **AFTER `socket.send(...)` inside the existing `try` block in `ClientConnection.trySend`, BEFORE the `catch`**. Exact shape:

  ```typescript
  trySend(frame: ServerFrame): void {
      if (this.closed) return;
      try {
          this.socket.send(JSON.stringify(frame));
          this.metrics.incrementSent();
          this.metrics.touchLastFrame();
      } catch {
          // Swallow — same boundary as today; counters never incremented if send threw.
      }
  }
  ```

  **R-32-03 satisfied directly:** a `socket.send`-throwing client never increments `frames_sent_total`. The existing `// Swallow` comment stays — the regression test in `firehose-send-throws.test.ts` is the active enforcement.

- **D-32-A4:** `stats()` returns the OBS-05 shape exactly:

  ```typescript
  interface FirehoseStats {
      readonly client_count: number;
      readonly frames_sent_total: number;
      readonly frames_dropped_total: number;
      readonly last_frame_at: number | null;
      readonly watermark_bytes: number;
  }
  ```

  Plain object snapshot — no mutability concerns. `buffer_high_water_mark` per client deferred (not in OBS-05 scope; revisit if Phase 34 dashboards want it).

### HealthWatchdog Cadence + Lifecycle (Area 2)

- **D-32-B1:** **Pure-pull design — HealthWatchdog has NO timer.** `snapshot()` is invoked synchronously by the `/health/detailed` route handler per request; reads `launcher.auditReconcile.{lastReconcileAt, persistedMaxId, lastPersistError}` + `firehoseHub.stats()` + `launcher.clock.state` + `Date.now()` and returns the full `HealthDetailedPayload`. **Why:** STATE.md locks "exactly ONE `clock.onTick` subscription" (Phase 31 inherits this) — pure-pull adds no new subscription. R-32-02 (setInterval lifecycle) is trivially satisfied because no `setInterval` exists. Cost: snapshot is computed per request instead of cached — at /health/detailed poll cadence of 5s (Phase 34 Steward), this is ~12 reads/min, negligible CPU.

- **D-32-B2:** `class HealthWatchdog` lives at **`grid/src/diagnostics/health-watchdog.ts`**, instantiated as a **one-shot-settable field on `GenesisLauncher`** (NOT strictly `readonly` at construction; see D-32-G1 below — pattern is `set once via attachHealthWatchdog(), frozen after`). Mirrors the spirit of Phase 31's `auditReconcile?: AuditReconcile | undefined` shape but with the construction site moved to `buildServerWithHub` (D-32-G1).

- **D-32-B3:** Logging: **state-transition warn-logs only** — `snapshot()` tracks a private `lastStatus: 'ok' | 'degraded' | 'critical' | null` field; when `lastStatus !== newStatus`, fires `logger.warn({ event: 'health_status_changed', from: lastStatus, to: newStatus, reasons: [...triggered conditions] })` (or `info` if degrading→ok). R-32-01 "silence is signal" requirement is **already satisfied by Phase 31's `audit_reconcile_ok` heartbeat stream** (`grid/src/db/audit-reconcile.ts` logs every 60-tick cadence at info level) — HealthWatchdog adds the orthogonal "status changed" signal on top. **Do NOT** log every `snapshot()` call (would require `NOESIS_LOG_LEVEL=debug` to see — defeats visible-by-default).

- **D-32-B4:** **Cold-start grace window:** if `launcher.clock.state.tick < 60` (one reconcile cycle hasn't elapsed yet), `snapshot()` returns `status: 'ok'` with `audit.last_persist_attempt_at: null` and `audit.divergence: null`. After 60 ticks the normal staleness rule (`Date.now() - launcher.auditReconcile.lastReconcileAt > 5 × snapshotCadenceMs`) applies. **Why:** without grace, every fresh Grid boot would page as `degraded` for the first 30s — operationally annoying and a false signal.

- **D-32-B5:** Constructor accepts injectable `opts.now?: () => number` (default `Date.now`) and `opts.snapshotCadenceMs?: number` (default `30_000`). Tests inject a fake clock to verify staleness thresholds without `sleep` or `vi.useFakeTimers()` cleanup churn. Mirrors Phase 31 `AuditReconcile.runAt` style. Constructor signature:

  ```typescript
  new HealthWatchdog(
      deps: {
          auditReconcile?: AuditReconcile;
          clockState: () => ClockState;
      },
      opts?: {
          now?: () => number;
          snapshotCadenceMs?: number;
      },
  );
  // firehoseStats is wired separately via attachFirehoseHub(hub) — see D-32-G2.
  ```

### /health/detailed Status Logic + Threshold Home (Area 3)

- **D-32-C1:** Threshold constants live as a **frozen module-level export inside `grid/src/diagnostics/health-watchdog.ts`**:

  ```typescript
  export const HEALTH_THRESHOLDS = Object.freeze({
      DIVERGENCE_DEGRADED: 10,
      DIVERGENCE_CRITICAL: 100,
      STALE_FRAME_MS: 60_000,
      RECONCILE_STALE_MULTIPLIER: 5,
  } as const);
  ```

  Named export so tests can reference symbolically (`HEALTH_THRESHOLDS.DIVERGENCE_DEGRADED`). Lives with the only code that reads them — no `health-thresholds.ts` file proliferation, no launcher-config injection (values are REQ-locked policy, not deployment-tunable knobs; changing them is a CONTEXT.md / SPEC change).

- **D-32-C2:** Status computation is a **single pure helper inside `health-watchdog.ts`**:

  ```typescript
  function computeStatus(input: {
      auditDivergence: number | null;
      auditLastPersistError: { code: string; at: number } | null;
      firehoseLastFrameAt: number | null;
      firehoseClientCount: number;
      reconcileStaleMs: number | null;
      now: number;
      snapshotCadenceMs: number;
      gracePeriodActive: boolean;
  }): { status: 'ok' | 'degraded' | 'critical'; reasons: string[] }
  ```

  Evaluation order: **grace period first** (returns `'ok'` if active), **critical second** (`divergence > DIVERGENCE_CRITICAL` OR `lastPersistError !== null && divergence > 0`), **degraded third** (`divergence > DIVERGENCE_DEGRADED` OR `firehoseLastFrameAt === null && clientCount > 0` OR `now - firehoseLastFrameAt > STALE_FRAME_MS && clientCount > 0` OR `reconcileStaleMs > RECONCILE_STALE_MULTIPLIER × snapshotCadenceMs`), else `'ok'`. Reasons array exposes WHICH conditions triggered (useful for the warn log in D-32-B3; NOT exposed in the route payload — that stays per OBS-06 shape).

- **D-32-C3:** Route file: **`grid/src/api/routes/health-detailed.ts`** — new file, mirrors `tick-metrics.ts` shape. Exports `registerHealthDetailedRoute(app: FastifyInstance, services: GridServices, launcher: GenesisLauncher)`. Registered at top level of `buildServerWithHub` (NOT inside the websocket scope `app.register(async instance => ...)` — that scope is for WebSocket routes only) immediately after the existing `app.get('/health', ...)` block (server.ts:284). Route handler is a one-liner: `return launcher.healthWatchdog!.snapshot();` (with appropriate guard if `healthWatchdog` not yet attached during the narrow startup window — see D-32-G2). Existing `/health` route stays cheap and unchanged (Docker healthcheck SLA).

### CI Gates + Test/UAT Depth (Area 4)

- **D-32-D1:** Two new CI gates land alongside Phase 31's `check-no-silent-catch.mjs`:

  1. **`scripts/check-observability-no-todo.mjs`** (R-32-01): greps for `(TODO|FIXME|XXX).{0,50}(health|metric|frame|drift|reconcile)` case-insensitive across `grid/src/diagnostics/` + `grid/src/audit/` + `grid/src/db/`. Fails build (non-zero exit) on any match. Prevents observability code shipping with deferred work — the exact pattern that produces silent failures.
  2. **`scripts/check-interval-lifecycle.mjs`** (R-32-02): asserts every `setInterval(` call in `grid/src/diagnostics/` + `grid/src/audit/` + `grid/src/db/` is stored in a class field (regex: the line containing `setInterval` either has `this.<name> =` to its left OR is preceded within 3 lines by a `<name> =` assignment that becomes a class field). Catches the "watchdog handle GC'd silently" failure mode. **Note:** D-32-B1 (pure-pull) means Phase 32 ships zero `setInterval` calls in these dirs — the gate flags zero entries today but locks the discipline for future phases.

  Both wired into **`.github/workflows/rig-invariants.yml`** as steps named `"OBS-R-32-01 observability-no-TODO gate (Phase 32)"` and `"OBS-R-32-02 setInterval-lifecycle gate (Phase 32)"`, alongside the existing Phase 31 `"OBS-03 no-silent-catch gate (Phase 31)"` step. Scope is the same three directories — narrowest scope that covers the observability + persistence + audit layers without false-positive risk from `grid/src/__tests__/` simulation harnesses.

- **D-32-D2:** **Four-file minimum regression test set** (vitest):

  1. **`grid/test/firehose-frame-counters.test.ts`** — asserts `stats().frames_sent_total` increments on successful send; `frames_dropped_total` increments when ring-buffer is at capacity AND another entry is pushed; `last_frame_at` updates to a recent ms-epoch on every send.
  2. **`grid/test/firehose-send-throws.test.ts`** (R-32-03 regression) — injects a `ClientConnection` whose `socket.send` always throws; asserts `frames_sent_total === 0` after N enqueues, hub does NOT panic (no unhandled rejection), other clients on the same hub continue receiving frames normally.
  3. **`grid/test/health-detailed-route.test.ts`** — builds the server + launcher with injected `now()`, exercises all four payload-block shapes (ok / cold-start-ok / degraded / critical) via a parametrized state matrix; asserts response shape matches `HealthDetailedPayload` exactly (no extra keys, no missing keys); asserts p95 latency invariant by timing 100 calls and asserting `< 50ms` (loose enough to survive CI variance).
  4. **`grid/test/health-watchdog-transitions.test.ts`** — asserts `logger.warn` fires on ok→degraded and degraded→critical transitions; does NOT fire on consecutive ok→ok snapshots; uses Pino test-mode sink to capture log events deterministically.

  Construction-order race test (Pitfall 1 from research doc) **deferred** — buildServerWithHub structure already locks the order; a future regression would require touching `server.ts` and would be caught by the lint/typecheck cycle.

- **D-32-D3:** **Phase 32 ships its own `32-HUMAN-UAT.md`** at `.planning/phases/32-firehose-observability/32-HUMAN-UAT.md`. Verification steps (mirroring `31-HUMAN-UAT.md` structure):

  1. `curl -s http://localhost:8080/health/detailed | jq .` after 60s uptime returns full shape per OBS-06.
  2. With at least one Steward `/firehose` tab open as a client, poll `/health/detailed` twice 5s apart — assert `frames_sent_total` strictly greater the second time AND `last_frame_at` is `> first_call - 5_000`.
  3. Half-closed socket harness (operator runs `node scripts/uat-half-close-socket.mjs --grid genesis` — a one-shot diagnostic script that connects, then half-closes after `hello` frame) — assert `frames_dropped_total` increments without `frames_sent_total` incrementing on the offending connection AND other clients keep receiving.
  4. `docker stop noesis-mysql` — assert `/health/detailed` returns `status: 'degraded'` within 60s with non-zero `audit.divergence` AND `audit.last_persist_error` populated. `docker start noesis-mysql` + wait one reconcile cycle (60 ticks ≈ 30s) — assert status returns to `'ok'`.
  5. `ab -n 1000 -c 10 http://localhost:8080/health/detailed` — assert p95 latency `< 50ms` per OBS-06 success criterion 5.

  Each phase having its own UAT keeps operator cutover playbooks independently versionable (matches Phase 31 D-31-D3 cutover-doc philosophy).

### HealthWatchdog ↔ FirehoseHub Wiring (Area 5 — construction-order resolution)

- **D-32-E1:** **`GenesisLauncher` gains a `attachFirehoseHub(hub: { stats(): FirehoseStats })` method**. Mirrors the Phase 9 `attachRelationshipStorage(pool)` precedent (D-9-04) — the launcher already has the setter pattern for resources constructed after itself. Method signature accepts a structural interface (`{ stats(): FirehoseStats }`) rather than the concrete `WsFirehoseHub` class to avoid circular dependency: `grid/src/genesis/` would otherwise need to import from `grid/src/audit/firehose-hub.ts`, when the audit layer should not depend on genesis types.

  Inside `attachFirehoseHub`: stores the hub reference (private field) AND wires it into the HealthWatchdog by calling `this.healthWatchdog!.attachFirehoseStats(() => hub.stats())`. Idempotency: throw if called twice (one-shot setter — `attached` flag).

- **D-32-E2:** HealthWatchdog mirror: gains `attachFirehoseStats(fn: () => FirehoseStats)` instance method. Before this method is called, `snapshot()` returns the `firehose` block with `{ client_count: 0, frames_sent_total: 0, frames_dropped_total: 0, last_frame_at: null, watermark_bytes: 0 }` (all-zeros sentinel — distinguishable from "no firehose configured" only by inspecting `auditReconcile` presence). After attach, `snapshot()` calls `this._firehoseStatsFn()` per request. Idempotency: throw if called twice.

### Watchdog Constructor Contract (Area 6)

- **D-32-F1:** Deps shape uses **getter functions for clockState (testability)** and direct reference for auditReconcile:

  ```typescript
  new HealthWatchdog(
      deps: {
          auditReconcile: AuditReconcile | undefined;  // by-reference; getters read at snapshot time
          clockState: () => ClockState;                  // getter for cheap test mocking
      },
      opts?: {
          now?: () => number;          // default Date.now
          snapshotCadenceMs?: number;  // default 30_000
      },
  );
  ```

  `firehoseStats` is NOT in the constructor — it arrives via `attachFirehoseStats(fn)` (D-32-E2) because of the construction-order timing. **Why getter for clockState:** tests don't need a full `WorldClock` (it has tick/start/stop/onTick surface area) — just a `() => ({ tick: 42, ... })` stub. **Why by-reference for auditReconcile:** its getters are designed for cross-phase access (Phase 31 D-31-C3 locked this); reading them at snapshot time is idiomatic.

### main.ts Integration Sequence (Area 7)

- **D-32-G1:** **HealthWatchdog construction happens inside `buildServerWithHub`** (after `firehoseHub` exists in the same scope). main.ts is NOT touched by Phase 32 (it constructs `launcher` and calls `buildServerWithHub` — same as today). Sequence inside `buildServerWithHub` (server.ts ~line 572):

  ```typescript
  // 1. (existing) Construct firehoseHub
  const firehoseHub = new WsFirehoseHub(services.audit, services.gridName);

  // 2. (NEW Phase 32) Construct HealthWatchdog and attach to launcher
  const healthWatchdog = new HealthWatchdog(
      {
          auditReconcile: launcher.auditReconcile,
          clockState: () => launcher.clock.state,
      },
      // opts left at defaults in production; tests inject via buildServerWithHub test seam
  );
  launcher.attachHealthWatchdog(healthWatchdog);
  launcher.attachFirehoseHub(firehoseHub);  // also wires healthWatchdog.attachFirehoseStats

  // 3. (NEW Phase 32) Register /health/detailed route
  registerHealthDetailedRoute(app, services, launcher);
  ```

  Order matters: HealthWatchdog must be attached BEFORE attachFirehoseHub (the latter calls back into the watchdog to wire stats).

- **D-32-G2:** `GenesisLauncher` field shape (one-shot-settable, NOT strictly `readonly` at construction):

  ```typescript
  // NOT readonly at construction; one-shot-settable via attachHealthWatchdog.
  private _healthWatchdog: HealthWatchdog | undefined;

  get healthWatchdog(): HealthWatchdog | undefined {
      return this._healthWatchdog;
  }

  attachHealthWatchdog(wd: HealthWatchdog): void {
      if (this._healthWatchdog !== undefined) {
          throw new Error('HealthWatchdog already attached');
      }
      this._healthWatchdog = wd;
  }
  ```

  Trade-off accepted: deviates from the strict `readonly` invariant established for `auditReconcile`. Justification: `auditReconcile` is constructed inside the launcher (`new AuditReconcile(...)` if `dbConn` present); `HealthWatchdog` cannot be — it depends on `firehoseHub` which only exists after `buildServerWithHub`. One-shot-settable with throw-on-second-call preserves the "set once at boot, immutable after" semantics that matter for testability and reasoning. Phase 34 (Steward UI) reads `launcher.healthWatchdog!.snapshot()` after boot — guard with `!` is acceptable because Phase 32's UAT step 1 verifies attachment completed before any request lands.

### Claude's Discretion

- **Exact RingBuffer accessor names** — if `RingBuffer.size` and `RingBuffer.capacity` are not already public, planner adds them. If they already are (Phase 25a tickLatencyBuffer suggests yes), no change.
- **Exact `HubMetricsSink` interface shape** — D-32-A2 specifies three callback methods. Planner may model as discrete params or a single sink object — whichever reads cleaner in `ClientConnection.constructor`.
- **`HealthDetailedPayload` TypeScript export location** — could live in `grid/src/diagnostics/health-watchdog.ts` (co-located with the producer) or `grid/src/api/types.ts` (where API contract types accrue). Planner chooses.
- **`uat-half-close-socket.mjs` script depth** — D-32-D3 step 3 needs a half-closed socket. Planner decides whether to ship a dedicated script or document `wscat` + `Ctrl-C` as the operator action.
- **Reasons array log shape** — D-32-B3 says the transition log includes `reasons: [...triggered conditions]`. Exact strings (`'divergence>10'` vs `'divergence_above_threshold'`) are planner's call as long as they're greppable.
- **Test depth on cold-start grace window** — at least one test case in `health-detailed-route.test.ts` should exercise `tick < 60` (expect ok) AND `tick === 60` (expect normal rule applies). Number of additional cases planner's call.
- **Migration of any existing `setInterval` in `grid/src/audit/` or `grid/src/db/`** — D-31-A1 cleanup work; if any exist that aren't held in fields, fix them in this phase so the new gate passes on its first run.

### Folded Todos

None — no pending todos matched Phase 32 scope at discuss time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning or implementing.**

### v2.6 Source-of-Truth

- `.planning/REQUIREMENTS.md` §"OBS — Firehose Observability (Phase 32)" — OBS-05/06/07 lock file paths, payload shapes, status thresholds, success criteria
- `.planning/ROADMAP.md` §"Phase 32: Firehose Observability" — goal, 5 success criteria, R-32-01..03 risks (CI gates + interval lifecycle + frame-counter placement), allowlist delta 0
- `.planning/STATE.md` §"v2.6 Key Decisions (locked 2026-05-24)" — observability stack (Pino + in-process counters), `/health/detailed` non-blocking constraint
- `.planning/STATE.md` §"v2.6 Phase 31 close-out (locked 2026-05-24)" — the cross-phase API surface contract: `launcher.auditReconcile.{lastReconcileAt, persistedMaxId, lastPersistError}` getters; single `clock.onTick` invariant
- `.planning/research/v2.6/OBSERVABILITY-HARDENING.md` §"Health Probes & Observability Surfaces" + §"Frame-counter + drop-counter shape" + §"Pitfalls 1, 3, 8" — HIGH-confidence root cause + recommended code-shape sketches + sovereignty rationale

### Phase 31 Inherited Surfaces

- `.planning/phases/31-audit-pipeline-persistence/31-CONTEXT.md` §D-31-C3 (AuditReconcile getter contract) — the cross-phase API surface Phase 32 reads
- `grid/src/db/audit-reconcile.ts` lines 40-66 (private state + readonly getters) — exact field names and types
- `grid/src/genesis/launcher.ts` lines 48 + 151 (`auditReconcile?: AuditReconcile` field + `readonly auditReconcile: AuditReconcile | undefined` accessor) — precedent for one-shot-settable optional fields
- `grid/src/util/logger.ts` (Pino singleton from Phase 31) — `logger.child({ module: 'health-watchdog' })` is the canonical per-module pattern
- `scripts/check-no-silent-catch.mjs` (Phase 31 CI gate) — pattern reference for `check-observability-no-todo.mjs` and `check-interval-lifecycle.mjs` discipline + workflow integration shape

### Project-Wide Invariants

- `PHILOSOPHY.md` §1 (sovereignty — no Prometheus/Datadog/Honeycomb/New Relic; in-process counters + REST polling only); §7 (broadcast allowlist frozen-except-by-explicit-addition — Phase 32 adds zero events)
- `CLAUDE.md` §"Documentation Sync Rule (user-mandated, 2026-04-20)" — Phase 35 will sync, but Phase 32 still touches `.planning/PROJECT.md` if any invariant changes
- `CLAUDE.md` §"Surgical Changes" — every changed line must trace to OBS-05/06/07 or the three Risks
- `.planning/MILESTONES.md` — v2.6 ongoing; Phase 32 will be logged here at v2.6 close (Phase 35 territory)

### Code Anchors (existing — Phase 32 modifies or aligns with)

- `grid/src/audit/firehose-hub.ts` (220 lines) — add `metrics` field, `stats()` method; modify `ClientConnection` constructor to accept `HubMetricsSink` callbacks; modify `trySend` to increment after `socket.send`; modify `enqueue` to check size===capacity before push
- `grid/src/util/ring-buffer.ts` — verify `size` and `capacity` are public accessors (no API change needed if so)
- `grid/src/genesis/launcher.ts` — add `_healthWatchdog: HealthWatchdog | undefined` field, `healthWatchdog` getter, `attachHealthWatchdog()` setter, `attachFirehoseHub({ stats })` setter (the latter ALSO calls into `_healthWatchdog.attachFirehoseStats(...)`). DO NOT add a new `clock.onTick` subscription.
- `grid/src/api/server.ts` line ~572 (`buildServerWithHub` body) — add Phase 32 wiring block between firehose construction and existing route registration (see D-32-G1 sketch). Keep existing `app.get('/health', ...)` at line 284 unchanged.
- `grid/src/api/routes/tick-metrics.ts` — pattern reference for new `registerHealthDetailedRoute(app, services, launcher)` shape
- `grid/src/db/audit-reconcile.ts` (Phase 31 surface) — read-only consumer; do NOT modify

### Files NOT to Touch in Phase 32

- `grid/src/audit/chain.ts` — base `AuditChain.append` and listener fan-out order (zero-diff invariant since 29c3516; Phase 31 R-31-01 regression test pins this)
- `grid/src/db/persistent-chain.ts` — Phase 31 territory; structured-logging shape locked
- `grid/src/db/audit-reconcile.ts` — Phase 31 territory; the getter API surface is the contract Phase 32 reads from
- `grid/src/audit/broadcast-allowlist.ts` — Phase 32 adds zero events; allowlist stays at 53
- `grid/src/api/portal/auth.ts` — Phase 33 territory
- Existing `app.get('/health', ...)` at server.ts:284 — Docker healthcheck SLA, stays cheap

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`launcher.auditReconcile`** (Phase 31) — `readonly auditReconcile: AuditReconcile | undefined`. HealthWatchdog reads `.lastReconcileAt`, `.persistedMaxId`, `.lastPersistError` directly. ZERO new fan-out subscriptions needed.
- **`WsFirehoseHub` private `_clients: Set<ClientConnection>`** — already tracks `client_count` (exposed as `get clientCount()` at firehose-hub.ts:133). `stats()` reuses this.
- **`RingBuffer`** (`grid/src/util/ring-buffer.ts`) — generic util used by NousRunner.tickLatencyBuffer (Phase 25a). Verify `size`/`capacity` are public accessors. If yes, D-32-A1 is a 1-line check in `ClientConnection.enqueue`.
- **Pino logger singleton** (`grid/src/util/logger.ts`, Phase 31) — `logger.child({ module: 'health-watchdog' })` is the canonical convention. Redact list already covers `password`, `signature`, `nonce`, etc. — Phase 32 emits no secrets, no additional redaction needed.
- **`registerTickMetricsRoute` pattern** (`grid/src/api/routes/tick-metrics.ts`) — exact shape for `registerHealthDetailedRoute(app, services, launcher)`. Same DID_REGEX-style early-return discipline, same `ApiError` type for any error responses.
- **`buildServerWithHub` scope** (`grid/src/api/server.ts` ~line 572) — the construction site where firehoseHub already lives. Phase 32 adds 3-5 lines after the existing firehoseHub construction: instantiate HealthWatchdog, call attachHealthWatchdog + attachFirehoseHub, registerHealthDetailedRoute.

### Established Patterns

- **One-shot-settable optional field** — `launcher.auditReconcile?: AuditReconcile` (Phase 31) is set inside the constructor (deps?-driven) and exposed as `readonly` accessor. Phase 32's `healthWatchdog` deviates: it's set via `attachHealthWatchdog()` because construction depends on `firehoseHub` which doesn't exist until `buildServerWithHub`. Same INTENT (set once, immutable after) — different MECHANISM (setter throws on second call). Documented in D-32-G2.
- **Post-construction setter precedent** — `attachRelationshipStorage(pool)` (Phase 9 D-9-04) for DB-bound services. `attachFirehoseHub({ stats })` follows the same shape with a structural interface to avoid `genesis/` → `audit/` import direction.
- **Pure-helper + injectable now() for tests** — Phase 25a NousRunner.tickLatencyBuffer + Phase 31 AuditReconcile both ship test seams. HealthWatchdog.opts.now follows the same pattern.
- **Sole-producer audit events** — Phase 32 adds ZERO audit events. The structured-logging events (`health_status_changed`) follow analogous discipline but are LOG events, not AUDIT events. No `audit.append` calls.

### Integration Points

- `grid/src/api/server.ts` ~line 572 (`buildServerWithHub` body) — primary integration site. Phase 32 wiring block sits BETWEEN firehose hub construction and the existing route registrations.
- `grid/src/genesis/launcher.ts` — add field, getter, two attach setters. No constructor change.
- `package.json` (grid workspace) — NO new dependencies. Pino is already a Phase 31 direct dep at ^10.0.0.
- CI workflow (`.github/workflows/rig-invariants.yml`) — add two new steps alongside the existing Phase 31 `check-no-silent-catch` step.

### Files Created by Phase 32

- `grid/src/diagnostics/health-watchdog.ts` — `class HealthWatchdog`, `interface HealthDetailedPayload`, `HEALTH_THRESHOLDS` const, `computeStatus()` pure helper
- `grid/src/api/routes/health-detailed.ts` — `registerHealthDetailedRoute(app, services, launcher)`
- `scripts/check-observability-no-todo.mjs`
- `scripts/check-interval-lifecycle.mjs`
- `grid/test/firehose-frame-counters.test.ts`
- `grid/test/firehose-send-throws.test.ts`
- `grid/test/health-detailed-route.test.ts`
- `grid/test/health-watchdog-transitions.test.ts`
- `.planning/phases/32-firehose-observability/32-HUMAN-UAT.md`
- (possibly) `scripts/uat-half-close-socket.mjs` — diagnostic for D-32-D3 step 3 (planner's call per Claude's Discretion)

</code_context>

<specifics>
## Specific Ideas

- **"status changed" log convention** — Pino structured event named `health_status_changed` with closed key set `{ event, from, to, reasons }`. Mirrors Phase 31 `audit_persist_failed` / `audit_reconcile_ok` convention. Operators tail logs with `docker compose logs grid -f | grep -E "(audit_reconcile|audit_persist|health_status_changed)"` and see three orthogonal signals.

- **"Silence is signal" channel ownership clarification** — Phase 31's `audit_reconcile_ok` every-60-ticks heartbeat IS the canonical "audit pipeline alive" signal. Phase 32's HealthWatchdog adds the orthogonal "computed health changed" signal. NEITHER signal replaces the other; both are required for R-32-01 mitigation. Operators noticing `audit_reconcile_ok` silence triggers "is the Grid running?"; operators noticing `health_status_changed: ok → degraded` triggers "what just degraded?". Different signals for different alarm types.

- **Cutover dance respects user's persistent operational rules** — per memory: "Always push to git after committing" + "Rebuild Grid Docker after every source change". Phase 32 32-HUMAN-UAT.md step 0 should explicitly mention `docker compose build grid && docker compose up -d grid` as the deploy step before any of the verification steps. Phase 31 31-HUMAN-UAT.md Step 6 already documents this — Phase 32 mirrors.

- **Cross-phase API stability** — Phase 34 (Steward UI) reads `launcher.healthWatchdog.snapshot()` payload AND `firehoseHub.stats()` shape via the `/health/detailed` endpoint. Both contracts are FROZEN at end of Phase 32 — changes after Phase 32 ship require coordinated migration of Steward consumers. Test files (`health-detailed-route.test.ts` shape assertions) are the active enforcement.

- **The "observer is the next silent failure" trap is actively guarded** — three layers: (1) `audit_reconcile_ok` heartbeat from Phase 31, (2) `health_status_changed` warn-logs from Phase 32, (3) CI gates blocking TODO/FIXME comments near observability keywords (D-32-D1). If a future regression silences any of the three, the others surface it.

</specifics>

<deferred>
## Deferred Ideas

### Carried into Phase 34 (Steward /system Health Surfaces)

- `use-health-detailed.ts` SWR-style polling hook for Steward `/system` (OBS-11/12)
- `EventsPerMinuteSparkline.tsx` REST-driven sparkline (OBS-13) — explicitly REST so it survives firehose failure
- `use-firehose-ws.ts` client-side watchdog forcing reconnect when `last_frame_at >60s AND client_count >0` (OBS-14)
- Reasons array surfacing in Steward UI — if Phase 34 wants WHY a status is degraded, expose `computeStatus().reasons` via an additional `/health/detailed` response field. NOT in Phase 32 scope per OBS-06 shape.

### Carried into Phase 35 (UAT + Doc Sync)

- 25a-HUMAN-UAT items #1 (firehose color rendering, live) and #5c re-verification to PASS — Phase 32 establishes the surfaces; Phase 35 closes the loop
- Atomic doc sync across MILESTONES, PROJECT, PHILOSOPHY, README, CLAUDE.md (OBS-15)

### Out of scope for v2.6 entirely (post-shipped to v2.7+ if warranted)

- `buffer_high_water_mark` per-client metric in `stats()` — diagnostic for slow consumers; revisit if Phase 34 Steward dashboards want it
- Construction-order race regression test (`firehose-subscribes-before-clock.test.ts`) — buildServerWithHub structure locks the order; regression would require touching `server.ts` and would be caught by typecheck/lint
- `GET /api/v1/health/diagnostics/self-test` synthetic-event end-to-end probe (OBS-FUTURE-DIAG-01) — v2.6 minimum is `/health/detailed` + Phase 34 client-watchdog combination
- OpenTelemetry self-hosted via `@fastify/otel` + OTLP collector (OBS-FUTURE-OTEL-01) — only if operators ask
- Prometheus / Datadog / Honeycomb / New Relic (sovereignty-incompatible, permanently rejected)
- Configurable thresholds via launcher config — D-32-C1 keeps them as frozen module consts; revisit only if a real operational need surfaces

### Scope-creep ideas redirected during discussion

- "Should we also add per-client send-error counter?" — Deferred. R-32-03 send-throws regression test covers the failure mode without adding payload surface area.
- "Should `/health/detailed` include a `reasons` array exposing WHY status is degraded?" — Deferred to Phase 34 if Steward UI needs it. OBS-06 shape is what's contracted now; expanding it later is non-breaking (additive key).

</deferred>

---

*Phase: 32-firehose-observability*
*Context gathered: 2026-05-24*
