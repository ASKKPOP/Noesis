/**
 * Phase 10b Wave 0 RED stub — BIOS-02 + BIOS-03 sole producer boundaries.
 *
 * Clones grid/test/ananke/drive-crossed-producer-boundary.test.ts.
 *
 * Two structural firewalls:
 *   - 'bios.birth' literal appears in grid/src ONLY in:
 *       grid/src/audit/broadcast-allowlist.ts (allowlist member)
 *       grid/src/bios/appendBiosBirth.ts       (sole emitter)
 *   - 'bios.death' literal appears in grid/src ONLY in:
 *       grid/src/audit/broadcast-allowlist.ts (allowlist member)
 *       grid/src/bios/appendBiosDeath.ts       (sole emitter)
 *
 * RED at Wave 0: emitter files do not exist; the grep finds 0 matches
 * for 'bios.birth' / 'bios.death' anywhere; the assertion that the
 * allowlist contains the strings will fail.
 *
 * Mitigates T-10b equivalent of T-10a-07 (unauthorized emission path).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_EMITTER_BIRTH = 'bios/appendBiosBirth.ts';
const SOLE_EMITTER_DEATH = 'bios/appendBiosDeath.ts';
const ALLOWLIST_FILE = 'audit/broadcast-allowlist.ts';
// Known event consumers: observe bios events but never call audit.append for them.
const KNOWN_CONSUMERS_BIRTH = ['chronos/wire-listener.ts'];

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

describe('bios.birth — sole producer boundary (BIOS-02)', () => {
    it("string 'bios.birth' appears only in allowlist, emitter, and known consumers", () => {
        const hits: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            const src = readFileSync(file, 'utf8');
            if (/bios\.birth/.test(src)) hits.push(rel);
        }
        hits.sort();
        const expected = [SOLE_EMITTER_BIRTH, ALLOWLIST_FILE, ...KNOWN_CONSUMERS_BIRTH].sort();
        expect(hits).toEqual(expected);
    });

    it('no file in grid/src/ except appendBiosBirth.ts directly emits bios.birth via audit.append', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_EMITTER_BIRTH) continue;
            const src = readFileSync(file, 'utf8');
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]bios\.birth['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('appendBiosBirth.ts itself calls audit.append with bios.birth (sanity)', () => {
        const src = readFileSync(join(GRID_SRC, SOLE_EMITTER_BIRTH), 'utf8');
        expect(src).toMatch(/audit\.append\(['"]bios\.birth['"]/);
    });
});

describe('bios.death — sole producer boundary (BIOS-03)', () => {
    it("string 'bios.death' appears only in allowlist and emitter", () => {
        const hits: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            const src = readFileSync(file, 'utf8');
            if (/bios\.death/.test(src)) hits.push(rel);
        }
        hits.sort();
        expect(hits).toEqual([SOLE_EMITTER_DEATH, ALLOWLIST_FILE].sort());
    });

    it('no file in grid/src/ except appendBiosDeath.ts directly emits bios.death via audit.append', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_EMITTER_DEATH) continue;
            const src = readFileSync(file, 'utf8');
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]bios\.death['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('appendBiosDeath.ts itself calls audit.append with bios.death (sanity)', () => {
        const src = readFileSync(join(GRID_SRC, SOLE_EMITTER_DEATH), 'utf8');
        expect(src).toMatch(/audit\.append\(['"]bios\.death['"]/);
    });
});

describe('forbidden bios siblings — never present anywhere in grid/src', () => {
    it('no bios.resurrect / bios.migrate / bios.transfer literals appear', () => {
        const siblings = ['bios.resurrect', 'bios.migrate', 'bios.transfer'];
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
