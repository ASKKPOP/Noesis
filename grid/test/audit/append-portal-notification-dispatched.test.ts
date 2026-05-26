/**
 * Phase 36 Wave 0 — append-portal-notification-dispatched sole-producer test.
 *
 * Event: portal.notification_dispatched
 * Keys (alphabetical): dispatched_at_tick, notification_type, operator_did
 * Actor: operator_did
 *
 * Key decision (D-36-19): portal.notification_dispatched is a private-queue event
 * (server-pushed to one operator-DID), NOT a broadcast city event. It enters the
 * audit chain but does NOT enter ALLOWLIST_MEMBERS.
 *
 * Tests fail RED until Plan 04 creates grid/src/audit/append-portal-notification-dispatched.ts.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendPortalNotificationDispatched } from '../../src/audit/append-portal-notification-dispatched.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const VALID_OP_DID = 'did:civic:noesis:gen-001';
const NOTIF_TYPE = 'proposal_vote_open';

function makeChain(): AuditChain {
    return new AuditChain();
}

function validPayload() {
    return {
        dispatched_at_tick: 7,
        notification_type: NOTIF_TYPE,
        operator_did: VALID_OP_DID,
    };
}

describe('appendPortalNotificationDispatched — payload validation', () => {
    it('throws TypeError when payload is null', () => {
        expect(() =>
            appendPortalNotificationDispatched(makeChain(), null as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is an array', () => {
        expect(() =>
            appendPortalNotificationDispatched(makeChain(), [] as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when payload is a primitive (number)', () => {
        expect(() =>
            appendPortalNotificationDispatched(makeChain(), 0 as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when dispatched_at_tick is negative (-1)', () => {
        expect(() =>
            appendPortalNotificationDispatched(makeChain(), {
                ...validPayload(),
                dispatched_at_tick: -1,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when dispatched_at_tick is a float (1.5)', () => {
        expect(() =>
            appendPortalNotificationDispatched(makeChain(), {
                ...validPayload(),
                dispatched_at_tick: 1.5,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when dispatched_at_tick is NaN', () => {
        expect(() =>
            appendPortalNotificationDispatched(makeChain(), {
                ...validPayload(),
                dispatched_at_tick: NaN,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when notification_type is empty string', () => {
        expect(() =>
            appendPortalNotificationDispatched(makeChain(), {
                ...validPayload(),
                notification_type: '',
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when notification_type is not a string', () => {
        expect(() =>
            appendPortalNotificationDispatched(makeChain(), {
                ...validPayload(),
                notification_type: 42 as unknown as string,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when operator_did fails DID_RE', () => {
        expect(() =>
            appendPortalNotificationDispatched(makeChain(), {
                ...validPayload(),
                operator_did: 'not-a-did',
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when operator_did is not a string', () => {
        expect(() =>
            appendPortalNotificationDispatched(makeChain(), {
                ...validPayload(),
                operator_did: null as unknown as string,
            }),
        ).toThrow(TypeError);
    });

    it('throws TypeError when extra key is present', () => {
        expect(() =>
            appendPortalNotificationDispatched(makeChain(), {
                ...validPayload(),
                extra: 'leak',
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when a required key is missing', () => {
        const { notification_type: _omit, ...rest } = validPayload();
        expect(() =>
            appendPortalNotificationDispatched(makeChain(), rest as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });

    it('throws TypeError when key has wrong name', () => {
        expect(() =>
            appendPortalNotificationDispatched(makeChain(), {
                tick: 7,             // wrong name
                notification_type: NOTIF_TYPE,
                operator_did: VALID_OP_DID,
            } as unknown as ReturnType<typeof validPayload>),
        ).toThrow(TypeError);
    });
});

describe('appendPortalNotificationDispatched — happy path', () => {
    it('returns AuditEntry with eventType === portal.notification_dispatched and actorDid === operator_did', () => {
        const chain = makeChain();
        const entry = appendPortalNotificationDispatched(chain, validPayload());
        expect(entry.eventType).toBe('portal.notification_dispatched');
        expect(entry.actorDid).toBe(VALID_OP_DID);
    });
});

describe('appendPortalNotificationDispatched — allowlist exclusion (D-36-19)', () => {
    it('is NOT on the broadcast allowlist (private queue event per D-36-19)', () => {
        expect(ALLOWLIST_MEMBERS.includes('portal.notification_dispatched')).toBe(false);
    });
});
