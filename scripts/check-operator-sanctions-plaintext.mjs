#!/usr/bin/env node
/**
 * Phase 25b D-25b-11 — Operator-sanctions plaintext grep gate.
 *
 * Enforces the plaintext-leak invariant for the operator-sanctions surface:
 * forbidden property keys must NEVER appear in sanction-related source files.
 *
 * Scanned scopes:
 *   Grid emitters : grid/src/audit/append-operator-*.ts
 *   Grid routes   : grid/src/api/operator/{mute-broadcast,slash-coin,quarantine,force-sleep,ban-human,freeze-wallet,spawn-system-nous}.ts
 *   Grid tests    : grid/test/operator/**\/*.ts (sanction|mute|slash|quarantine|ban|freeze)
 *
 * Forbidden keys (D-25b-11 — operator-sanctions plaintext gate):
 *   reason_text, reason_plaintext, reason_body, plaintext_reason
 *
 * Exit 0: zero violations.
 * Exit 1: grouped violation table printed to stderr.
 *
 * Run from repo root:
 *   node scripts/check-operator-sanctions-plaintext.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Forbidden keys (D-25b-11) ─────────────────────────────────────────────────
//
// These keys must never appear as property keys in operator-sanctions-scoped source.
const FORBIDDEN_KEYS = [
    'reason_text',
    'reason_plaintext',
    'reason_body',
    'plaintext_reason',
];

// Build a regex that matches each key in property-key position:
// KEY followed by whitespace? then `:` or `=`.
// This avoids false positives on variable names that merely contain the substring.
const FORBIDDEN_KEY_PATTERN = new RegExp(
    '(?:^|[^a-zA-Z0-9_])(?:' + FORBIDDEN_KEYS.join('|') + ')\\s*[=:]',
);

// ── Exempt paths (normalised to forward slashes, matched as suffix) ───────────
const EXEMPT_PATHS = new Set([
    // This script — the constant IS the pattern
    'scripts/check-operator-sanctions-plaintext.mjs',
    // broadcast-allowlist.ts IS the forbidden-key list by design
    'grid/src/audit/broadcast-allowlist.ts',
]);

/** Returns true when a path is a test file. */
function isTest(p) {
    const n = p.replace(/\\/g, '/');
    return (
        n.endsWith('.test.ts') ||
        n.endsWith('.test.tsx') ||
        n.endsWith('.drift.test.ts') ||
        /\/test_[^/]+\.py$/.test(n) ||
        /\/tests?\//.test(n) ||
        n.includes('/test/')
    );
}

/** Normalise a path to forward-slash form. */
function norm(p) {
    return p.replace(/\\/g, '/');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function walk(dir, acc = []) {
    if (!existsSync(dir)) return acc;
    for (const entry of readdirSync(dir)) {
        if (['node_modules', '.git', 'dist', '.next', '.venv', 'build', 'coverage', '__pycache__'].includes(entry)) continue;
        const p = join(dir, entry);
        const st = statSync(p);
        if (st.isDirectory()) walk(p, acc);
        else acc.push(p);
    }
    return acc;
}

/**
 * Scan a single file for forbidden patterns.
 *
 * Skips:
 *   - Pure comment lines (# ... for Python, // ... and * ... for JS/TS)
 *   - Content inside Python triple-quoted docstrings (""" ... """)
 *   - Content inside JS/TS block comments (/* ... *\/)
 */
function scan(filePath, pattern) {
    if (!existsSync(filePath)) {
        return [];
    }
    const content = readFileSync(filePath, 'utf8');
    const violations = [];
    const lines = content.split('\n');

    let inTripleQuote = false;   // Python """ ... """ docstring
    let inBlockComment = false;  // JS/TS /* ... */ block comment

    lines.forEach((line, i) => {
        const trimmed = line.trim();

        // Track Python triple-quoted string blocks.
        const tripleCount = (line.match(/"""/g) || []).length;
        if (inTripleQuote) {
            if (tripleCount % 2 !== 0) {
                inTripleQuote = false;
            }
            return; // inside docstring — skip entirely
        } else if (tripleCount % 2 !== 0) {
            inTripleQuote = true;
            return; // the docstring opening line itself is not code
        }

        // Track JS/TS block comments (/* ... */).
        if (inBlockComment) {
            if (trimmed.includes('*/')) {
                inBlockComment = false;
            }
            return;
        }
        if (trimmed.startsWith('/*') || trimmed.startsWith('/**')) {
            if (!trimmed.includes('*/') || trimmed.indexOf('*/') <= 2) {
                inBlockComment = true;
            }
            return;
        }

        // Skip pure single-line comment lines.
        if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('*')) {
            return;
        }

        // Code line — check against forbidden pattern.
        if (pattern.test(trimmed)) {
            // Find which key matched for reporting.
            const matchedKey = FORBIDDEN_KEYS.find(k => trimmed.includes(k)) ?? '?';
            violations.push({
                path: filePath,
                line: i + 1,
                text: trimmed,
                key: matchedKey,
            });
        }
    });
    return violations;
}

// ── Scan scope helper ─────────────────────────────────────────────────────────

function scanFiles(scopeName, files) {
    const hits = [];
    for (const f of files) {
        const rel = norm(f);
        // Normalise to repo-relative path for exempt matching
        const repoRel = rel.replace(/^.*\/(grid\/|brain\/|scripts\/)/, '$1');
        // Skip exempt files
        if (EXEMPT_PATHS.has(repoRel) || EXEMPT_PATHS.has(rel)) continue;
        // Skip tests
        if (isTest(rel)) continue;
        const violations = scan(f, FORBIDDEN_KEY_PATTERN);
        if (violations.length > 0) {
            hits.push(...violations.map(v => ({ scope: scopeName, ...v })));
        }
    }
    return hits;
}

// ── Collect scoped files ──────────────────────────────────────────────────────

// Grid sanction emitter files (append-operator-*.ts)
const gridEmitterFiles = walk('grid/src/audit').filter(f => /append-operator-/.test(norm(f)));

// Grid sanction route files
const gridRouteFiles = walk('grid/src/api/operator').filter(f =>
    /(mute-broadcast|slash-coin|quarantine|force-sleep|ban-human|freeze-wallet|spawn-system-nous)/.test(norm(f)));

// Grid sanction test files
const gridTestFiles = walk('grid/test/operator').filter(f =>
    /(sanction|mute|slash|quarantine|ban|freeze)/.test(norm(f)));

// ── Run scans ─────────────────────────────────────────────────────────────────
let allViolations = [];

allViolations = allViolations.concat(scanFiles('grid-emitters', gridEmitterFiles));
allViolations = allViolations.concat(scanFiles('grid-routes', gridRouteFiles));
allViolations = allViolations.concat(scanFiles('grid-tests', gridTestFiles));

// ── Report ────────────────────────────────────────────────────────────────────
if (allViolations.length > 0) {
    console.error('❌ check-operator-sanctions-plaintext: ' + allViolations.length + ' violation(s) found:');
    console.error('');

    // Group by scope
    const byScope = {};
    for (const v of allViolations) {
        if (!byScope[v.scope]) byScope[v.scope] = [];
        byScope[v.scope].push(v);
    }

    for (const [scope, hits] of Object.entries(byScope)) {
        console.error(`  Scope: ${scope} (${hits.length} hit${hits.length !== 1 ? 's' : ''})`);
        for (const v of hits) {
            console.error(`    ${v.path}:${v.line}  [key: ${v.key}]`);
            if (v.text) {
                console.error(`      > ${v.text.slice(0, 120)}`);
            }
        }
        console.error('');
    }

    console.error('Fix: forbidden operator-sanctions plaintext keys must never appear in scoped source files.');
    console.error('See: D-25b-11 (operator-sanctions plaintext gate) in .planning/phases/25b-sanctions-and-spawn-wizard/');
    console.error('     Forbidden: ' + FORBIDDEN_KEYS.join(', '));
    process.exit(1);
}

console.log('✅ check-operator-sanctions-plaintext: clean (0 violations across all scopes)');
