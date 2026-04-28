import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import type { RigClosedPayload, RigExitReason } from '../../src/rig/types.js';

describe('chronos.rig_closed event (D-14-08, RIG-05)', () => {
    it('payload type has exactly the 5 frozen keys', () => {
        const expectedKeys = ['seed', 'tick', 'exit_reason', 'chain_entry_count', 'chain_tail_hash'].sort();
        // Compile-time check via type assignment
        const sample: RigClosedPayload = {
            seed: 'd4e5f6a7b8c9d0e1',
            tick: 1000,
            exit_reason: 'tick_budget_exhausted',
            chain_entry_count: 50000,
            chain_tail_hash: createHash('sha256').update('x').digest('hex'),
        };
        expect(Object.keys(sample).sort()).toEqual(expectedKeys);
    });

    it('exit_reason enum locked to {tick_budget_exhausted, all_nous_dead, operator_h5_terminate}', () => {
        const valid: RigExitReason[] = ['tick_budget_exhausted', 'all_nous_dead', 'operator_h5_terminate'];
        expect(valid).toHaveLength(3);
        // @ts-expect-error — illegal value
        const bad: RigExitReason = 'crashed';
        void bad;
    });

    it('FAILS UNTIL Wave 2: rig emits chronos.rig_closed on its OWN chain (not production allowlist)', () => {
        expect.fail('Wave 2 scripts/rig.mjs must call rigChain.append("chronos.rig_closed", "system", payload) on the isolated AuditChain');
    });

    it('FAILS UNTIL Wave 2: chain_tail_hash = SHA-256(canonicalStringify(lastEntry))', () => {
        expect.fail('Wave 2 must compute chain_tail_hash with grid/src/export/canonical-json.ts canonicalStringify, then SHA-256');
    });
});
