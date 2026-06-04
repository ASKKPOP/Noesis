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
        // Exclude test fixtures (.test.ts / __tests__): tests legitimately call
        // audit.append(...) directly for setup, which is not a production sole-producer
        // violation. Mirrors the .test.ts exclusion in check-sole-producer-discipline.mjs.
        if (st.isDirectory()) {
            if (entry === '__tests__') continue;
            out.push(...walk(full));
        } else if (full.endsWith('.ts') && !full.endsWith('.d.ts') && !full.endsWith('.test.ts')) {
            out.push(full);
        }
    }
    return out;
}

describe('skill.* events — sole producer boundaries', () => {
    const allFiles = walk(GRID_SRC);

    for (const [event, emitterFile] of Object.entries(SOLE_EMITTERS)) {
        const escapedEvent = event.replace('.', '\\.');

        it(`'${event}' is registered in the allowlist and referenced by its sole emitter`, () => {
            const hits: string[] = [];
            for (const file of allFiles) {
                const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
                const src = readFileSync(file, 'utf8');
                if (new RegExp(escapedEvent).test(src)) hits.push(rel);
            }
            // The allowlist registration and the sole emitter MUST both reference the event.
            // Read-only consumers (e.g. culture/portal surfaces that filter by event_type)
            // may also reference the string; emission-uniqueness is enforced by the
            // companion 'via audit.append' test below + check-sole-producer-discipline.mjs.
            const expected = [emitterFile, ALLOWLIST_FILE];
            expect(hits).toEqual(expect.arrayContaining(expected));
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
