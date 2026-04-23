/**
 * Phase 11 Wave 0 RED stub — WHISPER-03 + WHISPER-04 sole producer boundary.
 *
 * Clones grid/test/bios/bios-producer-boundary.test.ts (Phase 10b Wave 0).
 *
 * Three structural firewalls:
 *   1. 'nous.whispered' literal appears ONLY in:
 *       grid/src/audit/broadcast-allowlist.ts (allowlist member)
 *       grid/src/whisper/appendNousWhispered.ts (sole emitter — Wave 2)
 *   2. No file except appendNousWhispered.ts calls audit.append('nous.whispered', ...)
 *   3. Forbidden sibling strings never appear in grid/src/:
 *       nous.whisper_broadcast, nous.whispered_plain, nous.whisper_rate_limited
 *
 * RED at Wave 0: grid/src/whisper/appendNousWhispered.ts does not yet exist.
 *   - The file-exists probe on appendNousWhispered.ts FAILS with "sole producer
 *     file missing" message so Wave 2 sees a meaningful RED→GREEN flip.
 *
 * Known consumers: initially empty. DialogueAggregator subscribes via
 * audit.onAppend (not by literal-reference) per D-11-10; it does NOT need to
 * appear here. Rate-limiter / router / pending-store / routes / nous-runner
 * pass the event symbolically via the emitter or via dispatch tables.
 * If during Wave 2/3 a consumer genuinely must reference the literal, append
 * it to KNOWN_CONSUMERS_WHISPERED in the same commit.
 *
 * Mitigates T-11-W0-01 (unauthorized emission path).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_EMITTER_WHISPERED = 'whisper/appendNousWhispered.ts';
const ALLOWLIST_FILE = 'audit/broadcast-allowlist.ts';

// Known event consumers: reference 'nous.whispered' but never call audit.append.
// whisper/types.ts is the shared type module — references the event name in its
// SYNC docblock. It does not emit. Any new consumer added in Wave 2/3 that
// genuinely must reference the literal should be appended here in the SAME commit.
const KNOWN_CONSUMERS_WHISPERED: string[] = [
    'whisper/types.ts',
];

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

describe("'nous.whispered' literal appears only in allowlist + sole-producer + known-consumers", () => {
    it("string 'nous.whispered' appears only in allowlist, emitter, and known consumers", () => {
        const hits: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            const src = readFileSync(file, 'utf8');
            if (/nous\.whispered/.test(src)) hits.push(rel);
        }
        hits.sort();
        const expected = [SOLE_EMITTER_WHISPERED, ALLOWLIST_FILE, ...KNOWN_CONSUMERS_WHISPERED].sort();
        expect(hits).toEqual(expected);
    });

    it('sole producer file appendNousWhispered.ts exists (RED until Wave 2)', () => {
        const emitterPath = join(GRID_SRC, SOLE_EMITTER_WHISPERED);
        expect(
            existsSync(emitterPath),
            `sole producer file missing: ${SOLE_EMITTER_WHISPERED} — create it in Wave 2`,
        ).toBe(true);
    });
});

describe("no file except appendNousWhispered.ts calls audit.append('nous.whispered', …)", () => {
    it('no file in grid/src/ except appendNousWhispered.ts directly emits nous.whispered via audit.append', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_EMITTER_WHISPERED) continue;
            const src = readFileSync(file, 'utf8');
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]nous\.whispered['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });
});

describe('forbidden bios siblings — never present anywhere in grid/src', () => {
    it('no nous.whisper_broadcast / nous.whispered_plain / nous.whisper_rate_limited literals appear', () => {
        const siblings = ['nous.whisper_broadcast', 'nous.whispered_plain', 'nous.whisper_rate_limited'];
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
