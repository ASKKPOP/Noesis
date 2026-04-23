/**
 * Phase 10b Wave 0 RED stub — CHRONOS-02 + D-10b-10 + D-10b-11 read-only
 * chronos invariant.
 *
 * Chronos is a Brain-local subjective-time computation; it MUST NOT cross
 * any wire (Brain↔Grid, Grid↔Dashboard, Grid↔WS clients).
 *
 * Three structural firewalls:
 *
 *   1. ALLOWLIST contains no string starting with `chronos.` — chronos
 *      never appears as a broadcast event type.
 *
 *   2. grep all grid/src/**\/*.ts for the chronos forbidden keys
 *      `subjective_multiplier|chronos_multiplier|subjective_tick` —
 *      expect zero matches OUTSIDE the CHRONOS_FORBIDDEN_KEYS declaration
 *      itself in broadcast-allowlist.ts (which is the privacy-list
 *      declaration that names what to forbid).
 *
 *   3. JSON-RPC response shapes (grid/src/brain/types.ts and any
 *      response-shape modules) carry zero chronos forbidden keys —
 *      Brain never returns multipliers across the wire.
 *
 * RED at Wave 0: CHRONOS_FORBIDDEN_KEYS does not yet exist in
 * broadcast-allowlist.ts; the import of CHRONOS_FORBIDDEN_KEYS fails
 * with "not exported".
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ALLOWLIST } from '../../src/audit/broadcast-allowlist.js';
import { CHRONOS_FORBIDDEN_KEYS } from '../../src/audit/broadcast-allowlist.js';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const ALLOWLIST_REL = 'audit/broadcast-allowlist.ts';

function walk(dir: string): string[] {
    const out: string[] = [];
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) out.push(...walk(full));
        else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) out.push(full);
    }
    return out;
}

describe('Phase 10b CHRONOS-02 — chronos never crosses the wire', () => {
    it('ALLOWLIST contains zero entries starting with chronos.', () => {
        for (const event of ALLOWLIST) {
            expect(event.startsWith('chronos.'), `forbidden allowlist member: ${event}`).toBe(false);
        }
    });

    it('CHRONOS_FORBIDDEN_KEYS contains exactly the 3 expected keys', () => {
        expect([...CHRONOS_FORBIDDEN_KEYS].sort()).toEqual([
            'chronos_multiplier',
            'subjective_multiplier',
            'subjective_tick',
        ]);
    });

    it('no chronos forbidden key literal appears in grid/src/ outside the privacy declaration', () => {
        const offenders: Array<{ file: string; key: string }> = [];
        const pattern = /\b(subjective_multiplier|chronos_multiplier|subjective_tick)\b/;
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            // The privacy-declaration file (broadcast-allowlist.ts) is
            // permitted to NAME the forbidden keys — that's the whole point
            // of the deny-list declaration. Skip it.
            if (rel === ALLOWLIST_REL) continue;
            // Test files are also permitted to reference the literal key
            // names (privacy regression tests).
            if (rel.endsWith('.test.ts')) continue;
            const src = readFileSync(file, 'utf8');
            const m = src.match(pattern);
            if (m) offenders.push({ file: rel, key: m[1] });
        }
        expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
    });

    it('JSON-RPC response shapes carry zero chronos forbidden keys', () => {
        const candidatePaths = [
            'brain/types.ts',
            'brain/rpc-types.ts',
            'rpc/types.ts',
        ];
        for (const cand of candidatePaths) {
            const full = join(GRID_SRC, cand);
            if (!existsSync(full)) continue;
            const src = readFileSync(full, 'utf8');
            for (const key of CHRONOS_FORBIDDEN_KEYS) {
                expect(src.includes(key), `${cand} leaks ${key}`).toBe(false);
            }
        }
    });
});
