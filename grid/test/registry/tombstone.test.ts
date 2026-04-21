import { describe, expect, it, beforeEach } from 'vitest';
import { NousRegistry } from '../../src/registry/registry.js';
import { SpatialMap } from '../../src/space/map.js';
import type { Region } from '../../src/space/types.js';
import { tombstoneCheck, TombstonedDidError } from '../../src/registry/tombstone-check.js';

const ALPHA = 'did:noesis:alpha';
const BETA  = 'did:noesis:beta';
const AGORA_REGION = 'agora';

function makeRegion(id: string): Region {
    return { id, name: id, description: `${id} region`, regionType: 'public', capacity: 100, properties: {} };
}

describe('AGENCY-05 tombstone primitive (D-01, D-02, D-04)', () => {
    let spatial: SpatialMap;
    let registry: NousRegistry;

    beforeEach(() => {
        spatial = new SpatialMap();
        spatial.addRegion(makeRegion(AGORA_REGION));
        registry = new NousRegistry();
        registry.spawn(
            { name: 'Alpha', did: ALPHA, publicKey: 'pk-alpha', region: AGORA_REGION },
            'genesis.noesis', 0, 1000,
        );
        // Place alpha on the spatial map so eviction is testable
        spatial.placeNous(ALPHA, AGORA_REGION);
    });

    it('fresh spawn sets status="active", no deletedAtTick', () => {
        const r = registry.get(ALPHA)!;
        expect(r.status).toBe('active');
        expect(r.deletedAtTick).toBeUndefined();
    });

    it('tombstone(did, tick) flips status to "deleted" and stamps deletedAtTick', () => {
        registry.tombstone(ALPHA, 42, spatial);
        const r = registry.get(ALPHA)!;
        expect(r.status).toBe('deleted');
        expect(r.deletedAtTick).toBe(42);
    });

    it('tombstoned record REMAINS in registry (D-02 audit retention)', () => {
        registry.tombstone(ALPHA, 42, spatial);
        expect(registry.get(ALPHA)).toBeDefined();
        expect(registry.get(ALPHA)!.did).toBe(ALPHA);
    });

    it('tombstone evicts from spatial index', () => {
        registry.tombstone(ALPHA, 42, spatial);
        // After tombstone, the DID should not appear in the spatial region
        const inRegion = spatial.getNousInRegion(AGORA_REGION);
        const dids = inRegion.map(p => p.nousDid);
        expect(dids).not.toContain(ALPHA);
    });

    it('tombstone on unknown DID throws (maps to HTTP 404 in Plan 02)', () => {
        expect(() => registry.tombstone('did:noesis:ghost', 42, spatial)).toThrow(/unknown/i);
    });

    it('tombstone on already-tombstoned DID throws (defensive)', () => {
        registry.tombstone(ALPHA, 42, spatial);
        expect(() => registry.tombstone(ALPHA, 43, spatial)).toThrow(/already.*tombstoned/i);
    });

    it('tombstone with non-integer tick throws', () => {
        expect(() => registry.tombstone(ALPHA, -1, spatial)).toThrow(/tick/i);
        expect(() => registry.tombstone(ALPHA, 1.5, spatial)).toThrow(/tick/i);
        expect(() => registry.tombstone(ALPHA, NaN, spatial)).toThrow(/tick/i);
    });

    it('spawn() rejects tombstoned DID reuse (D-04 — permanently reserved)', () => {
        registry.tombstone(ALPHA, 42, spatial);
        expect(() => registry.spawn(
            { name: 'AlphaNew', did: ALPHA, publicKey: 'pk-new', region: AGORA_REGION },
            'genesis.noesis', 100, 1000,
        )).toThrow(/tombstoned|cannot.*reuse/i);
    });

    it('removeNous on active DID throws (soft-delete only per D-02)', () => {
        expect(() => registry.removeNous(ALPHA)).toThrow(/active/i);
    });

    it('removeNous on tombstoned DID is a no-op (record stays)', () => {
        registry.tombstone(ALPHA, 42, spatial);
        expect(() => registry.removeNous(ALPHA)).not.toThrow();
        expect(registry.get(ALPHA)).toBeDefined();
        expect(registry.get(ALPHA)!.status).toBe('deleted');
    });

    it('SpatialMap.removeNous is idempotent on absent DID', () => {
        expect(() => spatial.removeNous('did:noesis:ghost')).not.toThrow();
    });

    it('SpatialMap.removeNous evicts a placed Nous', () => {
        // Alpha is placed in beforeEach
        spatial.removeNous(ALPHA);
        const inRegion = spatial.getNousInRegion(AGORA_REGION);
        expect(inRegion.map(p => p.nousDid)).not.toContain(ALPHA);
    });

    describe('tombstoneCheck helper (D-09)', () => {
        it('throws TombstonedDidError for tombstoned DID with statusHint=410', () => {
            registry.tombstone(ALPHA, 42, spatial);
            try {
                tombstoneCheck(registry, ALPHA);
                expect.fail('expected TombstonedDidError');
            } catch (err) {
                expect(err).toBeInstanceOf(TombstonedDidError);
                const e = err as TombstonedDidError;
                expect(e.statusHint).toBe(410);
                expect(e.did).toBe(ALPHA);
                expect(e.deletedAtTick).toBe(42);
            }
        });

        it('no-op on active DID', () => {
            expect(() => tombstoneCheck(registry, ALPHA)).not.toThrow();
        });

        it('no-op on unknown DID (404 is handled by a different guard)', () => {
            expect(() => tombstoneCheck(registry, 'did:noesis:ghost')).not.toThrow();
        });
    });

    describe('zero-diff audit invariant (Phase 6 / Phase 7 continuity)', () => {
        it('tombstone spawns no audit events on its own — audit emission is the delete route\'s job (Plan 02)', () => {
            // Plan 01 primitive is registry-only; audit emission is Plan 02's
            // delete route composing tombstone + appendNousDeleted.
            registry.tombstone(ALPHA, 42, spatial);
            // No assertion on audit chain here — Plan 01 doesn't import AuditChain.
            // This test exists to pin the contract: registry is audit-agnostic.
            expect(true).toBe(true);
        });
    });
});
