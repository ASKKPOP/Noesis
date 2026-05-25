#!/usr/bin/env node
/**
 * scripts/check-interval-lifecycle.mjs
 *
 * Phase 32 OBS-07 R-32-02 CI gate (D-32-D1). Blocks PRs that introduce
 * a setInterval() in grid/src/{diagnostics,audit,db}/ that is NOT stored
 * in a class field. The unbound setInterval failure mode (Pitfall 8 from
 * OBSERVABILITY-HARDENING.md) is: handle GC'd silently, watchdog dies.
 *
 * Discipline (D-32-B1 + D-32-G2): every interval handle must be held in
 * a field so it survives garbage collection AND can be cleared in stop().
 *
 * Day-1 state (research-verified): zero setInterval calls exist in any
 * of the scanned dirs. This gate ships to lock discipline for future phases.
 *
 * Scope: grid/src/diagnostics/, grid/src/audit/, grid/src/db/
 *   (mirrors check-no-silent-catch.mjs + check-observability-no-todo.mjs)
 *
 * Rule (per-line):
 *   1. Match `setInterval(` anywhere on the line.
 *   2. ALLOWED if the same line begins with `this.<name> = setInterval(`
 *      (the canonical inline-store pattern).
 *   3. ALLOWED if any of the 3 preceding non-comment lines contains the
 *      assignment target (`this.<name> = ` then the next lines continue
 *      into setInterval — multi-line patterns).
 *   4. Otherwise: VIOLATION.
 *
 * Note: setTimeout, setImmediate, queueMicrotask are NOT matched — only
 * setInterval has the "handle must outlive the call site" lifecycle concern.
 *
 * Exit codes:
 *   0 — clean: no unbound setInterval calls found.
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

const SET_INTERVAL_CALL_RE = /\bsetInterval\s*\(/;
// Matches `this.<name> = setInterval(` or `this.<name> = ` (same line as opening)
const INLINE_STORE_RE = /this\.\w+\s*=\s*setInterval\s*\(/;
const FIELD_ASSIGN_RE = /this\.\w+\s*=\s*$/; // assignment whose RHS continues on the next line(s)

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

function isCommentLine(line) {
    const t = line.trim();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

function scanFile(filePath) {
    const text = readFileSync(filePath, 'utf8');
    const lines = text.split('\n');
    const violations = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments — gate targets executable code only.
        if (isCommentLine(line)) continue;
        if (!SET_INTERVAL_CALL_RE.test(line)) continue;

        // Allowed: inline-store on the same line.
        if (INLINE_STORE_RE.test(line)) continue;

        // Allowed: a `this.<name> = ` assignment in the preceding 3 non-comment
        // lines that "flows into" this setInterval (multi-line assignment).
        let allowedByPrev = false;
        let scanned = 0;
        for (let j = i - 1; j >= 0 && scanned < 3; j--) {
            if (isCommentLine(lines[j])) continue;
            scanned++;
            if (FIELD_ASSIGN_RE.test(lines[j]) || INLINE_STORE_RE.test(lines[j])) {
                allowedByPrev = true;
                break;
            }
            // Also accept `this.<name> =` anywhere on the previous line (open expression).
            if (/this\.\w+\s*=/.test(lines[j])) {
                allowedByPrev = true;
                break;
            }
        }
        if (allowedByPrev) continue;

        violations.push({
            file: relative(ROOT, filePath),
            line: i + 1,
            rule: 'interval-must-be-stored',
            text: line.trim(),
        });
    }
    return violations;
}

// ── Run scan ─────────────────────────────────────────────────────────────────
const allViolations = [];
for (const dir of SCAN_DIRS) {
    for (const file of walkDir(dir)) {
        allViolations.push(...scanFile(file));
    }
}

if (allViolations.length === 0) {
    console.log('[check-interval-lifecycle] OK — every setInterval in grid/src/{diagnostics,audit,db}/ is held in a class field (or none exist).');
    process.exit(0);
}

console.error('[check-interval-lifecycle] VIOLATIONS FOUND:');
console.error('  file:line  rule  text');
for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}:${v.rule}:${v.text}`);
}
console.error('');
console.error('Phase 32 R-32-02 (D-32-D1) requires every setInterval handle to be stored in a class field.');
console.error('Replace `setInterval(...)` with `this.<name> = setInterval(...)` and clear in stop()/close().');
console.error('Pure-pull alternative: invoke the work synchronously on demand (no interval at all — see D-32-B1).');
process.exit(1);
