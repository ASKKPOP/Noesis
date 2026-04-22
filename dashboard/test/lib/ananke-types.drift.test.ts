/**
 * Plan 10a-05 Task 1 — ananke-types.ts SYNC drift detector.
 *
 * Reads `brain/src/noesis_brain/ananke/config.py` at test time, extracts
 * DRIVE_BASELINES[DriveName.X]: float lines, bucketizes each with the same
 * hysteresis-aware bucket function as Brain's drives.py bucket(value, LOW)
 * would produce, and asserts the result equals the dashboard mirror's
 * DRIVE_BASELINE_LEVEL[drive] for every drive.
 *
 * If Brain changes a baseline float (e.g. curiosity 0.5 → 0.7) without
 * updating the dashboard mirror, this test fails — making the SYNC-header
 * contract in ananke-types.ts machine-enforced.
 *
 * Purpose: T-10a-24 mitigation (baseline drift silent-corruption).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    DRIVE_BASELINE_LEVEL,
    DRIVE_ORDER,
    type DriveName,
    type DriveLevel,
} from '@/lib/protocol/ananke-types';

// Same hysteresis-aware bucket as Brain's drives.py bucket(value, DriveLevel.LOW).
// Starting from LOW: leave LOW only when value > 0.33 + 0.02 = 0.35;
// go HIGH instead of MED if value > 0.66 + 0.02 = 0.68.
function bucketFromLow(v: number): DriveLevel {
    if (v > 0.68) return 'high';
    if (v > 0.35) return 'med';
    return 'low';
}

describe('ananke-types.ts SYNC drift detector', () => {
    it('dashboard DRIVE_BASELINE_LEVEL matches Brain config DRIVE_BASELINES', () => {
        // dashboard/test/lib/ananke-types.drift.test.ts → resolve upward to repo root.
        const configPath = resolve(
            __dirname,
            '../../../brain/src/noesis_brain/ananke/config.py',
        );
        const source = readFileSync(configPath, 'utf8');

        // Anchor on the DRIVE_BASELINES block so we don't accidentally match
        // DRIVE_RISE_RATES (which also has DriveName.X: float lines).
        const blockMatch = source.match(
            /DRIVE_BASELINES\s*:\s*dict\[[^\]]+\]\s*=\s*\{([\s\S]*?)\}/,
        );
        expect(
            blockMatch,
            'DRIVE_BASELINES dict not found in config.py',
        ).not.toBeNull();
        const block = blockMatch![1];

        // Parse DriveName.X: float lines inside the block.
        const pattern = /DriveName\.(\w+)\s*:\s*([\d.]+)/g;
        const brainBaselines: Record<string, number> = {};
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(block)) !== null) {
            brainBaselines[m[1].toLowerCase()] = parseFloat(m[2]);
        }

        // All 5 drives must be present in the Brain block.
        for (const drive of DRIVE_ORDER) {
            expect(
                brainBaselines[drive],
                `drive ${drive} missing from DRIVE_BASELINES in config.py`,
            ).toBeDefined();
        }

        // Each dashboard-mirror level must match the bucket-from-LOW of the
        // Brain float.
        for (const drive of DRIVE_ORDER as readonly DriveName[]) {
            const baseline = brainBaselines[drive];
            const bucketed = bucketFromLow(baseline);
            expect(
                bucketed,
                `drift: dashboard DRIVE_BASELINE_LEVEL.${drive} = ` +
                    `${DRIVE_BASELINE_LEVEL[drive]} but Brain ` +
                    `DRIVE_BASELINES[${drive}] = ${baseline} bucketed = ${bucketed}`,
            ).toBe(DRIVE_BASELINE_LEVEL[drive]);
        }
    });

    it('ananke-types.ts declares SYNC headers for both Brain and Grid', () => {
        const typesPath = resolve(
            __dirname,
            '../../src/lib/protocol/ananke-types.ts',
        );
        const source = readFileSync(typesPath, 'utf8');
        // Locked invariants: at least two SYNC pointers (Brain + Grid) so a
        // divergent copy surfaces on grep.
        const syncMatches = source.match(/SYNC:\s*mirrors/g) ?? [];
        expect(syncMatches.length).toBeGreaterThanOrEqual(2);
        expect(source).toMatch(/brain\/src\/noesis_brain\/ananke/);
        expect(source).toMatch(/grid\/src\/ananke/);
    });

    it('ananke-types.ts contains NO drive-baseline floats in executable code', () => {
        const typesPath = resolve(
            __dirname,
            '../../src/lib/protocol/ananke-types.ts',
        );
        const source = readFileSync(typesPath, 'utf8');
        // Strip both // line comments AND /* block comments */ before grepping.
        // Baseline floats may appear in comments (reference material) but never
        // in executable code — the mirror only names buckets at runtime.
        const stripped = source
            // Remove block comments (handles /** ... */ JSDoc).
            .replace(/\/\*[\s\S]*?\*\//g, '')
            // Remove line comments.
            .replace(/\/\/.*$/gm, '');
        // No float literals of the form 0.x outside comments.
        expect(stripped).not.toMatch(/\b0\.[0-9]+/);
    });
});
