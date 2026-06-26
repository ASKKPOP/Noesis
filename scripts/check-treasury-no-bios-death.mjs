#!/usr/bin/env node
/**
 * Phase 45b CI gate (TYPE-B-04, D-V3-25 / PHILOSOPHY §9): treasury exhaustion must NEVER
 * cause bios.death. Dormancy preserves the first-life promise; only a Phase-47 civic
 * conviction can kill. This gate asserts the Type B funding code never references bios.death.
 *
 * Scans grid/src/typeb/ + the Type B treasury append/route files for any bios.death emission.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = [
    'grid/src/typeb',
    'grid/src/api/routes/treasury-type-b.ts',
    'grid/src/audit/append-treasury-endowment-granted.ts',
    'grid/src/audit/append-treasury-dormancy-entered.ts',
    'grid/src/audit/append-treasury-revived.ts',
];
// Match an actual emission of bios.death — not the word in a comment explaining the ban.
const DEATH_EMIT = /(appendBiosDeath|['"`]bios\.death['"`]|audit\.append\(\s*['"`]bios\.death)/;

function filesOf(p) {
    const abs = join(root, p);
    let st; try { st = statSync(abs); } catch { return []; }
    if (st.isFile()) return [abs];
    return readdirSync(abs).flatMap((f) => filesOf(join(p, f))).filter((f) => f.endsWith('.ts'));
}

const offenders = [];
for (const p of SCAN) {
    for (const file of filesOf(p)) {
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
            const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
            if (DEATH_EMIT.test(code)) offenders.push(`${file.replace(root + '/', '')}:${i + 1}`);
        });
    }
}

if (offenders.length) {
    console.error('[check-treasury-no-bios-death] VIOLATION — Type B funding code must never emit bios.death (D-V3-25):');
    offenders.forEach((o) => console.error('  - ' + o));
    console.error('  Treasury exhaustion → dormancy (identity preserved); only Phase-47 civic conviction can kill.');
    process.exit(1);
}
console.log('[check-treasury-no-bios-death] OK — no bios.death path in Type B funding (dormancy preserves first life).');
