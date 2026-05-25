#!/usr/bin/env node
/**
 * scripts/check-sole-producer-discipline.mjs
 *
 * Phase 33 OBS-09 (D-33-D1) CI gate. Blocks PRs where any sole-producer
 * audit emitter file is missing one of the three required triad elements:
 *   1. Object.keys(payload).sort()  — closed-tuple structural check
 *   2. payloadPrivacyCheck          — privacy gate
 *   3. audit.append(                — chain commit
 *
 * Covers all ~38 sole-producer files after Phase 33 ships:
 *   - grid/src/audit/append-*.ts            (16 files: 13 pre-existing + 3 Phase 33)
 *   - grid/src/ananke/append-drive-crossed.ts
 *   - grid/src/bios/appendBiosBirth.ts, appendBiosDeath.ts
 *   - grid/src/sleep/appendNousSleepEntered.ts, appendNousSleepCompleted.ts
 *   - grid/src/iris/append*.ts              (4 files)
 *   - grid/src/skills/append*.ts            (3 files)
 *   - grid/src/norms/append*.ts             (2 files)
 *   - grid/src/lore/append*.ts              (2 files)
 *   - grid/src/governance/append*.ts        (4 files)
 *   - grid/src/whisper/appendNousWhispered.ts
 *
 * File filter: basename starts with 'append' (case-sensitive) AND ends with .ts.
 * ENOENT-tolerant — missing directories (rare) are NOT violations.
 *
 * Exit codes:
 *   0 — clean: every sole-producer file contains all three triad elements.
 *   1 — at least one violation found; output identifies file:missing-check.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ROOT = process.cwd();

const SCAN_DIRS = [
    join(ROOT, 'grid', 'src', 'audit'),
    join(ROOT, 'grid', 'src', 'ananke'),
    join(ROOT, 'grid', 'src', 'bios'),
    join(ROOT, 'grid', 'src', 'sleep'),
    join(ROOT, 'grid', 'src', 'iris'),
    join(ROOT, 'grid', 'src', 'skills'),
    join(ROOT, 'grid', 'src', 'norms'),
    join(ROOT, 'grid', 'src', 'lore'),
    join(ROOT, 'grid', 'src', 'governance'),
    join(ROOT, 'grid', 'src', 'whisper'),
];

const EXCLUDE_FILE_PATTERNS = [/\.test\.ts$/, /\.d\.ts$/];
const EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.next']);

const REQUIRED_TRIAD = [
    'Object.keys(payload).sort()',
    'payloadPrivacyCheck',
    'audit.append(',
];

function* walkDir(dir) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
        if (err && err.code === 'ENOENT') return;
        throw err;
    }
    for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
            if (EXCLUDE_DIR_NAMES.has(e.name)) continue;
            yield* walkDir(p);
        } else if (
            e.isFile()
            && /\.ts$/.test(e.name)
            && /^append/.test(basename(e.name))
        ) {
            if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(p))) continue;
            yield p;
        }
    }
}

function scanFile(filePath) {
    const text = readFileSync(filePath, 'utf8');
    const missing = [];
    for (const check of REQUIRED_TRIAD) {
        if (!text.includes(check)) {
            missing.push(check);
        }
    }
    return missing.map((check) => ({
        file: relative(ROOT, filePath),
        missing: check,
    }));
}

// ── Run scan ─────────────────────────────────────────────────────────────────
const allViolations = [];
const filesScanned = [];
for (const dir of SCAN_DIRS) {
    for (const file of walkDir(dir)) {
        filesScanned.push(relative(ROOT, file));
        allViolations.push(...scanFile(file));
    }
}

if (allViolations.length === 0) {
    console.log(
        `[check-sole-producer-discipline] OK — ${filesScanned.length} sole-producer files all contain the full triad ` +
        `(Object.keys(payload).sort() + payloadPrivacyCheck + audit.append).`,
    );
    process.exit(0);
}

console.error('[check-sole-producer-discipline] VIOLATIONS FOUND:');
console.error('  file  missing-check');
for (const v of allViolations) {
    console.error(`  ${v.file}  ${v.missing}`);
}
console.error('');
console.error('Phase 33 D-33-D1 requires every sole-producer file to contain:');
console.error('  1. Object.keys(payload).sort()  — closed-tuple structural check');
console.error('  2. payloadPrivacyCheck          — privacy gate');
console.error('  3. audit.append(                — chain commit');
console.error('See grid/src/audit/append-human-joined.ts as the canonical reference.');
process.exit(1);
