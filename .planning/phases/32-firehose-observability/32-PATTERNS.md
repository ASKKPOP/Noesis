# Phase 32: Firehose Observability — Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 10 new + 5 modified = 15 files in scope
**Analogs found:** 14 / 15 (one new directory with no precedent)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `grid/src/diagnostics/health-watchdog.ts` | service | request-response (pure-pull) | `grid/src/db/audit-reconcile.ts` | role-match |
| `grid/src/api/routes/health-detailed.ts` | route | request-response | `grid/src/api/routes/tick-metrics.ts` | exact |
| `scripts/check-observability-no-todo.mjs` | utility/CI | transform | `scripts/check-no-silent-catch.mjs` | exact |
| `scripts/check-interval-lifecycle.mjs` | utility/CI | transform | `scripts/check-no-silent-catch.mjs` | exact |
| `grid/test/firehose-frame-counters.test.ts` | test | event-driven | `grid/test/audit/firehose-hub.test.ts` | exact |
| `grid/test/firehose-send-throws.test.ts` | test | event-driven | `grid/test/audit/firehose-hub.test.ts` | exact |
| `grid/test/health-detailed-route.test.ts` | test | request-response | `grid/test/ws-integration.test.ts` | role-match |
| `grid/test/health-watchdog-transitions.test.ts` | test | request-response | `grid/test/audit-reconcile.test.ts` | exact |
| `.planning/phases/32-firehose-observability/32-HUMAN-UAT.md` | docs | — | `.planning/phases/31-audit-pipeline-persistence/31-HUMAN-UAT.md` | exact |
| `scripts/uat-half-close-socket.mjs` | utility/diagnostic | event-driven | `scripts/check-no-silent-catch.mjs` (shebang/ESM pattern only) | partial |
| `grid/src/audit/firehose-hub.ts` (MODIFIED) | service | event-driven | self (existing) | — |
| `grid/src/genesis/launcher.ts` (MODIFIED) | service | CRUD | self — attach methods follow lines 234-273 pattern | — |
| `grid/src/api/server.ts` (MODIFIED) | config/wiring | request-response | self — wiring follows lines 571-586 pattern | — |
| `grid/src/util/ring-buffer.ts` (verify-only) | utility | — | self (no change needed) | — |
| `.github/workflows/rig-invariants.yml` (MODIFIED) | config/CI | — | self — follow lines 27-28 step pattern | — |

---

## Pattern Assignments

### `grid/src/diagnostics/health-watchdog.ts` (service, request-response)

**Analog:** `grid/src/db/audit-reconcile.ts`

**Imports pattern** (audit-reconcile.ts lines 27-31):
```typescript
import type { AuditChain } from '../audit/chain.js';
import type { IAuditStore } from './types.js';
import type { DatabaseConnection } from './connection.js';
import { logger as baseLogger } from '../util/logger.js';

const log = baseLogger.child({ module: 'audit-reconcile' });
```

Mirror for health-watchdog.ts — replace module-specific imports with:
```typescript
import type { AuditReconcile } from '../db/audit-reconcile.js';
import type { ClockState } from '../clock/ticker.js';
import { logger as baseLogger } from '../util/logger.js';

const log = baseLogger.child({ module: 'health-watchdog' });
```

**Constants pattern** (audit-reconcile.ts lines 34-37):
```typescript
export const REPLAY_BATCH_CAP = 500;
export const DIVERGENCE_WARN_THRESHOLD = 10;
```

Mirror for health-watchdog.ts — the `HEALTH_THRESHOLDS` frozen export (D-32-C1):
```typescript
export const HEALTH_THRESHOLDS = Object.freeze({
    DIVERGENCE_DEGRADED: 10,
    DIVERGENCE_CRITICAL: 100,
    STALE_FRAME_MS: 60_000,
    RECONCILE_STALE_MULTIPLIER: 5,
} as const);
```

**Private state + readonly getters pattern** (audit-reconcile.ts lines 39-67):
```typescript
export class AuditReconcile {
    private _lastReconcileAt = 0;
    private _persistedMaxId: number | null = null;
    private _lastPersistError: { code: string; at: number } | null = null;

    constructor(
        private readonly chain: AuditChain,
        private readonly store: IAuditStore,
        private readonly db: DatabaseConnection,
        private readonly gridName: string,
    ) {}

    get lastReconcileAt(): number {
        return this._lastReconcileAt;
    }
    get persistedMaxId(): number | null {
        return this._persistedMaxId;
    }
    get lastPersistError(): { code: string; at: number } | null {
        return this._lastPersistError;
    }
```

Mirror for HealthWatchdog — private `lastStatus` field + injectable clock/reconcile deps:
```typescript
export class HealthWatchdog {
    private lastStatus: 'ok' | 'degraded' | 'critical' | null = null;
    private _firehoseStatsFn: (() => FirehoseStats) | null = null;

    constructor(
        private readonly deps: {
            auditReconcile: AuditReconcile | undefined;
            clockState: () => ClockState;
        },
        private readonly opts: {
            now?: () => number;
            snapshotCadenceMs?: number;
        } = {},
    ) {}
```

**State-transition log pattern** (audit-reconcile.ts lines 90-94, 138-141):
```typescript
// info for normal path
log.info(
    { event: 'audit_reconcile_ok', divergence: 0, replayed: 0, remaining: 0 },
    'reconcile cycle complete',
);
// warn for above-threshold path
log.warn(payload, 'reconcile cycle: divergence above threshold');
```

Mirror for HealthWatchdog D-32-B3 — log ONLY on state transition:
```typescript
if (newStatus === 'ok') {
    log.info({ event: 'health_status_changed', from: this.lastStatus, to: newStatus, reasons }, 'health recovered');
} else {
    log.warn({ event: 'health_status_changed', from: this.lastStatus, to: newStatus, reasons }, 'health degraded');
}
this.lastStatus = newStatus;
```

**Defense-in-depth outer catch** (audit-reconcile.ts lines 143-157):
```typescript
} catch (err: unknown) {
    // Outermost defense-in-depth: a thrown reconcile must never crash the tick.
    this._lastReconcileAt = Date.now();
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    this._lastPersistError = { code, at: Date.now() };
    log.error(
        {
            event: 'audit_reconcile_failed',
            error_message: err instanceof Error ? err.message : String(err),
            error_code: code,
        },
        'reconcile body threw — recovered, will retry next cycle',
    );
}
```

HealthWatchdog.snapshot() is synchronous and pure-pull — no try/catch needed at the outer level. The route handler holds the guard (see `registerHealthDetailedRoute` below).

---

### `grid/src/api/routes/health-detailed.ts` (route, request-response)

**Analog:** `grid/src/api/routes/tick-metrics.ts`

**Imports pattern** (tick-metrics.ts lines 12-17):
```typescript
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { DID_REGEX } from '../server.js';
import type { ApiError } from '../types.js';
```

Mirror for health-detailed.ts — add GenesisLauncher type import:
```typescript
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { GenesisLauncher } from '../../genesis/launcher.js';
```

**Function signature + route registration pattern** (tick-metrics.ts lines 18-43):
```typescript
export function registerTickMetricsRoute(app: FastifyInstance, services: GridServices): void {
    app.get<{ Params: { did: string } }>(
        '/api/v1/nous/:did/tick-metrics',
        async (req, reply) => {
            const { did } = req.params;

            if (!DID_REGEX.test(did)) {
                reply.code(400);
                return { error: 'invalid_did' } satisfies ApiError;
            }

            const runner = services.getRunner ? services.getRunner(did) : undefined;
            if (!runner) {
                reply.code(404);
                return { error: 'unknown_nous' } satisfies ApiError;
            }

            if (typeof runner.getTickMetrics !== 'function') {
                return { p50: 0, p95: 0, queue_depth: 0, sample_count: 0 };
            }

            return runner.getTickMetrics();
        },
    );
}
```

Mirror for health-detailed.ts — third param is `launcher`, guard replaces DID check:
```typescript
export function registerHealthDetailedRoute(
    app: FastifyInstance,
    _services: GridServices,
    launcher: GenesisLauncher,
): void {
    app.get('/health/detailed', async (_req, reply) => {
        if (!launcher.healthWatchdog) {
            reply.code(503);
            return { error: 'watchdog_not_ready' } satisfies ApiError;
        }
        return launcher.healthWatchdog.snapshot();
    });
}
```

Key differences from tick-metrics.ts: no URL params, no DID_REGEX check, third launcher param, route at top-level path not nested API path.

---

### `scripts/check-observability-no-todo.mjs` (utility/CI, transform)

**Analog:** `scripts/check-no-silent-catch.mjs`

**Full file structure** (check-no-silent-catch.mjs lines 1-136) — copy the entire skeleton verbatim, changing only the three variable values:

**Shebang + imports** (lines 1-4, 27-30):
```javascript
#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
```

**SCAN_DIRS** (lines 32-35):
```javascript
const ROOT = process.cwd();
const SCAN_DIRS = [
    join(ROOT, 'grid', 'src', 'db'),
    join(ROOT, 'grid', 'src', 'audit'),
];
```

For check-observability-no-todo.mjs, SCAN_DIRS adds `diagnostics`:
```javascript
const SCAN_DIRS = [
    join(ROOT, 'grid', 'src', 'diagnostics'),
    join(ROOT, 'grid', 'src', 'audit'),
    join(ROOT, 'grid', 'src', 'db'),
];
```

**EXCLUDE patterns** (lines 37-38):
```javascript
const EXCLUDE_FILE_PATTERNS = [/\.test\.ts$/, /\.d\.ts$/];
const EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.next']);
```

Identical — copy verbatim.

**RULES array** (lines 55-66): replace with single rule using D-32-D1 regex:
```javascript
const RULES = [
    {
        name: 'observability-no-TODO',
        re: /(TODO|FIXME|XXX).{0,50}(health|metric|frame|drift|reconcile)/i,
    },
];
```

**walkDir function** (lines 68-86): copy verbatim — ENOENT swallow at line 73-74 is critical for the `diagnostics/` directory that doesn't exist yet.

**scanFile function** (lines 88-112): copy verbatim — comment-skip logic at lines 96-98 is the reason CI doesn't flag commented-out code.

**Run scan + exit pattern** (lines 114-136): copy verbatim, changing the final console messages to reference `check-observability-no-todo` and `Phase 32 D-32-D1`.

---

### `scripts/check-interval-lifecycle.mjs` (utility/CI, transform)

**Analog:** `scripts/check-no-silent-catch.mjs`

**Same skeleton** as check-observability-no-todo.mjs — shebang, imports, SCAN_DIRS (same three dirs), EXCLUDE patterns, walkDir, run-scan-exit pattern.

**RULES array** differs — two-pass logic for setInterval lifecycle:
```javascript
// Gate: every setInterval( in scanned dirs must be stored in a field.
// Regex 1: detect any setInterval( call
// Regex 2: detect it is stored inline (this.<name> = setInterval(...))
// Lines that match rule 1 but not rule 2 are violations.
// Current state: zero setInterval calls in scanned dirs — gate trivially passes.
// Future enforcement: a setInterval( without `this.<name> =` is a violation.
const RULES = [
    {
        name: 'interval-must-be-stored',
        // Matches: setInterval( without this.<name> = on same line
        re: /(?<!this\.\w+\s*=\s*)setInterval\s*\(/,
    },
];
```

Note: the `walkDir` ENOENT swallow (check-no-silent-catch.mjs line 73-74) applies identically — `grid/src/diagnostics/` does not exist until Wave 0, so both gates must tolerate ENOENT on that path.

---

### `grid/test/firehose-frame-counters.test.ts` (test, event-driven)

**Analog:** `grid/test/audit/firehose-hub.test.ts`

**FakeSocket class** (firehose-hub.test.ts lines 23-56) — copy verbatim. The `throwOnSend = false` flag is the critical test seam; leave it false for the frame-counter tests (successful sends only):
```typescript
class FakeSocket implements ServerSocket {
    bufferedAmount = 0;
    sent: string[] = [];
    closed = false;
    closeArgs: { code?: number; reason?: string } | null = null;
    throwOnSend = false;

    send(data: string): void {
        if (this.throwOnSend) throw new Error('send failed');
        this.sent.push(data);
    }
    close(code?: number, reason?: string): void { ... }
    on(event: EventName, cb: (...args: any[]) => void): void { ... }
    emit(event: 'close'): void { ... }
}
```

**flush helper** (firehose-hub.test.ts line 59):
```typescript
const flush = () => new Promise<void>((r) => queueMicrotask(() => r()));
```

**Imports pattern** (firehose-hub.test.ts lines 14-18):
```typescript
import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { WsFirehoseHub } from '../../src/audit/firehose-hub.js';
import type { ServerSocket } from '../../src/api/ws-hub.js';
```

**Test structure pattern** (firehose-hub.test.ts lines 61-150) — tests are independent (no beforeEach), each creates fresh `AuditChain` + `WsFirehoseHub` + `FakeSocket`. Adapt for Phase 32:

```typescript
it('frames_sent_total increments after successful send', () => {
    const audit = new AuditChain();
    const hub = new WsFirehoseHub(audit, 'test-grid');
    const sock = new FakeSocket();
    hub.onConnect(sock);
    // hello frame already sent — now append an allowlisted event
    audit.append('nous.moved', 'did:noesis:actor', { to: 'r' });
    expect(hub.stats().frames_sent_total).toBe(1);
});

it('frames_dropped_total increments when buffer at capacity', async () => {
    const audit = new AuditChain();
    const hub = new WsFirehoseHub(audit, 'test-grid', 4); // capacity 4
    const sock = new FakeSocket();
    sock.bufferedAmount = 2_000_000; // above watermark, forces buffering
    hub.onConnect(sock);
    // Append 5 events — 4 fill the buffer, 5th triggers drop
    for (let i = 0; i < 5; i++) {
        audit.append('nous.moved', 'did:noesis:actor', { to: `r${i}` });
    }
    await flush();
    expect(hub.stats().frames_dropped_total).toBeGreaterThan(0);
});
```

**Key difference from firehose-hub.test.ts:** tests now call `hub.stats()` (new Phase 32 method) instead of `hub.clientCount`. The `clientCount` getter (firehose-hub.ts line 133) pattern is the model for `stats()` returning a plain object snapshot.

---

### `grid/test/firehose-send-throws.test.ts` (test, event-driven — R-32-03 regression)

**Analog:** `grid/test/audit/firehose-hub.test.ts`

**Same FakeSocket + flush imports** — identical to firehose-frame-counters.test.ts.

**Core test seam:** set `throwOnSend = true` on one socket. The `throwOnSend` flag already exists in FakeSocket (firehose-hub.test.ts line 28-29); the backpressure test at line 135-150 shows how to use `sock.bufferedAmount` to control behavior. For R-32-03, control `throwOnSend` instead:

```typescript
it('frames_sent_total stays 0 when socket.send always throws', async () => {
    const audit = new AuditChain();
    const hub = new WsFirehoseHub(audit, 'test-grid');
    const badSock = new FakeSocket();
    badSock.throwOnSend = true;  // every send() throws
    hub.onConnect(badSock);
    audit.append('nous.moved', 'did:noesis:actor', { to: 'r' });
    expect(hub.stats().frames_sent_total).toBe(0); // R-32-03: counter never incremented
});

it('other clients continue receiving when one throws', async () => {
    const audit = new AuditChain();
    const hub = new WsFirehoseHub(audit, 'test-grid');
    const badSock = new FakeSocket();
    badSock.throwOnSend = true;
    const goodSock = new FakeSocket();
    hub.onConnect(badSock);
    hub.onConnect(goodSock);
    const prevGood = goodSock.sent.length; // count after hello
    audit.append('nous.moved', 'did:noesis:actor', { to: 'r' });
    expect(goodSock.sent.length).toBeGreaterThan(prevGood); // good client still receives
    expect(hub.stats().frames_sent_total).toBe(1); // only good client's send counted
});
```

---

### `grid/test/health-detailed-route.test.ts` (test, request-response)

**Analog:** `grid/test/ws-integration.test.ts`

**buildServerWithHub seam** (ws-integration.test.ts lines 112-125):
```typescript
async function setup(): Promise<void> {
    clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    audit = new AuditChain();
    const services = { clock, space, logos, audit, gridName: 'itest-grid' };
    const built = buildServerWithHub(services);
    app = built.app;
    wsHub = built.wsHub;
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port bound');
    port = addr.port;
}
```

Mirror for health-detailed-route.test.ts — add fakeLauncher to services:
```typescript
async function setup(mockNow: () => number, tick = 100): Promise<void> {
    clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    audit = new AuditChain();
    const fakeAuditReconcile = {
        get lastReconcileAt() { return mockNow() - 1000; },
        get persistedMaxId() { return 42; },
        get lastPersistError() { return null; },
    };
    // Minimal launcher shape — only the Phase 32 surface
    const fakeLauncher = {
        auditReconcile: fakeAuditReconcile,
        get clock() { return { state: { tick, running: true } }; },
        _healthWatchdog: undefined as HealthWatchdog | undefined,
        get healthWatchdog() { return this._healthWatchdog; },
        attachHealthWatchdog(wd: HealthWatchdog) { this._healthWatchdog = wd; },
        attachFirehoseHub(hub: { stats(): FirehoseStats }) {
            this._healthWatchdog?.attachFirehoseStats(() => hub.stats());
        },
    };
    const services = { clock, space, logos, audit, gridName: 'test-grid', launcher: fakeLauncher };
    const built = buildServerWithHub(services);
    app = built.app;
    await app.listen({ port: 0, host: '127.0.0.1' });
    ...
}
```

**beforeEach/afterEach pattern** (ws-integration.test.ts lines 127-143):
```typescript
beforeEach(async () => { await setup(); });
afterEach(async () => {
    try { await app.close(); } catch { /* swallow */ }
    try { clock.stop(); } catch { /* swallow */ }
});
```

Copy verbatim — `app.close()` + `clock.stop()` cleanup is identical.

**HTTP GET test pattern** — ws-integration uses a real `ws` client; health-detailed uses `fetch` or Fastify's `.inject()`. Use `app.inject()` for the parametrized shape tests (no network round-trip, deterministic):
```typescript
it('returns ok shape when tick >= 60', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/detailed' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('number');
    // Shape completeness: all five top-level keys present
    expect(Object.keys(body).sort()).toEqual(['audit', 'clock', 'firehose', 'status', 'timestamp']);
});
```

---

### `grid/test/health-watchdog-transitions.test.ts` (test, unit)

**Analog:** `grid/test/audit-reconcile.test.ts`

**Pino spy pattern** (audit-reconcile.test.ts lines 99-100, 129-130, 163-164):

The confirmed approach from Phase 31 is `vi.spyOn(logger, 'warn').mockImplementation(() => {})` on the imported singleton — Pino child loggers share the prototype warn/info/error reference with the base logger, so the spy intercepts without source-file modification:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { logger } from '../src/util/logger.js';
import { HealthWatchdog, HEALTH_THRESHOLDS } from '../src/diagnostics/health-watchdog.js';
// ...

it('logger.warn fires on ok→degraded transition', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
        const wd = new HealthWatchdog(
            { auditReconcile: undefined, clockState: () => ({ tick: 100, running: true }) },
            { now: () => 1_000_000, snapshotCadenceMs: 30_000 },
        );
        // First snapshot: ok (no reconcile, no clients → grace-like)
        wd.snapshot();
        // Force degraded: inject firehose with stale last_frame_at + clients
        wd.attachFirehoseStats(() => ({
            client_count: 1,
            frames_sent_total: 5,
            frames_dropped_total: 0,
            last_frame_at: 1_000_000 - 120_000, // 120s ago > STALE_FRAME_MS 60s
            watermark_bytes: 0,
        }));
        wd.snapshot();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'health_status_changed', to: 'degraded' }),
            expect.any(String),
        );
    } finally {
        vi.restoreAllMocks();
    }
});
```

**try/finally restoreAllMocks pattern** (audit-reconcile.test.ts lines 99-123): identical wrapper around every spy test — copy verbatim.

**Constants reference in test assertions** (audit-reconcile.test.ts lines 77-81):
```typescript
describe('AuditReconcile constants (D-31-C1/C2)', () => {
    it('REPLAY_BATCH_CAP is 500 and DIVERGENCE_WARN_THRESHOLD is 10', () => {
        expect(REPLAY_BATCH_CAP).toBe(500);
        expect(DIVERGENCE_WARN_THRESHOLD).toBe(10);
    });
});
```

Mirror for Phase 32 — assert `HEALTH_THRESHOLDS` values symbolically:
```typescript
describe('HEALTH_THRESHOLDS (D-32-C1)', () => {
    it('constants have expected locked values', () => {
        expect(HEALTH_THRESHOLDS.DIVERGENCE_DEGRADED).toBe(10);
        expect(HEALTH_THRESHOLDS.DIVERGENCE_CRITICAL).toBe(100);
        expect(HEALTH_THRESHOLDS.STALE_FRAME_MS).toBe(60_000);
        expect(HEALTH_THRESHOLDS.RECONCILE_STALE_MULTIPLIER).toBe(5);
    });
});
```

---

### `grid/src/audit/firehose-hub.ts` (MODIFIED — add metrics + HubMetricsSink)

**Analog:** self — existing patterns extended.

**Existing ClientConnection constructor** (firehose-hub.ts lines 42-46):
```typescript
constructor(socket: ServerSocket, watermarkBytes: number, bufferCapacity: number) {
    this.socket = socket;
    this.watermarkBytes = watermarkBytes;
    this.buffer = new RingBuffer<AuditEntry>(bufferCapacity);
}
```

Phase 32 adds a fourth param — new `HubMetricsSink` interface (D-32-A2):
```typescript
constructor(
    socket: ServerSocket,
    watermarkBytes: number,
    bufferCapacity: number,
    metrics: HubMetricsSink,  // NEW — D-32-A2
) { ... }
```

**Existing trySend** (firehose-hub.ts lines 51-59) — add counter increments AFTER `socket.send`, BEFORE `catch` per D-32-A3:
```typescript
trySend(frame: ServerFrame): void {
    if (this.closed) return;
    try {
        this.socket.send(JSON.stringify(frame));
        this.metrics.incrementSent();   // NEW — D-32-A3
        this.metrics.touchLastFrame();  // NEW — D-32-A3
    } catch {
        // Swallow — same boundary as today; counters never incremented if send threw.
    }
}
```

**Existing enqueue** (firehose-hub.ts lines 66-81) — add size===capacity check BEFORE push per D-32-A1:
```typescript
enqueue(entry: AuditEntry): void {
    if (this.closed) return;
    const canDirectSend = this.buffer.size === 0 && this.socket.bufferedAmount < this.watermarkBytes;
    if (canDirectSend) {
        this.trySend({ type: 'event', entry });
        return;
    }
    // D-32-A1: pre-check for drop BEFORE push
    if (this.buffer.size === this.buffer.capacity) {  // NEW
        this.metrics.incrementDropped();               // NEW
    }
    this.buffer.push(entry);
    this.scheduleDrain();
}
```

**Existing WsFirehoseHub.onConnect** (firehose-hub.ts lines 140-173) — pass callbacks when constructing ClientConnection:
```typescript
const client = new ClientConnection(
    socket,
    this.watermarkBytes,
    this.bufferCapacity,
    {   // NEW HubMetricsSink callbacks — D-32-A2
        incrementSent: () => { this.metrics.frames_sent_total++; },
        incrementDropped: () => { this.metrics.frames_dropped_total++; },
        touchLastFrame: () => { this.metrics.last_frame_at = Date.now(); },
    },
);
```

**WsFirehoseHub class additions** — new private `metrics` field + new `stats()` method:
```typescript
private metrics = {
    frames_sent_total: 0,
    frames_dropped_total: 0,
    last_frame_at: null as number | null,
};

stats(): FirehoseStats {
    return {
        client_count: this._clients.size,
        frames_sent_total: this.metrics.frames_sent_total,
        frames_dropped_total: this.metrics.frames_dropped_total,
        last_frame_at: this.metrics.last_frame_at,
        watermark_bytes: this.watermarkBytes,
    };
}
```

---

### `grid/src/genesis/launcher.ts` (MODIFIED — add _healthWatchdog field + two attach setters)

**Analog:** self — existing `attachRelationshipStorage` and `attachNormStorage` patterns at lines 234-273.

**Existing attach pattern** (launcher.ts lines 234-246):
```typescript
attachRelationshipStorage(pool: Pool): void {
    if (this.relationshipStorage !== null) {
        if (this.relationshipStorage.pool === pool) {
            return;
        }
        throw new Error(
            'GenesisLauncher.attachRelationshipStorage called twice with different pools',
        );
    }
    this.relationshipStorage = new RelationshipStorage(pool);
}
```

Mirror for `attachHealthWatchdog` — one-shot-settable, throw on second call (D-32-G2):
```typescript
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

**`attachFirehoseHub` pattern** (D-32-E1) — structural interface avoids genesis→audit import:
```typescript
attachFirehoseHub(hub: { stats(): FirehoseStats }): void {
    if (this._firehoseHub !== undefined) {
        throw new Error('FirehoseHub already attached');
    }
    this._firehoseHub = hub;
    // Wire stats into watchdog — D-32-E1
    this._healthWatchdog?.attachFirehoseStats(() => hub.stats());
}
```

**Field placement** — new private fields go alongside existing `private relationshipStorage` (line 109) and `private normStorage` (line 122) fields, not inside the constructor.

**Import addition** — add `import type { HealthWatchdog } from '../diagnostics/health-watchdog.js';` alongside existing type imports at lines 14-28. `FirehoseStats` can be imported from audit types to avoid circular dependency.

---

### `grid/src/api/server.ts` (MODIFIED — buildServerWithHub wiring block)

**Analog:** self — existing firehose wiring block at lines 571-576:
```typescript
// Phase 25a: Firehose hub + drift detector (observer-only, no audit writes).
const firehoseHub = new WsFirehoseHub(services.audit, services.gridName);
const driftDetector = new DriftDetector(services.audit);
services.firehoseHub = firehoseHub;
services.driftDetector = driftDetector;
```

Phase 32 adds its block AFTER line 576, BEFORE line 586 (`registerDriftAlertsRoute`):
```typescript
// Phase 32 OBS-06/07: HealthWatchdog + /health/detailed route.
if (services.launcher && typeof services.launcher.attachHealthWatchdog === 'function') {
    const healthWatchdog = new HealthWatchdog(
        {
            auditReconcile: (services.launcher as GenesisLauncher).auditReconcile,
            clockState: () => (services.launcher as GenesisLauncher).clock.state,
        },
    );
    (services.launcher as GenesisLauncher).attachHealthWatchdog(healthWatchdog);
    (services.launcher as GenesisLauncher).attachFirehoseHub(firehoseHub);
    registerHealthDetailedRoute(app, services, services.launcher as GenesisLauncher);
}
```

Or (Option A from research): extend `GridServices.launcher` type to include the full `GenesisLauncher` shape for Phase 32 fields, eliminating the type casts.

**Existing top-level route registration** (server.ts line 586, before WS scope at line 588):
```typescript
registerDriftAlertsRoute(app, services);  // line 586 — existing
// registerHealthDetailedRoute goes HERE (between drift alerts and WS scope)
app.register(async (instance) => {        // line 588 — WS scope, do not touch
```

**GridServices.launcher extension** — current shape (lines 235-237):
```typescript
launcher?: {
    spawnNous(name: string, did: string, publicKey: string, region: string, humanOwner?: string, personalitySeed?: string): void;
};
```

Phase 32 adds Phase 32 surface to this structural type — planner decides between Option A (extend the structural type in-place) and Option B (accept `GenesisLauncher` class directly). Research recommendation: Option A preserves backward compat for all existing tests that don't pass a launcher.

---

### `.github/workflows/rig-invariants.yml` (MODIFIED — add 2 new steps)

**Analog:** self — existing step at lines 27-28:
```yaml
- name: OBS-03 no-silent-catch gate (Phase 31)
  run: node scripts/check-no-silent-catch.mjs
```

Phase 32 adds two steps immediately after line 28 (before the Vitest step):
```yaml
- name: OBS-R-32-01 observability-no-TODO gate (Phase 32)
  run: node scripts/check-observability-no-todo.mjs

- name: OBS-R-32-02 setInterval-lifecycle gate (Phase 32)
  run: node scripts/check-interval-lifecycle.mjs
```

No `working-directory:` needed — both scripts use `process.cwd()` + `join(ROOT, ...)` to build absolute paths, same as check-no-silent-catch.mjs.

---

### `scripts/uat-half-close-socket.mjs` (diagnostic utility)

**Analog:** `scripts/check-no-silent-catch.mjs` (shebang + ESM import pattern only)

**Shebang + import** (check-no-silent-catch.mjs lines 1, 27-29):
```javascript
#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
```

For uat-half-close-socket.mjs — same shebang, different imports:
```javascript
#!/usr/bin/env node
import { WebSocket } from 'ws';
```

**Core script skeleton** from 32-RESEARCH.md WebSocket Half-Close section:
```javascript
const url = process.argv[2] ?? 'ws://localhost:8080/api/v1/audit/firehose';
const ws = new WebSocket(url);
ws.on('open', () => console.log('[half-close] connected'));
ws.on('message', (data) => {
    const frame = JSON.parse(data.toString());
    console.log('[half-close] received:', frame.type);
    if (frame.type === 'hello') {
        console.log('[half-close] terminating (hard close)...');
        ws.terminate();
    }
});
```

---

### `.planning/phases/32-firehose-observability/32-HUMAN-UAT.md` (docs)

**Analog:** `.planning/phases/31-audit-pipeline-persistence/31-HUMAN-UAT.md`

Read the Phase 31 UAT file for exact structure — five steps, each with prerequisites, commands, and expected outcomes. Phase 32 has five UAT steps specified in D-32-D3:
1. `curl -s http://localhost:8080/health/detailed | jq .` — after 60s uptime
2. Poll `/health/detailed` twice 5s apart — assert `frames_sent_total` strictly increases
3. Half-closed socket harness — `node scripts/uat-half-close-socket.mjs`
4. `docker stop noesis-mysql` → degraded → `docker start` → ok
5. `ab -n 1000 -c 10 http://localhost:8080/health/detailed` — p95 < 50ms

Step 0 must include the mandatory deploy step from MEMORY.md: `docker compose build grid && docker compose up -d grid`.

---

## Shared Patterns

### Pino Child Logger
**Source:** `grid/src/util/logger.ts` (singleton) + `grid/src/db/audit-reconcile.ts` lines 29-31 (per-module usage)
**Apply to:** `grid/src/diagnostics/health-watchdog.ts`
```typescript
import { logger as baseLogger } from '../util/logger.js';
const log = baseLogger.child({ module: 'health-watchdog' });
```

### Pino Spy in Tests (vi.spyOn on singleton prototype)
**Source:** `grid/test/audit-reconcile.test.ts` lines 99-100, 129-130, 163-164
**Apply to:** `grid/test/health-watchdog-transitions.test.ts`
```typescript
import { logger } from '../src/util/logger.js';
// ...
const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
try {
    // ... test body ...
} finally {
    vi.restoreAllMocks();
}
```
This pattern intercepts Pino child logger calls without source-file modification because child loggers share the base logger prototype.

### FakeSocket Test Seam
**Source:** `grid/test/audit/firehose-hub.test.ts` lines 23-56
**Apply to:** `grid/test/firehose-frame-counters.test.ts`, `grid/test/firehose-send-throws.test.ts`
```typescript
class FakeSocket implements ServerSocket {
    bufferedAmount = 0;
    sent: string[] = [];
    closed = false;
    throwOnSend = false;         // R-32-03 regression test key flag
    // send/close/on/emit implementations...
}
const flush = () => new Promise<void>((r) => queueMicrotask(() => r()));
```

### One-Shot-Settable Attach Pattern
**Source:** `grid/src/genesis/launcher.ts` lines 234-273 (`attachRelationshipStorage`, `attachNormStorage`)
**Apply to:** New `attachHealthWatchdog()` and `attachFirehoseHub()` methods in launcher.ts
```typescript
attachX(x: X): void {
    if (this._x !== null && this._x !== undefined) {
        throw new Error('GenesisLauncher.attachX called twice');
    }
    this._x = x;
}
```

### Frozen Constants Export
**Source:** `grid/src/db/audit-reconcile.ts` lines 34-37
**Apply to:** `grid/src/diagnostics/health-watchdog.ts` (HEALTH_THRESHOLDS)
```typescript
// Pattern: named export so tests can reference symbolically
export const REPLAY_BATCH_CAP = 500;
// Phase 32 mirror:
export const HEALTH_THRESHOLDS = Object.freeze({ ... } as const);
```

### CI Gate Script Skeleton (walkDir + scanFile + exit)
**Source:** `scripts/check-no-silent-catch.mjs` full file (136 lines)
**Apply to:** `scripts/check-observability-no-todo.mjs`, `scripts/check-interval-lifecycle.mjs`
- walkDir with ENOENT swallow (lines 68-86) — critical, copy verbatim
- scanFile with comment-line skip (lines 88-112) — copy verbatim
- run-scan-exit with violation list (lines 114-136) — copy verbatim, change messages only

### Route Registration Top-Level Pattern
**Source:** `grid/src/api/routes/tick-metrics.ts` lines 18-43
**Apply to:** `grid/src/api/routes/health-detailed.ts`
- Single exported function, `app: FastifyInstance` first param
- Guard with `reply.code()` + early return for missing deps
- Final line returns plain object (Fastify auto-serializes to JSON)

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `grid/src/diagnostics/` (directory) | — | — | No `diagnostics/` directory exists yet; Wave 0 must create it |

The `health-watchdog.ts` file itself has a close enough analog (`audit-reconcile.ts`) to extract all patterns — the missing piece is the directory scaffold only.

---

## Metadata

**Analog search scope:** `grid/src/`, `grid/test/`, `scripts/`, `.github/workflows/`
**Files read:** audit-reconcile.ts, tick-metrics.ts, check-no-silent-catch.mjs, firehose-hub.ts, launcher.ts, firehose-hub.test.ts, ws-integration.test.ts, audit-reconcile.test.ts, server.ts (lines 1-80, 89-244, 560-620), rig-invariants.yml
**Pattern extraction date:** 2026-05-24
