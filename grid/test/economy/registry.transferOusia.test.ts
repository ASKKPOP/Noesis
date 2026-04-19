import { describe, it, expect, beforeEach } from 'vitest';
import { NousRegistry } from '../../src/registry/registry.js';

describe('NousRegistry.transferOusia', () => {
    let registry: NousRegistry;

    beforeEach(() => {
        registry = new NousRegistry();
        registry.spawn(
            { name: 'Sophia', did: 'did:key:sophia', publicKey: 'pk-sophia', region: 'agora' },
            'genesis.noesis', 0, 1000,
        );
        registry.spawn(
            { name: 'Hermes', did: 'did:key:hermes', publicKey: 'pk-hermes', region: 'agora' },
            'genesis.noesis', 0, 500,
        );
    });

    it('transfers on success and returns new balances', () => {
        const result = registry.transferOusia('did:key:sophia', 'did:key:hermes', 200);
        expect(result).toEqual({
            success: true,
            fromBalance: 800,
            toBalance: 700,
        });
        expect(registry.get('did:key:sophia')?.ousia).toBe(800);
        expect(registry.get('did:key:hermes')?.ousia).toBe(700);
    });

    it('rejects unknown sender DID without mutating state', () => {
        const result = registry.transferOusia('did:key:ghost', 'did:key:hermes', 10);
        expect(result).toEqual({ success: false, error: 'not_found' });
        expect(registry.get('did:key:hermes')?.ousia).toBe(500);
    });

    it('rejects unknown recipient DID without mutating state', () => {
        const result = registry.transferOusia('did:key:sophia', 'did:key:ghost', 10);
        expect(result).toEqual({ success: false, error: 'not_found' });
        expect(registry.get('did:key:sophia')?.ousia).toBe(1000);
    });

    it('rejects insufficient balance without mutating either side', () => {
        const result = registry.transferOusia('did:key:sophia', 'did:key:hermes', 5000);
        expect(result).toEqual({ success: false, error: 'insufficient' });
        expect(registry.get('did:key:sophia')?.ousia).toBe(1000);
        expect(registry.get('did:key:hermes')?.ousia).toBe(500);
    });

    it('rejects self-transfer', () => {
        const result = registry.transferOusia('did:key:sophia', 'did:key:sophia', 10);
        expect(result).toEqual({ success: false, error: 'self_transfer' });
        expect(registry.get('did:key:sophia')?.ousia).toBe(1000);
    });

    it('rejects zero amount as invalid_amount', () => {
        const result = registry.transferOusia('did:key:sophia', 'did:key:hermes', 0);
        expect(result).toEqual({ success: false, error: 'invalid_amount' });
        expect(registry.get('did:key:sophia')?.ousia).toBe(1000);
    });

    it('rejects negative amount as invalid_amount', () => {
        const result = registry.transferOusia('did:key:sophia', 'did:key:hermes', -5);
        expect(result).toEqual({ success: false, error: 'invalid_amount' });
        expect(registry.get('did:key:sophia')?.ousia).toBe(1000);
        expect(registry.get('did:key:hermes')?.ousia).toBe(500);
    });

    it('rejects non-integer amount as invalid_amount', () => {
        const result = registry.transferOusia('did:key:sophia', 'did:key:hermes', 10.5);
        expect(result).toEqual({ success: false, error: 'invalid_amount' });
        expect(registry.get('did:key:sophia')?.ousia).toBe(1000);
    });

    it('allows transferring exactly the sender balance (boundary)', () => {
        const result = registry.transferOusia('did:key:hermes', 'did:key:sophia', 500);
        expect(result).toEqual({ success: true, fromBalance: 0, toBalance: 1500 });
        expect(registry.get('did:key:hermes')?.ousia).toBe(0);
        expect(registry.get('did:key:sophia')?.ousia).toBe(1500);
    });
});
