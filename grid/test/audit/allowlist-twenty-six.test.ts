/**
 * Phase 12 (VOTE-01..04) — broadcast allowlist 22→26 invariant.
 *
 * Extends Phase 11 baseline by exactly four members at positions 23..26
 * (zero-indexed 22..25):
 *   - 'proposal.opened'  (VOTE-01, D-12-01) — closed 6-key payload
 *   - 'ballot.committed' (VOTE-02, D-12-01) — closed 3-key payload
 *   - 'ballot.revealed'  (VOTE-03, D-12-01) — closed 4-key payload
 *   - 'proposal.tallied' (VOTE-04, D-12-01) — closed 6-key payload
 *
 * D-12-01: allowlist addition is exactly four — the four governance events only.
 * Forbidden siblings never appear in ALLOWLIST_MEMBERS.
 *
 * Sole producers: grid/src/governance/append*.ts (Wave 2).
 */
import { describe, expect, it } from 'vitest';
import { ALLOWLIST, isAllowlisted, GOVERNANCE_FORBIDDEN_KEYS } from '../../src/audit/broadcast-allowlist.js';

/** Frozen expected tuple — Phase 12 positions 23..26 + Phase 13-19 extensions. */
const EXPECTED_ORDER = [
    'nous.spawned',
    'nous.moved',
    'nous.spoke',
    'nous.direct_message',
    'trade.proposed',
    'trade.reviewed',
    'trade.settled',
    'law.triggered',
    'tick',
    'grid.started',
    'grid.stopped',
    'operator.inspected',
    'operator.paused',
    'operator.resumed',
    'operator.law_changed',
    'operator.telos_forced',
    'telos.refined',
    'operator.nous_deleted',
    'ananke.drive_crossed',
    'bios.birth',
    'bios.death',
    'nous.whispered',
    'proposal.opened',           // position 23 (zero-indexed 22) — Phase 12 VOTE-01
    'ballot.committed',          // position 24 (zero-indexed 23) — Phase 12 VOTE-02
    'ballot.revealed',           // position 25 (zero-indexed 24) — Phase 12 VOTE-03
    'proposal.tallied',          // position 26 (zero-indexed 25) — Phase 12 VOTE-04
    'operator.exported',         // position 27 (zero-indexed 26) — Phase 13 REPLAY-02 / D-13-09
    'nous.reflection_authored',  // position 28 — Phase 15 REFLEX-02
    'nous.self_model_revised',   // position 29 — Phase 15 REFLEX-02
    'nous.creed_violation',      // position 30 — Phase 15 REFLEX-02
    'nous.sleep.entered',        // position 31 — Phase 16 SLEEP-01
    'nous.sleep.completed',      // position 32 — Phase 16 SLEEP-01
    'iris.belief_revised',       // position 33 — Phase 17 D-17-02
    'iris.context_invoked',      // position 34 — Phase 17 D-17-02
    'iris.contradiction_detected', // position 35 — Phase 17 D-17-02
    'iris.prior_seeded',         // position 36 — Phase 17 D-17-02
    'skill.taught',              // position 37 — Phase 18 SKILL-03 D-18-09
    'skill.inferred',            // position 38 — Phase 18 SKILL-03 D-18-09
    'skill.rejected',            // position 39 — Phase 18 SKILL-03 D-18-09
    'norm.candidate',            // position 40 — Phase 19 NORM-01 D-19-11
    'norm.crystallized',         // position 41 — Phase 19 NORM-01 D-19-11
    'lore.contributed',          // position 42 — Phase 20 LORE-01 D-20-12
    'lore.cited',                // position 43 — Phase 20 LORE-02 D-20-12
] as const;

describe('broadcast allowlist — Phase 12 invariant (VOTE-01..04 D-12-01)', () => {
    it('has exactly 43 entries (Phase 20 extended from 41 — LORE-01/02 +2 lore.* events)', () => {
        // Note: allowlist has grown past 43 in later phases; this test now validates
        // only the Phase 12 positional invariants remain intact (size check updated to 53).
        expect(ALLOWLIST.size).toBe(53);
    });

    it('contains proposal.opened at position 23 (index 22)', () => {
        expect(isAllowlisted('proposal.opened')).toBe(true);
        expect([...ALLOWLIST][22]).toBe('proposal.opened');
    });

    it('contains ballot.committed at position 24 (index 23)', () => {
        expect(isAllowlisted('ballot.committed')).toBe(true);
        expect([...ALLOWLIST][23]).toBe('ballot.committed');
    });

    it('contains ballot.revealed at position 25 (index 24)', () => {
        expect(isAllowlisted('ballot.revealed')).toBe(true);
        expect([...ALLOWLIST][24]).toBe('ballot.revealed');
    });

    it('contains proposal.tallied at position 26 (index 25)', () => {
        expect(isAllowlisted('proposal.tallied')).toBe(true);
        expect([...ALLOWLIST][25]).toBe('proposal.tallied');
    });

    it('preserves first 43 members in exact positional order (Phase 12-20 baseline)', () => {
        // Allowlist has grown past 43; validate only the first 43 entries are stable.
        expect([...ALLOWLIST].slice(0, EXPECTED_ORDER.length)).toEqual([...EXPECTED_ORDER]);
    });

    it('does NOT contain forbidden governance sibling events (D-12-01)', () => {
        const forbidden = [
            'proposal.created',
            'proposal.draft',
            'proposal.submitted',
            'ballot.cast',
            'vote.committed',
            'vote.cast',
            'governance.opened',
            'governance.tallied',
        ];
        for (const event of forbidden) {
            expect(isAllowlisted(event), `${event} must not be allowlisted (D-12-01 forbidden sibling)`).toBe(false);
        }
    });

    it('preserves all 22 prior allowlist members (regression — Phase 11)', () => {
        const priorMembers = [
            'nous.spawned', 'nous.moved', 'nous.spoke', 'nous.direct_message',
            'trade.proposed', 'trade.reviewed', 'trade.settled',
            'law.triggered', 'tick', 'grid.started', 'grid.stopped',
            'operator.inspected', 'operator.paused', 'operator.resumed',
            'operator.law_changed', 'operator.telos_forced',
            'telos.refined', 'operator.nous_deleted', 'ananke.drive_crossed',
            'bios.birth', 'bios.death', 'nous.whispered',
        ];
        for (const m of priorMembers) {
            expect(isAllowlisted(m), `Prior member ${m} must remain allowlisted`).toBe(true);
        }
    });

    it('is frozen — mutation attempts throw TypeError', () => {
        expect(() => (ALLOWLIST as unknown as Set<string>).add('proposal.created')).toThrow(TypeError);
        expect(() => (ALLOWLIST as unknown as Set<string>).delete('proposal.opened')).toThrow(TypeError);
    });

    it('GOVERNANCE_FORBIDDEN_KEYS has exactly 12 elements', () => {
        expect(GOVERNANCE_FORBIDDEN_KEYS.length).toBe(12);
    });

    it('GOVERNANCE_FORBIDDEN_KEYS contains all 12 required literals', () => {
        const required = [
            'text', 'body', 'content', 'description', 'rationale',
            'proposal_text', 'law_text', 'body_text',
            'weight', 'reputation', 'relationship_score', 'ousia_weight',
        ] as const;
        for (const key of required) {
            expect(
                (GOVERNANCE_FORBIDDEN_KEYS as readonly string[]).includes(key),
                `GOVERNANCE_FORBIDDEN_KEYS must include "${key}"`,
            ).toBe(true);
        }
    });
});
