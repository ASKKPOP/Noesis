# Phase 31: Audit Pipeline Persistence — Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `PersistentAuditChain` into the production boot path so every in-memory audit entry is mirrored to MySQL `audit_trail` within seconds of commit. Add a tick-cadenced reconcile loop as belt-and-suspenders. Replace every silent `.catch(err => console.warn(...))` in `grid/src/db/` and `grid/src/audit/` with Pino structured logging. Ship a one-shot backfill script for the 2026-05-22 → present stall window.

**Closes:** GAP-2026-05-24-A (audit pipeline silence since 2026-05-22T06:57Z).

**Does NOT touch:** firehose frame counters (Phase 32), `/health/detailed` endpoint (Phase 32), `portal.auth.*` producers (Phase 33), Steward `/system` UI cards (Phase 34), allowlist (stays at 53), audit chain hash invariant, listener fan-out order.

**Foundational dependency:** Phases 32-34 all depend on the chain actually persisting; Phase 33's new producers would be in-memory-only without this.

</domain>

<decisions>
## Implementation Decisions

### Chain Injection (Area 1)

- **D-31-A1:** `GenesisLauncher` constructor gains optional second arg: `new GenesisLauncher(config, deps?)` where `deps` is `{ audit?: AuditChain }`. When `deps.audit` is provided, it replaces the default `new AuditChain()` at `launcher.ts:138`. `main.ts:69-81` constructs the chain BEFORE the launcher when `dbConn` is present:

  ```typescript
  const chain = dbConn
      ? new PersistentAuditChain(new AuditStore(dbConn), config.genesisConfig.gridName)
      : undefined;
  const launcher = new GenesisLauncher(config.genesisConfig, chain ? { audit: chain } : undefined);
  ```

  **Why this and not post-construction setter (`attachAuditChain` pattern, mirroring D-9-04 `attachRelationshipStorage`):** Every listener constructed inside `GenesisLauncher.constructor` binds to `this.audit` synchronously — `DialogueAggregator(this.audit, ...)`, `RelationshipListener(this.audit, ...)`, `NormDetector(this.audit, ...)`, `GovernanceEngine(this.audit, ...)` — plus `Reviewer(launcher.audit, ...)` in `main.ts:109` and `WsFirehoseHub` later. A post-construction setter would leave all those listeners bound to the OLD plain `AuditChain` while the swapped-in `PersistentAuditChain` runs in parallel → broken zero-diff invariant.

  **Backwards-compat:** `deps` is optional; the >40 existing tests that call `new GenesisLauncher(config)` keep working unchanged. The default branch `this.audit = deps?.audit ?? new AuditChain()` preserves the plain-chain code path for unit tests with no DB.

### Pino Logger (Area 2)

- **D-31-B1:** Singleton logger at `grid/src/util/logger.ts` exports a single `logger` instance. Modules import `{ logger } from '../util/logger.js'` and scope per-file via `.child({ module: 'persistent-chain' })`. One configuration point for level/redact/transport — this is the convention every future Phase will reuse.

- **D-31-B2:** Promote `pino` from transitive (via Fastify) to **direct dependency** in `grid/package.json` pinned at `10.x`. Production: raw JSON to stdout (Docker captures, operator pipes to whatever sink). Dev: `pino-pretty` as `devDependency` activated only when env `NOESIS_LOG_PRETTY=1`. Default log level `info`. No `pino-mysql` transport (single-point-of-failure if MySQL is the same connection `audit_trail` uses).

- **D-31-B3** (derived from B1+B2): Replace the `console.warn` at `persistent-chain.ts:35-38` with:

  ```typescript
  logger.warn({
      event: 'audit_persist_failed',
      entry_id: entry.id,
      event_type: eventType,
      error_message: err instanceof Error ? err.message : String(err),
      error_code: (err as { code?: string })?.code,
  }, 'failed to persist audit entry');
  ```

  Same shape required for every persist-failure path. CI gate `scripts/check-no-silent-catch.mjs` enforces no `.catch(.*console\.(warn|log|debug))` pattern in `grid/src/db/` or `grid/src/audit/`.

### Reconcile Loop (Area 3)

- **D-31-C1:** `AuditReconcile` ALWAYS replays missing tail entries via `INSERT IGNORE` on every cadence tick. The `divergence > 10` threshold is **alert-signal-only** — it changes log level from `info` to `warn` and (in Phase 32) flips `/health/detailed` `status` to `'degraded'`. The threshold does NOT gate the work. Simpler invariant: every cycle reconciles.

- **D-31-C2:** Replay batch is capped at **500 entries per cycle**. If divergence > 500, the oldest 500 missing entries replay this cycle and the rest catch up on subsequent cycles. Protects MySQL from a 10k-entry burst after a long outage. `INSERT IGNORE` keeps it safe regardless. Heartbeat log includes `{event: 'audit_reconcile_ok', divergence, replayed, remaining}` so silence vs success is unambiguous.

- **D-31-C3:** `class AuditReconcile` exposes readonly getters: `get lastReconcileAt(): number`, `get persistedMaxId(): number | null`, `get lastPersistError(): { code: string; at: number } | null`. `GenesisLauncher` holds the instance as a `readonly auditReconcile` field. Wired via `launcher.clock.onTick(t => { if (t % 60 === 0) auditReconcile.run() })`. Phase 32's `HealthWatchdog` and `/health/detailed` read directly from `launcher.auditReconcile.*` — clean ownership, no shared mutable state object.

- **D-31-C4** (derived): Cadence is **tick-based (every 60 ticks ≈ 30s at default rate)**, NOT wall-clock interval — matches the WorldClock domain. If the clock is paused, the reconcile loop pauses with it. Defensible because no NEW entries are appended while clock is paused either.

### Backfill Script (Area 4)

- **D-31-D1:** General-purpose script at `scripts/backfill-audit-trail.mjs` with required flags:

  ```
  node scripts/backfill-audit-trail.mjs \
    --grid <gridName> \
    --rest-url <http://host:port> \
    [--since <ISO8601>] \
    [--limit <N>] \
    [--dry-run]
  ```

  Reads `GET /api/v1/audit/trail?limit=N` (paginated), writes via direct mysql2 connection with `INSERT IGNORE` (idempotent). Reusable for any future stall recovery. The 2026-05-22 invocation is documented as a one-shot UAT step in `31-HUMAN-UAT.md`.

- **D-31-D2:** Script is **Live-Grid-safe** — runs against a running Grid via REST + writes idempotently to MySQL. No file/snapshot dependency. This is the critical capability that lets the operator save the 237+ at-risk entries BEFORE the cutover restart.

- **D-31-D3:** Cutover sequence documented in `31-HUMAN-UAT.md`:

  1. Leave OLD Grid (plain `AuditChain`) running
  2. Run `node scripts/backfill-audit-trail.mjs --grid genesis --rest-url http://localhost:8080 --dry-run` to confirm divergence
  3. Re-run without `--dry-run` to backfill
  4. Verify `SELECT COUNT(*) FROM audit_trail WHERE grid_name='genesis'` matches in-memory chain length
  5. Graceful-stop OLD Grid (`docker compose stop grid`)
  6. Deploy NEW Grid (with `PersistentAuditChain` wired)
  7. Start NEW Grid (`docker compose up -d grid`)
  8. Tail logs for 60s, confirm `{event: 'audit_reconcile_ok', divergence: 0}` heartbeat
  9. Smoke-test: `GET /api/v1/audit/trail?limit=5` returns recent entries; `SELECT MAX(id) FROM audit_trail WHERE grid_name='genesis'` is monotonic over a 2-minute window

  **Zero data loss.** Backfill-first means the OLD process never dies while still holding unpersisted entries.

### Claude's Discretion

- **Exact Pino redact keys** — beyond stdlib defaults, add `password`, `password_hash`, `signature`, `nonce`, `cookie`, `jwt` proactively (mirrors `PORTAL_AUTH_FORBIDDEN_KEYS` planned for Phase 33)
- **Pino base config keys** — whether to include `pid`, `hostname` (yes, useful in Docker); `time` format (epoch ms is fine)
- **`scripts/check-no-silent-catch.mjs` regex precision** — handle `.catch((err) => console.warn(...))`, `.catch(e => console.log(...))`, arrow w/o parens, multiline. Test fixtures with positive + negative cases
- **AuditReconcile internal state shape** — class with private mutable fields exposed via getters is fine
- **Backfill script pagination strategy** — page size 100, follow `?after=<id>` cursor if it exists, otherwise `?limit=N&offset=...`
- **Exact ESM vs CJS for `.mjs` scripts** — top-level await fine, `import` from grid types where useful
- **Migration of existing `console.*` calls in `grid/src/db/` + `grid/src/audit/`** — replace all (not just `console.warn` in `.catch`), even if they're not silent-catch patterns, so the codebase has one logger story. The CI gate only enforces the `.catch+console.*` pattern; the cleanup is opportunistic but should ship in this phase.
- **`audit-persistence-wiring.test.ts` depth** — at minimum: (a) launcher.audit is `PersistentAuditChain` when db configured, (b) launcher.audit is plain `AuditChain` when db absent, (c) chain head hash identical with/without DB attached after N appends (zero-diff regression). Add `audit-reconcile.test.ts` covering: (d) replay-batch cap, (e) divergence > threshold logs at warn level, (f) INSERT IGNORE idempotency. Skip integration tests requiring real MySQL — those are HUMAN-UAT territory.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning or implementing.**

### v2.6 Source-of-Truth

- `.planning/REQUIREMENTS.md` §"OBS — Audit Pipeline Persistence (Phase 31)" — OBS-01..04 lock file paths, payload shapes, CI gates, success criteria
- `.planning/ROADMAP.md` §"Phase 31: Audit Pipeline Persistence" — goal, dependencies, success criteria, risks R-31-01..03, allowlist delta 0
- `.planning/STATE.md` §"v2.6 Key Decisions (locked 2026-05-24)" — observability stack (Pino + in-process counters), audit persistence pattern, failure logging policy
- `.planning/research/v2.6/OBSERVABILITY-HARDENING.md` — HIGH-confidence root cause analysis; ranked hypotheses; recommended fix sketch; pitfalls 1-8; library recommendations (Pino 10.x ✓, Prometheus/Datadog/winston ✗)

### Project-Wide Invariants

- `PHILOSOPHY.md` §1 (sovereignty + first-life promise — audit entries retained forever); §7 (broadcast allowlist frozen-except-by-explicit-addition); §8 (zero custody)
- `CLAUDE.md` §"Documentation Sync Rule (user-mandated, 2026-04-20)" — Phase 35 will sync, but Phase 31 still touches `.planning/PROJECT.md` if any invariant changes
- `.planning/MILESTONES.md` — v2.5 close summary; Phase 31 will be logged here at v2.6 close

### Code Anchors (existing — Phase 31 modifies or aligns with)

- `grid/src/genesis/launcher.ts:128-178` — `GenesisLauncher.constructor`. **Modify line 138** to use `deps?.audit ?? new AuditChain()`. Lines 147, 154, 168, 177 are the listener constructions that bind to `this.audit` — they stay where they are, just bind to the right chain now
- `grid/src/db/persistent-chain.ts` — `PersistentAuditChain` exists but unused in production. Replace `console.warn` at line 35-38 with `logger.warn({ event: 'audit_persist_failed', ... })`. Expose `lastPersistError` getter so Phase 32 can surface it
- `grid/src/main.ts:69-100` — `createGridApp`. Construct `PersistentAuditChain` here (when `dbConn` is present) BEFORE constructing `GenesisLauncher`. Pass via `deps` arg
- `grid/src/db/stores/audit-store.ts` — `AuditStore` (the `IAuditStore` impl). Already idempotent via `INSERT IGNORE`. Used by reconcile loop's replay path
- `grid/src/audit/chain.ts` — base `AuditChain` class. `super.append()` fan-out order is the zero-diff invariant; DO NOT touch
- `grid/src/db/grid-store.ts` — existing `snapshotGrid()` path (the ONLY current MySQL write path). Keep it for first-boot + graceful-stop snapshots; Phase 31 makes it no longer the sole flush path
- `grid/src/api/portal/auth.ts:125-265` — Phase 33 wires producers here. Phase 31 makes sure those events will persist when they land
- `grid/src/audit/firehose-hub.ts` — Phase 32 adds frame counters here. Phase 31 doesn't touch but should be aware: firehose hub binds to `audit.onAppend` and MUST see appends from `PersistentAuditChain` (the chain we inject IS what `services.audit` references later in `buildServerWithHub`)

### Prior Phase Patterns Cited

- `.planning/phases/09-relationship-graph-derived-view/09-CONTEXT.md` D-9-04 — `attachRelationshipStorage(pool)` post-construction setter precedent (what we DEPART from for chain injection because of listener-binding constraint)
- `.planning/phases/14-researcher-rigs/14-CONTEXT.md` D-14-06 — fixture-mode env-var refusal pattern (analogous gate philosophy; Phase 31's `NOESIS_LOG_PRETTY` is much smaller scope)
- `.planning/phases/archived/v2.1/05-reviewernous-objective-only-pre-commit-review/05-CONTEXT.md` — singleton pattern (Reviewer); Phase 31's `logger` is the same shape

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`PersistentAuditChain` class** (`grid/src/db/persistent-chain.ts`) — already correct shape. `super.append()` → in-memory commit + listener fan-out (synchronous), then fire-and-forget `this.store.append(...).catch(...)`. Phase 31 changes the `.catch(console.warn(...))` line and wires it into production. No semantic change needed.
- **`AuditStore.append()`** (`grid/src/db/stores/audit-store.ts`) — already `INSERT IGNORE`, idempotent. Reconcile loop calls this directly for replay.
- **`MigrationRunner`** (`grid/src/db/migration-runner.ts`) — used in `main.ts:78-79`. No new migrations needed for Phase 31; `audit_trail` schema already exists.
- **`WorldClock.onTick(cb)`** — reconcile loop hook. Already in use by snapshot scheduling, RelationshipListener, etc.
- **`GenesisLauncherDeps` shape** — does NOT exist yet. Phase 31 introduces it. Future phases (32+) can extend the same `deps` arg for other injections (e.g., `{ audit?, logger? }`).

### Established Patterns

- **Post-construction setter precedent** (`attachRelationshipStorage`): used for DB-bound services whose listeners can attach AFTER launcher construction. Phase 31 DEPARTS from this because the audit chain's listeners bind synchronously in the constructor. Pattern stays valid for future Phase 32+ HealthWatchdog wiring.
- **Singleton pattern** (`Reviewer` from Phase 5, `LoreQuotaTracker` from Phase 20): one instance per launcher, held as readonly field. Phase 31's `AuditReconcile` follows the same shape.
- **Sole-producer + closed-tuple audit events**: Phase 31 adds NO new events. The pattern is referenced only because the structured-logging events (`audit_persist_failed`, `audit_reconcile_ok`) follow analogous discipline — closed key sets, log-level appropriate, no PII.
- **Listener fan-out order in `AuditChain`** (`chain.ts:51-58`): listeners fire inline AFTER the entry is committed to the in-memory array. `PersistentAuditChain.append()` calls `super.append()` first so listeners see consistent in-memory state. **DO NOT change this order.**

### Integration Points

- `main.ts:69-81` — primary entry point. Construct chain → pass to launcher → construct reconcile loop → wire to clock.
- `launcher.ts:138` — single-line change inside constructor.
- `launcher.ts` clock.onTick wire-up (existing pattern in `bootstrap()`) — add reconcile cadence wire here.
- `package.json` (grid workspace) — add `pino` and `pino-pretty` (the latter as devDependency).
- `scripts/` directory — new files `backfill-audit-trail.mjs` and `check-no-silent-catch.mjs`. Existing scripts follow ESM `.mjs` convention.
- CI workflow (`.github/workflows/ci.yml` or equivalent) — `check-no-silent-catch.mjs` joins existing structural gates (e.g., `check-state-doc-sync.mjs`, `check-sole-producer-discipline.mjs`).

### Files NOT to Touch in Phase 31

- `grid/src/audit/chain.ts` — base `AuditChain.append` and listener fan-out order (zero-diff invariant since `29c3516`)
- `grid/src/audit/broadcast-allowlist.ts` — Phase 31 adds zero events; allowlist stays at 53
- `grid/src/audit/firehose-hub.ts` — Phase 32 territory
- `grid/src/api/routes/health.ts` (the basic `/health`) — Phase 32 adds `/health/detailed` as a separate route
- `grid/src/api/portal/auth.ts` — Phase 33 wires producers here

</code_context>

<specifics>
## Specific Ideas

- **Structured log convention named "Pino + flat keys + closed-shape events"** — every `logger.warn/info/error` call passes an object with a top-level `event` key (closed enum: `'audit_persist_failed'`, `'audit_reconcile_ok'`, `'audit_reconcile_replay'`, plus future Phase 32 `'firehose_frame_dropped'`, etc.). This makes `grep "event\":\"audit_reconcile_ok"` work on Docker logs without parsing free-text messages.

- **Heartbeat semantics:** silence in the `audit_reconcile_ok` stream is itself a signal. Operators tail logs with `docker compose logs grid -f | grep -E "(audit_reconcile|audit_persist)"` and expect a line every ~30s. If they STOP, that's the alarm.

- **Cutover dance respects user's "Always push to git after committing" rule and "Rebuild Grid Docker after every source change" rule from memory.** UAT-doc cutover sequence should explicitly mention `docker compose build grid && docker compose up -d grid` as the deploy step in Step 6.

- **The 237+ at-risk in-memory entries are NOT optional to recover** — PHILOSOPHY §1 first-life promise (audit entries retained forever) makes this load-bearing. The "deploy-first, accept tail loss" alternative was REJECTED.

</specifics>

<deferred>
## Deferred Ideas

### Carried into Phase 32 (Firehose Observability)

- Frame counters (`frames_sent_total`, `frames_dropped_total`, `last_frame_at`) on `WsFirehoseHub.stats()` — OBS-05
- `/health/detailed` endpoint surfacing `audit` + `firehose` + `clock` blocks — OBS-06
- `HealthWatchdog` class wired into launcher tracking `lastReconcileAt` staleness — OBS-07
- Phase 32 will READ from `launcher.auditReconcile.lastReconcileAt` (the readonly getter Phase 31 ships)

### Carried into Phase 33 (portal.auth.* Producers)

- `PORTAL_AUTH_FORBIDDEN_KEYS` set + `FORBIDDEN_KEY_PATTERN` extension — OBS-10
- `appendPortalAuthLogin` / `appendPortalAuthRegister` sole-producer files — OBS-08/09
- Allowlist 53 → 55 (positions 54, 55) — Phase 33 only

### Carried into Phase 34 (Steward `/system` Health Surfaces)

- Audit Pipeline Health card / Firehose Diagnostics card / Events per Minute sparkline / `use-firehose-ws.ts` watchdog — OBS-11/12/13/14

### Carried into Phase 35 (UAT + Doc Sync)

- Atomic doc sync across MILESTONES, PROJECT, PHILOSOPHY, README, CLAUDE.md — OBS-15
- Re-run 25a-HUMAN-UAT items #1 and #5c

### Out of scope for v2.6 entirely (post-shipped to v2.7+ if warranted)

- `ua_hash` / `ip_country` payload extensions for `portal.auth.*` (OBS-FUTURE-METRICS-01)
- OpenTelemetry self-hosted via `@fastify/otel` + OTLP collector (OBS-FUTURE-OTEL-01)
- In-memory index-by-event-type map inside `AuditChain` if `audit.query()` p95 exceeds 50ms (OBS-FUTURE-INDEX-01)
- `GET /api/v1/health/diagnostics/self-test` synthetic-event end-to-end probe (OBS-FUTURE-DIAG-01)
- Prometheus / Datadog / Honeycomb / New Relic (sovereignty-incompatible, permanently rejected)
- `pino-mysql` transport (single-point-of-failure)
- `winston` / `bunyan` (no reason; Pino already in tree via Fastify)

### Scope-creep ideas that came up and were redirected

- "Should we add a `/health/diagnostics/self-test` endpoint that synthetically posts an event and verifies round-trip?" — Deferred to OBS-FUTURE-DIAG-01. v2.6 minimum is `/health/detailed` (Phase 32) + client watchdog (Phase 34).
- "Should we extend `check-no-silent-catch` to `grid/src/api/` and `brain/`?" — Out of scope for Phase 31. The REQ scope is `grid/src/db/` + `grid/src/audit/`. Broader rollout is a separate cleanup phase if warranted.

</deferred>

---

*Phase: 31-audit-pipeline-persistence*
*Context gathered: 2026-05-23*
