/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for the severance FSM (A6 / D-60-02 / R-60-03).
 *
 * describe.skip: grid/src/civic/severance.ts lands in Wave 1. Deferred dynamic import
 * (Phase 58/59 Wave-0 pattern) defers module resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - the closed FSM advances ACTIVE → NOTICE → SETTLEMENT → WIND_DOWN → REVOKE → ARCHIVED
 *     in order; no state is skipped on a normal path.
 *   - SETTLEMENT drains outstanding IOUs for the pair BEFORE REVOKE.
 *   - capabilities are removed ONLY at REVOKE; the edge is downgraded to retained history at
 *     ARCHIVED (never deleted — not a hard kill).
 *   - a for-cause breach SHORT-CIRCUITS to SETTLEMENT with a dispute flag pointing at Phase 47 Police.
 */
import { describe, it, expect } from 'vitest';

const loadSeverance = () => import('../../src/civic/severance.js');

const HOST = 'did:civic:noesis:alice';
const HOLDER = 'did:civic:noesis:bob';
const PARCEL = 'genesis:business:0001';

describe.skip('Phase 60 HOUSE-3 — severance FSM ordered traversal [Wave 1 un-skips]', () => {
    it('advances ACTIVE → NOTICE → SETTLEMENT → WIND_DOWN → REVOKE → ARCHIVED in order', async () => {
        const { advanceSeverance } = await loadSeverance();
        const ctx = { state: 'ACTIVE' as const, parcel_id: PARCEL, host: HOST, holder: HOLDER, forCause: false };
        let state = advanceSeverance(ctx);
        expect(state).toBe('NOTICE');
        state = advanceSeverance({ ...ctx, state });
        expect(state).toBe('SETTLEMENT');
        state = advanceSeverance({ ...ctx, state });
        expect(state).toBe('WIND_DOWN');
        state = advanceSeverance({ ...ctx, state });
        expect(state).toBe('REVOKE');
        state = advanceSeverance({ ...ctx, state });
        expect(state).toBe('ARCHIVED');
    });

    it('no normal-path state is skipped (SETTLEMENT always precedes REVOKE)', async () => {
        const { advanceSeverance } = await loadSeverance();
        const path: string[] = ['ACTIVE'];
        let state = 'ACTIVE';
        for (let i = 0; i < 5; i++) {
            state = advanceSeverance({ state: state as never, parcel_id: PARCEL, host: HOST, holder: HOLDER, forCause: false });
            path.push(state);
        }
        expect(path.indexOf('SETTLEMENT')).toBeLessThan(path.indexOf('REVOKE'));
        expect(path).toEqual(['ACTIVE', 'NOTICE', 'SETTLEMENT', 'WIND_DOWN', 'REVOKE', 'ARCHIVED']);
    });

    it('SETTLEMENT drains outstanding IOUs for the pair BEFORE the FSM reaches REVOKE', async () => {
        const { advanceSeverance } = await loadSeverance();
        const drained: string[] = [];
        const ctx = {
            state: 'SETTLEMENT' as const, parcel_id: PARCEL, host: HOST, holder: HOLDER, forCause: false,
            drainIous: () => { drained.push('drained'); },
        };
        const next = advanceSeverance(ctx);
        expect(drained).toEqual(['drained']);
        expect(next).toBe('WIND_DOWN');
    });

    it('capabilities are removed ONLY at REVOKE (not at NOTICE/SETTLEMENT/WIND_DOWN)', async () => {
        const { advanceSeverance } = await loadSeverance();
        const removed: string[] = [];
        const mk = (state: string) => ({
            state: state as never, parcel_id: PARCEL, host: HOST, holder: HOLDER, forCause: false,
            removeCapabilities: () => removed.push(state),
        });
        advanceSeverance(mk('NOTICE'));
        advanceSeverance(mk('SETTLEMENT'));
        advanceSeverance(mk('WIND_DOWN'));
        expect(removed).toEqual([]);
        advanceSeverance(mk('REVOKE'));
        expect(removed).toEqual(['REVOKE']);
    });

    it('ARCHIVED downgrades the edge to retained history — the edge is NEVER deleted (not a hard kill)', async () => {
        const { advanceSeverance } = await loadSeverance();
        let deleted = false;
        const next = advanceSeverance({
            state: 'REVOKE' as const, parcel_id: PARCEL, host: HOST, holder: HOLDER, forCause: false,
            deleteEdge: () => { deleted = true; },
        });
        expect(next).toBe('ARCHIVED');
        expect(deleted).toBe(false);
    });

    it('a for-cause breach SHORT-CIRCUITS to SETTLEMENT with a dispute flag pointing at Phase 47 Police', async () => {
        const { advanceSeverance } = await loadSeverance();
        const next = advanceSeverance({
            state: 'ACTIVE' as const, parcel_id: PARCEL, host: HOST, holder: HOLDER, forCause: true,
        });
        expect(next).toBe('SETTLEMENT');
    });
});
