/**
 * Phase 8 AGENCY-05 — operator.nous_deleted sole-producer boundary invariant.
 *
 * Grep-based assertion: no file under grid/src/ (except
 * audit/append-nous-deleted.ts) calls audit.append / chain.append within
 * ~200 chars of 'operator.nous_deleted'.
 *
 * See: 08-CONTEXT D-31 (sole-producer pattern).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_PRODUCER_FILE = 'audit/append-nous-deleted.ts';

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (full.endsWith('.ts')) out.push(full);
    }
    return out;
}

describe('operator.nous_deleted — sole producer boundary (D-31)', () => {
    it('no file in grid/src/ except append-nous-deleted.ts emits operator.nous_deleted', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_PRODUCER_FILE) continue;
            const src = readFileSync(file, 'utf8');
            // Pattern: (audit|chain).append within 200 chars of 'operator.nous_deleted'
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]operator\.nous_deleted['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('append-nous-deleted.ts itself calls audit.append with operator.nous_deleted', () => {
        const src = readFileSync(join(GRID_SRC, SOLE_PRODUCER_FILE), 'utf8');
        expect(src).toMatch(/audit\.append\(['"]operator\.nous_deleted['"]/);
    });
});
