/**
 * L2b D-MONEY-08 — sole producer boundary for procurement.bid_placed.
 *
 * Grep-style invariant: no file in grid/src/ except append-procurement-bid-placed.ts
 * emits procurement.bid_placed via audit.append / chain.append directly.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_PRODUCER_FILE = 'audit/append-procurement-bid-placed.ts';

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

describe('procurement.bid_placed — sole producer boundary (D-MONEY-08 / L2b)', () => {
    it('no file in grid/src/ except append-procurement-bid-placed.ts directly emits procurement.bid_placed', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_PRODUCER_FILE) continue;
            const src = readFileSync(file, 'utf8');
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]procurement\.bid_placed['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('append-procurement-bid-placed.ts itself calls audit.append with procurement.bid_placed (sanity)', () => {
        const src = readFileSync(join(GRID_SRC, SOLE_PRODUCER_FILE), 'utf8');
        expect(src).toMatch(/audit\.append\(['"]procurement\.bid_placed['"]/);
    });
});
