/**
 * Phase 10b Wave 0 RED stub — UI-SPEC §Testing Contract #8.
 *
 * Clone of dashboard/test/lib/ananke-types.drift.test.ts adapted for the
 * Bios needs surface.
 *
 * Reads `brain/src/noesis_brain/bios/config.py` at test time, extracts
 * NEED_BASELINES values for ENERGY and SUSTENANCE, bucketizes each at
 * THRESHOLD_LOW=0.33 / THRESHOLD_HIGH=0.66, and asserts the result equals
 * the dashboard mirror's NEED_BASELINE_LEVEL[need] for every need.
 *
 * If Brain changes a baseline float (e.g. energy 0.3 → 0.5) without
 * updating the dashboard mirror, this test fails — making the SYNC-header
 * contract in bios-types.ts machine-enforced.
 *
 * Also verifies (UI-SPEC §Testing Contract #8):
 *   - NEED_ORDER deep-equals ['energy', 'sustenance']
 *   - NEED_GLYPH.energy === '\u26A1' (lightning bolt)
 *   - NEED_GLYPH.sustenance === '\u2B21' (white hexagon)
 *   - NEED_TO_DRIVE.energy === 'hunger'
 *   - NEED_TO_DRIVE.sustenance === 'safety'
 *
 * Purpose: T-10b-24 mitigation (baseline drift silent-corruption) +
 * D-10b-02 elevator-mapping freeze.
 *
 * RED at Wave 0:
 *   - brain/src/noesis_brain/bios/config.py does not exist
 *   - dashboard/src/lib/protocol/bios-types.ts does not exist
 *   - imports of NEED_BASELINE_LEVEL, NEED_ORDER, NEED_GLYPH, NEED_TO_DRIVE fail
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    NEED_BASELINE_LEVEL,
    NEED_ORDER,
    NEED_GLYPH,
    NEED_TO_DRIVE,
    type NeedName,
    type NeedLevel,
} from '@/lib/protocol/bios-types';

// Bucket function — UI-SPEC §Bucketing thresholds.
// THRESHOLD_LOW = 0.33, THRESHOLD_HIGH = 0.66 (no hysteresis on initial bucket).
function bucketize(v: number): NeedLevel {
    if (v >= 0.66) return 'high';
    if (v >= 0.33) return 'med';
    return 'low';
}

describe('bios-types.ts SYNC drift detector (D-10b-02 + T-10b-24)', () => {
    it('dashboard NEED_BASELINE_LEVEL matches Brain config NEED_BASELINES', () => {
        const configPath = resolve(
            __dirname,
            '../../../brain/src/noesis_brain/bios/config.py',
        );
        const source = readFileSync(configPath, 'utf8');

        // Parse NeedName.X: float lines for ENERGY + SUSTENANCE.
        const energyMatch = source.match(/NeedName\.ENERGY\s*:\s*([\d.]+)/);
        const sustenanceMatch = source.match(/NeedName\.SUSTENANCE\s*:\s*([\d.]+)/);

        expect(
            energyMatch,
            'NeedName.ENERGY baseline not found in bios/config.py',
        ).not.toBeNull();
        expect(
            sustenanceMatch,
            'NeedName.SUSTENANCE baseline not found in bios/config.py',
        ).not.toBeNull();

        const brainBaselines: Record<NeedName, number> = {
            energy: parseFloat(energyMatch![1]),
            sustenance: parseFloat(sustenanceMatch![1]),
        };

        // Phase 10b decision pin: both baselines = 0.3 (LOW bucket).
        expect(brainBaselines.energy, 'energy baseline pinned at 0.3').toBeCloseTo(0.3, 5);
        expect(brainBaselines.sustenance, 'sustenance baseline pinned at 0.3').toBeCloseTo(0.3, 5);

        // Each dashboard-mirror level must match the bucket of the Brain float.
        for (const need of NEED_ORDER as readonly NeedName[]) {
            const baseline = brainBaselines[need];
            const bucketed = bucketize(baseline);
            expect(
                bucketed,
                `drift: dashboard NEED_BASELINE_LEVEL.${need} = ` +
                    `${NEED_BASELINE_LEVEL[need]} but Brain ` +
                    `NEED_BASELINES[${need}] = ${baseline} bucketed = ${bucketed}`,
            ).toBe(NEED_BASELINE_LEVEL[need]);
        }
    });

    it('NEED_ORDER deep-equals ["energy", "sustenance"]', () => {
        expect([...NEED_ORDER]).toEqual(['energy', 'sustenance']);
    });

    it('NEED_BASELINE_LEVEL.energy === "low" && NEED_BASELINE_LEVEL.sustenance === "low"', () => {
        expect(NEED_BASELINE_LEVEL.energy).toBe('low');
        expect(NEED_BASELINE_LEVEL.sustenance).toBe('low');
    });

    it('NEED_GLYPH carries the pinned visual glyphs (D-10b decision)', () => {
        // U+26A1 lightning bolt for energy; U+2B21 white hexagon for sustenance.
        expect(NEED_GLYPH.energy).toBe('\u26A1');
        expect(NEED_GLYPH.sustenance).toBe('\u2B21');
    });

    it('NEED_TO_DRIVE encodes the elevator mapping (D-10b-02 frozen)', () => {
        // The two-mapping-only invariant: energy→hunger, sustenance→safety.
        // No mapping for curiosity, boredom, loneliness.
        expect(NEED_TO_DRIVE.energy).toBe('hunger');
        expect(NEED_TO_DRIVE.sustenance).toBe('safety');
        // Defensive: NEED_TO_DRIVE must have exactly 2 keys.
        expect(Object.keys(NEED_TO_DRIVE).sort()).toEqual(['energy', 'sustenance']);
    });

    it('bios-types.ts declares SYNC headers for both Brain and Grid', () => {
        const typesPath = resolve(
            __dirname,
            '../../src/lib/protocol/bios-types.ts',
        );
        const source = readFileSync(typesPath, 'utf8');
        // At least two SYNC pointers (Brain + Grid) so divergent copies surface on grep.
        const syncMatches = source.match(/SYNC:\s*mirrors/g) ?? [];
        expect(syncMatches.length).toBeGreaterThanOrEqual(2);
        expect(source).toMatch(/brain\/src\/noesis_brain\/bios/);
        expect(source).toMatch(/grid\/src\/bios/);
    });

    it('bios-types.ts contains NO need-baseline floats in executable code', () => {
        const typesPath = resolve(
            __dirname,
            '../../src/lib/protocol/bios-types.ts',
        );
        const source = readFileSync(typesPath, 'utf8');
        // Strip both line and block comments before grepping. Baseline floats
        // may appear in comments (reference material) but never in executable
        // code — the mirror only names buckets at runtime.
        const stripped = source
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '');
        expect(stripped).not.toMatch(/\b0\.[0-9]+/);
    });
});
