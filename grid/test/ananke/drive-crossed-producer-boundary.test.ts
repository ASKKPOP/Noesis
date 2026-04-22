/**
 * Phase 10a DRIVE-03 — sole producer boundary for ananke.drive_crossed.
 *
 * Grep-style invariant: the string literal 'ananke.drive_crossed' appears in
 * grid/src ONLY in the two authorized files:
 *   - grid/src/audit/broadcast-allowlist.ts (allowlist member)
 *   - grid/src/ananke/append-drive-crossed.ts (the sole emitter)
 *
 * Any third match — a scattered audit.append('ananke.drive_crossed', ...)
 * elsewhere in grid/src — fails this test. This is the structural firewall
 * that makes appendAnankeDriveCrossed the SOLE producer of the event type.
 *
 * Mirrors grid/test/audit/telos-refined-producer-boundary.test.ts (Phase 7 D-31).
 *
 * Mitigates T-10a-07 (unauthorized / duplicated event emission path).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_EMITTER = 'ananke/append-drive-crossed.ts';
const ALLOWLIST_FILE = 'audit/broadcast-allowlist.ts';

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

describe('ananke.drive_crossed — sole producer boundary', () => {
    it("string 'ananke.drive_crossed' appears only in allowlist and emitter", () => {
        const hits: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            const src = readFileSync(file, 'utf8');
            if (/ananke\.drive_crossed/.test(src)) hits.push(rel);
        }
        hits.sort();
        expect(hits).toEqual([SOLE_EMITTER, ALLOWLIST_FILE].sort());
    });

    it('no file in grid/src/ except append-drive-crossed.ts directly emits ananke.drive_crossed via audit.append', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_EMITTER) continue;
            const src = readFileSync(file, 'utf8');
            // Match audit.append(..., 'ananke.drive_crossed', ...) / chain.append(...)
            // / this.audit.append(...) within a 200-char window.
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]ananke\.drive_crossed['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('append-drive-crossed.ts itself calls audit.append with ananke.drive_crossed (sanity)', () => {
        const src = readFileSync(join(GRID_SRC, SOLE_EMITTER), 'utf8');
        expect(src).toMatch(/audit\.append\(['"]ananke\.drive_crossed['"]/);
    });

    it('no forbidden sibling events exist anywhere in grid/src', () => {
        const siblings = ['ananke.drive_raised', 'ananke.drive_saturated', 'ananke.drive_reset'];
        const hits: Array<{ sibling: string; file: string }> = [];
        for (const file of walk(GRID_SRC)) {
            const src = readFileSync(file, 'utf8');
            for (const s of siblings) {
                if (src.includes(s)) {
                    hits.push({ sibling: s, file: relative(GRID_SRC, file).replace(/\\/g, '/') });
                }
            }
        }
        expect(hits).toEqual([]);
    });
});
