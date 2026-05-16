/**
 * appendSkillRejected unit tests — Phase 18 sole producer (skill.rejected pos 39).
 *
 * Covers:
 *  - Happy path: all 3 valid rejection_reason values commit successfully.
 *  - Closed-tuple rejection: missing key, extra key.
 *  - Self-report invariant: payload.learner_did === actorDid.
 *  - DID validation: actorDid, learner_did.
 *  - Tick validation: negative tick.
 *  - rejection_reason enum: invalid reason throws.
 *  - SKILL_REJECTED_KEYS is alphabetically sorted.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendSkillRejected } from '../../src/skills/appendSkillRejected.js';
import { SKILL_REJECTED_KEYS, type SkillRejectedPayload } from '../../src/skills/types.js';

const LEARNER_DID = 'did:noesis:learner';

const happy: SkillRejectedPayload = {
    learner_did: LEARNER_DID,
    rejection_reason: 'low_trust',
    tick: 3,
};

describe('appendSkillRejected — Phase 18 sole producer (skill.rejected pos 39)', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('appends valid skill.rejected entry (low_trust)', () => {
        const entry = appendSkillRejected(chain, LEARNER_DID, happy);
        expect(entry.eventType).toBe('skill.rejected');
        expect(entry.actorDid).toBe(LEARNER_DID);
        expect(entry.payload['rejection_reason']).toBe('low_trust');
        expect(entry.payload['tick']).toBe(3);
    });

    it('accepts rejection_reason = structural_invalid', () => {
        const p = { ...happy, rejection_reason: 'structural_invalid' };
        const entry = appendSkillRejected(chain, LEARNER_DID, p);
        expect(entry.eventType).toBe('skill.rejected');
        expect(entry.payload['rejection_reason']).toBe('structural_invalid');
    });

    it('accepts rejection_reason = quota_exceeded', () => {
        const p = { ...happy, rejection_reason: 'quota_exceeded' };
        const entry = appendSkillRejected(chain, LEARNER_DID, p);
        expect(entry.eventType).toBe('skill.rejected');
        expect(entry.payload['rejection_reason']).toBe('quota_exceeded');
    });

    it('commits to the chain (length increments)', () => {
        expect(chain.length).toBe(0);
        appendSkillRejected(chain, LEARNER_DID, happy);
        expect(chain.length).toBe(1);
    });

    it('rejects invalid actorDid', () => {
        expect(() => appendSkillRejected(chain, 'not-a-did', happy))
            .toThrow(/actorDid/);
    });

    it('rejects invalid learner_did', () => {
        const bad = { ...happy, learner_did: 'not-a-did' };
        expect(() => appendSkillRejected(chain, LEARNER_DID, bad))
            .toThrow(/learner_did/);
    });

    it('rejects self-report violation', () => {
        const bad = { ...happy, learner_did: 'did:noesis:other' };
        expect(() => appendSkillRejected(chain, LEARNER_DID, bad))
            .toThrow(/self-report/);
    });

    it('rejects negative tick', () => {
        const bad = { ...happy, tick: -1 };
        expect(() => appendSkillRejected(chain, LEARNER_DID, bad))
            .toThrow(/tick/);
    });

    it('rejects invalid rejection_reason', () => {
        const bad = { ...happy, rejection_reason: 'hacked' } as any;
        expect(() => appendSkillRejected(chain, LEARNER_DID, bad))
            .toThrow(/rejection_reason/);
    });

    it('rejects payload with extra key (closed-tuple enforcement)', () => {
        const bad = { ...happy, extra_field: 'value' } as any;
        expect(() => appendSkillRejected(chain, LEARNER_DID, bad))
            .toThrow(/closed-tuple/);
    });

    it('rejects payload with missing key (closed-tuple enforcement)', () => {
        const { rejection_reason: _, ...bad } = happy;
        expect(() => appendSkillRejected(chain, LEARNER_DID, bad as any))
            .toThrow(/closed-tuple|rejection_reason/);
    });

    it('SKILL_REJECTED_KEYS are alphabetically sorted', () => {
        const sorted = [...SKILL_REJECTED_KEYS].sort();
        expect(SKILL_REJECTED_KEYS).toEqual(sorted);
    });

    it('accepts tick=0 (boundary)', () => {
        const entry = appendSkillRejected(chain, LEARNER_DID, { ...happy, tick: 0 });
        expect(entry).toBeDefined();
    });
});
