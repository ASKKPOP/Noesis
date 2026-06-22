/**
 * L2b D-MONEY-08 — sole producer boundary for procurement.notice_issued.
 *
 * Grep-style invariant: no file in grid/src/ except append-procurement-notice-issued.ts
 * emits procurement.notice_issued via audit.append / chain.append directly.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_PRODUCER_FILE = 'audit/append-procurement-notice-issued.ts';

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

describe('procurement.notice_issued — sole producer boundary (D-MONEY-08 / L2b)', () => {
    it('no file in grid/src/ except append-procurement-notice-issued.ts directly emits procurement.notice_issued', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_PRODUCER_FILE) continue;
            const src = readFileSync(file, 'utf8');
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]procurement\.notice_issued['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('append-procurement-notice-issued.ts itself calls audit.append with procurement.notice_issued (sanity)', () => {
        const src = readFileSync(join(GRID_SRC, SOLE_PRODUCER_FILE), 'utf8');
        expect(src).toMatch(/audit\.append\(['"]procurement\.notice_issued['"]/);
    });
});
