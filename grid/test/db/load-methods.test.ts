/**
 * Sprint 12 — Load Methods
 *
 * Tests the new loadEntries / loadRecords / loadPositions / allPositions / all()
 * methods added to AuditChain, NousRegistry, and SpatialMap.
 */

import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { SpatialMap } from '../../src/space/map.js';
import type { AuditEntry } from '../../src/audit/types.js';
import type { NousRecord } from '../../src/registry/types.js';
import type { NousPosition } from '../../src/space/types.js';

// ── Helpers ───────────────────────────────────────────────────

function buildChainEntries(count: number): AuditEntry[] {
    const chain = new AuditChain();
    for (let i = 0; i < count; i++) {
        chain.append(`event.${i}`, 'did:key:actor', { i });
    }
    return chain.all();
}

function makeRecord(did: string): NousRecord {
    return {
        did,
        name: did.split(':')[2],
        ndsAddress: `nous://${did}.test`,
        publicKey: 'pk',
        region: 'alpha',
        lifecyclePhase: 'spawning',
        reputation: 0,
        ousia: 1000,
        spawnedAtTick: 0,
        lastActiveTick: 0,
        status: 'active',
    };
}

// ── AuditChain ────────────────────────────────────────────────

describe('Sprint 12: AuditChain load methods', () => {

    it('all() returns all entries as a copy', () => {
        const chain = new AuditChain();
        chain.append('a', 'did:key:x', {});
        chain.append('b', 'did:key:x', {});

        const entries = chain.all();
        expect(entries).toHaveLength(2);
        expect(entries[0].eventType).toBe('a');
        expect(entries[1].eventType).toBe('b');
    });

    it('all() returns a copy — mutation does not affect chain', () => {
        const chain = new AuditChain();
        chain.append('a', 'did:key:x', {});

        const entries = chain.all();
        entries[0].eventType = 'mutated';

        expect(chain.at(0)!.eventType).toBe('a');
    });

    it('loadEntries restores a chain from serialised entries', () => {
        const original = new AuditChain();
        for (let i = 0; i < 5; i++) original.append(`evt.${i}`, 'did:key:a', { i });

        const entries = original.all();

        const restored = new AuditChain();
        restored.loadEntries(entries);

        expect(restored.length).toBe(5);
        expect(restored.verify().valid).toBe(true);
        expect(restored.head).toBe(original.head);
    });

    it('loadEntries preserves id sequence — next append gets correct id', () => {
        const entries = buildChainEntries(3);
        const chain = new AuditChain();
        chain.loadEntries(entries);

        const next = chain.append('new.event', 'did:key:b', {});
        expect(next.id).toBe(4);
    });

    it('loadEntries on empty chain succeeds', () => {
        const chain = new AuditChain();
        expect(() => chain.loadEntries([])).not.toThrow();
        expect(chain.length).toBe(0);
    });

    it('loadEntries throws on non-empty chain', () => {
        const chain = new AuditChain();
        chain.append('existing', 'did:key:x', {});
        const entries = buildChainEntries(2);

        expect(() => chain.loadEntries(entries)).toThrow('non-empty');
    });
});

// ── NousRegistry ──────────────────────────────────────────────

describe('Sprint 12: NousRegistry load methods', () => {

    it('loadRecords populates an empty registry', () => {
        const reg = new NousRegistry();
        const records = [makeRecord('did:key:sophia'), makeRecord('did:key:hermes')];

        reg.loadRecords(records);

        expect(reg.count).toBe(2);
        expect(reg.get('did:key:sophia')?.name).toBe('sophia');
        expect(reg.get('did:key:hermes')?.name).toBe('hermes');
    });

    it('loadRecords supports findByName after load', () => {
        const reg = new NousRegistry();
        reg.loadRecords([makeRecord('did:key:sophia')]);

        expect(reg.findByName('sophia')?.did).toBe('did:key:sophia');
    });

    it('loadRecords stores copies — external mutation does not affect registry', () => {
        const reg = new NousRegistry();
        const record = makeRecord('did:key:sophia');
        reg.loadRecords([record]);

        record.ousia = 99999;

        expect(reg.get('did:key:sophia')?.ousia).toBe(1000);
    });

    it('loadRecords into empty registry with empty array is a no-op', () => {
        const reg = new NousRegistry();
        expect(() => reg.loadRecords([])).not.toThrow();
        expect(reg.count).toBe(0);
    });
});

// ── SpatialMap ────────────────────────────────────────────────

describe('Sprint 12: SpatialMap load methods', () => {

    it('allPositions returns all current positions', () => {
        const map = new SpatialMap();
        map.addRegion({ id: 'alpha', name: 'Alpha', description: '', regionType: 'public', capacity: 100, properties: {} });
        map.addRegion({ id: 'beta',  name: 'Beta',  description: '', regionType: 'public', capacity: 100, properties: {} });

        map.placeNous('did:key:sophia', 'alpha');
        map.placeNous('did:key:hermes', 'beta');

        const positions = map.allPositions();
        expect(positions).toHaveLength(2);

        const regions = positions.map(p => p.regionId).sort();
        expect(regions).toEqual(['alpha', 'beta']);
    });

    it('allPositions returns a copy', () => {
        const map = new SpatialMap();
        map.addRegion({ id: 'alpha', name: 'Alpha', description: '', regionType: 'public', capacity: 100, properties: {} });
        map.placeNous('did:key:sophia', 'alpha');

        const positions = map.allPositions();
        positions[0].regionId = 'mutated';

        expect(map.getPosition('did:key:sophia')?.regionId).toBe('alpha');
    });

    it('loadPositions restores positions', () => {
        const map = new SpatialMap();
        const positions: NousPosition[] = [
            { nousDid: 'did:key:sophia', regionId: 'alpha', arrivedAt: 1000 },
            { nousDid: 'did:key:hermes', regionId: 'beta',  arrivedAt: 2000 },
        ];

        map.loadPositions(positions);

        expect(map.getPosition('did:key:sophia')?.regionId).toBe('alpha');
        expect(map.getPosition('did:key:hermes')?.regionId).toBe('beta');
        expect(map.nousCount).toBe(2);
    });

    it('loadPositions stores copies', () => {
        const map = new SpatialMap();
        const pos: NousPosition = { nousDid: 'did:key:sophia', regionId: 'alpha', arrivedAt: 1000 };
        map.loadPositions([pos]);

        pos.regionId = 'mutated';
        expect(map.getPosition('did:key:sophia')?.regionId).toBe('alpha');
    });
});
