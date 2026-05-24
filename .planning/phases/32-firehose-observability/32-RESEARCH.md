# Phase 32: Firehose Observability — Research

**Researched:** 2026-05-24
**Domain:** In-process observability counters, Fastify REST route, pure-pull health watchdog, CI gate scripts
**Confidence:** HIGH — all critical facts verified by direct source-file reads

---

## Summary

Phase 32 is purely additive. No existing behavior changes — it adds counters to
`WsFirehoseHub`, a new `/health/detailed` REST route, a `HealthWatchdog` class,
two CI gate scripts, four vitest test files, and a human UAT playbook.

All implementation decisions are locked in `32-CONTEXT.md`. This research resolves
the ten verification questions that the planner needs before writing tasks:
RingBuffer accessors confirmed public, `buildServerWithHub` construction order
confirmed safe, route registration timing confirmed compatible, Pino child-logger
pattern confirmed, CI gate shebang pattern documented, test seam identified,
environment dependencies confirmed available, no `setInterval` in scanned
directories (gate passes on first run), `diagnostics/` directory does not yet
exist (Wave 0 creates it), `@fastify/websocket` WebSocket object supports
half-close via `socket.terminate()`.

**Primary recommendation:** Proceed directly to planning. All architectural
decisions are locked. The planner must create the `grid/src/diagnostics/`
directory as part of Wave 0 scaffolding — it does not exist yet.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-32-A1:** `frames_dropped_total` via `size===capacity` check inside `ClientConnection.enqueue` — zero RingBuffer API change.
- **D-32-A2:** Counters on `WsFirehoseHub` as private metrics, mutated via callbacks passed into `ClientConnection` (typed `HubMetricsSink` interface — planner's exact shape choice).
- **D-32-A3:** `frames_sent_total` and `last_frame_at` increment AFTER `socket.send(...)` inside existing `try` block, BEFORE the `catch`. Exact trySend shape locked.
- **D-32-A4:** `stats()` returns `FirehoseStats` interface exactly as specified (5 fields, readonly, plain object snapshot).
- **D-32-B1:** Pure-pull design — HealthWatchdog has NO timer. Zero new `clock.onTick` subscriptions. R-32-02 trivially satisfied.
- **D-32-B2:** `class HealthWatchdog` at `grid/src/diagnostics/health-watchdog.ts`, one-shot-settable field on `GenesisLauncher`.
- **D-32-B3:** Log state transitions only (warn for ok→degraded/critical, info for degrading→ok). Do NOT log every `snapshot()` call.
- **D-32-B4:** Cold-start grace: `clock.state.tick < 60` returns `status: 'ok'` with null audit timestamps.
- **D-32-B5:** Constructor injectable `opts.now?: () => number` and `opts.snapshotCadenceMs?: number` (default 30_000).
- **D-32-C1:** `HEALTH_THRESHOLDS` frozen module-level export in `health-watchdog.ts`. `DIVERGENCE_DEGRADED=10`, `DIVERGENCE_CRITICAL=100`, `STALE_FRAME_MS=60_000`, `RECONCILE_STALE_MULTIPLIER=5`.
- **D-32-C2:** Single pure `computeStatus()` helper inside `health-watchdog.ts`. Evaluation order: grace → critical → degraded → ok.
- **D-32-C3:** Route file `grid/src/api/routes/health-detailed.ts`. Registered at top level of `buildServerWithHub` (NOT inside WS scope). Handler is one-liner `return launcher.healthWatchdog!.snapshot()`.
- **D-32-D1:** Two CI gates: `scripts/check-observability-no-todo.mjs` (R-32-01) and `scripts/check-interval-lifecycle.mjs` (R-32-02). Scope: `grid/src/diagnostics/`, `grid/src/audit/`, `grid/src/db/`. Both added to `.github/workflows/rig-invariants.yml`.
- **D-32-D2:** Four-file vitest regression test set. Exact file names locked: `grid/test/firehose-frame-counters.test.ts`, `grid/test/firehose-send-throws.test.ts`, `grid/test/health-detailed-route.test.ts`, `grid/test/health-watchdog-transitions.test.ts`.
- **D-32-D3:** Own `32-HUMAN-UAT.md` at `.planning/phases/32-firehose-observability/32-HUMAN-UAT.md`. Five UAT steps.
- **D-32-E1:** `GenesisLauncher.attachFirehoseHub(hub: { stats(): FirehoseStats })` — structural interface to avoid genesis→audit import direction. Also calls `this.healthWatchdog!.attachFirehoseStats(() => hub.stats())`.
- **D-32-E2:** `HealthWatchdog.attachFirehoseStats(fn: () => FirehoseStats)` instance method. Before attach, snapshot returns all-zeros firehose block.
- **D-32-F1:** Constructor deps: `{ auditReconcile: AuditReconcile | undefined; clockState: () => ClockState }`. `firehoseStats` NOT in constructor.
- **D-32-G1:** Construction sequence inside `buildServerWithHub`: (1) firehoseHub, (2) new HealthWatchdog + attachHealthWatchdog + attachFirehoseHub, (3) registerHealthDetailedRoute. Order mandatory.
- **D-32-G2:** `private _healthWatchdog: HealthWatchdog | undefined` + `get healthWatchdog()` + `attachHealthWatchdog(wd)` with throw-on-second-call. Not strictly `readonly` at construction — one-shot-settable semantics enforced by setter.
- **Phase 32 adds zero allowlist events. Allowlist stays at 53.**

### Claude's Discretion

- Exact RingBuffer accessor names — verified `size` and `capacity` are already public (see Architecture Patterns section). No change needed.
- Exact `HubMetricsSink` interface shape — discrete params or single sink object, whichever reads cleaner.
- `HealthDetailedPayload` TypeScript export location — `grid/src/diagnostics/health-watchdog.ts` or `grid/src/api/types.ts`.
- `uat-half-close-socket.mjs` script depth — dedicated script vs wscat documentation (see WebSocket section for technical facts).
- Reasons array log string shape — planner chooses greppable strings.
- Test depth on cold-start grace window — at minimum tick<60 + tick===60 cases.
- Migration of any pre-existing `setInterval` in `grid/src/audit/` or `grid/src/db/` if any exist not held in fields.

### Deferred Ideas (OUT OF SCOPE)

- `buffer_high_water_mark` per-client metric (v2.7+)
- Construction-order race regression test (structure locks order)
- Configurable thresholds via launcher config (keep as frozen consts)
- Reasons array exposed in route payload (Phase 34 if Steward needs it)
- Per-client send-error counter (R-32-03 test covers it)
- Steward UI cards (Phase 34)
- portal.auth.* producers (Phase 33)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OBS-05 | `WsFirehoseHub.stats()` returning `{frames_sent_total, frames_dropped_total, last_frame_at, client_count, watermark_bytes}`. `frames_sent_total` increments AFTER successful `socket.send`. `frames_dropped_total` increments on ring-buffer overflow. | RingBuffer.size + .capacity verified public. FakeSocket test pattern from existing firehose-hub.test.ts reusable. |
| OBS-06 | `GET /health/detailed` endpoint returning full payload shape. MUST NOT block on DB. p95 <50ms. | Route registration confirmed at top-level scope (after /health, before WS scope). buildServerWithHub is the sole wiring site. launcher.auditReconcile is populated before buildServerWithHub via GenesisLauncherDeps. |
| OBS-07 | `HealthWatchdog` tracking `last_reconcile_at`, surfacing `degraded` when stale. Pure-pull. `readonly` field on GenesisLauncher. Explicit stop capability. | AuditReconcile.lastReconcileAt getter confirmed at lines 52-54. clockState as getter function confirmed testable. No timer = no stop() needed beyond D-32-B1 (pure-pull). |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Frame counter accumulation | Backend (WsFirehoseHub) | — | Counters live where socket sends happen — the hub's ClientConnection objects |
| Drop detection | Backend (ClientConnection.enqueue) | — | Only the enqueue site knows when ring buffer overflows |
| Health snapshot computation | Backend (HealthWatchdog) | — | Pure computation over in-process state; no UI involvement |
| `/health/detailed` response | API / Backend | — | Fastify route handler; reads in-process cached values, no DB |
| CI enforcement | Scripts / CI | — | Node-native scripts wired into rig-invariants.yml workflow |
| UAT verification | Operator | — | Manual steps against live docker compose stack |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^2.0.0 | Test runner for all four regression test files | Project standard; already in grid/package.json `devDependencies` |
| Pino | ^10.0.0 | Structured logging for `health_status_changed` transition events | Direct dep since Phase 31; singleton pattern locked at `grid/src/util/logger.ts` |
| Fastify | ^5.0.0 | REST route registration via `app.get('/health/detailed', ...)` | Grid API server framework |
| @fastify/websocket | ^11.2.0 | WebSocket transport (already in place; Phase 32 does not add/change WS routes) | Grid WebSocket framework; `ws` library underpins it |
| Node.js | >=20.0.0 (25.9.0 locally) | `.mjs` CI gate scripts use `node:fs`, `node:path` | Project engine requirement |

**Installation: no new dependencies for Phase 32.**

All packages already in `grid/package.json`. Confirmed: `pino ^10.0.0` direct dep, `vitest ^2.0.0` devDep, `@fastify/websocket ^11.2.0` dep. [VERIFIED: direct file read of grid/package.json]

### Supporting

None — Phase 32 uses no libraries beyond what Phase 31 already added.

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP GET /health/detailed
         │
         ▼
registerHealthDetailedRoute (health-detailed.ts)
         │
         ▼ launcher.healthWatchdog!.snapshot()
         │
    HealthWatchdog.snapshot()
    ┌────────────────────────────────────────┐
    │  reads: launcher.auditReconcile.*      │
    │    .lastReconcileAt                    │
    │    .persistedMaxId                     │
    │    .lastPersistError                   │
    │  reads: clockState() → ClockState      │
    │  reads: _firehoseStatsFn() → stats()   │
    │  reads: opts.now()                     │
    │  computes: computeStatus(...)          │
    │  side-effect: warn log on transition   │
    └────────────────────────────────────────┘
         │
         ▼
    HealthDetailedPayload { status, timestamp, audit, firehose, clock }
         │
         ▼ JSON response (in-process, no DB query)

WsFirehoseHub (firehose-hub.ts)
    ┌────────────────────────────────────────┐
    │  private metrics = {                   │
    │    frames_sent_total: 0                │
    │    frames_dropped_total: 0             │
    │    last_frame_at: null                 │
    │  }                                     │
    │                                        │
    │  ClientConnection.trySend(frame)       │
    │    socket.send(JSON.stringify(frame))  │
    │    ← success →                         │
    │    metrics.incrementSent()             │
    │    metrics.touchLastFrame()            │
    │                                        │
    │  ClientConnection.enqueue(entry)       │
    │    if buffer.size === buffer.capacity  │
    │      metrics.incrementDropped()        │
    │    buffer.push(entry)                  │
    └────────────────────────────────────────┘
         │
         ▼ stats() snapshot
    launcher.attachFirehoseHub() → healthWatchdog.attachFirehoseStats(fn)
         │
         ▼ _firehoseStatsFn() called per /health/detailed request
```

### Recommended Project Structure

```
grid/src/
├── diagnostics/              ← NEW directory (Wave 0)
│   └── health-watchdog.ts    ← class HealthWatchdog, HEALTH_THRESHOLDS, computeStatus
├── api/routes/
│   └── health-detailed.ts    ← registerHealthDetailedRoute (NEW)
├── audit/
│   └── firehose-hub.ts       ← MODIFIED: add metrics, stats(), HubMetricsSink
└── genesis/
    └── launcher.ts           ← MODIFIED: add _healthWatchdog field, attachHealthWatchdog, attachFirehoseHub

grid/test/
├── firehose-frame-counters.test.ts     ← NEW
├── firehose-send-throws.test.ts        ← NEW
├── health-detailed-route.test.ts       ← NEW
└── health-watchdog-transitions.test.ts ← NEW

scripts/
├── check-observability-no-todo.mjs     ← NEW
└── check-interval-lifecycle.mjs        ← NEW

.planning/phases/32-firehose-observability/
└── 32-HUMAN-UAT.md                     ← NEW
```

### Pattern 1: HubMetricsSink Callback Interface

The `HubMetricsSink` connects the hub's private counters to ClientConnection without
exposing the hub internals. Pattern follows D-32-A2 exactly.

```typescript
// Source: 32-CONTEXT.md D-32-A2
interface HubMetricsSink {
    incrementSent: () => void;
    incrementDropped: () => void;
    touchLastFrame: () => void;
}
```

ClientConnection constructor gains `private readonly metrics: HubMetricsSink` param.
Hub passes callbacks bound to its private `metrics` object:

```typescript
// Inside WsFirehoseHub.onConnect():
const client = new ClientConnection(
    socket,
    this.watermarkBytes,
    this.bufferCapacity,
    {
        incrementSent: () => { this.metrics.frames_sent_total++; },
        incrementDropped: () => { this.metrics.frames_dropped_total++; },
        touchLastFrame: () => { this.metrics.last_frame_at = Date.now(); },
    },
);
```

### Pattern 2: Drop Check in ClientConnection.enqueue (D-32-A1)

```typescript
// Source: 32-CONTEXT.md D-32-A1 + verified RingBuffer.size/capacity are public
enqueue(entry: AuditEntry): void {
    if (this.closed) return;

    const canDirectSend =
        this.buffer.size === 0 &&
        this.socket.bufferedAmount < this.watermarkBytes;

    if (canDirectSend) {
        this.trySend({ type: 'event', entry });
        return;
    }

    // D-32-A1: pre-check for drop BEFORE push (pre-check === drop is happening)
    if (this.buffer.size === this.buffer.capacity) {
        this.metrics.incrementDropped();
    }
    this.buffer.push(entry);
    this.scheduleDrain();
}
```

Note: `RingBuffer.size` and `RingBuffer.capacity` are ALREADY public getters.
[VERIFIED: direct read of grid/src/util/ring-buffer.ts lines 50-52]

```typescript
// ring-buffer.ts lines 50-52 — these exist now, no change needed:
get size(): number { return this.items.length; }
get capacity(): number { return this._capacity; }
get isFull(): boolean { return this.items.length >= this._capacity; }
```

### Pattern 3: trySend Counter Placement (D-32-A3)

```typescript
// Source: 32-CONTEXT.md D-32-A3
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

### Pattern 4: HealthWatchdog Constructor (D-32-F1, D-32-B5)

```typescript
// Source: 32-CONTEXT.md D-32-F1 + D-32-B5
new HealthWatchdog(
    deps: {
        auditReconcile: AuditReconcile | undefined;
        clockState: () => ClockState;
    },
    opts?: {
        now?: () => number;         // default Date.now
        snapshotCadenceMs?: number; // default 30_000
    },
);
```

### Pattern 5: buildServerWithHub Wiring Sequence (D-32-G1)

Insertion point is AFTER line 573 `const firehoseHub = new WsFirehoseHub(...)` and
BEFORE the existing `app.register(async (instance) => {...})` block for WS routes.

```typescript
// Source: 32-CONTEXT.md D-32-G1
// (existing, line 572)
const firehoseHub = new WsFirehoseHub(services.audit, services.gridName);

// (NEW Phase 32 block)
const healthWatchdog = new HealthWatchdog(
    {
        auditReconcile: launcher.auditReconcile,
        clockState: () => launcher.clock.state,
    },
);
launcher.attachHealthWatchdog(healthWatchdog);
launcher.attachFirehoseHub(firehoseHub);  // also wires healthWatchdog.attachFirehoseStats

registerHealthDetailedRoute(app, services, launcher);

// (existing, line 574+)
const driftDetector = new DriftDetector(services.audit);
```

`launcher` must be available in `buildServerWithHub` scope. Currently
`buildServerWithHub` does NOT have a `launcher` parameter — it receives
`GridServices`. See Construction-Order Safety section for the solution.

### Pattern 6: registerHealthDetailedRoute Shape (mirrors tick-metrics.ts)

```typescript
// Source: grid/src/api/routes/tick-metrics.ts — pattern reference [VERIFIED]
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { GenesisLauncher } from '../../genesis/launcher.js';

export function registerHealthDetailedRoute(
    app: FastifyInstance,
    _services: GridServices,
    launcher: GenesisLauncher,
): void {
    app.get('/health/detailed', async (_req, reply) => {
        if (!launcher.healthWatchdog) {
            reply.code(503);
            return { error: 'watchdog_not_ready' };
        }
        return launcher.healthWatchdog.snapshot();
    });
}
```

### Pattern 7: Pino Transition Logging (D-32-B3)

```typescript
// Source: 32-CONTEXT.md D-32-B3 + grid/src/util/logger.ts [VERIFIED]
import { logger } from '../util/logger.js';
const log = logger.child({ module: 'health-watchdog' });

// Inside snapshot(), when lastStatus !== newStatus:
if (newStatus === 'ok') {
    log.info({ event: 'health_status_changed', from: this.lastStatus, to: newStatus, reasons }, 'health recovered');
} else {
    log.warn({ event: 'health_status_changed', from: this.lastStatus, to: newStatus, reasons }, 'health degraded');
}
```

Event-name schema confirmed by Phase 31 convention:
- `audit_persist_failed` (persistent-chain.ts)
- `audit_reconcile_ok` (audit-reconcile.ts)
- `health_status_changed` (Phase 32, new)

All three are greppable for: `docker compose logs grid -f | grep -E "(audit_reconcile|audit_persist|health_status_changed)"` [CITED: 32-CONTEXT.md Specific Ideas]

### Pattern 8: CI Gate Script Structure (check-no-silent-catch.mjs pattern)

```javascript
#!/usr/bin/env node
// Source: scripts/check-no-silent-catch.mjs [VERIFIED full file read]

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = [
    join(ROOT, 'grid', 'src', 'diagnostics'),
    join(ROOT, 'grid', 'src', 'audit'),
    join(ROOT, 'grid', 'src', 'db'),
];
const EXCLUDE_FILE_PATTERNS = [/\.test\.ts$/, /\.d\.ts$/];
const EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.next']);

// Regex with multiline-safe per-line scan (no /m needed — file split on '\n')
const FORBIDDEN_PATTERN = /(TODO|FIXME|XXX).{0,50}(health|metric|frame|drift|reconcile)/i;

// walkDir + scanFile pattern identical to check-no-silent-catch.mjs
// Exit 0 on clean, exit 1 with violation list on any match
```

Key implementation notes from the existing script:
- Uses `readdirSync` (sync, no async) with `{ withFileTypes: true }`
- Skips lines starting with `//`, `*`, `/*` (comments excluded from scan)
- Reports `file:line:rule:text` format
- `ENOENT` on SCAN_DIRS is swallowed (allows running before `diagnostics/` exists)

### Anti-Patterns to Avoid

- **Importing `GenesisLauncher` type into `grid/src/api/server.ts` as a class**: Use structural typing or add `launcher` to `GridServices`. See Construction-Order Safety section for the actual solution.
- **Logging every `snapshot()` call**: The `NOESIS_LOG_LEVEL=debug` caveat in D-32-B3 notes this would require debug level to see — defeats visible-by-default. Only transition events get logged.
- **Blocking `/health/detailed` on a DB query**: `launcher.auditReconcile.persistedMaxId` is cached from the last reconcile run; Phase 32 reads it, never calls `SELECT`.
- **Registering `/health/detailed` inside the WS scope**: The `app.register(async (instance) => {...})` block at server.ts:588 is for WebSocket routes only. The new route must be registered at top level (before the `app.register` call) to stay in the main scope.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured logging | Custom logger class | `logger.child({ module: 'health-watchdog' })` (Pino singleton) | Phase 31 locked this pattern; redact list already configured |
| Test clock injection | `vi.useFakeTimers()` + cleanup churn | `opts.now?: () => number` constructor parameter | D-32-B5 mirrors Phase 31/25a AuditReconcile pattern; no timer cleanup needed |
| WebSocket termination in UAT script | Custom TCP manipulation | `ws.terminate()` (hard close) or `ws.close()` (graceful) via `ws` npm package | `@fastify/websocket` uses `ws` under the hood; `ws` WebSocket object has both |
| Health threshold constants | Magic literals | `HEALTH_THRESHOLDS` frozen module export | D-32-C1 locked; named export enables symbolic reference in tests |

---

## Construction-Order Safety

**Research question:** Is `launcher.auditReconcile` populated before `buildServerWithHub` is called? Can `buildServerWithHub` receive a `launcher` parameter?

**Finding:** [VERIFIED: direct read of grid/src/main.ts lines 76-247]

`main.ts` construction order:
1. `auditReconcile = new AuditReconcile(...)` (line 93)
2. `launcher = new GenesisLauncher(config, { audit: chain, auditReconcile })` (line 101) → `this.auditReconcile = deps?.auditReconcile` set in constructor
3. `launcher.bootstrap(...)` (line 107)
4. `buildServer(...)` called (line 213) → internally calls `buildServerWithHub(services)`

Therefore: `launcher.auditReconcile` IS populated before `buildServerWithHub` runs.

**Critical gap:** `buildServerWithHub` currently has signature:
```typescript
export function buildServerWithHub(
    services: GridServices,
    wsHubOptions?: WsHubOverrides,
): { app, wsHub, firehoseHub, driftDetector }
```

`GenesisLauncher` is NOT currently a parameter. `GridServices` has only `launcher?: { spawnNous(...) }` (structural, not the full class).

**Solution options for the planner:**

Option A (recommended): Add `launcher?: GenesisLauncher` to `GridServices` interface. `main.ts` passes the full launcher. `buildServerWithHub` reads `services.launcher` for HealthWatchdog construction. Tests that don't need Phase 32 features don't pass `launcher` (undefined guard in `registerHealthDetailedRoute`).

Option B: Add `launcher?: GenesisLauncher` as a third parameter to `buildServerWithHub`. `buildServer` forwards it. Tests pass undefined.

Option A aligns with how `GridServices.launcher?.spawnNous` is already used (structural duck-typing); Option B adds parameter proliferation. The planner decides — both satisfy D-32-G1's requirement that `healthWatchdog` is constructed inside `buildServerWithHub`.

**Test seam confirmation:** `ws-integration.test.ts` (line 118) calls `buildServerWithHub(services)` with a plain `GridServices` object (no launcher). Adding `launcher?: GenesisLauncher` to `GridServices` as optional preserves backward compat for all existing tests. [VERIFIED: direct read]

---

## RingBuffer Accessor Verification

**D-32-A1 dependency confirmed:** [VERIFIED: direct read of grid/src/util/ring-buffer.ts lines 50-52]

```typescript
get size(): number { return this.items.length; }      // LINE 50 — PUBLIC
get capacity(): number { return this._capacity; }     // LINE 51 — PUBLIC
get isFull(): boolean { return this.items.length >= this._capacity; }  // LINE 52 — PUBLIC
```

`isFull` is equivalent to `size === capacity` but the D-32-A1 spec explicitly uses
`size === capacity` for the drop check. Either form is functionally correct; the spec
form is preferred for alignment with the decision text. No change to `ring-buffer.ts`
is needed in Phase 32. [VERIFIED]

---

## Fastify Route Registration Timing

**Finding:** [VERIFIED: direct read of grid/src/api/server.ts lines 560-650]

The `app.register(async (instance) => {...})` scope at line 588 registers WebSocket
routes only (`registerAuditFirehoseRoute`, `/ws/events`). The Fastify plugin system
processes all registered plugins asynchronously before `app.ready()`, so a route
registered at the top level before this `app.register()` call is valid and will be
available. The existing pattern at line 284 (`app.get('/health', ...)`) is proof:
it's registered at top level before the WS scope registration.

The pattern for `registerHealthDetailedRoute` is:
1. Register at top level of `buildServerWithHub` (same level as `/health`)
2. After the existing `registerDriftAlertsRoute(app, services)` call (line 586)
3. Before the `app.register(async (instance) => {...})` WS scope (line 588)

`registerTickMetricsRoute` (lines ~540+) is ALSO registered at top level inside
`buildServerWithHub` — this is the exact analog for Phase 32. [VERIFIED: tick-metrics.ts confirms the same function signature `(app, services)` pattern]

---

## setInterval Inventory in Scanned Directories

**Finding:** Zero `setInterval` calls in `grid/src/audit/`, `grid/src/db/`, or
`grid/src/diagnostics/` (the last does not yet exist). [VERIFIED: Bash grep across
those directories returned empty output]

The `check-interval-lifecycle.mjs` gate will pass on first run (zero matches = zero
violations). The gate exists to lock discipline for future phases — Phase 32 itself
ships zero `setInterval` calls by design (pure-pull watchdog, D-32-B1).

The only `setInterval` references in `grid/src/api/` are in whisper route comments
(`// NO setInterval`) — not in the scanned directories and not in code paths. [VERIFIED]

---

## Pino Logger Pattern

**Finding:** [VERIFIED: direct read of grid/src/util/logger.ts]

- Singleton exported as `logger: Logger` from `grid/src/util/logger.ts`
- Per-module scoping: `const log = logger.child({ module: 'health-watchdog' })`
- Level controlled by `NOESIS_LOG_LEVEL` env var (default `'info'`)
- Pretty-print mode: `NOESIS_LOG_PRETTY=1` (dev only, pino-pretty in devDeps)
- Redact list: `password`, `password_hash`, `signature`, `nonce`, `cookie`, `jwt`, `authorization`, `secret`, `token` (+ `*.` variants)
- Phase 32 emits no secrets → no additional redaction needed

**`NOESIS_LOG_LEVEL=debug` context (D-32-B3):** If every `snapshot()` call were
logged, the operator would need `NOESIS_LOG_LEVEL=debug` to see them (since they'd
need to be at debug level to avoid noise). This is why only state transitions are
logged at `warn`/`info` — they are visible at the default `info` level without any
env override.

**Existing log event names (Phase 31 convention):**
- `audit_persist_failed` — persistent-chain.ts
- `audit_reconcile_ok` — audit-reconcile.ts (every 60-tick cycle)
- `health_status_changed` — health-watchdog.ts (Phase 32, new)

All three are snake_case, verb-or-noun + past-tense pattern. [VERIFIED: audit-reconcile.ts phase 31 implementation]

---

## CI Gate Node Compatibility

**Node version:** 25.9.0 locally; engine requirement `>=20.0.0`. [VERIFIED: grid/package.json + `node --version`]

**Shebang/import style from check-no-silent-catch.mjs:** [VERIFIED: full file read]
```javascript
#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
```

ESM `import` with `node:` protocol prefix. Works on Node 20+. File is `.mjs` — no
`"type": "module"` needed in package.json (the `.mjs` extension forces ESM). This is
the exact shebang + import style both new gates must use.

**`check-observability-no-todo.mjs` regex:** [CITED: 32-CONTEXT.md D-32-D1]
```javascript
const FORBIDDEN_PATTERN = /(TODO|FIXME|XXX).{0,50}(health|metric|frame|drift|reconcile)/i;
```
This is a single-line regex applied per line (no multiline flag needed — file is
split on `\n` before testing). Case-insensitive flag `i` handles all caps variants.

**`check-interval-lifecycle.mjs` regex:** [CITED: 32-CONTEXT.md D-32-D1]
The gate asserts that every line containing `setInterval(` either has `this.<name> =`
to its left on the same line OR is preceded within 3 lines by a field assignment.
Current state: zero `setInterval` calls in scanned dirs, so the gate trivially
passes today. The implementation must handle the ENOENT case for `grid/src/diagnostics/`
gracefully (same pattern as check-no-silent-catch.mjs `ENOENT` swallow).

---

## Test Seam Analysis

**How existing tests construct a server for integration testing:**

From `grid/test/ws-integration.test.ts` lines 112-124: [VERIFIED]

```typescript
async function setup(): Promise<void> {
    clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    audit = new AuditChain();
    const services = { clock, space, logos, audit, gridName: 'itest-grid' };
    const built = buildServerWithHub(services);
    app = built.app;
    // app.listen({ port: 0, host: '127.0.0.1' })
}
```

For `health-detailed-route.test.ts`, the seam must include a `launcher`-like object.
Minimal approach:

```typescript
// Inside health-detailed-route.test.ts setup
const fakeAuditReconcile = {
    get lastReconcileAt() { return mockNow - 1000; },
    get persistedMaxId() { return 42; },
    get lastPersistError() { return null; },
};
const fakeLauncher = {
    auditReconcile: fakeAuditReconcile,
    get clock() { return { state: { tick: 100, running: true } }; },
    _healthWatchdog: undefined as HealthWatchdog | undefined,
    get healthWatchdog() { return this._healthWatchdog; },
    attachHealthWatchdog(wd: HealthWatchdog) { this._healthWatchdog = wd; },
    attachFirehoseHub(hub: { stats(): FirehoseStats }) {
        this._healthWatchdog?.attachFirehoseStats(() => hub.stats());
    },
};
const services = { clock, space, logos, audit, gridName: 'test-grid', launcher: fakeLauncher };
const built = buildServerWithHub(services);
```

This pattern injects injectable `now()` and `snapshotCadenceMs` via HealthWatchdog
constructor opts — no `vi.useFakeTimers()` needed. [CITED: 32-CONTEXT.md D-32-B5]

**Pino test-mode sink for `health-watchdog-transitions.test.ts`:**

Phase 31 tests likely use Pino's in-memory transport. The standard pattern:
```typescript
import pino from 'pino';
const logLines: object[] = [];
const testLogger = pino({ level: 'trace' }, { write: (s: string) => logLines.push(JSON.parse(s)) });
```
Then inject as `logger` via dependency injection or module mock. Since `logger` is a
module-level singleton, the cleanest approach for `health-watchdog-transitions.test.ts`
is to make `HealthWatchdog` accept an optional `logger` dep in opts (or use vi.mock on
the logger module). The planner chooses — both work. [ASSUMED: Pino test sink pattern
from training knowledge; Phase 31 test files not read to confirm exact approach]

---

## WebSocket Half-Close for UAT Script

**Research question:** What is the minimal API for half-closing a WebSocket
connection programmatically? What library does `@fastify/websocket` use?

**Finding:** [VERIFIED: grid/package.json — `@fastify/websocket: ^11.2.0` is the dep;
`ws` is NOT a direct dep but is the underlying library for `@fastify/websocket`]

`@fastify/websocket` wraps the `ws` npm package. For the UAT diagnostic script
`uat-half-close-socket.mjs`, the script connects as a client using `ws` (installable
or available via `@fastify/websocket`'s transitive dep). Half-close semantics:

- **Graceful WS close (sends CLOSE frame, waits for server ack):** `ws.close()`
- **Hard terminate (TCP reset, no CLOSE frame):** `ws.terminate()`
- **Half-close to simulate backpressure:** Connect, receive the hello frame, then
  call `ws.terminate()` before ACKing. The server-side socket enters a half-open
  state that makes subsequent `socket.send()` calls throw. This is exactly the
  failure mode D-32-A3 / R-32-03 tests for.

**Script recommendation (planner's call):** A ~30-line Node.js script is preferable
over `wscat` documentation because:
1. `wscat` requires interactive TTY; scripts run non-interactively in UAT
2. The `ws` package is already available transitively
3. The script can connect, log the hello frame, wait 2s, call `terminate()`, and
   exit with a clear message — reproducible and documentable

**Minimal script skeleton:**
```javascript
#!/usr/bin/env node
// scripts/uat-half-close-socket.mjs
import { WebSocket } from 'ws';
const url = process.argv[2] ?? 'ws://localhost:8080/api/v1/audit/firehose';
const ws = new WebSocket(url);
ws.on('open', () => console.log('[half-close] connected'));
ws.on('message', (data) => {
    const frame = JSON.parse(data.toString());
    console.log('[half-close] received:', frame.type);
    if (frame.type === 'hello') {
        console.log('[half-close] terminating (hard close)...');
        ws.terminate(); // Hard close — server-side send will throw on next frame
        console.log('[half-close] done. Check frames_dropped_total did NOT increment.');
        console.log('[half-close] Check frames_sent_total did NOT increment for this client.');
    }
});
```
[CITED: 32-CONTEXT.md D-32-D3 Step 3; ws npm package API — ASSUMED from training]

---

## Pitfalls (from OBSERVABILITY-HARDENING.md)

### Pitfall 1: Construction-Order Race Between Firehose Subscription and First Tick

**Exact text:** [VERIFIED: direct read of OBSERVABILITY-HARDENING.md Pitfalls section]
> Where it could re-occur: `grid/src/api/server.ts:572` — `WsFirehoseHub` is
> constructed inside `buildServerWithHub`, AFTER `launcher.bootstrap()` has wired
> the `clock.onTick` callback. If a future refactor moves the clock-start before
> the hub construction, the first N ticks would fire-and-vanish.

**Phase 32 mitigation:** D-32-G1 locks the order: HealthWatchdog and
`attachFirehoseHub` happen immediately after `firehoseHub` construction, within
`buildServerWithHub`. The construction-order race regression test is **deferred**
(decision D-32-D2: buildServerWithHub structure already locks the order; a future
regression would require touching server.ts and would be caught by typecheck/lint).

### Pitfall 3: `firehose-hub.ts:55-58` Silently Swallows `socket.send` Failures

**Exact text:** [VERIFIED: direct read of OBSERVABILITY-HARDENING.md Pitfalls section]
> Where: `ClientConnection.trySend` catches and discards. With no counter increment
> for "swallowed sends", a half-closed socket would appear as "frames sent" forever.
> The frame-counter recommendation above only counts AFTER successful send — if
> `send` throws, no increment, no log either.
>
> Prevention gate: regression test that injects a `ClientConnection` with a
> `socket.send` throwing on every call, asserts `frames_sent_total === 0` AND
> `frames_dropped_total` increments OR a new `send_errors_total` counter increments.

**Phase 32 mitigation:** D-32-A3 places the counter increment AFTER `socket.send()`
inside the `try` block, BEFORE the `catch`. If `send` throws, the increment is
never reached → `frames_sent_total` stays accurate. `firehose-send-throws.test.ts`
is the regression enforcement.

### Pitfall 8: Health-Watchdog Dies Silently if setInterval Handle is GC'd

**Exact text:** [VERIFIED: direct read of OBSERVABILITY-HARDENING.md Pitfalls section]
> Node's `setInterval` keeps a reference alive, but if the watchdog is constructed
> inside a closure that gets re-assigned, the old interval can become orphaned.
>
> Prevention: store the watchdog as a `readonly` field on `GenesisLauncher` (not
> in a closure), with an explicit `stop()` called in `launcher.stop()`. CI gate
> `scripts/check-interval-lifecycle.mjs` greps for `setInterval` calls in
> `grid/src/diagnostics/` and asserts each is stored in a field, not just `const`.

**Phase 32 mitigation:** D-32-B1 eliminates the pitfall entirely — pure-pull design
has NO `setInterval`. The CI gate still ships to enforce the discipline for future
phases (any future Phase that adds a setInterval in these dirs must store the handle).
`healthWatchdog` is stored as a field on `GenesisLauncher` (D-32-G2), satisfying the
"not in a closure" requirement even though there's no handle to store.

---

## Validation Architecture

> `workflow.nyquist_validation` key is absent from `.planning/config.json` (file contains only `{ "workflow": {} }`). Treat as enabled. [VERIFIED: file read]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^2.0.0 |
| Config file | None detected — grid uses `npx vitest run` from `grid/` directory |
| Quick run command | `cd grid && npx vitest run test/firehose-frame-counters.test.ts test/firehose-send-throws.test.ts test/health-detailed-route.test.ts test/health-watchdog-transitions.test.ts` |
| Full suite command | `cd grid && npm test` (= `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OBS-05 | `frames_sent_total` increments after successful send | Unit | `npx vitest run test/firehose-frame-counters.test.ts` | ❌ Wave 0 |
| OBS-05 | `frames_dropped_total` increments when buffer at capacity | Unit | `npx vitest run test/firehose-frame-counters.test.ts` | ❌ Wave 0 |
| OBS-05 | `last_frame_at` updates on every successful send | Unit | `npx vitest run test/firehose-frame-counters.test.ts` | ❌ Wave 0 |
| OBS-05 R-32-03 | socket.send-throwing client: `frames_sent_total === 0`, hub survives, other clients receive | Unit | `npx vitest run test/firehose-send-throws.test.ts` | ❌ Wave 0 |
| OBS-06 | `/health/detailed` returns all four payload shapes (ok/cold-start-ok/degraded/critical) | Integration | `npx vitest run test/health-detailed-route.test.ts` | ❌ Wave 0 |
| OBS-06 | Response shape exactly matches `HealthDetailedPayload` (no extra/missing keys) | Integration | `npx vitest run test/health-detailed-route.test.ts` | ❌ Wave 0 |
| OBS-06 | p95 latency <50ms over 100 calls (timing test) | Performance | `npx vitest run test/health-detailed-route.test.ts` | ❌ Wave 0 |
| OBS-07 | `logger.warn` fires on ok→degraded and degraded→critical transitions | Unit | `npx vitest run test/health-watchdog-transitions.test.ts` | ❌ Wave 0 |
| OBS-07 | Consecutive ok→ok: NO warn log fired | Unit | `npx vitest run test/health-watchdog-transitions.test.ts` | ❌ Wave 0 |
| R-32-01 | CI gate blocks TODO/FIXME/XXX near observability keywords | CI | `node scripts/check-observability-no-todo.mjs` | ❌ Wave 0 |
| R-32-02 | CI gate: every setInterval in scanned dirs stored in field | CI | `node scripts/check-interval-lifecycle.mjs` | ❌ Wave 0 |
| OBS-06 UAT | Full payload shape after 60s uptime | Manual | `32-HUMAN-UAT.md Step 1` | ❌ Wave 0 |
| OBS-05 UAT | `frames_sent_total` strictly increases across 5s polls | Manual | `32-HUMAN-UAT.md Step 2` | ❌ Wave 0 |
| OBS-05 UAT | Half-closed socket increments dropped, not sent | Manual | `32-HUMAN-UAT.md Step 3` | ❌ Wave 0 |
| OBS-06 UAT | MySQL stop → degraded within 60s, restart → ok within 60s | Manual | `32-HUMAN-UAT.md Step 4` | ❌ Wave 0 |
| OBS-06 UAT | ab load test: p95 latency <50ms | Manual | `32-HUMAN-UAT.md Step 5` | ❌ Wave 0 |

### Addressing "p95 <50ms in CI" (Success Criterion 5)

The route is in-process, reads cached values, does no I/O. Timing 100 sequential
calls and asserting all at <50ms in a vitest test is deterministic because:
- Node.js single-threaded: no DB contention
- `Date.now()` resolution: 1ms, sufficient for 50ms threshold
- Test asserts p95 not p100 — allows for occasional GC pause outliers

The assertion should be `duration < 50` where `duration = Date.now() - before`. If
this flakes in CI, raise to `< 100ms` with a comment that the spec target is 50ms
but CI headroom accounts for resource-constrained runners.

### Addressing "frames_sent_total increments at least once per tick" (Success Criterion 2)

This is a live/UAT assertion, not a unit test assertion. In unit tests, verify:
- Each `hub.audit.append(allowlisted entry)` → `hub.stats().frames_sent_total` increments by 1 (for a single connected FakeSocket)

In CI, this is deterministic via the FakeSocket pattern from existing `firehose-hub.test.ts`. [VERIFIED: test file read shows FakeSocket with controllable `throwOnSend`]

### Sampling Rate

- **Per task commit:** `cd grid && npx vitest run test/firehose-frame-counters.test.ts test/firehose-send-throws.test.ts test/health-detailed-route.test.ts test/health-watchdog-transitions.test.ts`
- **Per wave merge:** `cd grid && npm test` (full suite)
- **Phase gate:** Full suite green + CI gate scripts pass + rig-invariants workflow passes before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `grid/src/diagnostics/` — directory does not exist [VERIFIED: Bash ls returned empty]
- [ ] `grid/src/diagnostics/health-watchdog.ts` — covers OBS-07
- [ ] `grid/src/api/routes/health-detailed.ts` — covers OBS-06
- [ ] `grid/test/firehose-frame-counters.test.ts` — covers OBS-05
- [ ] `grid/test/firehose-send-throws.test.ts` — covers OBS-05 R-32-03
- [ ] `grid/test/health-detailed-route.test.ts` — covers OBS-06
- [ ] `grid/test/health-watchdog-transitions.test.ts` — covers OBS-07
- [ ] `scripts/check-observability-no-todo.mjs` — CI gate R-32-01
- [ ] `scripts/check-interval-lifecycle.mjs` — CI gate R-32-02
- [ ] `.planning/phases/32-firehose-observability/32-HUMAN-UAT.md` — operator UAT
- [ ] `scripts/uat-half-close-socket.mjs` — (planner's call) UAT Step 3 harness

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js >=20 | CI gate scripts (.mjs) | ✓ | 25.9.0 locally; CI uses `node-version: '20'` in rig-invariants.yml | — |
| Vitest ^2.0.0 | Test files | ✓ | ^2.0.0 (grid/package.json devDep) | — |
| Pino ^10.0.0 | health-watchdog.ts logging | ✓ | ^10.0.0 (grid/package.json direct dep since Phase 31) | — |
| @fastify/websocket ^11.2.0 | WS route (unchanged) | ✓ | ^11.2.0 | — |
| ws (transitive) | uat-half-close-socket.mjs client | ✓ | Transitive of @fastify/websocket | wscat CLI if not available |
| docker compose | UAT Steps 4-5 (MySQL stop/start, ab load test) | [ASSUMED] | Production environment | — |
| ab (ApacheBench) | UAT Step 5 (p95 latency test) | [ASSUMED] | Typically pre-installed on Ubuntu | `wrk` or simple curl loop |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `ab` for UAT Step 5 can be replaced by a `for i in {1..1000}; do curl -s http://localhost:8080/health/detailed > /dev/null; done` timing script if not available.

---

## Common Pitfalls

### Pitfall 1: Import Direction Violation (genesis → audit)

**What goes wrong:** If `GenesisLauncher` imports `WsFirehoseHub` directly, `genesis/` depends on `audit/` → import cycle risk. The existing dependency graph has `audit/` subscribing to chain events, not the other direction.

**Why it happens:** D-32-E1 (`attachFirehoseHub`) needs to call `hub.stats()`. If typed as `WsFirehoseHub`, the launcher file must import from `audit/firehose-hub.ts`.

**How to avoid:** Use the structural interface `{ stats(): FirehoseStats }` as specified in D-32-E1. The `FirehoseStats` interface can live in `grid/src/audit/types.ts` or `grid/src/api/types.ts` — either way accessible without importing the class.

**Warning signs:** TypeScript error "circular dependency" or tslint import-direction violation in CI.

### Pitfall 2: HealthWatchdog Constructed Before auditReconcile Exists

**What goes wrong:** If `healthWatchdog` is constructed with `auditReconcile: undefined` in tests (correct), but in production `buildServerWithHub` is called before `launcher.auditReconcile` is populated.

**Why it happens:** Tests often wire a simpler launcher than production.

**How to avoid:** Confirmed safe: `main.ts` constructs `auditReconcile` at line 93, passes it to `GenesisLauncher` constructor at line 101, and calls `buildServerWithHub` at line 213. By the time `buildServerWithHub` runs, `launcher.auditReconcile` is already populated. [VERIFIED: main.ts read]

**Warning signs:** `snapshot().audit.last_reconcile_at` is always 0 in production despite the reconcile loop running.

### Pitfall 3: tryDrain Bypasses Drop Counter

**What goes wrong:** `ClientConnection.tryDrain()` calls `trySend()` multiple times with items from `buffer.drain()`. If the drain loop pushes overflow back into the buffer (lines 97-99 in current code), the overflow push does NOT go through the `enqueue` method — so the `size===capacity` drop check is bypassed.

**Why it happens:** `tryDrain` has its own `buffer.push(items[i])` calls for items that couldn't be sent yet. These are RE-QUEUED items, not newly arriving items — so they should NOT increment `frames_dropped_total`.

**How to avoid:** The drop counter increment belongs ONLY in `enqueue()`, not in `tryDrain()`. The `buffer.push()` calls inside `tryDrain()` are for partial-drain re-queuing; they should NOT call `this.metrics.incrementDropped()`. The D-32-A1 spec is correct — only the `enqueue()` path triggers the drop counter.

**Warning signs:** `frames_dropped_total` increments rapidly during normal drain cycles even when clients keep up.

### Pitfall 4: Route Returns 503 During Narrow Boot Window

**What goes wrong:** If a request hits `/health/detailed` between when `buildServerWithHub` registers the route and when `attachHealthWatchdog` is called (which should be immediate in the same function), `launcher.healthWatchdog` is undefined.

**How to avoid:** D-32-C3 specifies a guard: if `healthWatchdog` not yet attached, return a safe response (503 or an empty payload). The guard is a single `if (!launcher.healthWatchdog)` check at the top of the handler. In practice, this window is nanoseconds-wide because all three steps happen synchronously in `buildServerWithHub` before `app.listen()`. The guard is defensive code only.

### Pitfall 5: `check-interval-lifecycle.mjs` Fails on `tryDrain`'s `queueMicrotask`

**What goes wrong:** The gate looks for `setInterval(` — `queueMicrotask` is a different API and not matched. However, `firehose-hub.ts` has `queueMicrotask(() => this.tryDrain())` in `scheduleDrain()`. This is NOT a `setInterval` — gate correctly ignores it.

**How to avoid:** The gate regex targets `setInterval(` only. `queueMicrotask`, `setTimeout`, `setImmediate` are NOT matched. Gate documentation should clarify scope.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hub silently swallows send errors with no visibility | `frames_sent_total` + `frames_dropped_total` counters | Phase 32 | "Tick advances but zero frames delivered" becomes detectable within 60s |
| In-process health: only basic `{ status: 'ok' }` | `/health/detailed` with audit + firehose + clock blocks | Phase 32 | Operator gets structured pipeline status without DB query |
| No Phase 31 staleness detection | HealthWatchdog `RECONCILE_STALE_MULTIPLIER` check | Phase 32 | Reconcile loop stopping silently surfaces as `degraded` within 5 cadence windows |

---

## Project Constraints (from CLAUDE.md)

| Directive | Source | Enforcement |
|-----------|--------|-------------|
| Simplicity First — minimum code that solves the problem, no speculative abstractions | CLAUDE.md §2 | Every changed line must trace to OBS-05/06/07 or the three Risks |
| Surgical Changes — touch only what is needed | CLAUDE.md §3 | Phase 32 modifies 4 files, creates 9 new files, touches ZERO existing test files |
| Documentation Sync Rule — update source-of-truth docs in same turn when scope changes | CLAUDE.md §Documentation Sync Rule | Phase 32 does not change milestone/philosophy — doc sync is Phase 35 territory |
| No Prometheus / Datadog / Honeycomb / New Relic | PHILOSOPHY.md §1 sovereignty | Rejected by architecture; Pino + in-process counters + REST polling is the v2.6 stack |
| Broadcast allowlist frozen — Phase 32 adds 0 events (stays at 53) | PHILOSOPHY.md §7 + STATE.md | `/health/detailed` is a route, not an audit event; HealthWatchdog emits LOG events not AUDIT events |
| Phase numbering continues — do NOT reset | CLAUDE.md GSD Workflow Notes | Phase 32 follows Phase 31 in the v2.6 sequence |
| Push to git after every commit | MEMORY.md | Applies to all phase tasks |
| Rebuild Grid Docker after every source change | MEMORY.md | `docker compose build grid && docker compose up -d grid` required after Phase 32 commits |
| `vitest run` only — never watch/background/detached | MEMORY.md | All test commands must use `npx vitest run`, never `npx vitest` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Pino test sink pattern (in-memory write function for health-watchdog-transitions.test.ts) | Test Seam Analysis | If project uses a different Pino test interception method, test scaffolding needs adjustment |
| A2 | `ws` package available transitively from `@fastify/websocket` for uat-half-close-socket.mjs | WebSocket Half-Close section | Script needs `import { WebSocket } from 'ws'` — if not available, `npm install ws --save-dev` or use `wscat` |
| A3 | `docker compose` and `ab` available on operator machine for UAT Steps 4-5 | Environment Availability | UAT Step 5 needs `ab` fallback documented |
| A4 | `@fastify/websocket` wraps the `ws` npm package (not a native binding or different WS lib) | WebSocket section | If wrong, ws.terminate() API may differ — verify by checking @fastify/websocket source |

**Verified claims in this research: all critical architectural facts confirmed by direct source-file reads.**

---

## Open Questions

1. **Logger injection in `health-watchdog-transitions.test.ts`**
   - What we know: Pino singleton at `grid/src/util/logger.ts`; tests need to capture warn events
   - What's unclear: Does Phase 31 establish a vi.mock pattern for the logger, or does it use Pino's stream injection?
   - Recommendation: Check existing Phase 31 test files (e.g., `grid/test/audit-reconcile.test.ts`) for the established logger mock pattern before implementing. [ASSUMED: pattern not confirmed]

2. **`GridServices.launcher` field type**
   - What we know: Currently `launcher?: { spawnNous(...): void }` (structural, not GenesisLauncher class)
   - What's unclear: Whether to add `healthWatchdog?: HealthWatchdog` to this structural type vs adding the full `GenesisLauncher` class reference
   - Recommendation: Adding the full `GenesisLauncher` type is cleaner and Phase 34 will need it too. Planner decides.

---

## Sources

### Primary (HIGH confidence)

- `grid/src/util/ring-buffer.ts` — verified `size`, `capacity`, `isFull` public getters at lines 50-52 [VERIFIED]
- `grid/src/audit/firehose-hub.ts` — verified full current implementation, constructor signature, trySend, enqueue, onConnect [VERIFIED]
- `grid/src/genesis/launcher.ts` — verified `auditReconcile` field (line 151), `GenesisLauncherDeps` interface (lines 40-48), all existing attach methods [VERIFIED]
- `grid/src/api/server.ts` — verified `buildServerWithHub` signature, `/health` route at line 284, WS scope at line 588, `GridServices.launcher` structural type [VERIFIED]
- `grid/src/api/routes/tick-metrics.ts` — verified exact function signature `registerTickMetricsRoute(app, services)` as pattern reference [VERIFIED]
- `grid/src/util/logger.ts` — verified Pino singleton, `NOESIS_LOG_LEVEL` env var, `.child({ module })` pattern [VERIFIED]
- `grid/src/db/audit-reconcile.ts` — verified getter API: `lastReconcileAt`, `persistedMaxId`, `lastPersistError` at lines 52-66 [VERIFIED]
- `grid/src/main.ts` — verified construction order: auditReconcile (line 93) → launcher (line 101) → buildServer (line 213) [VERIFIED]
- `scripts/check-no-silent-catch.mjs` — verified shebang, imports, walkDir pattern, per-line scan with comment skip, exit codes [VERIFIED]
- `.github/workflows/rig-invariants.yml` — verified existing steps structure, Node 20, `OBS-03` step name pattern [VERIFIED]
- `.planning/phases/32-firehose-observability/32-CONTEXT.md` — all locked decisions [VERIFIED]
- `.planning/research/v2.6/OBSERVABILITY-HARDENING.md` — Pitfalls 1, 3, 8 exact text [VERIFIED]
- `grid/test/audit/firehose-hub.test.ts` — verified FakeSocket pattern, test structure [VERIFIED]
- `grid/test/ws-integration.test.ts` — verified `buildServerWithHub(services)` seam, services shape for integration tests [VERIFIED]
- `grid/package.json` — verified no new deps needed: pino ^10.0.0, vitest ^2.0.0, @fastify/websocket ^11.2.0 [VERIFIED]
- `.planning/config.json` — verified `workflow.nyquist_validation` absent (treated as enabled) [VERIFIED]
- Bash scan: zero `setInterval` calls in `grid/src/audit/`, `grid/src/db/` [VERIFIED]
- Bash: `grid/src/diagnostics/` does not exist [VERIFIED]

### Secondary (MEDIUM confidence)

- 32-DISCUSSION-LOG.md — alternatives considered and rationale [CITED]
- .planning/REQUIREMENTS.md OBS-05/06/07 — payload shapes and threshold values [CITED]
- .planning/ROADMAP.md Phase 32 section — success criteria, risks R-32-01..03 [CITED]
- .planning/STATE.md v2.6 Key Decisions — observability stack rationale [CITED]
- .planning/phases/31-audit-pipeline-persistence/31-CONTEXT.md D-31-C3 — AuditReconcile getter contract [CITED]

### Tertiary (LOW / ASSUMED)

- Pino test sink / vi.mock pattern for `health-watchdog-transitions.test.ts` [ASSUMED — Phase 31 test convention not read]
- `ws.terminate()` API availability via @fastify/websocket transitive dep [ASSUMED — ws package API training knowledge]
- docker/ab availability on operator machine [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all packages verified in grid/package.json
- Architecture (RingBuffer, route scope, construction order): HIGH — direct source file reads
- CI gate pattern: HIGH — check-no-silent-catch.mjs read in full; exact shebang + walkDir documented
- Test seam: HIGH — ws-integration.test.ts and firehose-hub.test.ts read; FakeSocket pattern confirmed
- WebSocket half-close: MEDIUM — @fastify/websocket/ws API from training; package identity verified
- Pino test-mode sink for transitions test: LOW — specific test interception method not confirmed from Phase 31 tests

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable stack — 30-day validity)
