/**
 * Phase 36 Wave 0 — append-portal-did-revoked sole-producer test.
 *
 * Event: portal.did_revoked
 * Keys (alphabetical): human_or_nous_did, revoked_at_tick, revoker_portal_id
 * Actor: human_or_nous_did
 *
 * Tests fail RED until Plan 04 creates grid/src/audit/append-portal-did-revoked.ts.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendPortalDidRevoked } from '../../src/audit/append-portal-did-revoked.js';

const VALID_DID = 'did:noesis:human:0xabcdef0123456789';
const PORTAL_ID = 'portal-genesis-001';

function makeChain(): AuditChain {
    return new AuditChain();
}

function validPayload() {
    return {
        human_or_nous_did: VALID_DID,
        revoked_at_tick: 99,
        revoker_portal_id: PORTAL_ID,
    };
}

describe('appendPortalDidRevoked — payload validation', () => {
    it('throws TypeError when payload is null', () => {
        expect(() =>
            appendPortalDidRevoked(makeChain(), null as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is an array', () => {
        expect(() =>
            appendPortalDidRevoked(makeChain(), [] as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is a primitive (number)', () => {
        expect(() =>
            appendPortalDidRevoked(makeChain(), 5 as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when human_or_nous_did is not a string', () => {
        expect(() =>
            appendPortalDidRevoked(makeChain(), {
                ...validPayload(),
                human_or_nous_did: null as unknown as string,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when human_or_nous_did fails DID_RE', () => {
        expect(() =>
            appendPortalDidRevoked(makeChain(), {
                ...validPayload(),
                human_or_nous_did: 'invalid-did-format',
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when revoked_at_tick is negative (-1)', () => {
        expect(() =>
            appendPortalDidRevoked(makeChain(), {
                ...validPayload(),
                revoked_at_tick: -1,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when revoked_at_tick is a float (1.5)', () => {
        expect(() =>
            appendPortalDidRevoked(makeChain(), {
                ...validPayload(),
                revoked_at_tick: 1.5,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when revoked_at_tick is NaN', () => {
        expect(() =>
            appendPortalDidRevoked(makeChain(), {
                ...validPayload(),
                revoked_at_tick: NaN,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when revoker_portal_id is empty string', () => {
        expect(() =>
            appendPortalDidRevoked(makeChain(), {
                ...validPayload(),
                revoker_portal_id: '',
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when extra key is present', () => {
        expect(() =>
            appendPortalDidRevoked(makeChain(), {
                ...validPayload(),
                extra_key: 'should-not-be-here',
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when a required key is missing', () => {
        const { revoker_portal_id: _omit, ...rest } = validPayload();
        expect(() =>
            appendPortalDidRevoked(makeChain(), rest as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when a key has wrong name (typo)', () => {
        expect(() =>
            appendPortalDidRevoked(makeChain(), {
                human_or_nous_did: VALID_DID,
                revoked_tick: 99,          // wrong name
                revoker_portal_id: PORTAL_ID,
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });
});

describe('appendPortalDidRevoked — happy path', () => {
    it('returns AuditEntry with eventType === portal.did_revoked and actorDid === human_or_nous_did', () => {
        const chain = makeChain();
        const entry = appendPortalDidRevoked(chain, validPayload());
        expect(entry.eventType).toBe('portal.did_revoked');
        expect(entry.actorDid).toBe(VALID_DID);
    });

    it('accepts tick=0 (boundary)', () => {
        const chain = makeChain();
        const entry = appendPortalDidRevoked(chain, { ...validPayload(), revoked_at_tick: 0 });
        expect(entry.eventType).toBe('portal.did_revoked');
    });
});
