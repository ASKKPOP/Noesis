/**
 * Producer-boundary test for operator.forced_sleep sole-producer invariant (D-25b-09).
 *
 * Enforces: only grid/src/audit/append-operator-forced-sleep.ts may call
 * audit.append('operator.forced_sleep', ...) in the grid/src tree.
 *
 * Any other file calling append with 'operator.forced_sleep' fails this CI grep gate.
 *
 * Mirrors the pattern from grid/test/audit/operator-exported-producer-boundary.test.ts
 * (Phase 13 / REPLAY-02 discipline).
 *
 * See: 25b-CONTEXT D-25b-09, plan 08 CI gate.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Walk all .ts files under a directory recursively. */
function walkTs(dir: string, files: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        try {
            if (statSync(p).isDirectory()) {
                walkTs(p, files);
            } else if (p.endsWith('.ts') && !p.endsWith('.d.ts')) {
                files.push(p);
            }
        } catch {
            // Skip unreadable entries
        }
    }
    return files;
}

/**
 * Regex matching any direct chain/audit .append() call with 'operator.forced_sleep'.
 * Catches both:
 *   - chain.append('operator.forced_sleep', ...)
 *   - audit.append('operator.forced_sleep', ...)
 */
const OPERATOR_FORCED_SLEEP_APPEND_RE =
    /\.(append)\s*\(\s*['"]operator\.forced_sleep['"]/;

describe('operator.forced_sleep sole-producer boundary', () => {
    it('exactly one file in grid/src/** calls append for operator.forced_sleep — and it is append-operator-forced-sleep.ts', () => {
        // Resolve grid/src relative to this test file
        // Test file: grid/test/audit/operator-forced-sleep-producer-boundary.test.ts
        // grid/src: two directories up, then into src/
        const gridSrcDir = join(import.meta.dirname ?? __dirname, '..', '..', 'src');

        const allTsFiles = walkTs(gridSrcDir);

        const matchingFiles = allTsFiles.filter((filePath) => {
            const content = readFileSync(filePath, 'utf8');
            return content.split('\n').some((line) => {
                // Skip comment lines
                const trimmed = line.trim();
                if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
                return OPERATOR_FORCED_SLEEP_APPEND_RE.test(line);
            });
        });

        expect(matchingFiles.length).toBe(1);

        // The one matching file must be the sole-producer file
        const expected = join(gridSrcDir, 'audit', 'append-operator-forced-sleep.ts');
        expect(matchingFiles[0]).toBe(expected);
    });
});
