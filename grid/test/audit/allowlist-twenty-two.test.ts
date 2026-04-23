/**
 * Phase 11 (WHISPER-04) — broadcast allowlist 21→22 invariant.
 *
 * Extends Phase 10b baseline by exactly one member at position 22 (zero-indexed 21):
 *   - 'nous.whispered' (WHISPER-04, D-11-01)
 *
 * D-11-01: allowlist addition is exactly one — nous.whispered only.
 * No 'nous.whispered_ack', 'nous.whisper_read', or other whisper siblings.
 * No operator tier can read plaintext (T-10-03 — verified by three-tier CI gate, Wave 4).
 *
 * Sole producer: grid/src/whisper/appendNousWhispered.ts (Wave 2).
 * Payload (closed 4-tuple): { ciphertext_hash, from_did, tick, to_did }
 */
import { describe, expect, it } from 'vitest';
import { ALLOWLIST, isAllowlisted } from '../../src/audit/broadcast-allowlist.js';

/** Frozen expected tuple — Phase 11 position-22 discipline. */
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
    'bios.birth',       // position 20 (zero-indexed 19) — Phase 10b BIOS-02
    'bios.death',       // position 21 (zero-indexed 20) — Phase 10b BIOS-03
    'nous.whispered',   // position 22 (zero-indexed 21) — Phase 11 WHISPER-04
] as const;

describe('broadcast allowlist — Phase 11 invariant (WHISPER-04 D-11-01)', () => {
    it('has exactly 22 entries', () => {
        expect(ALLOWLIST.size).toBe(22);
    });

    it('contains nous.whispered at position 22 (index 21)', () => {
        expect(isAllowlisted('nous.whispered')).toBe(true);
        expect([...ALLOWLIST][21]).toBe('nous.whispered');
    });

    it('does NOT contain whisper sibling events (forbidden by D-11-01)', () => {
        const forbidden = [
            'nous.whispered_ack',
            'nous.whisper_read',
            'nous.whisper_inspect',
            'nous.whispered_plaintext',
        ];
        for (const event of forbidden) {
            expect(isAllowlisted(event)).toBe(false);
        }
    });

    it('preserves all 22 members in exact positional order', () => {
        expect([...ALLOWLIST]).toEqual([...EXPECTED_ORDER]);
    });

    it('preserves all 21 prior allowlist members (regression — Phase 10b)', () => {
        const priorMembers = [
            'nous.spawned', 'nous.moved', 'nous.spoke', 'nous.direct_message',
            'trade.proposed', 'trade.reviewed', 'trade.settled',
            'law.triggered', 'tick', 'grid.started', 'grid.stopped',
            'operator.inspected', 'operator.paused', 'operator.resumed',
            'operator.law_changed', 'operator.telos_forced',
            'telos.refined', 'operator.nous_deleted', 'ananke.drive_crossed',
            'bios.birth', 'bios.death',
        ];
        for (const m of priorMembers) expect(isAllowlisted(m)).toBe(true);
    });

    it('is frozen — mutation attempts throw TypeError', () => {
        expect(() => (ALLOWLIST as unknown as Set<string>).add('nous.whisper_read')).toThrow(TypeError);
        expect(() => (ALLOWLIST as unknown as Set<string>).delete('nous.whispered')).toThrow(TypeError);
    });
});
