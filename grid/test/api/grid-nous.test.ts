/**
 * Plan 04-03 Task 1: GET /api/v1/grid/nous — roster endpoint.
 *
 * Contract: returns { nous: NousRosterEntry[] } where each entry is
 * { did, name, region, ousia, lifecyclePhase, reputation, status } sourced
 * from registry.active(). No pagination — rosters are small.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { ShopRegistry } from '../../src/economy/shop-registry.js';
import type { FastifyInstance } from 'fastify';

function seedServer(seedNous: boolean): {
    app: FastifyInstance;
    clock: WorldClock;
    registry: NousRegistry;
} {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    const registry = new NousRegistry();
    const shops = new ShopRegistry();

    if (seedNous) {
        registry.spawn(
            { name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk-s', region: 'agora' },
            'genesis.grid', 0, 500,
        );
        registry.spawn(
            { name: 'Hermes', did: 'did:noesis:hermes', publicKey: 'pk-h', region: 'market' },
            'genesis.grid', 0, 500,
        );
        registry.spawn(
            { name: 'Themis', did: 'did:noesis:themis', publicKey: 'pk-t', region: 'council' },
            'genesis.grid', 0, 500,
        );
    }

    const app = buildServer({
        clock, space, logos, audit, gridName: 'genesis', registry, shops,
    });
    return { app, clock, registry };
}

describe('GET /api/v1/grid/nous — roster with three Nous', () => {
    let app: FastifyInstance;
    let clock: WorldClock;

    beforeAll(async () => {
        ({ app, clock } = seedServer(true));
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        clock.stop();
    });

    it('returns { nous: [...] } with exactly three entries', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/grid/nous' });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { nous: unknown[] };
        expect(Array.isArray(body.nous)).toBe(true);
        expect(body.nous).toHaveLength(3);
    });

    it('every entry carries all 7 required fields with correct types', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/grid/nous' });
        const body = res.json() as {
            nous: Array<{
                did: string;
                name: string;
                region: string;
                ousia: number;
                lifecyclePhase: string;
                reputation: number;
                status: string;
            }>;
        };
        for (const entry of body.nous) {
            expect(typeof entry.did).toBe('string');
            expect(typeof entry.name).toBe('string');
            expect(typeof entry.region).toBe('string');
            expect(typeof entry.ousia).toBe('number');
            expect(typeof entry.lifecyclePhase).toBe('string');
            expect(typeof entry.reputation).toBe('number');
            expect(typeof entry.status).toBe('string');
        }
        const dids = body.nous.map(e => e.did).sort();
        expect(dids).toEqual([
            'did:noesis:hermes',
            'did:noesis:sophia',
            'did:noesis:themis',
        ]);
    });
});

describe('GET /api/v1/grid/nous — empty roster', () => {
    let app: FastifyInstance;
    let clock: WorldClock;

    beforeAll(async () => {
        ({ app, clock } = seedServer(false));
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        clock.stop();
    });

    it('returns { nous: [] } for an empty registry', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/grid/nous' });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { nous: unknown[] };
        expect(body.nous).toEqual([]);
    });
});
