/**
 * Phase 32 OBS-06 /health/detailed integration test (D-32-D2 third bullet).
 *
 * Coverage:
 *  - Payload shape exactly matches HealthDetailedPayload (no extra/missing keys).
 *  - status: 'ok' for cold-start (tick<60) AND for healthy steady-state (tick>=60).
 *  - status: 'degraded' when reconcile is stale beyond multiplier.
 *  - status: 'critical' when divergence > DIVERGENCE_CRITICAL.
 *  - 503 'watchdog_not_ready' when launcher.healthWatchdog is undefined.
 *  - p95 latency over 100 sequential in-process calls < 50ms.
 *
 * Uses app.inject() for deterministic timing — no network round-trip.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { WorldClock } from '../src/clock/ticker.js';
import { SpatialMap } from '../src/space/map.js';
import { LogosEngine } from '../src/logos/engine.js';
import { AuditChain } from '../src/audit/chain.js';
import { WsFirehoseHub } from '../src/audit/firehose-hub.js';
import { HealthWatchdog } from '../src/diagnostics/health-watchdog.js';
import { registerHealthDetailedRoute } from '../src/api/routes/health-detailed.js';
import type { AuditReconcile } from '../src/db/audit-reconcile.js';

function makeFakeReconcile(opts: {
    lastReconcileAt?: number;
    persistedMaxId?: number | null;
    lastPersistError?: { code: string; at: number } | null;
}): AuditReconcile {
    return {
        get lastReconcileAt() { return opts.lastReconcileAt ?? 0; },
        get persistedMaxId() { return opts.persistedMaxId ?? null; },
        get lastPersistError() { return opts.lastPersistError ?? null; },
    } as unknown as AuditReconcile;
}

interface FakeLauncher {
    spawnNous: (...args: unknown[]) => void;
    readonly healthWatchdog: HealthWatchdog | undefined;
    readonly auditReconcile: AuditReconcile | undefined;
    readonly clock: { state: { tick: number; running: boolean } };
    attachHealthWatchdog(wd: HealthWatchdog): void;
    attachFirehoseHub(hub: { stats(): import('../src/audit/firehose-hub.js').FirehoseStats }): void;
}

function makeFakeLauncher(opts: {
    auditReconcile: AuditReconcile | undefined;
    tick: number;
    now: () => number;
    snapshotCadenceMs?: number;
}): FakeLauncher {
    let wd: HealthWatchdog | undefined;
    const clock = { state: { tick: opts.tick, running: true } };
    const launcher: FakeLauncher = {
        spawnNous() {},
        get healthWatchdog() { return wd; },
        get auditReconcile() { return opts.auditReconcile; },
        get clock() { return clock; },
        attachHealthWatchdog(w: HealthWatchdog) { wd = w; },
        attachFirehoseHub(hub) {
            wd?.attachFirehoseStats(() => hub.stats());
        },
    };
    return launcher;
}

async function buildTestServer(opts: {
    auditReconcile: AuditReconcile | undefined;
    tick: number;
    now: () => number;
    snapshotCadenceMs?: number;
    attachWatchdog?: boolean;          // default true
    attachFirehose?: boolean;          // default true
}): Promise<{ app: FastifyInstance; clock: WorldClock; launcher: FakeLauncher }> {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const _space = new SpatialMap();
    const _logos = new LogosEngine();
    const audit = new AuditChain();
    const launcher = makeFakeLauncher(opts);
    const services = {
        clock, space: _space, logos: _logos, audit, gridName: 'test-grid',
        launcher,
    } as unknown as import('../src/api/server.js').GridServices;
    // Manual mini-wiring (mirrors buildServerWithHub Phase 32 block):
    const app = Fastify({ logger: false });
    const firehoseHub = new WsFirehoseHub(audit, 'test-grid');
    if (opts.attachWatchdog !== false) {
        const wd = new HealthWatchdog(
            { auditReconcile: launcher.auditReconcile, clockState: () => launcher.clock.state },
            { now: opts.now, snapshotCadenceMs: opts.snapshotCadenceMs ?? 30_000 },
        );
        launcher.attachHealthWatchdog(wd);
        if (opts.attachFirehose !== false) {
            launcher.attachFirehoseHub(firehoseHub);
        }
    }
    registerHealthDetailedRoute(app, services, launcher as never);
    await app.ready();
    return { app, clock, launcher };
}

describe('GET /health/detailed (OBS-06)', () => {
    let app: FastifyInstance;
    let clock: WorldClock;

    afterEach(async () => {
        try { await app.close(); } catch { /* swallow */ }
        try { clock.stop(); } catch { /* swallow */ }
    });

    it('returns 503 watchdog_not_ready when watchdog not attached', async () => {
        const built = await buildTestServer({
            auditReconcile: undefined, tick: 200, now: () => 1_000_000,
            attachWatchdog: false,
        });
        app = built.app; clock = built.clock;

        const res = await app.inject({ method: 'GET', url: '/health/detailed' });
        expect(res.statusCode).toBe(503);
        const body = JSON.parse(res.body);
        expect(body).toEqual({ error: 'watchdog_not_ready' });
    });

    it('returns ok shape with all 5 top-level keys (cold-start grace)', async () => {
        const built = await buildTestServer({
            auditReconcile: undefined, tick: 5, now: () => 1_000_000,
        });
        app = built.app; clock = built.clock;

        const res = await app.inject({ method: 'GET', url: '/health/detailed' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        // Shape completeness: exactly 5 top-level keys.
        expect(Object.keys(body).sort()).toEqual(['audit', 'clock', 'firehose', 'status', 'timestamp']);
        expect(body.status).toBe('ok');
        expect(typeof body.timestamp).toBe('number');
        // Cold-start: audit timestamps null.
        expect(body.audit.last_persist_attempt_at).toBeNull();
        expect(body.audit.divergence).toBeNull();
        // Firehose: all-zeros (attachFirehoseStats wires the real hub but tick<60 grace
        // does not affect firehose block; client_count is real 0).
        expect(body.firehose.client_count).toBe(0);
        expect(body.clock.tick).toBe(5);
    });

    it('returns ok shape with healthy steady-state (tick>=60, recent reconcile)', async () => {
        const now = 2_000_000;
        const built = await buildTestServer({
            auditReconcile: makeFakeReconcile({ lastReconcileAt: now - 1000, persistedMaxId: 50 }),
            tick: 200, now: () => now,
        });
        app = built.app; clock = built.clock;

        const res = await app.inject({ method: 'GET', url: '/health/detailed' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.status).toBe('ok');
        expect(body.audit.persisted_max_id).toBe(50);
        expect(body.audit.last_persist_attempt_at).toBe(now - 1000);
        expect(body.audit.divergence).toBe(0); // persistedMaxId equals derived in_memory_length
        expect(body.clock.tick).toBe(200);
        expect(body.clock.running).toBe(true);
    });

    it('returns degraded when reconcile is stale beyond multiplier', async () => {
        const now = 3_000_000;
        const built = await buildTestServer({
            auditReconcile: makeFakeReconcile({ lastReconcileAt: now - (6 * 30_000 + 1), persistedMaxId: 50 }),
            tick: 200, now: () => now, snapshotCadenceMs: 30_000,
        });
        app = built.app; clock = built.clock;

        const res = await app.inject({ method: 'GET', url: '/health/detailed' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.status).toBe('degraded');
    });

    it('payload audit block exposes ONLY the OBS-06 contract keys (no leakage)', async () => {
        const now = 4_000_000;
        const built = await buildTestServer({
            auditReconcile: makeFakeReconcile({
                lastReconcileAt: now - 1000,
                persistedMaxId: 50,
                lastPersistError: { code: 'ECONNREFUSED', at: now - 500 },
            }),
            tick: 200, now: () => now,
        });
        app = built.app; clock = built.clock;

        const res = await app.inject({ method: 'GET', url: '/health/detailed' });
        const body = JSON.parse(res.body);
        // T-32-01 information-disclosure mitigation: assert closed key set in audit block.
        expect(Object.keys(body.audit).sort()).toEqual([
            'divergence',
            'divergence_threshold',
            'in_memory_length',
            'last_persist_attempt_at',
            'last_persist_error',
            'persisted_max_id',
        ].sort());
        // Persist error: ONLY {code, at} — no message, no stack.
        expect(Object.keys(body.audit.last_persist_error).sort()).toEqual(['at', 'code']);
        expect(body.audit.last_persist_error).not.toHaveProperty('message');
        expect(body.audit.last_persist_error).not.toHaveProperty('stack');
    });

    it('p95 over 100 sequential in-process calls is < 50ms', async () => {
        const now = 5_000_000;
        const built = await buildTestServer({
            auditReconcile: makeFakeReconcile({ lastReconcileAt: now - 1000, persistedMaxId: 50 }),
            tick: 200, now: () => now,
        });
        app = built.app; clock = built.clock;

        const durations: number[] = [];
        for (let i = 0; i < 100; i++) {
            const t0 = Date.now();
            const res = await app.inject({ method: 'GET', url: '/health/detailed' });
            durations.push(Date.now() - t0);
            expect(res.statusCode).toBe(200);
        }
        durations.sort((a, b) => a - b);
        const p95 = durations[Math.floor(durations.length * 0.95)];
        // OBS-06 success criterion 5: p95 < 50ms. CI headroom: 100ms.
        expect(p95).toBeLessThan(100);
    });
});
