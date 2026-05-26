/**
 * Phase 36 Wave 0 — append-portal-did-issued sole-producer test.
 *
 * Event: portal.did_issued
 * Keys (alphabetical): human_or_nous_did, issued_at_tick, issuer_portal_id
 * Actor: human_or_nous_did
 *
 * Tests fail RED until Plan 04 creates grid/src/audit/append-portal-did-issued.ts.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendPortalDidIssued } from '../../src/audit/append-portal-did-issued.js';

const VALID_DID = 'did:noesis:human:0xabcdef0123456789';
const PORTAL_ID = 'portal-genesis-001';

function makeChain(): AuditChain {
    return new AuditChain();
}

function validPayload() {
    return {
        human_or_nous_did: VALID_DID,
        issued_at_tick: 42,
        issuer_portal_id: PORTAL_ID,
    };
}

describe('appendPortalDidIssued — payload validation', () => {
    it('throws TypeError when payload is null', () => {
        expect(() =>
            appendPortalDidIssued(makeChain(), null as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is an array', () => {
        expect(() =>
            appendPortalDidIssued(makeChain(), [] as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is a primitive (string)', () => {
        expect(() =>
            appendPortalDidIssued(makeChain(), 'bad' as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when human_or_nous_did is not a string', () => {
        expect(() =>
            appendPortalDidIssued(makeChain(), {
                ...validPayload(),
                human_or_nous_did: 42 as unknown as string,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when human_or_nous_did fails DID_RE', () => {
        expect(() =>
            appendPortalDidIssued(makeChain(), {
                ...validPayload(),
                human_or_nous_did: 'not-a-did',
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when issued_at_tick is negative (-1)', () => {
        expect(() =>
            appendPortalDidIssued(makeChain(), {
                ...validPayload(),
                issued_at_tick: -1,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when issued_at_tick is a float (1.5)', () => {
        expect(() =>
            appendPortalDidIssued(makeChain(), {
                ...validPayload(),
                issued_at_tick: 1.5,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when issued_at_tick is NaN', () => {
        expect(() =>
            appendPortalDidIssued(makeChain(), {
                ...validPayload(),
                issued_at_tick: NaN,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when issuer_portal_id is not a non-empty string', () => {
        expect(() =>
            appendPortalDidIssued(makeChain(), {
                ...validPayload(),
                issuer_portal_id: '',
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when extra key is present', () => {
        expect(() =>
            appendPortalDidIssued(makeChain(), {
                ...validPayload(),
                extra_key: 'should-not-be-here',
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when a required key is missing', () => {
        const { issued_at_tick: _omit, ...rest } = validPayload();
        expect(() =>
            appendPortalDidIssued(makeChain(), rest as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when a key has wrong name (typo)', () => {
        expect(() =>
            appendPortalDidIssued(makeChain(), {
                human_or_nous_did: VALID_DID,
                issued_tick: 42,          // wrong name
                issuer_portal_id: PORTAL_ID,
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });
});

describe('appendPortalDidIssued — happy path', () => {
    it('returns AuditEntry with eventType === portal.did_issued and actorDid === human_or_nous_did', () => {
        const chain = makeChain();
        const entry = appendPortalDidIssued(chain, validPayload());
        expect(entry.eventType).toBe('portal.did_issued');
        expect(entry.actorDid).toBe(VALID_DID);
    });

    it('accepts tick=0 (boundary)', () => {
        const chain = makeChain();
        const entry = appendPortalDidIssued(chain, { ...validPayload(), issued_at_tick: 0 });
        expect(entry.eventType).toBe('portal.did_issued');
    });
});
