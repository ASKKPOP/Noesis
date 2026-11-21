/**
 * D-V3-40 — a Grid's identity is never assigned; it is read from the audit chain.
 * The profile must match a hand count on a fixture chain.
 */
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { gridProfile, activityOf, ACTIVITIES } from '../../src/identity/grid-profile.js';
import { ALLOWLIST } from '../../src/audit/broadcast-allowlist.js';
import { registerGridProfileRoute } from '../../src/api/routes/grid-profile.js';
import type { GridServices } from '../../src/api/server.js';

const chainOf = (events: string[]) => ({ length: events.length, at: (i: number) => (events[i] === undefined ? undefined : { eventType: events[i] }) });
const rep = (e: string, n: number): string[] => Array.from({ length: n }, () => e);

describe('activityOf', () => {
    it('sorts recorded actions into what the Nous were doing', () => {
        expect(activityOf('trade.settled')).toBe('trade');
        expect(activityOf('market.listed')).toBe('trade');
        expect(activityOf('library.entry_added')).toBe('knowledge');
        expect(activityOf('zoning.structure_built')).toBe('making');
        expect(activityOf('procurement.bid_placed')).toBe('making');
        expect(activityOf('ballot.cast')).toBe('civic');
        expect(activityOf('zoning.zone_set_changed')).toBe('civic');
        expect(activityOf('nous.spoke')).toBe('social');
        expect(activityOf('zoning.parcel_purchased')).toBe('settling');
    });

    it('leaves substrate bookkeeping out of the profile', () => {
        for (const e of ['grid.started', 'operator.paused', 'portal.account_created', 'treasury.upkeep_collected', 'bios.birth', 'nous.sleep.entered', 'chronos.tick', 'nonsense']) {
            expect(activityOf(e)).toBeNull();
        }
    });

    it('every activity is reachable from a real allowlisted event', () => {
        const seen = new Set([...ALLOWLIST].map(activityOf).filter(Boolean));
        expect([...seen].sort()).toEqual([...ACTIVITIES].sort());
    });
});

describe('gridProfile', () => {
    it('matches a hand count on a fixture chain', () => {
        // 10 counted actions: 4 trade, 3 knowledge, 2 civic, 1 social — plus 3 that do not count.
        const events = [
            ...rep('trade.settled', 3), 'grid.started', 'market.listed',
            ...rep('library.entry_added', 2), 'skill.learned', 'operator.paused',
            'ballot.cast', 'gov.law_enacted', 'treasury.stipend_paid', 'nous.spoke',
        ];
        const p = gridProfile(chainOf(events), 100);
        expect(p.actions).toBe(10);
        expect(p.activities).toEqual([
            { activity: 'trade', count: 4, share: 0.4 },
            { activity: 'knowledge', count: 3, share: 0.3 },
            { activity: 'civic', count: 2, share: 0.2 },
            { activity: 'social', count: 1, share: 0.1 },
        ]);
        expect(p.previous).toBeNull();
    });

    it('shows drift: the newest window against the one before it', () => {
        // Older: 4 knowledge. Newer: 3 trade + 1 knowledge. Nobody assigned either.
        const p = gridProfile(chainOf([...rep('library.entry_added', 4), ...rep('trade.settled', 3), 'lore.written']), 4);
        expect(p.activities.map((a) => [a.activity, a.share])).toEqual([['trade', 0.75], ['knowledge', 0.25]]);
        expect(p.previous).toEqual([{ activity: 'knowledge', count: 4, share: 1 }]);
    });

    it('gives no previous window until a whole one exists', () => {
        const p = gridProfile(chainOf([...rep('trade.settled', 5)]), 4);
        expect(p.actions).toBe(4);
        expect(p.previous).toBeNull();
    });

    it('an empty chain has no identity yet', () => {
        expect(gridProfile(chainOf([]))).toMatchObject({ actions: 0, activities: [], previous: null });
    });
});

describe('GET /api/v1/grid/profile', () => {
    it('serves the projection of the live chain, counts only', async () => {
        const audit = new AuditChain();
        audit.append('trade.settled', 'did:noesis:a', { secret_note: 'x' });
        audit.append('ballot.cast', 'did:noesis:b', {});
        const app = Fastify();
        registerGridProfileRoute(app, { audit, gridName: 'Genesis' } as unknown as GridServices);
        const res = await app.inject({ method: 'GET', url: '/api/v1/grid/profile' });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ grid: 'Genesis', actions: 2, previous: null });
        expect(res.body).not.toMatch(/did:noesis|secret_note/);
        await app.close();
    });
});
