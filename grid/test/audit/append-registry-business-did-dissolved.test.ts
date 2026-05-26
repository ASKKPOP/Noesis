/**
 * Phase 37 Wave 1 — append-registry-business-did-dissolved sole-producer test.
 *
 * Event: registry.business_did_dissolved
 * Keys (alphabetical): business_did, civic_did, dissolved_at_tick, grid_name
 * Actor: business_did
 *
 * REG-06 — Tests fail RED until Task 1 creates grid/src/audit/append-registry-business-did-dissolved.ts.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendRegistryBusinessDidDissolved } from '../../src/audit/append-registry-business-did-dissolved.js';

function makeChain(): AuditChain {
    return new AuditChain();
}

function validPayload() {
    return {
        business_did: 'did:biz:noesis:acme-001',
        civic_did: 'did:civic:noesis:resident-001',
        dissolved_at_tick: 200,
        grid_name: 'genesis',
    };
}

describe('appendRegistryBusinessDidDissolved — payload validation', () => {
    it('throws TypeError when payload is null', () => {
        expect(() =>
            appendRegistryBusinessDidDissolved(makeChain(), null as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is an array', () => {
        expect(() =>
            appendRegistryBusinessDidDissolved(makeChain(), [] as unknown as ReturnType<typeof validPayload>),
        ).toThrow(/plain object/);
    });

    it('throws TypeError when payload is a primitive (string)', () => {
        expect(() =>
            appendRegistryBusinessDidDissolved(makeChain(), 'bad' as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when business_did has wrong family (not did:biz:noesis:*)', () => {
        expect(() =>
            appendRegistryBusinessDidDissolved(makeChain(), {
                ...validPayload(),
                business_did: 'did:noesis:nous:abc',
            }),
        ).toThrow(/BIZ_DID_RE/);
    });

    it('throws TypeError when business_did is not a string', () => {
        expect(() =>
            appendRegistryBusinessDidDissolved(makeChain(), {
                ...validPayload(),
                business_did: 42 as unknown as string,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when civic_did has wrong family (not did:civic:noesis:*)', () => {
        expect(() =>
            appendRegistryBusinessDidDissolved(makeChain(), {
                ...validPayload(),
                civic_did: 'did:biz:noesis:abc',
            }),
        ).toThrow(/CIVIC_DID_RE/);
    });

    it('throws TypeError when grid_name is empty string', () => {
        expect(() =>
            appendRegistryBusinessDidDissolved(makeChain(), {
                ...validPayload(),
                grid_name: '',
            }),
        ).toThrow(/grid_name/);
    });

    it('throws TypeError when dissolved_at_tick is negative (-1)', () => {
        expect(() =>
            appendRegistryBusinessDidDissolved(makeChain(), {
                ...validPayload(),
                dissolved_at_tick: -1,
            }),
        ).toThrow(/non-negative integer/);
    });

    it('throws TypeError when dissolved_at_tick is not an integer (1.5)', () => {
        expect(() =>
            appendRegistryBusinessDidDissolved(makeChain(), {
                ...validPayload(),
                dissolved_at_tick: 1.5,
            }),
        ).toThrow(/non-negative integer/);
    });

    it('throws TypeError when payload has an extra key', () => {
        expect(() =>
            appendRegistryBusinessDidDissolved(makeChain(), {
                ...validPayload(),
                extra: 'no',
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(/unexpected key set/);
    });

    it('throws TypeError when payload is missing a required key', () => {
        const partial = { ...validPayload() } as Record<string, unknown>;
        delete partial['dissolved_at_tick'];
        expect(() =>
            appendRegistryBusinessDidDissolved(makeChain(), partial as unknown as ReturnType<typeof validPayload>),
        ).toThrow(/unexpected key set/);
    });
});

describe('appendRegistryBusinessDidDissolved — happy path', () => {
    it('appends to chain on valid payload and returns AuditEntry with correct eventType', () => {
        const audit = makeChain();
        const entry = appendRegistryBusinessDidDissolved(audit, validPayload());
        expect(entry).toBeDefined();
        expect(entry.eventType).toBe('registry.business_did_dissolved');
        expect(entry.actorDid).toBe('did:biz:noesis:acme-001');
        expect(entry.payload).toEqual(validPayload());
    });

    it('accepts tick=0 (boundary)', () => {
        const audit = makeChain();
        const entry = appendRegistryBusinessDidDissolved(audit, { ...validPayload(), dissolved_at_tick: 0 });
        expect(entry.eventType).toBe('registry.business_did_dissolved');
    });
});
