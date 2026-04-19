/**
 * Plan 04-03 Task 2: GET /api/v1/economy/trades.
 *
 * Contract:
 *   - Default limit=20, max=100, invalid → default. Negative offset → 0.
 *   - Source: audit.query({ eventType: 'trade.settled', limit, offset })
 *   - Row shape EXACTLY { actorDid, counterparty, amount, nonce, timestamp }.
 *   - Privacy: no `text`, `name`, `tick` keys leak (T-04-14).
 *   - W2 CONTRACT: timestamp is Unix INTEGER SECONDS (< 10_000_000_000).
 *     AuditEntry.createdAt is ms (Date.now), so mapper must divide by 1000.
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

// Seed N trade.settled entries at controlled timestamps.
// We use AuditChain.append which sets createdAt = Date.now() (ms), so we
// can't directly control timestamps. Instead, for the W2 contract test we
// assert the mapper emits a value < 10_000_000_000 (seconds-range) regardless
// of the underlying entry's ms units.
function seedAuditChainWithTrades(audit: AuditChain, n: number): void {
    for (let i = 0; i < n; i++) {
        // Append NON-trade noise too so the filter is exercised.
        if (i % 3 === 0) {
            audit.append('nous.spoke', `did:noesis:x${i}`, {
                name: 'X', channel: 'agora', text: 'hello world', tick: i,
            });
        }
        audit.append('trade.settled', `did:noesis:seller${i}`, {
            counterparty: `did:noesis:buyer${i}`,
            amount: i + 1,
            nonce: `n-${i}`,
        });
    }
}

function seedServer(): {
    app: FastifyInstance;
    clock: WorldClock;
    audit: AuditChain;
} {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    const registry = new NousRegistry();
    const shops = new ShopRegistry();

    const app = buildServer({
        clock, space, logos, audit, gridName: 'genesis', registry, shops,
    });
    return { app, clock, audit };
}

describe('GET /api/v1/economy/trades — defaults and clamps', () => {
    let app: FastifyInstance;
    let clock: WorldClock;
    let audit: AuditChain;

    beforeAll(async () => {
        ({ app, clock, audit } = seedServer());
        seedAuditChainWithTrades(audit, 25);
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        clock.stop();
    });

    it('defaults to limit=20 when no query string is provided', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/economy/trades' });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { trades: unknown[]; total: number };
        expect(body.trades).toHaveLength(20);
        expect(body.total).toBe(25);
    });

    it('clamps limit at 100 even when a larger value is requested', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/economy/trades?limit=9999',
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { trades: unknown[]; total: number };
        // Only 25 entries exist, so trades.length = min(25, 100) = 25.
        expect(body.trades).toHaveLength(25);
    });

    it('treats invalid/negative limit as the default (20)', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/economy/trades?limit=-5',
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as { trades: unknown[] };
        expect(body.trades).toHaveLength(20);
    });

    it('applies offset correctly', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/economy/trades?limit=5&offset=10',
        });
        expect(res.statusCode).toBe(200);
        const body = res.json() as {
            trades: Array<{ actorDid: string; counterparty: string; amount: number; nonce: string }>;
        };
        expect(body.trades).toHaveLength(5);
        // 11th trade.settled entry (0-indexed 10) → seller10, nonce n-10
        expect(body.trades[0].nonce).toBe('n-10');
        expect(body.trades[0].actorDid).toBe('did:noesis:seller10');
    });
});

describe('GET /api/v1/economy/trades — privacy invariant (T-04-14)', () => {
    let app: FastifyInstance;
    let clock: WorldClock;

    beforeAll(async () => {
        const seeded = seedServer();
        app = seeded.app;
        clock = seeded.clock;
        seedAuditChainWithTrades(seeded.audit, 5);
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        clock.stop();
    });

    it('each trade row exposes EXACTLY the 5-key allowlist — no field leaks', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/economy/trades' });
        const body = res.json() as { trades: Array<Record<string, unknown>> };
        expect(body.trades.length).toBeGreaterThan(0);
        for (const trade of body.trades) {
            expect(Object.keys(trade).sort()).toEqual(
                ['actorDid', 'amount', 'counterparty', 'nonce', 'timestamp'],
            );
        }
    });
});

describe('GET /api/v1/economy/trades — W2 timestamp contract', () => {
    let app: FastifyInstance;
    let clock: WorldClock;

    beforeAll(async () => {
        const seeded = seedServer();
        app = seeded.app;
        clock = seeded.clock;
        seedAuditChainWithTrades(seeded.audit, 3);
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        clock.stop();
    });

    it('emits timestamp in Unix seconds (W2 contract)', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/economy/trades' });
        const body = res.json() as { trades: Array<{ timestamp: number }>; total: number };
        expect(body.trades.length).toBeGreaterThan(0);
        for (const row of body.trades) {
            expect(Number.isInteger(row.timestamp)).toBe(true);
            expect(row.timestamp).toBeLessThan(10_000_000_000); // < 10^10 ⇒ seconds, not ms
            expect(row.timestamp).toBeGreaterThan(1_000_000_000); // > 10^9 ⇒ sanity (post-2001)
        }
    });
});

describe('GET /api/v1/economy/trades — empty chain', () => {
    let app: FastifyInstance;
    let clock: WorldClock;

    beforeAll(async () => {
        const seeded = seedServer();
        app = seeded.app;
        clock = seeded.clock;
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        clock.stop();
    });

    it('returns { trades: [], total: 0 } when no trade.settled entries exist', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/v1/economy/trades' });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ trades: [], total: 0 });
    });
});
