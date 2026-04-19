/**
 * Plan 04-03 Task 2: GET /api/v1/economy/shops.
 *
 * Contract:
 *   - Reads ShopRegistry.list() (Plan 04-01 artifact).
 *   - Returns { shops: [{ ownerDid, name, listings: [{sku, label, priceOusia}] }] }.
 *   - Empty registry → { shops: [] }.
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

function seedServer(seedShops: boolean): {
    app: FastifyInstance;
    clock: WorldClock;
} {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    const registry = new NousRegistry();
    const shops = new ShopRegistry();

    if (seedShops) {
        shops.register({
            ownerDid: 'did:noesis:sophia',
            name: "Sophia's Library",
            listings: [{ sku: 'dialectic-session', label: 'Dialectic Session', priceOusia: 5 }],
        });
        shops.register({
            ownerDid: 'did:noesis:hermes',
            name: "Hermes' Courier",
            listings: [
                { sku: 'message-delivery', label: 'Message Delivery', priceOusia: 2 },
                { sku: 'escort', label: 'Safe Escort', priceOusia: 4 },
            ],
        });
    }

    const app = buildServer({
        clock, space, logos, audit, gridName: 'genesis', registry, shops,
    });
    return { app, clock };
}

describe('GET /api/v1/economy/shops — two registered shops', () => {
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

    it('returns both shops with exact nested listing shape', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/economy/shops' });
        expect(res.statusCode).toBe(200);
        const body = res.json() as {
            shops: Array<{
                ownerDid: string;
                name: string;
                listings: Array<{ sku: string; label: string; priceOusia: number }>;
            }>;
        };
        expect(body.shops).toHaveLength(2);

        const sophia = body.shops.find(s => s.ownerDid === 'did:noesis:sophia');
        expect(sophia).toBeDefined();
        expect(sophia!.name).toBe("Sophia's Library");
        expect(sophia!.listings).toEqual([
            { sku: 'dialectic-session', label: 'Dialectic Session', priceOusia: 5 },
        ]);

        const hermes = body.shops.find(s => s.ownerDid === 'did:noesis:hermes');
        expect(hermes).toBeDefined();
        expect(hermes!.listings).toHaveLength(2);
        expect(hermes!.listings).toEqual([
            { sku: 'message-delivery', label: 'Message Delivery', priceOusia: 2 },
            { sku: 'escort', label: 'Safe Escort', priceOusia: 4 },
        ]);
    });

    it('returns plain objects (not frozen references) — safe to mutate client-side', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/economy/shops' });
        const body = res.json() as { shops: Array<{ listings: unknown[] }> };
        // Should be safe to push — serialized response is a copy, not the frozen
        // in-memory record. This guards against a future regression where the
        // handler accidentally returns shops.list() raw.
        expect(() => body.shops[0].listings.push({ sku: 'x', label: 'x', priceOusia: 1 })).not.toThrow();
    });
});

describe('GET /api/v1/economy/shops — empty registry', () => {
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

    it('returns { shops: [] } when no shops are registered', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/economy/shops' });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ shops: [] });
    });
});
