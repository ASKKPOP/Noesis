/**
 * Groups & Holdings · Phase 1 — GroupStore persistence contract (MOCK Pool).
 *
 * Verifies the D-GROUP-01/04 seed contract against a vi.fn() Pool (no DB):
 * five founding Businesses inserted idempotently, each emitting exactly one
 * group.founded onto the audit chain only when a row is actually inserted.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { GroupStore } from '../../src/economy/group-store.js';
import { AuditChain } from '../../src/audit/chain.js';

/** Mock Pool: INSERTs report `affectedRows`; SELECTs return `selectRows`. */
function makeMockPool(opts: { affectedRows?: number; selectRows?: unknown[] } = {}): Pool {
    const affectedRows = opts.affectedRows ?? 1;
    const selectRows = opts.selectRows ?? [];
    const query = vi.fn().mockImplementation((sql: string) => {
        if (/^\s*select/i.test(sql)) return Promise.resolve([selectRows, []]);
        return Promise.resolve([{ affectedRows } as ResultSetHeader, []]);
    });
    return { query } as unknown as Pool;
}

describe('GroupStore.seedGenesisGroups (D-GROUP-04)', () => {
    it('seeds 5 Businesses and emits one group.founded each', async () => {
        const pool = makeMockPool({ affectedRows: 1 });
        const audit = new AuditChain();
        const store = new GroupStore(pool, 'genesis');

        const inserted = await store.seedGenesisGroups(audit, 0);

        expect(inserted).toBe(5);
        const founded = audit.query({ eventType: 'group.founded' });
        expect(founded).toHaveLength(5);
        expect(founded.map((e) => e.actorDid).sort()).toEqual([
            'genesis:group:aegis',
            'genesis:group:dynamo',
            'genesis:group:helix',
            'genesis:group:qubit',
            'genesis:group:soma',
        ]);
    });

    it('is idempotent: a 2nd run (INSERT IGNORE → 0 rows) emits no events', async () => {
        const pool = makeMockPool({ affectedRows: 0 });
        const audit = new AuditChain();
        const store = new GroupStore(pool, 'genesis');

        const inserted = await store.seedGenesisGroups(audit, 0);

        expect(inserted).toBe(0);
        expect(audit.query({ eventType: 'group.founded' })).toHaveLength(0);
    });

    it('listGroups maps DB rows to group summaries', async () => {
        const pool = makeMockPool({
            selectRows: [
                { group_id: 'genesis:group:aegis', grid_name: 'genesis', kind: 'business', domain: 'defense', display_name: 'Aegis', crest_path: '/orgs/defense.jpg', ring: 2, sector_deg: '0.00', status: 'active' },
            ],
        });
        const store = new GroupStore(pool, 'genesis');

        const groups = await store.listGroups();

        expect(groups).toHaveLength(1);
        expect(groups[0].groupId).toBe('genesis:group:aegis');
        expect(groups[0].domain).toBe('defense');
        expect(groups[0].displayName).toBe('Aegis');
    });
});
