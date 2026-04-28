#!/usr/bin/env node
/**
 * scripts/check-rig-invariants.mjs
 *
 * CI gate enforcing T-10-12 (no httpServer/wsHub in rig code) and T-10-13 (no bypass flags).
 * Cloned from scripts/check-replay-readonly.mjs pattern.
 *
 * RULE 1 (T-10-12): scripts/rig.mjs must NOT reference httpServer.listen or wsHub.
 *   Defense: prevents headless rig from accidentally opening a network surface.
 *
 * RULE 2 (T-10-13): scripts/rig.mjs and grid/src/rig/** must NOT contain bypass flags.
 *   Ban list: --skip-{word} | --bypass-{word} | --disable-{word} | --no-reviewer | --no-tier
 *   --permissive is NOT a bypass per D-14-05 (it is a fixture cache-miss mode selector).
 *
 * Exit codes:
 *   0 — no violations found, rig code is clean.
 *   1 — at least one violation found; output identifies file:line:match.
 *
 * Excludes: *.test.ts, *.d.ts, node_modules/, dist/, build/, .next/
 *
 * See: 14-CONTEXT.md D-14-01 (T-10-12), D-14-05 (T-10-13, --permissive NOT a bypass).
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const RIG_SCRIPT = join(ROOT, 'scripts', 'rig.mjs');
const RIG_SRC_DIR = join(ROOT, 'grid', 'src', 'rig');

const FORBIDDEN_SYMBOLS_RE = /httpServer\.listen|wsHub/g;
const BYPASS_FLAG_RE = /--skip-[a-z]|--bypass-[a-z]|--disable-[a-z]|--no-reviewer|--no-tier/g;

const EXCLUDE_FILE_PATTERNS = [/\.test\.ts$/, /\.d\.ts$/];
const EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.next']);

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
        } else if (e.isFile() && /\.(ts|mjs|js)$/.test(e.name)) {
            if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(p))) continue;
            yield p;
        }
    }
}

function scanFile(filePath, rules) {
    const text = readFileSync(filePath, 'utf8');
    const lines = text.split('\n');
    const violations = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comment lines — the gate targets code-level violations only.
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue;
        }
        for (const { name, re } of rules) {
            re.lastIndex = 0;
            if (re.test(line)) {
                violations.push({ file: relative(ROOT, filePath), line: i + 1, rule: name, text: line.trim() });
            }
        }
    }
    return violations;
}

const allViolations = [];

// Scan scripts/rig.mjs for both T-10-12 and T-10-13 violations
if (existsSync(RIG_SCRIPT)) {
    allViolations.push(...scanFile(RIG_SCRIPT, [
        { name: 'FORBIDDEN_SYMBOLS_RE (T-10-12)', re: FORBIDDEN_SYMBOLS_RE },
        { name: 'BYPASS_FLAG_RE (T-10-13)', re: BYPASS_FLAG_RE },
    ]));
}

// Scan grid/src/rig/** for T-10-13 violations (bypass flags in rig source)
for (const filePath of walkDir(RIG_SRC_DIR)) {
    allViolations.push(...scanFile(filePath, [
        { name: 'BYPASS_FLAG_RE (T-10-13)', re: BYPASS_FLAG_RE },
    ]));
}

if (allViolations.length > 0) {
    console.error('[check-rig-invariants] VIOLATIONS:');
    for (const v of allViolations) {
        console.error(`  ✗ ${v.file}:${v.line}: ${v.rule} — ${v.text}`);
    }
    console.error('');
    console.error(`check-rig-invariants: ${allViolations.length} violation(s) — T-10-12/T-10-13`);
    console.error('Reference: 14-CONTEXT.md D-14-01 (T-10-12), D-14-05 (T-10-13).');
    process.exit(1);
}

console.log('[check-rig-invariants] OK — no violations.');
process.exit(0);
