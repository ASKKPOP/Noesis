#!/usr/bin/env node
/**
 * scripts/check-observability-no-todo.mjs
 *
 * Phase 32 OBS-05/06/07 R-32-01 CI gate (D-32-D1). Blocks PRs that ship
 * observability code with deferred work — the exact pattern that produces
 * silent failures.
 *
 * Greps for TODO|FIXME|XXX within 50 chars of observability keywords
 * (health|metric|frame|drift|reconcile) case-insensitive across:
 *   - grid/src/diagnostics/  (Phase 32 HealthWatchdog)
 *   - grid/src/audit/        (Phase 25a firehose + chain)
 *   - grid/src/db/           (Phase 31 PersistentAuditChain + AuditReconcile)
 *
 * Scope mirrors check-no-silent-catch.mjs (Phase 31) — the same three layers
 * that touch the audit chain and its persistence/observability surfaces.
 *
 * ENOENT-tolerant walkDir means grid/src/diagnostics/ not existing yet
 * (before Plan 03 lands) is NOT a violation — the gate is forward-locking.
 *
 * Exit codes:
 *   0 — clean: no observability TODO/FIXME/XXX patterns found.
 *   1 — at least one violation found; output identifies file:line:rule:text.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

const SCAN_DIRS = [
    join(ROOT, 'grid', 'src', 'diagnostics'),
    join(ROOT, 'grid', 'src', 'audit'),
    join(ROOT, 'grid', 'src', 'db'),
];

const EXCLUDE_FILE_PATTERNS = [/\.test\.ts$/, /\.d\.ts$/];
const EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.next']);

// D-32-D1 R-32-01 regex: matches (TODO|FIXME|XXX) within 50 chars of one of
// the five observability keywords, case-insensitive. Tested patterns:
//   "TODO: fix this health check"            -> match
//   "FIXME — frame counter is wrong"          -> match
//   "XXX investigate reconcile drift"         -> match
//   "TODO: refactor user list"                -> no match (no observability keyword)
//   "// add health note (no TODO here)"      -> no match (no TODO/FIXME/XXX)
const RULES = [
    {
        name: 'observability-no-TODO',
        re: /(TODO|FIXME|XXX).{0,50}(health|metric|frame|drift|reconcile)/i,
    },
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
        // NOTE: unlike check-no-silent-catch.mjs (which SKIPS comments because
        // it targets code-level violations), this gate INTENTIONALLY scans
        // comments — TODO/FIXME/XXX live in comments by design. Do NOT add
        // the comment-skip lines here.
        for (const { name, re } of rules) {
            re.lastIndex = 0;
            if (re.test(line)) {
                violations.push({
                    file: relative(ROOT, filePath),
                    line: i + 1,
                    rule: name,
                    text: line.trim(),
                });
            }
        }
    }
    return violations;
}

// ── Run scan ─────────────────────────────────────────────────────────────────
const allViolations = [];
for (const dir of SCAN_DIRS) {
    for (const file of walkDir(dir)) {
        allViolations.push(...scanFile(file, RULES));
    }
}

if (allViolations.length === 0) {
    console.log('[check-observability-no-todo] OK — no TODO/FIXME/XXX near observability keywords in grid/src/{diagnostics,audit,db}/');
    process.exit(0);
}

console.error('[check-observability-no-todo] VIOLATIONS FOUND:');
console.error('  file:line  rule  text');
for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}:${v.rule}:${v.text}`);
}
console.error('');
console.error('Phase 32 R-32-01 (D-32-D1) blocks observability code shipping with deferred work.');
console.error('Resolve the TODO/FIXME/XXX before merging, or remove the observability keyword from the comment.');
process.exit(1);
