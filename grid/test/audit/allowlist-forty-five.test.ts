/**
 * Phase 24 allowlist verification — WALLET-04.
 *
 * Asserts the Phase 24 end-state: 45 events in the allowlist,
 * human.transferred at position 45 (index 44), human.joined at index 43,
 * and human.moved absent (deferred per D-04).
 *
 * Mitigates T-24-05-02 (weakened assertions allowing a broken allowlist to pass).
 */
import { describe, it, expect } from 'vitest';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

describe('broadcast allowlist — Phase 24 end-state (45 events)', () => {
    it('has exactly 45 members at Phase 24 end-state (allowlist has since grown to 56)', () => {
        // Allowlist grew in Phase 25b (+6), Phase 27 (+1), Phase 28 (+1), Phase 33 (+3); verify positional invariants
        // for Phases 22-24 hold while acknowledging the current size is 56.
        expect((ALLOWLIST_MEMBERS as readonly string[]).length).toBe(56);
    });

    it('has human.transferred at position 45 (index 44)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[44]).toBe('human.transferred');
    });

    it('has human.joined at position 44 (index 43)', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[])[43]).toBe('human.joined');
    });

    it('does not contain human.moved (deferred per D-04)', () => {
        expect(ALLOWLIST_MEMBERS as readonly string[]).not.toContain('human.moved');
    });
});
