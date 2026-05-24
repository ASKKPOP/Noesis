#!/usr/bin/env node
/**
 * scripts/check-no-silent-catch.mjs
 *
 * Phase 31 OBS-03 (D-31-B3) CI gate. Blocks PRs that reintroduce the
 * silent `.catch(err => console.warn(...))` pattern inside `grid/src/db/`
 * or `grid/src/audit/` — the directories that touch the audit chain and
 * its persistence layer, where silent failures were the root cause of
 * GAP-2026-05-24-A.
 *
 * The replacement shape is structured Pino logging
 *   logger.warn({ event: 'audit_persist_failed', entry_id, event_type,
 *                 error_message, error_code }, 'msg')
 * locked by D-31-B3 and pinned by grid/test/audit-persistence-wiring.test.ts.
 *
 * Scope is intentionally narrow (per CONTEXT.md "Deferred ideas"):
 *   - grid/src/db/      — audit persistence + the broader DB layer
 *   - grid/src/audit/   — the in-memory audit chain + firehose + producers
 *
 * Broader rollout (e.g. grid/src/api/, brain/) is out of scope for Phase 31.
 *
 * Exit codes:
 *   0 — clean: no silent catch patterns found.
 *   1 — at least one violation found; output identifies file:line:rule:text.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

const SCAN_DIRS = [
    join(ROOT, 'grid', 'src', 'db'),
    join(ROOT, 'grid', 'src', 'audit'),
];

const EXCLUDE_FILE_PATTERNS = [/\.test\.ts$/, /\.d\.ts$/];
const EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.next']);

// Matches:
//   .catch(err => console.warn(...))
//   .catch((err) => console.warn(...))
//   .catch(err => { console.warn(...); })
//   .catch(e => console.log(...))
//   .catch(_ => console.debug(...))
// Does NOT match:
//   .catch(err => logger.warn(...))            (correct shape)
//   .catch(err => { logger.warn(...); })       (correct shape)
//   console.warn(...) outside any .catch()
//
// Tolerant of optional parens around the arg, optional block body, and
// console.{warn,log,debug,error}. Param name is any valid identifier.
const FORBIDDEN_PATTERN = /\.catch\s*\(\s*\(?\s*[a-zA-Z_$][\w$]*\s*\)?\s*=>\s*\{?\s*console\.(?:warn|log|debug|error)\b/;

const RULES = [
    {
        name: 'no-silent-catch-console',
        re: FORBIDDEN_PATTERN,
    },
    // Also catch the rarer paren-less single-arg form .catch(console.warn) where
    // the catch handler IS console.warn — a "bound silent log".
    {
        name: 'no-silent-catch-bound-console',
        re: /\.catch\s*\(\s*console\.(?:warn|log|debug|error)\b/,
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
        const trimmed = line.trim();
        // Skip line/block comments — gate targets code-level violations only.
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue;
        }
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
    console.log('[check-no-silent-catch] OK — no silent .catch(...console.*) patterns in grid/src/db/ or grid/src/audit/');
    process.exit(0);
}

console.error('[check-no-silent-catch] VIOLATIONS FOUND:');
console.error('  file:line  rule  text');
for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}:${v.rule}:${v.text}`);
}
console.error('');
console.error('Phase 31 OBS-03 requires structured Pino logging for audit-persistence failures.');
console.error('Replace `console.warn` with `logger.warn({ event: "...", ... }, "...")` per D-31-B3.');
process.exit(1);
