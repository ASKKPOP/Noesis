# Phase 31: Audit Pipeline Persistence — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `31-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 31-audit-pipeline-persistence
**Areas discussed:** Chain injection mechanism, Pino logger architecture, Reconcile loop semantics, Backfill + restart cutover

---

## Gray Area Selection

Four areas were presented; user selected ALL four.

| Area | Description | Selected |
|------|-------------|----------|
| Chain injection mechanism | Constructor deps vs post-construction setter | ✓ |
| Pino logger architecture | Singleton vs per-module vs Fastify reuse | ✓ |
| Reconcile loop semantics | Threshold meaning, batch size, lifecycle | ✓ |
| Backfill + restart cutover | Scope, live-mode safety, sequence | ✓ |

---

## Area 1 — Chain Injection Mechanism

### Q1: How should PersistentAuditChain reach GenesisLauncher?

| Option | Description | Selected |
|--------|-------------|----------|
| Constructor deps (recommended) | `new GenesisLauncher(config, { audit?: AuditChain })`. Optional second arg, listeners bind to right chain from start, test-compatible. | ✓ |
| Static factory | `GenesisLauncher.create(config, opts)` async factory; existing constructor stays internal. | |
| Launcher owns DB | Pass `dbConn` into launcher; launcher internally chooses chain type. | |

**User's choice:** Constructor deps (recommended).
**Locked decision:** D-31-A1.
**Notes:** Departure from `attachRelationshipStorage` precedent (D-9-04) justified because audit-chain listeners bind synchronously in the constructor and cannot tolerate a post-construction chain swap without breaking zero-diff invariant.

---

## Area 2 — Pino Logger Architecture

### Q1: Pino logger pattern?

| Option | Description | Selected |
|--------|-------------|----------|
| Singleton in grid/src/util/logger.ts (recommended) | One exported `logger`, modules import + `.child({ module })` per file. | ✓ |
| Per-module instance | Each file creates its own pino instance, no shared util. | |
| Reuse Fastify request logger | Use `app.log` inside route handlers. Won't work for non-request scope (persistent-chain, audit-reconcile). | |

**User's choice:** Singleton in grid/src/util/logger.ts (recommended).
**Locked decision:** D-31-B1.
**Notes:** Convention spreads to future phases. Single configuration point for level/redact/transport.

### Q2: Pino dependency + transport config?

| Option | Description | Selected |
|--------|-------------|----------|
| Direct dep + stdout JSON + dev pretty (recommended) | Pin pino 10.x as direct dep, raw JSON to stdout, `pino-pretty` devDep activated via NOESIS_LOG_PRETTY=1. | ✓ |
| Direct dep + stdout JSON only | Same but no pretty mode — operator pipes externally if needed. | |
| Keep as transitive dep | Don't add to package.json; risk: Fastify could bump pino silently. | |

**User's choice:** Direct dep + stdout JSON + dev pretty (recommended).
**Locked decision:** D-31-B2.
**Notes:** Production log shape is now under explicit version control. `pino-pretty` is dev-only ergonomics.

---

## Area 3 — Reconcile Loop Semantics

### Q1: What does divergence > 10 actually trigger?

| Option | Description | Selected |
|--------|-------------|----------|
| Pure alert signal (recommended) | Reconcile ALWAYS replays; threshold only changes log level + Phase 32 `/health/detailed` status. | ✓ |
| Retry throttle | Below threshold = heartbeat only; above = actually replay. Saves SQL but lets small divergence persist. | |

**User's choice:** Pure alert signal (recommended).
**Locked decision:** D-31-C1.
**Notes:** Simpler invariant — every cycle reconciles. Threshold is for human attention, not for code branching.

### Q2: Batch size cap on replay?

| Option | Description | Selected |
|--------|-------------|----------|
| Cap at 500 entries per cycle (recommended) | Replay oldest 500 missing per cycle; rest catch up next cycle. Protects MySQL from 10k-entry bursts. | ✓ |
| Replay all missing | No cap. After 6-hour outage, single cycle replays everything. | |

**User's choice:** Cap at 500 entries per cycle (recommended).
**Locked decision:** D-31-C2.
**Notes:** Heartbeat log includes `{replayed, remaining}` so operators see catch-up progress.

### Q3: How does Phase 32 HealthWatchdog read lastReconcileAt?

| Option | Description | Selected |
|--------|-------------|----------|
| AuditReconcile exposes readonly getter (recommended) | Class with readonly getters; held on launcher as readonly field; Phase 32 reads `launcher.auditReconcile.lastReconcileAt`. | ✓ |
| Shared diagnostics state object | Both components mutate shared `DiagnosticsState` blob. More flexible, more shared mutable state. | |

**User's choice:** AuditReconcile exposes readonly getter (recommended).
**Locked decision:** D-31-C3.
**Notes:** Clean ownership boundary. Phase 32 is a pure reader.

---

## Area 4 — Backfill + Restart Cutover

### Q1: Backfill script scope?

| Option | Description | Selected |
|--------|-------------|----------|
| General-purpose with required flags (recommended) | `--grid`, `--rest-url`, `--since`, `--limit`, `--dry-run` flags. Reusable for future stalls. 2026-05-22 documented as one-shot UAT step. | ✓ |
| Hard-coded for 2026-05-22 only | Single-shot script with stall window baked in. Discarded after recovery. | |

**User's choice:** General-purpose with required flags (recommended).
**Locked decision:** D-31-D1.

### Q2: Run against a live Grid or only after stop?

| Option | Description | Selected |
|--------|-------------|----------|
| Live-Grid-safe via REST (recommended) | Reads via REST + writes via direct mysql2 INSERT IGNORE. Operator runs BEFORE cutover to save at-risk entries. | ✓ |
| Post-stop only (snapshot-based) | Requires graceful stop first. Safer (no race) but loses in-memory entries because graceful-stop snapshot doesn't include them. | |

**User's choice:** Live-Grid-safe via REST (recommended).
**Locked decision:** D-31-D2.
**Notes:** This is the critical capability that enables zero-data-loss cutover.

### Q3: Cutover sequence documented in 31-HUMAN-UAT.md?

| Option | Description | Selected |
|--------|-------------|----------|
| Backfill-first, then deploy (recommended) | Live backfill → verify divergence=0 → graceful stop OLD → deploy NEW → start NEW → confirm reconcile_ok heartbeat. Zero data loss. | ✓ |
| Deploy-first, accept tail loss | Stop OLD (lose 237+ entries), deploy NEW, start NEW. Faster but violates first-life retention. | |

**User's choice:** Backfill-first, then deploy (recommended).
**Locked decision:** D-31-D3.
**Notes:** PHILOSOPHY §1 first-life promise is load-bearing — "deploy-first" was rejected on that basis.

---

## Claude's Discretion

Areas where the user did not explicitly decide and downstream agents have flexibility:

- Exact Pino redact key list (defaults + proactive `password`, `password_hash`, `signature`, `nonce`, `cookie`, `jwt`)
- `scripts/check-no-silent-catch.mjs` regex precision and test fixture coverage
- Pagination strategy for backfill script (page size 100, cursor or offset)
- Migration of pre-existing `console.*` calls in `grid/src/db/` + `grid/src/audit/` beyond the CI-gated `.catch+console.warn` pattern
- Test depth in `audit-persistence-wiring.test.ts` + new `audit-reconcile.test.ts`

## Deferred Ideas

Mentioned during discussion and noted for future phases:

- `/health/diagnostics/self-test` synthetic round-trip endpoint → OBS-FUTURE-DIAG-01 (v2.7+)
- Extending `check-no-silent-catch` to `grid/src/api/` and `brain/` → out of scope for Phase 31 (separate cleanup phase if warranted)
- `ua_hash` / `ip_country` for `portal.auth.*` → OBS-FUTURE-METRICS-01 (v2.7+)
- OpenTelemetry, Prometheus, Datadog/Honeycomb/New Relic → permanently rejected (sovereignty)
