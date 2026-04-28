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

    it('rig emits chronos.rig_closed on its OWN chain (not production allowlist)', () => {
        // Verify via source inspection that rig.mjs appends 'chronos.rig_closed' to
        // the isolated launcher.audit chain — never to production allowlist.
        const { readFileSync } = require('node:fs');
        const { join } = require('node:path');
        const src = readFileSync(join(process.cwd(), '..', 'scripts', 'rig.mjs'), 'utf8');
        // Must append chronos.rig_closed on launcher.audit (the isolated chain)
        expect(src).toContain("launcher.audit.append('chronos.rig_closed', 'system', rigClosedPayload)");
        // Must NOT add to production allowlist (checked by check-state-doc-sync.mjs separately)
        // Must contain all 5 payload keys (D-14-08)
        expect(src).toContain('seed: cfg.seed');
        expect(src).toContain('tick: finalTick');
        expect(src).toContain('exit_reason: exitReason');
        expect(src).toContain('chain_entry_count:');
        expect(src).toContain('chain_tail_hash:');
    });

    it('chain_tail_hash = SHA-256(canonicalStringify(lastEntry))', () => {
        // Verify via source inspection that rig.mjs derives chain_tail_hash using
        // canonicalStringify (from canonical-json.ts) then SHA-256 — same pattern as Phase 13.
        const { readFileSync } = require('node:fs');
        const { join } = require('node:path');
        const src = readFileSync(join(process.cwd(), '..', 'scripts', 'rig.mjs'), 'utf8');
        // Must import canonicalStringify from the grid dist
        expect(src).toContain('canonicalStringify');
        // Must use createHash('sha256') for the tail hash
        expect(src).toContain("createHash('sha256')");
        // Must use canonicalStringify when computing the hash
        expect(src).toMatch(/createHash\(['"]sha256['"]\).*update\(canonicalStringify/s);
    });
});
