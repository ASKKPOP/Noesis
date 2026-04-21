import { describe, it, expect, beforeEach } from 'vitest';
import { Reviewer } from '../../src/review/Reviewer.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';

describe('REV-03: Reviewer singleton enforcement (D-07)', () => {
    beforeEach(() => {
        Reviewer.resetForTesting();
    });

    it('first construction succeeds', () => {
        const r = new Reviewer(new AuditChain(), new NousRegistry());
        expect(r).toBeInstanceOf(Reviewer);
    });

    it('second construction throws with /singleton/i AND /already constructed/i', () => {
        new Reviewer(new AuditChain(), new NousRegistry());
        let err: Error | null = null;
        try {
            new Reviewer(new AuditChain(), new NousRegistry());
        } catch (e) {
            err = e as Error;
        }
        expect(err).not.toBeNull();
        expect(err!.message).toMatch(/singleton/i);
        expect(err!.message).toMatch(/already constructed/i);
    });

    it('resetForTesting clears the flag so a fresh construction succeeds', () => {
        new Reviewer(new AuditChain(), new NousRegistry());
        Reviewer.resetForTesting();
        expect(() => new Reviewer(new AuditChain(), new NousRegistry())).not.toThrow();
    });

    it('Reviewer.DID equals did:noesis:reviewer (grid-agnostic, D-08)', () => {
        expect(Reviewer.DID).toBe('did:noesis:reviewer');
    });

    it('Reviewer.DID passes Phase 1 DID regex', () => {
        const DID_PATTERN = /^did:noesis:[a-z0-9_\-]+$/i;
        expect(DID_PATTERN.test(Reviewer.DID)).toBe(true);
    });

    it('Reviewer.DID contains no period (regression: rejected did:noesis:reviewer.<grid> form)', () => {
        expect(Reviewer.DID.includes('.')).toBe(false);
    });
});
