import { describe, it, expect, beforeEach } from 'vitest';
import { NousRegistry } from '../src/registry/registry.js';

describe('NousRegistry', () => {
    let registry: NousRegistry;

    beforeEach(() => {
        registry = new NousRegistry();
    });

    it('spawns a Nous', () => {
        const record = registry.spawn(
            { name: 'Sophia', did: 'did:key:sophia', publicKey: 'pk', region: 'agora' },
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
        registry.spawn({ name: 'Sophia', did: 'did:key:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        expect(() => registry.spawn(
            { name: 'Sophia2', did: 'did:key:sophia', publicKey: 'pk2', region: 'agora' }, 'g.n', 0, 1000,
        )).toThrow('already registered');
    });

    it('rejects duplicate name', () => {
        registry.spawn({ name: 'Sophia', did: 'did:key:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        expect(() => registry.spawn(
            { name: 'Sophia', did: 'did:key:other', publicKey: 'pk2', region: 'agora' }, 'g.n', 0, 1000,
        )).toThrow('already taken');
    });

    it('finds by name (case-insensitive)', () => {
        registry.spawn({ name: 'Sophia', did: 'did:key:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        expect(registry.findByName('sophia')?.did).toBe('did:key:sophia');
        expect(registry.findByName('SOPHIA')?.did).toBe('did:key:sophia');
        expect(registry.findByName('unknown')).toBeUndefined();
    });

    it('resolves NDS address', () => {
        registry.spawn({ name: 'Sophia', did: 'did:key:sophia', publicKey: 'pk', region: 'agora' }, 'genesis.noesis', 0, 1000);
        expect(registry.resolve('nous://sophia.genesis.noesis')?.did).toBe('did:key:sophia');
        expect(registry.resolve('nous://unknown.genesis.noesis')).toBeUndefined();
    });

    it('advances lifecycle', () => {
        registry.spawn({ name: 'Sophia', did: 'did:key:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        expect(registry.advanceLifecycle('did:key:sophia')).toBe('infant');
        expect(registry.advanceLifecycle('did:key:sophia')).toBe('adolescent');
        expect(registry.advanceLifecycle('did:key:sophia')).toBe('maturity');
        expect(registry.advanceLifecycle('did:key:sophia')).toBe('elder');
        expect(registry.advanceLifecycle('did:key:sophia')).toBeNull(); // at max
    });

    it('suspends and reinstates', () => {
        registry.spawn({ name: 'Sophia', did: 'did:key:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        expect(registry.suspend('did:key:sophia')).toBe(true);
        expect(registry.get('did:key:sophia')!.status).toBe('suspended');
        expect(registry.active()).toHaveLength(0);
        expect(registry.reinstate('did:key:sophia')).toBe(true);
        expect(registry.get('did:key:sophia')!.status).toBe('active');
    });

    it('exiles a Nous', () => {
        registry.spawn({ name: 'Sophia', did: 'did:key:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        expect(registry.exile('did:key:sophia')).toBe(true);
        expect(registry.get('did:key:sophia')!.status).toBe('exiled');
        expect(registry.get('did:key:sophia')!.lifecyclePhase).toBe('exiled');
    });

    it('touch updates lastActiveTick', () => {
        registry.spawn({ name: 'Sophia', did: 'did:key:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        registry.touch('did:key:sophia', 42);
        expect(registry.get('did:key:sophia')!.lastActiveTick).toBe(42);
    });

    it('lists Nous in a region', () => {
        registry.spawn({ name: 'Sophia', did: 'did:key:sophia', publicKey: 'pk', region: 'agora' }, 'g.n', 0, 1000);
        registry.spawn({ name: 'Hermes', did: 'did:key:hermes', publicKey: 'pk', region: 'market' }, 'g.n', 0, 1000);
        expect(registry.inRegion('agora')).toHaveLength(1);
        expect(registry.inRegion('market')).toHaveLength(1);
        expect(registry.inRegion('nowhere')).toHaveLength(0);
    });
});
