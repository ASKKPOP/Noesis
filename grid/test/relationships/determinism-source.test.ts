/**
 * Phase 9 Plan 01 Task 3 — Wall-clock ban grep gate (D-9-12).
 *
 * Asserts that no file under grid/src/relationships/ uses wall-clock
 * primitives: Date.now, performance.now, setInterval, setTimeout, Math.random.
 *
 * All timing in the relationships module must be driven by entry.payload.tick
 * (audit chain tick) — not by the system clock. This is the D-9-12 invariant.
 *
 * Gate pattern: clones grid/test/dialogue/determinism-source.test.ts shape.
 * Walks the entire grid/src/relationships/ subtree (.ts files only).
 * Collects any offending files into an array; asserts toEqual([]) so the
 * failure message names the offending file.
 *
 * Runs on every commit (Wave 0 state = trivially passes; enforces Waves 1-4).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const GRID_SRC = join(__dirname, '../../src/relationships');

const WALL_CLOCK_PATTERN = /\b(?:Date\.now|performance\.now|setInterval|setTimeout|Math\.random)\b/;

function walk(dir: string, files: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, files);
        else if (full.endsWith('.ts')) files.push(full);
    }
    return files;
}

describe('relationships module — wall-clock ban (D-9-12)', () => {
    it('no file in grid/src/relationships/** uses wall-clock or randomness primitives', () => {
        const offenders: string[] = [];
        for (const f of walk(GRID_SRC)) {
            if (WALL_CLOCK_PATTERN.test(readFileSync(f, 'utf-8'))) {
                offenders.push(f);
            }
        }
        expect(offenders).toEqual([]);
    });
});
