/**
 * Phase 10b Wave 0 RED stub — T-09-04 / D-10b-09 wall-clock grep gate.
 *
 * Clones grid/test/ci/ananke-no-walltime.test.ts shape.
 *
 * Scope: walks BOTH grid/src/bios/** AND grid/src/chronos/** recursively.
 * For each .ts file (excluding .test.ts and .d.ts), asserts that the
 * forbidden wall-clock / non-determinism patterns return zero matches.
 *
 * All timing on the Grid-side bios + chronos paths must derive from the
 * audit chain tick (carried on payloads). All randomness must be
 * derived from seeded deterministic sources (none currently needed).
 *
 * RED at Wave 0: the source directories do not yet exist; the
 * `expect(files.length > 0)` sanity check fails. Wave 2 + Wave 3 +
 * Wave 4 create the dirs; the gate then passes only if no wall-clock
 * pattern appears in either subtree.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BIOS_SRC    = join(__dirname, '../../src/bios');
const CHRONOS_SRC = join(__dirname, '../../src/chronos');

const FORBIDDEN_PATTERNS: Array<{ name: string; regex: RegExp }> = [
    { name: 'Date.now()', regex: /\bDate\.now\s*\(/ },
    { name: 'performance.now()', regex: /\bperformance\.now\s*\(/ },
    { name: 'setInterval', regex: /\bsetInterval\s*\(/ },
    { name: 'setTimeout', regex: /\bsetTimeout\s*\(/ },
    { name: 'Math.random', regex: /\bMath\.random\s*\(/ },
    { name: 'new Date()', regex: /\bnew\s+Date\s*\(/ },
];

function walk(dir: string, files: string[] = []): string[] {
    if (!existsSync(dir)) return files;
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            walk(full, files);
        } else if (
            full.endsWith('.ts') &&
            !full.endsWith('.test.ts') &&
            !full.endsWith('.d.ts')
        ) {
            files.push(full);
        }
    }
    return files;
}

function scanSubtree(name: string, root: string): void {
    const files = walk(root);
    expect(
        files.length,
        `${name} source dir must exist and be populated: ${root}`,
    ).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
        const content = readFileSync(file, 'utf8');
        for (const { name: patternName, regex } of FORBIDDEN_PATTERNS) {
            const match = content.match(regex);
            if (match) {
                violations.push(`${file}: ${patternName} (matched "${match[0]}")`);
            }
        }
    }
    expect(violations, violations.join('\n') || 'no violations').toHaveLength(0);
}

describe('Phase 10b T-09-04 defense — no wall-clock in grid/src/bios/**', () => {
    it('contains zero forbidden wall-clock or non-determinism patterns', () => {
        scanSubtree('bios', BIOS_SRC);
    });
});

describe('Phase 10b T-09-04 defense — no wall-clock in grid/src/chronos/**', () => {
    it('contains zero forbidden wall-clock or non-determinism patterns', () => {
        scanSubtree('chronos', CHRONOS_SRC);
    });
});
