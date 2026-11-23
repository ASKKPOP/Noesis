/**
 * D-MONEY-10 — the launcher runs one round of the civic duty every 60 ticks, in LIFETIME
 * periods: the ticks of every earlier run count, so a restart neither delays a period nor
 * repeats one. The count is handed in after the stored chain is restored (main.ts).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { GenesisLauncher } from '../../src/genesis/launcher.js';
import type { GenesisConfig } from '../../src/genesis/types.js';
import { EARTH_ORBIT } from '../../src/registry/grid-environments.js';
import { CIVIC_DUTY_PERIOD_TICKS } from '../../src/civic/founding-law.js';

function config(): GenesisConfig {
    return {
        gridName: 'test-grid', gridDomain: 'test.noesis', environment: EARTH_ORBIT,
        tickRateMs: 1_000_000, ticksPerEpoch: 25,
        regions: [{ id: 'agora', name: 'Agora', description: 'square', regionType: 'public', capacity: 50, properties: {} }],
        connections: [], laws: [], economy: {}, seedNous: [],
    } as unknown as GenesisConfig;
}

const settle = async () => { for (let i = 0; i < 6; i++) await new Promise<void>((r) => setImmediate(r)); };
const P = CIVIC_DUTY_PERIOD_TICKS;

function recorder() {
    const sql: Array<{ q: string; params: unknown[] }> = [];
    const query = vi.fn().mockImplementation((q: string, params: unknown[] = []) => {
        sql.push({ q: String(q), params });
        return Promise.resolve([String(q).includes('civic_did_registry') ? [{ civic_did: 'did:civic:noesis:aaa' }] : [], {}]);
    });
    return { sql, pool: { query } as unknown as Pool };
}

describe('the launcher and the civic duty', () => {
    let launcher: GenesisLauncher;
    afterEach(() => launcher.stop());

    it('runs a round every 60 ticks and not in between', async () => {
        launcher = new GenesisLauncher(config());
        const r = recorder();
        launcher.bootstrap({ skipSeedNous: true });
        launcher.attachRelationshipStorage(r.pool);
        for (let i = 0; i < 59; i++) launcher.clock.advance();
        await settle();
        expect(r.sql.some((c) => c.q.includes('civic_did_registry'))).toBe(false);
        launcher.clock.advance();                                         // tick 60
        await settle();
        expect(r.sql.filter((c) => c.q.includes('civic_did_registry'))).toHaveLength(1);
    });

    it('counts periods from the ticks of earlier runs it is given', async () => {
        launcher = new GenesisLauncher(config());
        const r = recorder();
        launcher.bootstrap({ skipSeedNous: true });
        launcher.setCivicDutyLifetimeStart(3 * P + 500);                  // the chain restored after bootstrap
        launcher.attachRelationshipStorage(r.pool);
        for (let i = 0; i < 60; i++) launcher.clock.advance();
        await settle();
        const who = r.sql.find((c) => c.q.includes('civic_did_registry'))!;
        expect(who.params).toEqual(['test-grid', 'p3']);
        const insert = r.sql.find((c) => c.q.includes('INSERT INTO civic_dues'))!;
        expect(insert.params).toContain('did:civic:noesis:aaa');          // the civic identity, not a registry name
        expect(insert.params).toContain('p3');
        expect(insert.params).toContain(3 * P + 500 + 60 + P);            // the deadline is a lifetime tick
        const sweep = r.sql.find((c) => c.q.includes("status = 'assessed' AND due_tick <"))!;
        expect(sweep.params).toEqual(['test-grid', 3 * P + 560]);
    });

    it('without that count a restarted Grid would start again at the first period', async () => {
        launcher = new GenesisLauncher(config());
        const r = recorder();
        launcher.bootstrap({ skipSeedNous: true });
        launcher.attachRelationshipStorage(r.pool);
        for (let i = 0; i < 60; i++) launcher.clock.advance();
        await settle();
        expect(r.sql.find((c) => c.q.includes('civic_did_registry'))!.params).toEqual(['test-grid', 'p0']);
    });
});
