/**
 * appendSkillInferred unit tests — Phase 18 sole producer (skill.inferred pos 38).
 *
 * Covers:
 *  - Happy path: valid 4-key payload commits and returns audit entry.
 *  - Closed-tuple rejection: missing key, extra key.
 *  - Self-report invariant: payload.learner_did === actorDid.
 *  - DID validation: actorDid, learner_did.
 *  - Tick validation: negative tick.
 *  - Hash format: skill_hash and source_event_hash (64-char hex).
 *  - SKILL_INFERRED_KEYS is alphabetically sorted.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendSkillInferred } from '../../src/skills/appendSkillInferred.js';
import { SKILL_INFERRED_KEYS, type SkillInferredPayload } from '../../src/skills/types.js';

const LEARNER_DID = 'did:noesis:learner';
const SKILL_HASH = 'a'.repeat(64);
const SOURCE_EVENT_HASH = 'c'.repeat(64);

const happy: SkillInferredPayload = {
    learner_did: LEARNER_DID,
    skill_hash: SKILL_HASH,
    source_event_hash: SOURCE_EVENT_HASH,
    tick: 5,
};

describe('appendSkillInferred — Phase 18 sole producer (skill.inferred pos 38)', () => {
    let chain: AuditChain;
    beforeEach(() => { chain = new AuditChain(); });

    it('appends valid skill.inferred entry', () => {
        const entry = appendSkillInferred(chain, LEARNER_DID, happy);
        expect(entry.eventType).toBe('skill.inferred');
        expect(entry.actorDid).toBe(LEARNER_DID);
        expect(entry.payload['skill_hash']).toBe(SKILL_HASH);
        expect(entry.payload['source_event_hash']).toBe(SOURCE_EVENT_HASH);
        expect(entry.payload['tick']).toBe(5);
    });

    it('commits to the chain (length increments)', () => {
        expect(chain.length).toBe(0);
        appendSkillInferred(chain, LEARNER_DID, happy);
        expect(chain.length).toBe(1);
    });

    it('rejects invalid actorDid', () => {
        expect(() => appendSkillInferred(chain, 'not-a-did', happy))
            .toThrow(/actorDid/);
    });

    it('rejects invalid learner_did', () => {
        const bad = { ...happy, learner_did: 'not-a-did' };
        expect(() => appendSkillInferred(chain, LEARNER_DID, bad))
            .toThrow(/learner_did/);
    });

    it('rejects self-report violation', () => {
        const bad = { ...happy, learner_did: 'did:noesis:other' };
        expect(() => appendSkillInferred(chain, LEARNER_DID, bad))
            .toThrow(/self-report/);
    });

    it('rejects negative tick', () => {
        const bad = { ...happy, tick: -1 };
        expect(() => appendSkillInferred(chain, LEARNER_DID, bad))
            .toThrow(/tick/);
    });

    it('rejects non-hex64 skill_hash', () => {
        const bad = { ...happy, skill_hash: 'short' };
        expect(() => appendSkillInferred(chain, LEARNER_DID, bad))
            .toThrow(/skill_hash/);
    });

    it('rejects non-hex64 source_event_hash', () => {
        const bad = { ...happy, source_event_hash: 'not-hex' };
        expect(() => appendSkillInferred(chain, LEARNER_DID, bad))
            .toThrow(/source_event_hash/);
    });

    it('rejects payload with extra key (closed-tuple enforcement)', () => {
        const bad = { ...happy, extra_field: 'value' } as any;
        expect(() => appendSkillInferred(chain, LEARNER_DID, bad))
            .toThrow(/closed-tuple/);
    });

    it('rejects payload with missing key (closed-tuple enforcement)', () => {
        // Removing source_event_hash: validator may fire on missing hash field before
        // reaching the closed-tuple check, depending on validation ordering in the emitter.
        const { source_event_hash: _, ...bad } = happy;
        expect(() => appendSkillInferred(chain, LEARNER_DID, bad as any))
            .toThrow(/source_event_hash|closed-tuple/);
    });

    it('SKILL_INFERRED_KEYS are alphabetically sorted', () => {
        const sorted = [...SKILL_INFERRED_KEYS].sort();
        expect(SKILL_INFERRED_KEYS).toEqual(sorted);
    });

    it('accepts tick=0 (boundary)', () => {
        const entry = appendSkillInferred(chain, LEARNER_DID, { ...happy, tick: 0 });
        expect(entry).toBeDefined();
    });
});
