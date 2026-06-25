/**
 * Join-a-Grid S2 — NousSponsorStore (Type A pairing). A human owns/sponsors a Nous.
 * Private portal record; mock-pool unit tests (no DB).
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { NousSponsorStore } from '../../src/economy/nous-sponsor-store.js';

function pool(rows: unknown[] = []): Pool {
    return { query: vi.fn().mockResolvedValue([rows as RowDataPacket[], {}]) } as unknown as Pool;
}
const calls = (p: Pool) => (p.query as ReturnType<typeof vi.fn>).mock.calls;

describe('NousSponsorStore', () => {
    it('claim INSERTs the pairing with human + nous (idempotent ON DUPLICATE)', async () => {
        const p = pool();
        await new NousSponsorStore(p).claim('genesis', 'did:noesis:human:h1', 'did:noesis:nous:alice', 5);
        const [sql, params] = calls(p)[0];
        expect(sql).toMatch(/INSERT INTO nous_sponsors/i);
        expect(sql).toMatch(/ON DUPLICATE KEY UPDATE/i);
        expect((params as unknown[]).map(String)).toEqual(
            expect.arrayContaining(['genesis', 'did:noesis:human:h1', 'did:noesis:nous:alice']),
        );
    });

    it('sponsorsOf returns the owned Nous existence-DIDs', async () => {
        const p = pool([{ nous_did: 'did:noesis:nous:alice' }, { nous_did: 'did:noesis:nous:bob' }]);
        expect(await new NousSponsorStore(p).sponsorsOf('genesis', 'did:noesis:human:h1'))
            .toEqual(['did:noesis:nous:alice', 'did:noesis:nous:bob']);
    });

    it('sponsorOf returns the owner human, or null', async () => {
        expect(await new NousSponsorStore(pool([{ human_did: 'did:noesis:human:h1' }])).sponsorOf('genesis', 'n')).toBe('did:noesis:human:h1');
        expect(await new NousSponsorStore(pool([])).sponsorOf('genesis', 'n')).toBeNull();
    });

    it('owns is true only when a matching row exists', async () => {
        expect(await new NousSponsorStore(pool([{ '1': 1 }])).owns('genesis', 'h', 'n')).toBe(true);
        expect(await new NousSponsorStore(pool([])).owns('genesis', 'h', 'n')).toBe(false);
    });
});
