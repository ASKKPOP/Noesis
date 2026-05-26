/**
 * Phase 37 Wave 1 — append-registry-civic-did-issued sole-producer test.
 *
 * Event: registry.civic_did_issued
 * Keys (alphabetical): civic_did, existence_did, grid_name, issued_at_tick
 * Actor: civic_did
 *
 * REG-06 — Tests fail RED until Task 1 creates grid/src/audit/append-registry-civic-did-issued.ts.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendRegistryCivicDidIssued } from '../../src/audit/append-registry-civic-did-issued.js';

function makeChain(): AuditChain {
    return new AuditChain();
}

function validPayload() {
    return {
        civic_did: 'did:civic:noesis:resident-001',
        existence_did: 'did:noesis:nous:alpha',
        grid_name: 'genesis',
        issued_at_tick: 42,
    };
}

describe('appendRegistryCivicDidIssued — payload validation', () => {
    it('throws TypeError when payload is null', () => {
        expect(() =>
            appendRegistryCivicDidIssued(makeChain(), null as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is an array', () => {
        expect(() =>
            appendRegistryCivicDidIssued(makeChain(), [] as unknown as ReturnType<typeof validPayload>),
        ).toThrow(/plain object/);
    });

    it('throws TypeError when payload is a primitive (string)', () => {
        expect(() =>
            appendRegistryCivicDidIssued(makeChain(), 'bad' as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when civic_did has wrong scheme (not did:civic:noesis:*)', () => {
        expect(() =>
            appendRegistryCivicDidIssued(makeChain(), {
                ...validPayload(),
                civic_did: 'did:noesis:bad',
            }),
        ).toThrow(/CIVIC_DID_RE/);
    });

    it('throws TypeError when civic_did is not a string', () => {
        expect(() =>
            appendRegistryCivicDidIssued(makeChain(), {
                ...validPayload(),
                civic_did: 42 as unknown as string,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when existence_did has wrong family (not did:noesis:nous:*)', () => {
        expect(() =>
            appendRegistryCivicDidIssued(makeChain(), {
                ...validPayload(),
                existence_did: 'did:civic:noesis:wrong',
            }),
        ).toThrow(/EXISTENCE_DID_RE/);
    });

    it('throws TypeError when grid_name is empty string', () => {
        expect(() =>
            appendRegistryCivicDidIssued(makeChain(), {
                ...validPayload(),
                grid_name: '',
            }),
        ).toThrow(/grid_name/);
    });

    it('throws TypeError when issued_at_tick is negative (-1)', () => {
        expect(() =>
            appendRegistryCivicDidIssued(makeChain(), {
                ...validPayload(),
                issued_at_tick: -1,
            }),
        ).toThrow(/non-negative integer/);
    });

    it('throws TypeError when issued_at_tick is not an integer (1.5)', () => {
        expect(() =>
            appendRegistryCivicDidIssued(makeChain(), {
                ...validPayload(),
                issued_at_tick: 1.5,
            }),
        ).toThrow(/non-negative integer/);
    });

    it('throws TypeError when payload has an extra key', () => {
        expect(() =>
            appendRegistryCivicDidIssued(makeChain(), {
                ...validPayload(),
                extra: 'no',
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(/unexpected key set/);
    });

    it('throws TypeError when payload is missing a required key', () => {
        const partial = { ...validPayload() } as Record<string, unknown>;
        delete partial['grid_name'];
        expect(() =>
            appendRegistryCivicDidIssued(makeChain(), partial as unknown as ReturnType<typeof validPayload>),
        ).toThrow(/unexpected key set/);
    });
});

describe('appendRegistryCivicDidIssued — happy path', () => {
    it('appends to chain on valid payload and returns AuditEntry with correct eventType', () => {
        const audit = makeChain();
        const entry = appendRegistryCivicDidIssued(audit, validPayload());
        expect(entry).toBeDefined();
        expect(entry.eventType).toBe('registry.civic_did_issued');
        expect(entry.actorDid).toBe('did:civic:noesis:resident-001');
        expect(entry.payload).toEqual(validPayload());
    });

    it('accepts tick=0 (boundary)', () => {
        const audit = makeChain();
        const entry = appendRegistryCivicDidIssued(audit, { ...validPayload(), issued_at_tick: 0 });
        expect(entry.eventType).toBe('registry.civic_did_issued');
    });
});
