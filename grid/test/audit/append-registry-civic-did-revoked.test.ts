/**
 * Phase 37 Wave 1 — append-registry-civic-did-revoked sole-producer test.
 *
 * Event: registry.civic_did_revoked
 * Keys (alphabetical): civic_did, court_conviction_ref_hash, grid_name, revoked_at_tick
 * Actor: civic_did
 *
 * Privacy invariant: court_conviction_ref is HASHED (HEX64 SHA-256).
 * Plaintext ref lives in civic_did_registry.court_conviction_ref MySQL column only.
 *
 * REG-06 — Tests fail RED until Task 1 creates grid/src/audit/append-registry-civic-did-revoked.ts.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendRegistryCivicDidRevoked } from '../../src/audit/append-registry-civic-did-revoked.js';

function makeChain(): AuditChain {
    return new AuditChain();
}

const VALID_HEX64 = 'a'.repeat(64);

function validPayload() {
    return {
        civic_did: 'did:civic:noesis:resident-001',
        court_conviction_ref_hash: VALID_HEX64,
        grid_name: 'genesis',
        revoked_at_tick: 100,
    };
}

describe('appendRegistryCivicDidRevoked — payload validation', () => {
    it('throws TypeError when payload is null', () => {
        expect(() =>
            appendRegistryCivicDidRevoked(makeChain(), null as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is an array', () => {
        expect(() =>
            appendRegistryCivicDidRevoked(makeChain(), [] as unknown as ReturnType<typeof validPayload>),
        ).toThrow(/plain object/);
    });

    it('throws TypeError when payload is a primitive (string)', () => {
        expect(() =>
            appendRegistryCivicDidRevoked(makeChain(), 'bad' as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when civic_did has wrong scheme (not did:civic:noesis:*)', () => {
        expect(() =>
            appendRegistryCivicDidRevoked(makeChain(), {
                ...validPayload(),
                civic_did: 'did:noesis:bad',
            }),
        ).toThrow(/CIVIC_DID_RE/);
    });

    it('throws TypeError when court_conviction_ref_hash is not 64 hex chars (too short)', () => {
        expect(() =>
            appendRegistryCivicDidRevoked(makeChain(), {
                ...validPayload(),
                court_conviction_ref_hash: 'abc'.repeat(20), // 60 chars, not 64
            }),
        ).toThrow(/HEX64_RE/);
    });

    it('throws TypeError when court_conviction_ref_hash contains non-hex chars', () => {
        expect(() =>
            appendRegistryCivicDidRevoked(makeChain(), {
                ...validPayload(),
                court_conviction_ref_hash: 'g'.repeat(64), // 'g' is not hex
            }),
        ).toThrow(/HEX64_RE/);
    });

    it('throws TypeError when court_conviction_ref_hash is exactly 65 chars (too long)', () => {
        expect(() =>
            appendRegistryCivicDidRevoked(makeChain(), {
                ...validPayload(),
                court_conviction_ref_hash: 'a'.repeat(65),
            }),
        ).toThrow(/HEX64_RE/);
    });

    it('throws TypeError when court_conviction_ref_hash is not a string', () => {
        expect(() =>
            appendRegistryCivicDidRevoked(makeChain(), {
                ...validPayload(),
                court_conviction_ref_hash: 42 as unknown as string,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when grid_name is empty string', () => {
        expect(() =>
            appendRegistryCivicDidRevoked(makeChain(), {
                ...validPayload(),
                grid_name: '',
            }),
        ).toThrow(/grid_name/);
    });

    it('throws TypeError when revoked_at_tick is negative (-1)', () => {
        expect(() =>
            appendRegistryCivicDidRevoked(makeChain(), {
                ...validPayload(),
                revoked_at_tick: -1,
            }),
        ).toThrow(/non-negative integer/);
    });

    it('throws TypeError when revoked_at_tick is not an integer (1.5)', () => {
        expect(() =>
            appendRegistryCivicDidRevoked(makeChain(), {
                ...validPayload(),
                revoked_at_tick: 1.5,
            }),
        ).toThrow(/non-negative integer/);
    });

    it('throws TypeError when payload has an extra key', () => {
        expect(() =>
            appendRegistryCivicDidRevoked(makeChain(), {
                ...validPayload(),
                extra: 'no',
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(/unexpected key set/);
    });

    it('throws TypeError when payload is missing a required key', () => {
        // Deleting court_conviction_ref_hash — the HEX64 guard fires before the
        // closed-tuple check (step 2b runs before step 5). Either way the
        // function throws TypeError.
        const partial = { ...validPayload() } as Record<string, unknown>;
        delete partial['court_conviction_ref_hash'];
        expect(() =>
            appendRegistryCivicDidRevoked(makeChain(), partial as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });
});

describe('appendRegistryCivicDidRevoked — happy path', () => {
    it('appends to chain on valid payload and returns AuditEntry with correct eventType', () => {
        const audit = makeChain();
        const entry = appendRegistryCivicDidRevoked(audit, validPayload());
        expect(entry).toBeDefined();
        expect(entry.eventType).toBe('registry.civic_did_revoked');
        expect(entry.actorDid).toBe('did:civic:noesis:resident-001');
        expect(entry.payload).toEqual(validPayload());
    });

    it('accepts lowercase hex court_conviction_ref_hash', () => {
        const audit = makeChain();
        const entry = appendRegistryCivicDidRevoked(audit, {
            ...validPayload(),
            court_conviction_ref_hash: 'f'.repeat(64),
        });
        expect(entry.eventType).toBe('registry.civic_did_revoked');
    });
});
