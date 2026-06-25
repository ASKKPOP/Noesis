/**
 * Join-a-Grid S3 — GridRecommendationStore. A User recommends a Grid to their owned
 * Nous (advisory). Private portal record; mock-pool unit tests (no DB).
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { GridRecommendationStore } from '../../src/economy/grid-recommendation-store.js';

function pool(rows: unknown[] = []): Pool {
    return { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
}
const calls = (p: Pool) => (p.query as ReturnType<typeof vi.fn>).mock.calls;

describe('GridRecommendationStore', () => {
    it('recommend INSERTs a pending row (re-arm on duplicate) and returns a uuid', async () => {
        const p = pool();
        const id = await new GridRecommendationStore(p).recommend({
            gridName: 'genesis', humanDid: 'did:noesis:human:h1', nousDid: 'did:noesis:nous:alice', targetGridId: 'genesis', tick: 5,
        });
        expect(id).toMatch(/^[0-9a-f-]{36}$/i);
        const [sql, params] = calls(p)[0];
        expect(sql).toMatch(/INSERT INTO grid_join_recommendations/i);
        expect(sql).toMatch(/ON DUPLICATE KEY UPDATE status = 'pending'/i);
        expect((params as unknown[]).map(String)).toEqual(
            expect.arrayContaining(['genesis', 'did:noesis:human:h1', 'did:noesis:nous:alice', 'genesis']),
        );
    });

    it('pendingForNous selects only pending rows for that Nous', async () => {
        const p = pool([{ recommendation_id: 'r1', nous_did: 'did:noesis:nous:alice', target_grid_id: 'moon', status: 'pending' }]);
        const out = await new GridRecommendationStore(p).pendingForNous('genesis', 'did:noesis:nous:alice');
        expect(out[0].target_grid_id).toBe('moon');
        const [sql, params] = calls(p)[0];
        expect(sql).toMatch(/WHERE grid_name = \? AND nous_did = \? AND status = 'pending'/i);
        expect((params as unknown[]).map(String)).toEqual(expect.arrayContaining(['genesis', 'did:noesis:nous:alice']));
    });

    it('markSeen flips status to seen', async () => {
        const p = pool();
        await new GridRecommendationStore(p).markSeen('genesis', 'r1');
        expect(calls(p)[0][0]).toMatch(/UPDATE grid_join_recommendations SET status = 'seen'/i);
    });
});
