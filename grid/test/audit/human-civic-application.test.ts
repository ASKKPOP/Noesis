/**
 * Human Civic-DID application pipeline (2026-06-10) — producer boundaries,
 * allowlist extension 86 → 91, and the Polis charter-review rules.
 *
 * Test matrix:
 *   - All 5 producers succeed with valid payloads and return AuditEntry
 *   - Human DID regex rejects Nous DIDs (and vice versa for the human issuance event)
 *   - Closed-tuple: extra key throws TypeError
 *   - reason_code outside the closed set throws TypeError
 *   - ALLOWLIST_MEMBERS positions 87-91 are the five new events
 *   - reviewHumanCivicApplication: severity order + each rejection path + approval
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';
import { appendPortalRegistrationRequested } from '../../src/audit/append-portal-registration-requested.js';
import { appendPolisRegistrationPending } from '../../src/audit/append-polis-registration-pending.js';
import { appendPortalRegistrationApproved } from '../../src/audit/append-portal-registration-approved.js';
import { appendPortalRegistrationRejected } from '../../src/audit/append-portal-registration-rejected.js';
import { appendRegistryCivicDidIssuedHuman } from '../../src/audit/append-registry-civic-did-issued-human.js';
import {
    HUMAN_CIVIC_OATH,
    reviewHumanCivicApplication,
} from '../../src/civic-registry/human-charter-review.js';

const APP_ID = '0b2e7a14-9c1d-4f6e-8a3b-5d7c9e1f2a4b';
const HUMAN_DID_SIWE = 'did:noesis:human:0xabc123def4567890abc123def4567890abc12345';
const HUMAN_DID_EMAIL = 'did:noesis:human:email:0b2e7a14-9c1d-4f6e-8a3b-5d7c9e1f2a4b';
const NOUS_DID = 'did:noesis:nous:sophia';
const CIVIC_DID_HUMAN = 'did:civic:noesis:human:0b2e7a14-9c1d-4f6e-8a3b-5d7c9e1f2a4b';

describe('human civic application producers — 8-step discipline', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('portal.registration_requested succeeds for SIWE and email DIDs', () => {
        for (const did of [HUMAN_DID_SIWE, HUMAN_DID_EMAIL]) {
            const entry = appendPortalRegistrationRequested(chain, {
                application_id: APP_ID,
                grid_name: 'genesis',
                human_did: did,
                requested_at_tick: 100,
            });
            expect(entry.eventType).toBe('portal.registration_requested');
            expect(entry.actorDid).toBe(APP_ID);
        }
    });

    it('portal.registration_requested rejects a Nous DID (human pipeline only)', () => {
        expect(() => appendPortalRegistrationRequested(chain, {
            application_id: APP_ID,
            grid_name: 'genesis',
            human_did: NOUS_DID,
            requested_at_tick: 100,
        })).toThrow(TypeError);
    });

    it('polis.registration_pending succeeds and closes its 3-key tuple', () => {
        const entry = appendPolisRegistrationPending(chain, {
            application_id: APP_ID,
            forwarded_at_tick: 100,
            grid_name: 'genesis',
        });
        expect(entry.eventType).toBe('polis.registration_pending');
        expect(() => appendPolisRegistrationPending(chain, {
            application_id: APP_ID,
            forwarded_at_tick: 100,
            grid_name: 'genesis',
            // @ts-expect-error — intentional extra key (closed-tuple violation)
            extra: 'x',
        })).toThrow(TypeError);
    });

    it('portal.registration_approved succeeds with valid payload', () => {
        const entry = appendPortalRegistrationApproved(chain, {
            application_id: APP_ID,
            approved_at_tick: 101,
            grid_name: 'genesis',
            human_did: HUMAN_DID_SIWE,
        });
        expect(entry.eventType).toBe('portal.registration_approved');
    });

    it('portal.registration_rejected enforces the closed reason_code set', () => {
        const entry = appendPortalRegistrationRejected(chain, {
            application_id: APP_ID,
            grid_name: 'genesis',
            reason_code: 'oath_mismatch',
            rejected_at_tick: 101,
        });
        expect(entry.eventType).toBe('portal.registration_rejected');
        expect(() => appendPortalRegistrationRejected(chain, {
            application_id: APP_ID,
            grid_name: 'genesis',
            // @ts-expect-error — free-text reason must be refused (privacy)
            reason_code: 'the applicant statement was rude',
            rejected_at_tick: 101,
        })).toThrow(TypeError);
    });

    it('registry.civic_did_issued_human accepts human DIDs and rejects Nous existence DIDs', () => {
        const entry = appendRegistryCivicDidIssuedHuman(chain, {
            civic_did: CIVIC_DID_HUMAN,
            grid_name: 'genesis',
            human_did: HUMAN_DID_SIWE,
            issued_at_tick: 101,
        });
        expect(entry.eventType).toBe('registry.civic_did_issued_human');
        expect(entry.actorDid).toBe(CIVIC_DID_HUMAN);
        expect(() => appendRegistryCivicDidIssuedHuman(chain, {
            civic_did: CIVIC_DID_HUMAN,
            grid_name: 'genesis',
            human_did: NOUS_DID,
            issued_at_tick: 101,
        })).toThrow(TypeError);
    });
});

describe('allowlist extension 86 → 91', () => {
    it('positions 87-91 carry the five new events (1-indexed comments = 0-indexed array)', () => {
        const members = ALLOWLIST_MEMBERS as readonly string[];
        expect(members.length).toBe(151); // …L3b orbital.* → 117; human.approval.* → 120; portal.account_endowed → 121; Phase 47 police.* → 123
        expect(members[86]).toBe('portal.registration_requested');
        expect(members[87]).toBe('polis.registration_pending');
        expect(members[88]).toBe('portal.registration_approved');
        expect(members[89]).toBe('portal.registration_rejected');
        expect(members[90]).toBe('registry.civic_did_issued_human');
    });
});

describe('reviewHumanCivicApplication — Genesis Polis charter rules', () => {
    const base = {
        oathText: HUMAN_CIVIC_OATH,
        statement: 'I want to study how autonomous minds self-govern.',
        frozen: false,
        banned: false,
        alreadyRegistered: false,
    };

    it('approves a clean application', () => {
        expect(reviewHumanCivicApplication(base)).toEqual({ approved: true });
    });

    it('rejects sanctions first (severity order)', () => {
        expect(reviewHumanCivicApplication({ ...base, frozen: true, oathText: 'wrong' }))
            .toEqual({ approved: false, reasonCode: 'account_sanctioned' });
        expect(reviewHumanCivicApplication({ ...base, banned: true }))
            .toEqual({ approved: false, reasonCode: 'account_sanctioned' });
    });

    it('rejects duplicates before oath problems', () => {
        expect(reviewHumanCivicApplication({ ...base, alreadyRegistered: true, oathText: 'wrong' }))
            .toEqual({ approved: false, reasonCode: 'already_registered' });
    });

    it('rejects a non-verbatim oath', () => {
        expect(reviewHumanCivicApplication({ ...base, oathText: HUMAN_CIVIC_OATH.toLowerCase() }))
            .toEqual({ approved: false, reasonCode: 'oath_mismatch' });
    });

    it('rejects out-of-bounds statements', () => {
        expect(reviewHumanCivicApplication({ ...base, statement: 'short' }))
            .toEqual({ approved: false, reasonCode: 'statement_invalid' });
        expect(reviewHumanCivicApplication({ ...base, statement: 'x'.repeat(2001) }))
            .toEqual({ approved: false, reasonCode: 'statement_invalid' });
    });
});
