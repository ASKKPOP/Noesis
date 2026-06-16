import { describe, it, expect, beforeEach } from 'vitest';
import { NousRegistry } from '../src/registry/registry.js';

/**
 * Agent-controlled visibility (spec §1): a Nous may choose to be visible or
 * hidden from other agents. Hidden suppresses peer-discovery (inRegion) only —
 * operators always see (substrate sovereignty). Distinct from operator quarantine.
 */
describe('NousRegistry agent visibility', () => {
    let registry: NousRegistry;
    beforeEach(() => {
        registry = new NousRegistry();
        registry.spawn(
            { name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk', region: 'agora' },
            'g.n', 0, 1000,
        );
    });

    it('hides a Nous from peer-discovery when it self-hides', () => {
        expect(registry.inRegion('agora')).toHaveLength(1);
        expect(registry.setVisibility('did:noesis:sophia', true)).toBe(true);
        expect(registry.inRegion('agora')).toHaveLength(0);   // peers cannot see
        expect(registry.active()).toHaveLength(1);            // operator still sees
        expect(registry.get('did:noesis:sophia')?.hiddenFlag).toBe(true);
    });

    it('reappears when it makes itself visible again', () => {
        registry.setVisibility('did:noesis:sophia', true);
        registry.setVisibility('did:noesis:sophia', false);
        expect(registry.inRegion('agora')).toHaveLength(1);
    });

    it('returns false for an unknown DID', () => {
        expect(registry.setVisibility('did:noesis:ghost', true)).toBe(false);
    });
});
