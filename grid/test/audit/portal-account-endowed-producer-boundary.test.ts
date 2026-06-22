/**
 * W4 (D-MONEY-09) — sole producer boundary for portal.account_endowed.
 *
 * Grep-style invariant: no file in grid/src/ except append-portal-account-endowed.ts
 * emits portal.account_endowed via audit.append / chain.append directly. Any
 * scattered audit.append('portal.account_endowed', ...) call fails this test.
 *
 * Mirrors due-paid-producer-boundary; tolerates ENOENT races during the walk.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_PRODUCER_FILE = 'audit/append-portal-account-endowed.ts';

function walk(dir: string): string[] {
    const out: string[] = [];
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return out; }
    for (const entry of entries) {
        const full = join(dir, entry);
        try {
            const st = statSync(full);
            if (st.isDirectory()) out.push(...walk(full));
            else if (full.endsWith('.ts')) out.push(full);
        } catch { /* ENOENT race — skip */ }
    }
    return out;
}

describe('portal.account_endowed — sole producer boundary (D-MONEY-09)', () => {
    it('no file in grid/src/ except append-portal-account-endowed.ts directly emits portal.account_endowed', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_PRODUCER_FILE) continue;
            let src: string;
            try { src = readFileSync(file, 'utf8'); } catch { continue; }
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]portal\.account_endowed['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('append-portal-account-endowed.ts itself calls audit.append with portal.account_endowed (sanity)', () => {
        const src = readFileSync(join(GRID_SRC, SOLE_PRODUCER_FILE), 'utf8');
        expect(src).toMatch(/audit\.append\(['"]portal\.account_endowed['"]/);
    });
});
