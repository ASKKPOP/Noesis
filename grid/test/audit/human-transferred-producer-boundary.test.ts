/**
 * Phase 24 WALLET-04 — human.transferred sole-producer boundary invariant.
 *
 * Grep-based assertion: no file under grid/src/ (except
 * audit/append-human-transferred.ts) calls audit.append / chain.append
 * within ~200 chars of 'human.transferred'.
 *
 * Also verifies the closed 4-key payload tuple {asset, grid_name, human_did, tick}
 * is declared in the sole-producer file (structural source check).
 *
 * Mitigates T-24-05-02 (sole-producer drift).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_PRODUCER_FILE = 'audit/append-human-transferred.ts';

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (full.endsWith('.ts')) out.push(full);
    }
    return out;
}

describe('human.transferred — sole producer boundary (WALLET-04)', () => {
    it('no file in grid/src/ except append-human-transferred.ts emits human.transferred', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_PRODUCER_FILE) continue;
            const src = readFileSync(file, 'utf8');
            // Pattern: (audit|chain).append within 200 chars of 'human.transferred'
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]human\.transferred['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });

    it('append-human-transferred.ts itself calls audit.append with human.transferred', () => {
        const src = readFileSync(join(GRID_SRC, SOLE_PRODUCER_FILE), 'utf8');
        expect(src).toMatch(/audit\.append\(['"]human\.transferred['"]/);
    });
});

describe('human.transferred — closed 4-key payload tuple (WALLET-04)', () => {
    const src = readFileSync(join(GRID_SRC, SOLE_PRODUCER_FILE), 'utf8');

    it('payload contains asset key', () => {
        expect(src).toContain('asset');
    });

    it('payload contains grid_name key', () => {
        expect(src).toContain('grid_name');
    });

    it('payload contains human_did key', () => {
        expect(src).toContain('human_did');
    });

    it('payload contains tick key', () => {
        expect(src).toContain('tick');
    });

    it('EXPECTED_KEYS declares the 4-key closed tuple in alphabetical order', () => {
        // The sole-producer file must lock the 4 keys alphabetically
        expect(src).toContain("'asset', 'grid_name', 'human_did', 'tick'");
    });
});
