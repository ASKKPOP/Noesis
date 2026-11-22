/**
 * A Polis may name a zone with digits (ZONE_ID_RE: /^[a-z][a-z0-9_]{1,30}$/), and a parcel
 * id is `<grid>:<zone>:<nnnn>`. Every event writer checks the parcel id with its own copy of
 * a pattern; that pattern refused digits in the zone part, so every event about a parcel in
 * such a zone would have thrown. This reads each writer's pattern from its source.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ZONE_ID_RE } from '../../src/zoning/zone-types.js';

const AUDIT_DIR = join(__dirname, '..', '..', 'src', 'audit');

function writerPatterns(): Array<{ file: string; re: RegExp }> {
    const out: Array<{ file: string; re: RegExp }> = [];
    for (const file of readdirSync(AUDIT_DIR)) {
        if (!file.endsWith('.ts')) continue;
        const m = /const PARCEL_ID_RE = \/(.+)\/;/.exec(readFileSync(join(AUDIT_DIR, file), 'utf8'));
        if (m) out.push({ file, re: new RegExp(m[1]) });
    }
    return out;
}

describe('event writers accept every parcel id the zone law allows', () => {
    const patterns = writerPatterns();

    it('finds the writers', () => {
        expect(patterns.length).toBeGreaterThanOrEqual(14);
    });

    it.each(['habitat2', 'ring3_east', 'residential', 'government_quarter', 'b2'])('zone %s', (zone) => {
        expect(ZONE_ID_RE.test(zone)).toBe(true);
        for (const { file, re } of patterns) {
            expect(re.test(`genesis:${zone}:0001`), `${file} refuses genesis:${zone}:0001`).toBe(true);
        }
    });

    it('still refuses what is not a parcel id', () => {
        for (const { file, re } of patterns) {
            for (const bad of ['genesis:Habitat:0001', 'genesis:residential:1', 'residential:0001', 'genesis:resi dential:0001', '']) {
                expect(re.test(bad), `${file} accepts ${JSON.stringify(bad)}`).toBe(false);
            }
        }
    });
});
