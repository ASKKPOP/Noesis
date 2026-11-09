/**
 * BrainTokenStore.getByDid must return the owner. The lookup once omitted the
 * operator_did column, so every Brain read as unclaimed and
 * GET /api/v1/operator/me/brain-settings answered 403 brain_not_claimed for all of them.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { BrainTokenStore } from '../../src/db/stores/brain-token-store.js';

const ROW = { brain_did: 'did:noesis:hermes', public_key_jwk: '{"kty":"OKP"}', issued_at: 1, expires_at: 2, revoked: 0 };

function storeReturning(row: Record<string, unknown>) {
    // Like MySQL, hand back only the columns the statement selected.
    const query = vi.fn(async (sql: string) => {
        const cols = /SELECT([\s\S]*?)FROM/i.exec(sql)![1].split(',').map((c) => c.trim());
        return [[Object.fromEntries(cols.map((c) => [c, row[c]]))], {}];
    });
    return new BrainTokenStore({ gridName: 'genesis', pool: { query } as unknown as Pool });
}

describe('BrainTokenStore.getByDid — owner', () => {
    it('returns the operator that owns the Brain', async () => {
        const rec = await storeReturning({ ...ROW, operator_did: 'did:noesis:human:email:op' }).getByDid(ROW.brain_did);
        expect(rec?.operatorDid).toBe('did:noesis:human:email:op');
    });

    it('returns null for an unclaimed Brain', async () => {
        const rec = await storeReturning({ ...ROW, operator_did: null }).getByDid(ROW.brain_did);
        expect(rec?.operatorDid).toBeNull();
    });
});
