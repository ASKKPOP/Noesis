#!/usr/bin/env node
/**
 * scripts/check-replay-readonly.mjs
 *
 * CI gate enforcing T-10-07 (CRITICAL risk from Phase 13 ROADMAP):
 *   "Replay engine shares state with live Grid"
 *
 * Hard rule: NO file under grid/src/replay/**\/*.ts may contain a call
 * matching the regex /\.append\s*\(/ . The replay engine operates on a
 * ReadOnlyAuditChain whose append method throws — but the type system alone
 * is insufficient defense if a future contributor casts or rebinds the
 * audit reference. This grep gate is the belt-and-suspenders defense.
 *
 * Exit codes:
 *   0 — no forbidden tokens found, replay tree is clean.
 *   1 — at least one forbidden token found; output identifies file:line:match.
 *
 * Excludes: *.test.ts, *.d.ts, node_modules/, dist/, build/.
 *
 * Wired via grid/package.json `scripts.lint:replay-readonly`. Runs in
 * the standard CI pipeline alongside check-state-doc-sync.mjs and
 * check-wallclock-forbidden.mjs.
 *
 * See: 13-CONTEXT.md D-13-03; 13-PLAN-01 acceptance #5; 13-PLAN-02 acceptance #4.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIR = join(ROOT, 'grid', 'src', 'replay');
const FORBIDDEN_RE = /\.append\s*\(/g;
const EXCLUDE_FILE_PATTERNS = [/\.test\.ts$/, /\.d\.ts$/];
const EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.next']);

function* walkTs(dir) {
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
            yield* walkTs(p);
        } else if (e.isFile() && p.endsWith('.ts')) {
            if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(p))) continue;
            yield p;
        }
    }
}

let violations = 0;
for (const file of walkTs(SCAN_DIR)) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comment lines — the gate targets code-level violations only.
        // Single-line comments: // and * (inside block comments)
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue;
        }
        FORBIDDEN_RE.lastIndex = 0;
        let m;
        while ((m = FORBIDDEN_RE.exec(line)) !== null) {
            const rel = relative(ROOT, file);
            console.error(`  ✗ ${rel}:${i + 1}: forbidden chain-append call under grid/src/replay/** — ${line.trim()}`);
            violations += 1;
        }
    }
}

if (violations > 0) {
    console.error('');
    console.error(`check-replay-readonly: ${violations} violation(s) — T-10-07 (replay engine must not write to chain)`);
    console.error('Replay code must use ReadOnlyAuditChain; chain-append is forbidden under grid/src/replay/**.');
    console.error('Reference: 13-CONTEXT.md D-13-03, .planning/ROADMAP.md Phase 13 risk T-10-07.');
    process.exit(1);
}

console.log(`check-replay-readonly: 0 violations under ${relative(ROOT, SCAN_DIR)} ✓`);
process.exit(0);
