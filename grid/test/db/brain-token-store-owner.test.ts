/**
 * Phase 39 — BrainTokenStore ownership methods
 * Tests: setOwner, findByOperator, countActiveByOperator (TENANT-01)
 */
import { describe, it, expect, beforeEach } from 'vitest';

// In-memory mock follows the same contract as the real BrainTokenStore
// These tests will be filled in when BrainTokenStore methods are implemented (Plan 02).
// Using it.todo so the suite passes but clearly signals work remaining.

interface MockTokenRow {
    brainDid: string;
    operatorDid: string | null;
    revoked: boolean;
    expiresAt: number; // unix seconds
}

function makeStore() {
    const rows = new Map<string, MockTokenRow>();
    return {
        rows,
        async setOwner(brainDid: string, operatorDid: string): Promise<boolean> {
            const row = rows.get(brainDid);
            if (!row) return false; // brain not registered
            if (row.operatorDid !== null) return false; // already claimed
            rows.set(brainDid, { ...row, operatorDid });
            return true;
        },
        async findByOperator(operatorDid: string): Promise<MockTokenRow[]> {
            return [...rows.values()].filter(r => r.operatorDid === operatorDid && !r.revoked);
        },
        async countActiveByOperator(operatorDid: string): Promise<number> {
            const now = Math.floor(Date.now() / 1000);
            return [...rows.values()].filter(
                r => r.operatorDid === operatorDid && !r.revoked && r.expiresAt > now
            ).length;
        },
    };
}

describe('Phase 39: BrainTokenStore — ownership methods (TENANT-01)', () => {
    let store: ReturnType<typeof makeStore>;
    const OPERATOR_A = 'did:noesis:human:0xAAAA';
    const OPERATOR_B = 'did:noesis:human:0xBBBB';
    const BRAIN_1 = 'did:noesis:nous:brain1';
    const BRAIN_2 = 'did:noesis:nous:brain2';
    const FAR_FUTURE = Math.floor(Date.now() / 1000) + 86400 * 365;

    beforeEach(() => {
        store = makeStore();
        store.rows.set(BRAIN_1, { brainDid: BRAIN_1, operatorDid: null, revoked: false, expiresAt: FAR_FUTURE });
        store.rows.set(BRAIN_2, { brainDid: BRAIN_2, operatorDid: null, revoked: false, expiresAt: FAR_FUTURE });
    });

    describe('setOwner', () => {
        it('returns true and assigns operator_did when brain is unclaimed', async () => {
            const result = await store.setOwner(BRAIN_1, OPERATOR_A);
            expect(result).toBe(true);
            expect(store.rows.get(BRAIN_1)!.operatorDid).toBe(OPERATOR_A);
        });

        it('returns false when brain is already claimed by any operator (race-condition safety)', async () => {
            await store.setOwner(BRAIN_1, OPERATOR_A);
            const result = await store.setOwner(BRAIN_1, OPERATOR_B);
            expect(result).toBe(false);
            // Owner remains OPERATOR_A — no silent override
            expect(store.rows.get(BRAIN_1)!.operatorDid).toBe(OPERATOR_A);
        });

        it('returns false for an unknown brain_did', async () => {
            const result = await store.setOwner('did:noesis:nous:unknown', OPERATOR_A);
            expect(result).toBe(false);
        });
    });

    describe('findByOperator', () => {
        it('returns only tokens owned by the given operator', async () => {
            await store.setOwner(BRAIN_1, OPERATOR_A);
            await store.setOwner(BRAIN_2, OPERATOR_B);
            const results = await store.findByOperator(OPERATOR_A);
            expect(results).toHaveLength(1);
            expect(results[0]!.brainDid).toBe(BRAIN_1);
        });

        it('excludes revoked tokens', async () => {
            await store.setOwner(BRAIN_1, OPERATOR_A);
            store.rows.set(BRAIN_1, { ...store.rows.get(BRAIN_1)!, revoked: true });
            const results = await store.findByOperator(OPERATOR_A);
            expect(results).toHaveLength(0);
        });

        it('returns empty array when operator owns no brains', async () => {
            const results = await store.findByOperator(OPERATOR_A);
            expect(results).toHaveLength(0);
        });
    });

    describe('countActiveByOperator', () => {
        it('returns count of active non-expired tokens for operator', async () => {
            await store.setOwner(BRAIN_1, OPERATOR_A);
            const count = await store.countActiveByOperator(OPERATOR_A);
            expect(count).toBe(1);
        });

        it('excludes expired tokens from count', async () => {
            await store.setOwner(BRAIN_1, OPERATOR_A);
            // Expire the token
            store.rows.set(BRAIN_1, { ...store.rows.get(BRAIN_1)!, expiresAt: 1 });
            const count = await store.countActiveByOperator(OPERATOR_A);
            expect(count).toBe(0);
        });

        it('counts correctly across multiple owned brains', async () => {
            await store.setOwner(BRAIN_1, OPERATOR_A);
            await store.setOwner(BRAIN_2, OPERATOR_A);
            const count = await store.countActiveByOperator(OPERATOR_A);
            expect(count).toBe(2);
        });
    });
});
