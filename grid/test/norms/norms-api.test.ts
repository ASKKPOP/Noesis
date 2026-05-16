/**
 * Phase 19 Plan 04 — GET /api/v1/grid/norms endpoint tests.
 *
 * Uses Fastify inject() for HTTP testing without a real MySQL pool.
 * The norms service is a mock that returns controlled rows.
 *
 * Contract:
 *   - 200 + correct shape when norms service present
 *   - evidence_tick_range is [first_seen_tick, crystallized_tick]
 *   - 200 + { norms: [] } when service returns empty array
 *   - Route not registered (404) when services.norms is undefined
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../../src/api/server.js';

function makeBaseServices(): Omit<GridServices, 'norms'> {
    return {
        clock: new WorldClock({ tickRateMs: 100_000 }),
        space: new SpatialMap(),
        logos: new LogosEngine(),
        audit: new AuditChain(),
        gridName: 'test-grid',
    };
}

describe('GET /api/v1/grid/norms', () => {
    describe('with norms service returning one norm', () => {
        let app: FastifyInstance;

        beforeAll(async () => {
            const services: GridServices = {
                ...makeBaseServices(),
                norms: {
                    loadNorms: async (_gridName: string) => [
                        {
                            norm_id: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
                            fingerprint: 'a1b2c3',
                            crystallized_tick: 50,
                            participant_count: 4,
                            convergence_type: 'emergent' as const,
                            first_seen_tick: 30,
                        },
                    ],
                },
            };
            app = buildServer(services);
            await app.ready();
        });

        afterAll(async () => { await app.close(); });

        it('returns 200', async () => {
            const res = await app.inject({ method: 'GET', url: '/api/v1/grid/norms' });
            expect(res.statusCode).toBe(200);
        });

        it('returns correct norm shape', async () => {
            const res = await app.inject({ method: 'GET', url: '/api/v1/grid/norms' });
            const body = res.json();
            expect(body.norms).toHaveLength(1);
            const norm = body.norms[0];
            expect(norm.norm_id).toBe('abc123def456abc123def456abc123def456abc123def456abc123def456abc1');
            expect(norm.fingerprint).toBe('a1b2c3');
            expect(norm.crystallized_tick).toBe(50);
            expect(norm.participant_count).toBe(4);
            expect(norm.convergence_type).toBe('emergent');
        });

        it('returns evidence_tick_range as [first_seen_tick, crystallized_tick]', async () => {
            const res = await app.inject({ method: 'GET', url: '/api/v1/grid/norms' });
            const body = res.json();
            expect(body.norms[0].evidence_tick_range).toEqual([30, 50]);
        });
    });

    describe('with norms service returning empty array', () => {
        let app: FastifyInstance;

        beforeAll(async () => {
            const services: GridServices = {
                ...makeBaseServices(),
                norms: {
                    loadNorms: async (_gridName: string) => [],
                },
            };
            app = buildServer(services);
            await app.ready();
        });

        afterAll(async () => { await app.close(); });

        it('returns 200 with empty norms array', async () => {
            const res = await app.inject({ method: 'GET', url: '/api/v1/grid/norms' });
            expect(res.statusCode).toBe(200);
            expect(res.json()).toEqual({ norms: [] });
        });
    });

    describe('without norms service (route not registered)', () => {
        let app: FastifyInstance;

        beforeAll(async () => {
            const services: GridServices = {
                ...makeBaseServices(),
                // norms deliberately omitted
            };
            app = buildServer(services);
            await app.ready();
        });

        afterAll(async () => { await app.close(); });

        it('returns 404', async () => {
            const res = await app.inject({ method: 'GET', url: '/api/v1/grid/norms' });
            expect(res.statusCode).toBe(404);
        });
    });
});
