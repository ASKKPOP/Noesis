import { describe, it, expect, beforeEach } from 'vitest';
import { NousRegistry } from '../src/registry/registry.js';

describe('NousRegistry', () => {
    let registry: NousRegistry;

    beforeEach(() => {
        registry = new NousRegistry();
    });

    it('spawns a Nous', () => {
        const record = registry.spawn(
            { name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk', region: 'agora' },
            'genesis.noesis', 0, 1000,
        );
        expect(record.name).toBe('Sophia');
        expect(record.ndsAddress).toBe('nous://sophia.genesis.noesis');
        expect(record.lifecyclePhase).toBe('spawning');
        expect(record.ousia).toBe(1000);
        expect(record.status).toBe('active');
        expect(registry.count).toBe(1);
    });

    it('rejects duplicate DID', () => {
        registry.spawn({ name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        expect(() => registry.spawn(
            { name: 'Sophia2', did: 'did:noesis:sophia', publicKey: 'pk2', region: 'agora' }, 'g.n', 0, 1000,
        )).toThrow('already registered');
    });

    it('rejects duplicate name', () => {
        registry.spawn({ name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        expect(() => registry.spawn(
            { name: 'Sophia', did: 'did:noesis:other', publicKey: 'pk2', region: 'agora' }, 'g.n', 0, 1000,
        )).toThrow('already taken');
    });

    it('finds by name (case-insensitive)', () => {
        registry.spawn({ name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        expect(registry.findByName('sophia')?.did).toBe('did:noesis:sophia');
        expect(registry.findByName('SOPHIA')?.did).toBe('did:noesis:sophia');
        expect(registry.findByName('unknown')).toBeUndefined();
    });

    it('resolves NDS address', () => {
        registry.spawn({ name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk', region: 'agora' }, 'genesis.noesis', 0, 1000);
        expect(registry.resolve('nous://sophia.genesis.noesis')?.did).toBe('did:noesis:sophia');
        expect(registry.resolve('nous://unknown.genesis.noesis')).toBeUndefined();
    });

    it('advances lifecycle', () => {
        registry.spawn({ name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        expect(registry.advanceLifecycle('did:noesis:sophia')).toBe('infant');
        expect(registry.advanceLifecycle('did:noesis:sophia')).toBe('adolescent');
        expect(registry.advanceLifecycle('did:noesis:sophia')).toBe('maturity');
        expect(registry.advanceLifecycle('did:noesis:sophia')).toBe('elder');
        expect(registry.advanceLifecycle('did:noesis:sophia')).toBeNull(); // at max
    });

    it('suspends and reinstates', () => {
        registry.spawn({ name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        expect(registry.suspend('did:noesis:sophia')).toBe(true);
        expect(registry.get('did:noesis:sophia')!.status).toBe('suspended');
        expect(registry.active()).toHaveLength(0);
        expect(registry.reinstate('did:noesis:sophia')).toBe(true);
        expect(registry.get('did:noesis:sophia')!.status).toBe('active');
    });

    it('exiles a Nous', () => {
        registry.spawn({ name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        expect(registry.exile('did:noesis:sophia')).toBe(true);
        expect(registry.get('did:noesis:sophia')!.status).toBe('exiled');
        expect(registry.get('did:noesis:sophia')!.lifecyclePhase).toBe('exiled');
    });

    it('touch updates lastActiveTick', () => {
        registry.spawn({ name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        registry.touch('did:noesis:sophia', 42);
        expect(registry.get('did:noesis:sophia')!.lastActiveTick).toBe(42);
    });

    it('lists Nous in a region', () => {
        registry.spawn({ name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        registry.spawn({ name: 'Hermes', did: 'did:noesis:hermes', publicKey: 'pk', region: 'market' }, 'g.n', 0, 1000);
        expect(registry.inRegion('agora')).toHaveLength(1);
        expect(registry.inRegion('market')).toHaveLength(1);
        expect(registry.inRegion('nowhere')).toHaveLength(0);
    });
});
