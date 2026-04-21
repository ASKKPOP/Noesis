/**
 * Phase 7 DIALOG-02 — sole producer boundary for telos.refined (D-31).
 *
 * Grep-style invariant: no file in grid/src/ except append-telos-refined.ts
 * emits telos.refined via audit.append / chain.append directly. Any scattered
 * audit.append('telos.refined', ...) call fails this test.
 *
 * Mitigates T-07-23 (scattered producer drift over time).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_PRODUCER_FILE = 'audit/append-telos-refined.ts';

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

describe('telos.refined — sole producer boundary (D-31)', () => {
    it('no file in grid/src/ except append-telos-refined.ts directly emits telos.refined', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_PRODUCER_FILE) continue;
            const src = readFileSync(file, 'utf8');
            // Match audit.append(..., 'telos.refined', ...) / chain.append('telos.refined', ...)
            // / this.audit.append('telos.refined', ...) within a 200-char window.
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]telos\.refined['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('append-telos-refined.ts itself calls audit.append with telos.refined (sanity)', () => {
        const src = readFileSync(join(GRID_SRC, SOLE_PRODUCER_FILE), 'utf8');
        expect(src).toMatch(/audit\.append\(['"]telos\.refined['"]/);
    });
});
