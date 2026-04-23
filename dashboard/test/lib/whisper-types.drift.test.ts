/**
 * Phase 11 Wave 4 — Fourth protocol mirror drift detector (WHISPER-02 D-11-06).
 *
 * Clone of dashboard/test/lib/ananke-types.drift.test.ts (Plan 10a-05).
 *
 * Reads grid/src/whisper/types.ts AND brain/src/noesis_brain/whisper/types.py
 * as plain text and asserts both contain the WHISPERED_KEYS tuple in the
 * expected form. Also asserts dashboard/src/lib/protocol/whisper-types.ts
 * mirrors the same tuple.
 *
 * If grid or brain changes WHISPERED_KEYS without updating the dashboard mirror,
 * this test fails — making the SYNC-header contract machine-enforced.
 *
 * Per D-11-16: consolidation into @noesis/protocol-types is DEFERRED;
 * the three-way manual mirror pattern is intentional until Phase 12+.
 *
 * T-10-03 mitigation: cross-language shape parity prevents type drift that
 * could introduce plaintext fields into dashboard code.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Repo-relative paths from dashboard/test/lib/ directory
const GRID_TYPES_PATH = resolve(__dirname, '../../../grid/src/whisper/types.ts');
const BRAIN_TYPES_PATH = resolve(__dirname, '../../../brain/src/noesis_brain/whisper/types.py');
const DASH_TYPES_PATH = resolve(__dirname, '../../src/lib/protocol/whisper-types.ts');

const gridSrc = readFileSync(GRID_TYPES_PATH, 'utf8');
const brainSrc = readFileSync(BRAIN_TYPES_PATH, 'utf8');
const dashSrc = readFileSync(DASH_TYPES_PATH, 'utf8');

/** The canonical 4 keys of the NousWhisperedPayload tuple (alphabetical). */
const EXPECTED_KEYS = ['ciphertext_hash', 'from_did', 'tick', 'to_did'] as const;

describe('whisper-types drift detector (fourth mirror — D-11-06 WHISPER-02)', () => {

    it('grid source declares WHISPERED_KEYS as an alphabetical 4-tuple', () => {
        // Assert the const exists with the exact key order
        expect(gridSrc).toMatch(
            /WHISPERED_KEYS\s*=\s*\[.*'ciphertext_hash'.*'from_did'.*'tick'.*'to_did'.*\]\s*as const/s,
        );
        // Assert all 4 keys are present
        for (const k of EXPECTED_KEYS) {
            expect(gridSrc).toContain(k);
        }
    });

    it('brain source declares WHISPERED_KEYS as an alphabetical 4-tuple', () => {
        // Python tuple form: ("ciphertext_hash", "from_did", "tick", "to_did")
        expect(brainSrc).toMatch(
            /WHISPERED_KEYS\s*=\s*\(.*"ciphertext_hash".*"from_did".*"tick".*"to_did".*\)/s,
        );
        for (const k of EXPECTED_KEYS) {
            expect(brainSrc).toContain(k);
        }
    });

    it('dashboard mirror declares WHISPERED_KEYS', () => {
        expect(dashSrc).toMatch(/WHISPERED_KEYS/);
        for (const k of EXPECTED_KEYS) {
            expect(dashSrc).toContain(k);
        }
    });

    it('grid source has SYNC headers pointing to both brain and dashboard', () => {
        const syncMatches = gridSrc.match(/SYNC:\s*mirrors/g) ?? [];
        expect(
            syncMatches.length,
            'grid/src/whisper/types.ts should have ≥2 SYNC: mirrors headers (brain + dashboard)',
        ).toBeGreaterThanOrEqual(2);
        expect(gridSrc).toMatch(/brain\/src\/noesis_brain\/whisper/);
        expect(gridSrc).toMatch(/dashboard\/src\/lib\/protocol\/whisper-types/);
    });

    it('dashboard mirror has SYNC headers pointing to both grid and brain', () => {
        const syncMatches = dashSrc.match(/SYNC:\s*mirrors/g) ?? [];
        expect(
            syncMatches.length,
            'dashboard whisper-types.ts should have ≥2 SYNC: mirrors headers (grid + brain)',
        ).toBeGreaterThanOrEqual(2);
        expect(dashSrc).toMatch(/grid\/src\/whisper\/types/);
        expect(dashSrc).toMatch(/brain\/src\/noesis_brain\/whisper\/types/);
    });

    it('dashboard mirror contains no forbidden plaintext fields', () => {
        // The dashboard mirror must NEVER declare plaintext, body, message, utterance
        // as exported fields (WHISPER-02 boundary)
        const FORBIDDEN = ['plaintext', 'body', 'utterance', 'message'];
        for (const f of FORBIDDEN) {
            // Strip comments before checking (forbidden words may appear in explanatory comments)
            const stripped = dashSrc
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');
            expect(
                stripped,
                `dashboard whisper-types.ts must not declare exported field "${f}"`,
            ).not.toMatch(new RegExp(`\\b${f}\\b\\s*:`));
        }
    });

    it('grid and brain source both contain NousWhisperedPayload type', () => {
        expect(gridSrc).toMatch(/NousWhisperedPayload/);
        expect(brainSrc).toMatch(/NousWhisperedPayload/);
        expect(dashSrc).toMatch(/NousWhisperedPayload/);
    });
});
