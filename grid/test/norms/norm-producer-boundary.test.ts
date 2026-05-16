/**
 * RED stub — grep gate will pass once Plan 03 ships emitters in the correct sole-producer files:
 *   grid/src/norms/appendNormCandidate.ts    — sole producer for norm.candidate (pos 40)
 *   grid/src/norms/appendNormCrystallized.ts — sole producer for norm.crystallized (pos 41)
 *
 * Phase 19 Plan 01 — NORM-01 sole-producer boundary gate (D-19-06).
 *
 * Grep-style invariant: each norm.* event string literal appears in grid/src
 * ONLY in the two authorized locations:
 *   1. grid/src/audit/broadcast-allowlist.ts (allowlist registration)
 *   2. The sole-producer emitter file (e.g. norms/appendNormCandidate.ts)
 *
 * Any third match — a scattered audit.append('norm.candidate', ...) in another
 * file — fails this test. This is the structural firewall that makes each
 * appendNorm* function the SOLE producer of its event type.
 *
 * Mirrors grid/test/skills/skill-producer-boundary.test.ts (Phase 18).
 * Mitigates T-19-01 (unauthorized / duplicated norm event emission path).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const ALLOWLIST_FILE = 'audit/broadcast-allowlist.ts';

const SOLE_EMITTERS: Record<string, string> = {
    'norm.candidate': 'norms/appendNormCandidate.ts',
    'norm.crystallized': 'norms/appendNormCrystallized.ts',
};

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) out.push(...walk(full));
        else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) out.push(full);
    }
    return out;
}

describe('norm.* events — sole producer boundaries', () => {
    const allFiles = walk(GRID_SRC);

    for (const [event, emitterFile] of Object.entries(SOLE_EMITTERS)) {
        const escapedEvent = event.replace('.', '\\.');

        it(`'${event}' string appears only in allowlist and sole emitter`, () => {
            const hits: string[] = [];
            for (const file of allFiles) {
                const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
                const src = readFileSync(file, 'utf8');
                if (new RegExp(escapedEvent).test(src)) hits.push(rel);
            }
            hits.sort();
            const expected = [emitterFile, ALLOWLIST_FILE].sort();
            expect(hits).toEqual(expected);
        });

        it(`no file except ${emitterFile} emits '${event}' via audit.append`, () => {
            const offenders: string[] = [];
            for (const file of allFiles) {
                const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
                if (rel === emitterFile) continue;
                const src = readFileSync(file, 'utf8');
                // Match audit.append / chain.append / this.audit.append with norm event
                const pattern = new RegExp(
                    `\\b(?:audit|chain|this\\.audit|this\\.chain)\\.append[^;]{0,200}['"\`]${escapedEvent}['"\`]`,
                    's'
                );
                if (pattern.test(src)) offenders.push(rel);
            }
            expect(offenders).toEqual([]);
        });
    }
});
