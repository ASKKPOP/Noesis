/**
 * Sole-producer boundary test for lore.contributed and lore.cited.
 * Phase 20 D-20-12: each event string MUST appear only in:
 *   1. audit/broadcast-allowlist.ts
 *   2. The designated sole emitter file
 * AND: no file other than the designated emitter calls audit.append('lore.*', ...)
 *
 * This is a RED stub — the sole emitter files don't exist yet (Plan 03 ships them).
 * Once Plan 04 adds lore.contributed/lore.cited to ALLOWLIST_MEMBERS, this test
 * will pass fully.
 *
 * Mirrors grid/test/norms/norm-producer-boundary.test.ts (Phase 19).
 * Mitigates T-20-01 (unauthorized / duplicated lore event emission path).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const GRID_SRC = join(__dirname, '..', '..', 'src');
const ALLOWLIST_FILE = 'audit/broadcast-allowlist.ts';

const SOLE_EMITTERS: Record<string, string> = {
    'lore.contributed': 'lore/appendLoreContributed.ts',
    'lore.cited': 'lore/appendLoreCited.ts',
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

describe('lore.* events — sole producer boundaries (D-20-12)', () => {
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
