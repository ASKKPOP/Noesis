/**
 * appendSkillTaught unit tests — Phase 18 sole producer (skill.taught pos 37).
 *
 * Covers:
 *  - Happy path: valid 5-key payload commits and returns audit entry.
 *  - Closed-tuple rejection: missing key, extra key, forbidden key (skill_body).
 *  - Self-report invariant: payload.learner_did === actorDid.
 *  - DID validation: actorDid, learner_did, teacher_did.
 *  - Tick validation: negative tick.
 *  - Hash format: skill_hash and parent_hash (64-char hex).
 *  - SKILL_TAUGHT_KEYS is alphabetically sorted.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendSkillTaught } from '../../src/skills/appendSkillTaught.js';
import { SKILL_TAUGHT_KEYS, type SkillTaughtPayload } from '../../src/skills/types.js';

const LEARNER_DID = 'did:noesis:learner';
const TEACHER_DID = 'did:noesis:teacher';
const SKILL_HASH = 'a'.repeat(64);
const PARENT_HASH = 'b'.repeat(64);

const happy: SkillTaughtPayload = {
    learner_did: LEARNER_DID,
    parent_hash: PARENT_HASH,
    skill_hash: SKILL_HASH,
    teacher_did: TEACHER_DID,
    tick: 1,
};

describe('appendSkillTaught — Phase 18 sole producer (skill.taught pos 37)', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('appends valid skill.taught entry', () => {
        const entry = appendSkillTaught(chain, LEARNER_DID, happy);
        expect(entry.eventType).toBe('skill.taught');
        expect(entry.actorDid).toBe(LEARNER_DID);
        expect(entry.payload['skill_hash']).toBe(SKILL_HASH);
        expect(entry.payload['teacher_did']).toBe(TEACHER_DID);
        expect(entry.payload['parent_hash']).toBe(PARENT_HASH);
        expect(entry.payload['tick']).toBe(1);
    });

    it('commits to the chain (length increments)', () => {
        expect(chain.length).toBe(0);
        appendSkillTaught(chain, LEARNER_DID, happy);
        expect(chain.length).toBe(1);
    });

    it('rejects invalid actorDid', () => {
        expect(() => appendSkillTaught(chain, 'not-a-did', happy))
            .toThrow(/actorDid/);
    });

    it('rejects invalid learner_did', () => {
        const bad = { ...happy, learner_did: 'not-a-did' };
        expect(() => appendSkillTaught(chain, LEARNER_DID, bad))
            .toThrow(/learner_did/);
    });

    it('rejects self-report violation', () => {
        const bad = { ...happy, learner_did: 'did:noesis:other' };
        expect(() => appendSkillTaught(chain, LEARNER_DID, bad))
            .toThrow(/self-report/);
    });

    it('rejects negative tick', () => {
        const bad = { ...happy, tick: -1 };
        expect(() => appendSkillTaught(chain, LEARNER_DID, bad))
            .toThrow(/tick/);
    });

    it('rejects invalid teacher_did', () => {
        const bad = { ...happy, teacher_did: 'not-a-did' };
        expect(() => appendSkillTaught(chain, LEARNER_DID, bad))
            .toThrow(/teacher_did/);
    });

    it('rejects non-hex64 skill_hash', () => {
        const bad = { ...happy, skill_hash: 'short' };
        expect(() => appendSkillTaught(chain, LEARNER_DID, bad))
            .toThrow(/skill_hash/);
    });

    it('rejects non-hex64 parent_hash', () => {
        const bad = { ...happy, parent_hash: 'short' };
        expect(() => appendSkillTaught(chain, LEARNER_DID, bad))
            .toThrow(/parent_hash/);
    });

    it('rejects payload with extra key (closed-tuple enforcement)', () => {
        const bad = { ...happy, extra_field: 'value' } as any;
        expect(() => appendSkillTaught(chain, LEARNER_DID, bad))
            .toThrow(/closed-tuple/);
    });

    it('rejects payload with missing key (closed-tuple enforcement)', () => {
        // Removing parent_hash: validator may fire on missing hash field before reaching
        // the closed-tuple check, depending on validation ordering in the emitter.
        const { parent_hash: _, ...bad } = happy;
        expect(() => appendSkillTaught(chain, LEARNER_DID, bad as any))
            .toThrow(/parent_hash|closed-tuple/);
    });

    it('rejects payload with forbidden skill body key', () => {
        const bad = { ...happy, skill_body: 'instruction text' } as any;
        expect(() => appendSkillTaught(chain, LEARNER_DID, bad))
            .toThrow(/closed-tuple|privacy/);
    });

    it('SKILL_TAUGHT_KEYS are alphabetically sorted', () => {
        const sorted = [...SKILL_TAUGHT_KEYS].sort();
        expect(SKILL_TAUGHT_KEYS).toEqual(sorted);
    });

    it('accepts tick=0 (boundary)', () => {
        const entry = appendSkillTaught(chain, LEARNER_DID, { ...happy, tick: 0 });
        expect(entry).toBeDefined();
    });
});
