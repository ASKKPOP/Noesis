/**
 * Skill sole-producer boundary test — Phase 18 D-18-07.
 *
 * Grep-style invariant: each skill.* event string literal appears in grid/src
 * ONLY in the two authorized locations:
 *   1. grid/src/audit/broadcast-allowlist.ts (allowlist registration)
 *   2. The sole-producer emitter file (e.g. skills/appendSkillTaught.ts)
 *
 * Any third match — a scattered audit.append('skill.taught', ...) in another
 * file — fails this test. This is the structural firewall that makes each
 * appendSkill* function the SOLE producer of its event type.
 *
 * Mirrors grid/test/iris/iris-producer-boundary.test.ts (Phase 17).
 * Mitigates T-18-01 (unauthorized / duplicated skill event emission path).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const ALLOWLIST_FILE = 'audit/broadcast-allowlist.ts';

const SOLE_EMITTERS: Record<string, string> = {
    'skill.taught': 'skills/appendSkillTaught.ts',
    'skill.inferred': 'skills/appendSkillInferred.ts',
    'skill.rejected': 'skills/appendSkillRejected.ts',
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

describe('skill.* events — sole producer boundaries', () => {
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
                // Match audit.append / chain.append / this.audit.append with skill event
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
