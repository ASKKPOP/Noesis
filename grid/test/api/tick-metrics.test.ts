/**
 * Plan 25a-04 Task 2: GET /api/v1/nous/:did/tick-metrics
 *
 * Contract:
 *   400 — invalid DID
 *   404 — unknown_nous (no runner for DID)
 *   200 — {p50, p95, queue_depth, sample_count} when runner exists
 *   200 — {p50: 0, p95: 0, sample_count: 0} when runner has no samples
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';
import type { InspectorRunner } from '../../src/api/server.js';

const NOUS_DID = 'did:noesis:nous01';
const GRID_NAME = 'genesis';

interface FakeMetricsRunner extends InspectorRunner {
    getTickMetrics(): { p50: number; p95: number; queue_depth: number; sample_count: number };
}

function buildTestServer(runnerMap: Map<string, FakeMetricsRunner>): { app: FastifyInstance } {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();

    const app = buildServer({
        clock,
        space,
        logos,
        audit,
        gridName: GRID_NAME,
        getRunner: (did) => runnerMap.get(did),
    });

    return { app };
}

describe('GET /api/v1/nous/:did/tick-metrics — 400 on invalid DID', () => {
    let app: FastifyInstance;

    beforeAll(() => {
        ({ app } = buildTestServer(new Map()));
        return app.ready();
    });

    afterAll(async () => { try { await app?.close(); } catch { /* swallow */ } });

    it('returns 400 for non-DID string', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/nous/not-a-did/tick-metrics',
        });
        expect(res.statusCode).toBe(400);
        expect(res.json<{ error: string }>().error).toBe('invalid_did');
    });
});

describe('GET /api/v1/nous/:did/tick-metrics — 404 on unknown nous', () => {
    let app: FastifyInstance;

    beforeAll(() => {
        ({ app } = buildTestServer(new Map()));
        return app.ready();
    });

    afterAll(async () => { try { await app?.close(); } catch { /* swallow */ } });

    it('returns 404 when no runner registered for DID', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/nous/${NOUS_DID}/tick-metrics`,
        });
        expect(res.statusCode).toBe(404);
        expect(res.json<{ error: string }>().error).toBe('unknown_nous');
    });
});

describe('GET /api/v1/nous/:did/tick-metrics — 200 with samples', () => {
    let app: FastifyInstance;

    beforeAll(() => {
        const runner: FakeMetricsRunner = {
            connected: true,
            async getState() { return {}; },
            getTickMetrics() {
                return { p50: 12.5, p95: 18.3, queue_depth: 0, sample_count: 10 };
            },
        };
        const map = new Map([[NOUS_DID, runner]]);
        ({ app } = buildTestServer(map));
        return app.ready();
    });

    afterAll(async () => { try { await app?.close(); } catch { /* swallow */ } });

    it('returns 200 with numeric metric fields', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/nous/${NOUS_DID}/tick-metrics`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<{ p50: number; p95: number; queue_depth: number; sample_count: number }>();
        expect(body.p50).toBeTypeOf('number');
        expect(body.p95).toBeTypeOf('number');
        expect(body.queue_depth).toBeTypeOf('number');
        expect(body.sample_count).toBe(10);
    });
});

describe('GET /api/v1/nous/:did/tick-metrics — 200 with no samples', () => {
    let app: FastifyInstance;

    beforeAll(() => {
        const runner: FakeMetricsRunner = {
            connected: true,
            async getState() { return {}; },
            getTickMetrics() {
                return { p50: 0, p95: 0, queue_depth: 0, sample_count: 0 };
            },
        };
        const map = new Map([[NOUS_DID, runner]]);
        ({ app } = buildTestServer(map));
        return app.ready();
    });

    afterAll(async () => { try { await app?.close(); } catch { /* swallow */ } });

    it('returns 200 with zeros when no samples yet', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/nous/${NOUS_DID}/tick-metrics`,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<{ p50: number; p95: number; sample_count: number }>();
        expect(body.p50).toBe(0);
        expect(body.p95).toBe(0);
        expect(body.sample_count).toBe(0);
    });
});
