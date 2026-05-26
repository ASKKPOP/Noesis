/**
 * Phase 37 Wave 1 — append-registry-business-did-registered sole-producer test.
 *
 * Event: registry.business_did_registered
 * Keys (alphabetical): business_did, civic_did, grid_name, registered_at_tick
 * Actor: business_did
 *
 * Privacy invariant: business_name and category are NOT in audit payload (DB only).
 *
 * REG-06 — Tests fail RED until Task 1 creates grid/src/audit/append-registry-business-did-registered.ts.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendRegistryBusinessDidRegistered } from '../../src/audit/append-registry-business-did-registered.js';

function makeChain(): AuditChain {
    return new AuditChain();
}

function validPayload() {
    return {
        business_did: 'did:biz:noesis:acme-001',
        civic_did: 'did:civic:noesis:resident-001',
        grid_name: 'genesis',
        registered_at_tick: 50,
    };
}

describe('appendRegistryBusinessDidRegistered — payload validation', () => {
    it('throws TypeError when payload is null', () => {
        expect(() =>
            appendRegistryBusinessDidRegistered(makeChain(), null as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is an array', () => {
        expect(() =>
            appendRegistryBusinessDidRegistered(makeChain(), [] as unknown as ReturnType<typeof validPayload>),
        ).toThrow(/plain object/);
    });

    it('throws TypeError when payload is a primitive (string)', () => {
        expect(() =>
            appendRegistryBusinessDidRegistered(makeChain(), 'bad' as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when business_did has wrong family (not did:biz:noesis:*)', () => {
        expect(() =>
            appendRegistryBusinessDidRegistered(makeChain(), {
                ...validPayload(),
                business_did: 'did:noesis:nous:abc',
            }),
        ).toThrow(/BIZ_DID_RE/);
    });

    it('throws TypeError when business_did is not a string', () => {
        expect(() =>
            appendRegistryBusinessDidRegistered(makeChain(), {
                ...validPayload(),
                business_did: 42 as unknown as string,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when civic_did has wrong family (not did:civic:noesis:*)', () => {
        expect(() =>
            appendRegistryBusinessDidRegistered(makeChain(), {
                ...validPayload(),
                civic_did: 'did:biz:noesis:abc',
            }),
        ).toThrow(/CIVIC_DID_RE/);
    });

    it('throws TypeError when grid_name is empty string', () => {
        expect(() =>
            appendRegistryBusinessDidRegistered(makeChain(), {
                ...validPayload(),
                grid_name: '',
            }),
        ).toThrow(/grid_name/);
    });

    it('throws TypeError when registered_at_tick is negative (-1)', () => {
        expect(() =>
            appendRegistryBusinessDidRegistered(makeChain(), {
                ...validPayload(),
                registered_at_tick: -1,
            }),
        ).toThrow(/non-negative integer/);
    });

    it('throws TypeError when registered_at_tick is not an integer (1.5)', () => {
        expect(() =>
            appendRegistryBusinessDidRegistered(makeChain(), {
                ...validPayload(),
                registered_at_tick: 1.5,
            }),
        ).toThrow(/non-negative integer/);
    });

    it('throws TypeError when payload has an extra key', () => {
        expect(() =>
            appendRegistryBusinessDidRegistered(makeChain(), {
                ...validPayload(),
                extra: 'no',
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(/unexpected key set/);
    });

    it('throws TypeError when payload is missing a required key', () => {
        const partial = { ...validPayload() } as Record<string, unknown>;
        delete partial['grid_name'];
        expect(() =>
            appendRegistryBusinessDidRegistered(makeChain(), partial as unknown as ReturnType<typeof validPayload>),
        ).toThrow(/unexpected key set/);
    });
});

describe('appendRegistryBusinessDidRegistered — happy path', () => {
    it('appends to chain on valid payload and returns AuditEntry with correct eventType', () => {
        const audit = makeChain();
        const entry = appendRegistryBusinessDidRegistered(audit, validPayload());
        expect(entry).toBeDefined();
        expect(entry.eventType).toBe('registry.business_did_registered');
        expect(entry.actorDid).toBe('did:biz:noesis:acme-001');
        expect(entry.payload).toEqual(validPayload());
    });

    it('accepts tick=0 (boundary)', () => {
        const audit = makeChain();
        const entry = appendRegistryBusinessDidRegistered(audit, { ...validPayload(), registered_at_tick: 0 });
        expect(entry.eventType).toBe('registry.business_did_registered');
    });
});
