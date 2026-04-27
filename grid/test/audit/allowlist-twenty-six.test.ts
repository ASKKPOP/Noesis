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

/** Frozen expected tuple — Phase 12 positions 23..26 discipline. */
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
    'proposal.opened',    // position 23 (zero-indexed 22) — Phase 12 VOTE-01
    'ballot.committed',   // position 24 (zero-indexed 23) — Phase 12 VOTE-02
    'ballot.revealed',    // position 25 (zero-indexed 24) — Phase 12 VOTE-03
    'proposal.tallied',   // position 26 (zero-indexed 25) — Phase 12 VOTE-04
    'operator.exported',  // position 27 (zero-indexed 26) — Phase 13 REPLAY-02 / D-13-09
] as const;

describe('broadcast allowlist — Phase 12 invariant (VOTE-01..04 D-12-01)', () => {
    it('has exactly 27 entries (Phase 13 extended from 26 — REPLAY-02)', () => {
        expect(ALLOWLIST.size).toBe(27);
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

    it('preserves all 27 members in exact positional order', () => {
        expect([...ALLOWLIST]).toEqual([...EXPECTED_ORDER]);
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
