/**
 * work.stage_changed — closed 6-key payload, hashes only, and only along a real edge.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendWorkStageChanged, WORK_STAGE_CHANGED_KEYS, type WorkStageChangedPayload } from '../../src/audit/append-work-stage-changed.js';
import { ALLOWLIST } from '../../src/audit/broadcast-allowlist.js';

const H = 'a'.repeat(64);
const good = (): WorkStageChangedPayload => ({
    actor_did_hash: H, card_hash: 'b'.repeat(64), from_stage: 'plan', tick: 7, to_stage: 'build',
    work_id: '00000000-0000-4000-8000-000000000001',
});

describe('appendWorkStageChanged', () => {
    it('appends an allowlisted event with the closed payload', () => {
        const audit = new AuditChain();
        const e = appendWorkStageChanged(audit, good());
        expect(e.eventType).toBe('work.stage_changed');
        expect(ALLOWLIST.has(e.eventType)).toBe(true);
        expect(e.actorDid).toBe(H);
        expect(Object.keys(e.payload).sort()).toEqual([...WORK_STAGE_CHANGED_KEYS]);
    });

    it('takes creation as a move from enter', () => {
        const audit = new AuditChain();
        expect(() => appendWorkStageChanged(audit, { ...good(), from_stage: 'enter', to_stage: 'goal' })).not.toThrow();
        expect(() => appendWorkStageChanged(audit, { ...good(), from_stage: 'enter', to_stage: 'define' })).not.toThrow();
        expect(() => appendWorkStageChanged(audit, { ...good(), from_stage: 'enter', to_stage: 'build' })).toThrow(/no move/);
    });

    it('refuses a move that is not an edge, an extra key, a raw DID and a bad id', () => {
        const audit = new AuditChain();
        expect(() => appendWorkStageChanged(audit, { ...good(), from_stage: 'done', to_stage: 'goal' })).toThrow(/no move/);
        expect(() => appendWorkStageChanged(audit, { ...good(), from_stage: 'plan', to_stage: 'plan' })).toThrow(/no move/);
        expect(() => appendWorkStageChanged(audit, { ...good(), goal: 'a reading room' } as never)).toThrow(/closed-tuple/);
        expect(() => appendWorkStageChanged(audit, { ...good(), actor_did_hash: 'did:civic:noesis:sophia' })).toThrow(/HEX64/);
        expect(() => appendWorkStageChanged(audit, { ...good(), work_id: 'x' })).toThrow(/UUID/);
        expect(() => appendWorkStageChanged(audit, { ...good(), tick: -1 })).toThrow(/tick/);
        expect(audit.all().length).toBe(0);
    });
});
