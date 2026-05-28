/**
 * Phase 43 FORK-04 — operator.nous_forked sole producer boundary.
 *
 * Grep-style invariant: no file in grid/src/ except append-operator-nous-forked.ts
 * emits operator.nous_forked via audit.append / chain.append directly. Any scattered
 * audit.append('operator.nous_forked', ...) call fails this test.
 *
 * Mitigates T-43-sole (FORK-04 / D-43-04).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_PRODUCER_FILE = 'audit/append-operator-nous-forked.ts';

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) out.push(...walk(full));
        else if (full.endsWith('.ts')) out.push(full);
    }
    return out;
}

describe('operator.nous_forked — sole producer boundary (FORK-04 / D-43-04)', () => {
    it('no file in grid/src/ except append-operator-nous-forked.ts directly emits operator.nous_forked', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_PRODUCER_FILE) continue;
            const src = readFileSync(file, 'utf8');
            // Match audit.append(..., 'operator.nous_forked', ...) / chain.append('operator.nous_forked', ...)
            // / this.audit.append('operator.nous_forked', ...) within a 200-char window.
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]operator\.nous_forked['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('append-operator-nous-forked.ts itself calls audit.append with operator.nous_forked (sanity)', () => {
        const src = readFileSync(join(GRID_SRC, SOLE_PRODUCER_FILE), 'utf8');
        expect(src).toMatch(/audit\.append\(['"]operator\.nous_forked['"]/);
    });
});
