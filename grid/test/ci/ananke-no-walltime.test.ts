/**
 * Phase 10a Plan 06 Task 1 Test C — Wall-clock grep gate (Grid side).
 *
 * T-10a-29 / T-09-03 defense: `grid/src/ananke/**` MUST NOT reference
 * Date.now, performance.now, setInterval, setTimeout, Math.random, or
 * `new Date(...)`. All timing on the Grid-side Ananke emitter path must
 * be derived from the audit chain tick (carried on the payload) — never
 * from the system clock. Random numbers must be derived from seeded
 * deterministic sources (none currently needed on the Grid side).
 *
 * Gate pattern: clones grid/test/relationships/determinism-source.test.ts.
 * Walks grid/src/ananke/** (.ts files only, excluding test / .d.ts files).
 * Collects offending files into an array; asserts toHaveLength(0) so the
 * failure message names the offending file(s) + matched snippet.
 *
 * Rationale: running on every commit means if a future edit introduces a
 * wall-clock reference to (for example) add a rate-limiter, the CI gate
 * breaks immediately with a clear diagnostic.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ANANKE_SRC = join(__dirname, '../../src/ananke');

const FORBIDDEN_PATTERNS: Array<{ name: string; regex: RegExp }> = [
    { name: 'Date.now()', regex: /\bDate\.now\s*\(/ },
    { name: 'performance.now()', regex: /\bperformance\.now\s*\(/ },
    { name: 'setInterval', regex: /\bsetInterval\s*\(/ },
    { name: 'setTimeout', regex: /\bsetTimeout\s*\(/ },
    { name: 'Math.random', regex: /\bMath\.random\s*\(/ },
    { name: 'new Date()', regex: /\bnew\s+Date\s*\(/ },
];

function walk(dir: string, files: string[] = []): string[] {
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

describe('Phase 10a T-09-03 defense — no wall-clock in grid/src/ananke/**', () => {
    it('contains zero forbidden wall-clock or non-determinism patterns', () => {
        const files = walk(ANANKE_SRC);

        // Sanity: directory must exist and be populated. A zero-file count
        // here would indicate the test is running against the wrong path
        // and silently "passing" — we want that to fail loudly.
        expect(files.length, `ananke source dir must be populated: ${ANANKE_SRC}`).toBeGreaterThan(0);

        const violations: string[] = [];
        for (const file of files) {
            const content = readFileSync(file, 'utf8');
            for (const { name, regex } of FORBIDDEN_PATTERNS) {
                const match = content.match(regex);
                if (match) {
                    violations.push(`${file}: ${name} (matched "${match[0]}")`);
                }
            }
        }

        expect(violations, violations.join('\n') || 'no violations').toHaveLength(0);
    });
});
