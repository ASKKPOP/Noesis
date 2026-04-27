/**
 * RED test for operator.exported sole-producer boundary (REPLAY-02).
 *
 * This test encodes the acceptance criteria for Wave 3 (Plan 13-04).
 * It MUST fail until grid/src/audit/append-operator-exported.ts is created.
 *
 * Threat mitigation: Forged 'operator.exported' event from non-sole-producer.
 * Any file other than grid/src/audit/append-operator-exported.ts that calls
 * chain.append('operator.exported', ...) or audit.append('operator.exported', ...)
 * must fail this CI grep gate immediately.
 *
 * Mirrors the pattern from grid/test/audit/nous-deleted-producer-boundary.test.ts
 * (Phase 8 / AGENCY-05 discipline).
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
 * Regex matching any direct chain/audit .append() call with 'operator.exported'.
 * Catches both:
 *   - chain.append('operator.exported', ...)
 *   - audit.append('operator.exported', ...)
 */
const OPERATOR_EXPORTED_APPEND_RE =
    /\.(append)\s*\(\s*['"]operator\.exported['"]/;

describe('operator.exported sole-producer boundary', () => {
    it('exactly one file in grid/src/** calls append for operator.exported — and it is append-operator-exported.ts', () => {
        // Resolve grid/src relative to this test file
        // Test file: grid/test/audit/operator-exported-producer-boundary.test.ts
        // grid/src: two directories up, then into src/
        const gridSrcDir = join(import.meta.dirname ?? __dirname, '..', '..', 'src');

        const allTsFiles = walkTs(gridSrcDir);

        const matchingFiles = allTsFiles.filter((filePath) => {
            const content = readFileSync(filePath, 'utf8');
            return content.split('\n').some((line) => {
                // Skip comment lines
                const trimmed = line.trim();
                if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
                return OPERATOR_EXPORTED_APPEND_RE.test(line);
            });
        });

        // RED: append-operator-exported.ts does not yet exist (Wave 3 creates it)
        // So matchingFiles will be empty (0) — this fails the assertion below.
        // After Wave 3 creates the file, matchingFiles will be exactly 1.
        expect(matchingFiles.length).toBe(1);

        // The one matching file must be the sole-producer file
        const expected = join(gridSrcDir, 'audit', 'append-operator-exported.ts');
        expect(matchingFiles[0]).toBe(expected);
    });
    // RED until Wave 3 (Plan 13-04) creates grid/src/audit/append-operator-exported.ts
});
