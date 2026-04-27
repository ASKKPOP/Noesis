/**
 * Phase 11 (WHISPER-04) — broadcast allowlist 21→22 invariant.
 * Updated Phase 12 (VOTE-01..04): allowlist grew from 22→26; this file
 * retains Phase 11's position/member assertions which remain valid as
 * a regression guard. Size assertion updated to 26 per D-12-01.
 *
 * D-11-01: nous.whispered is at position 22 (index 21) — unchanged.
 * D-12-01: four governance events appended at positions 23..26 (indices 22..25).
 *
 * Sole producer: grid/src/whisper/appendNousWhispered.ts (Wave 2).
 * Payload (closed 4-tuple): { ciphertext_hash, from_did, tick, to_did }
 */
import { describe, expect, it } from 'vitest';
import { ALLOWLIST, isAllowlisted } from '../../src/audit/broadcast-allowlist.js';

describe('broadcast allowlist — Phase 11 invariant (WHISPER-04 D-11-01)', () => {
    it('has exactly 27 entries (Phase 13 extended from 26 — REPLAY-02 / D-13-09)', () => {
        expect(ALLOWLIST.size).toBe(27);
    });

    it('contains nous.whispered at position 22 (index 21) — unchanged by Phase 12', () => {
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

    it('preserves all 22 Phase-11-and-prior allowlist members (regression)', () => {
        const priorMembers = [
            'nous.spawned', 'nous.moved', 'nous.spoke', 'nous.direct_message',
            'trade.proposed', 'trade.reviewed', 'trade.settled',
            'law.triggered', 'tick', 'grid.started', 'grid.stopped',
            'operator.inspected', 'operator.paused', 'operator.resumed',
            'operator.law_changed', 'operator.telos_forced',
            'telos.refined', 'operator.nous_deleted', 'ananke.drive_crossed',
            'bios.birth', 'bios.death', 'nous.whispered',
        ];
        for (const m of priorMembers) expect(isAllowlisted(m)).toBe(true);
    });

    it('is frozen — mutation attempts throw TypeError', () => {
        expect(() => (ALLOWLIST as unknown as Set<string>).add('nous.whisper_read')).toThrow(TypeError);
        expect(() => (ALLOWLIST as unknown as Set<string>).delete('nous.whispered')).toThrow(TypeError);
    });
});
