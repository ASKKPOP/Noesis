#!/usr/bin/env node
/**
 * Phase 25a D-25a-05 — Cognitive-snapshot plaintext grep gate.
 *
 * Enforces the plaintext-leak invariant for the cognitive-snapshot surface:
 * forbidden property keys must NEVER appear in cognitive-snapshot source files
 * on the Brain→Grid wire.
 *
 * Scanned scopes:
 *   Brain (Python) : brain/src/noesis_brain/http/**\/*.py
 *   Brain (tests)  : brain/test/test_cognitive_snapshot*.py
 *   Grid (TS)      : grid/src/api/operator/cognitive-snapshot*.ts
 *   Grid (tests)   : grid/test/operator/cognitive-snapshot*.test.ts
 *
 * Forbidden keys (D-25a-05 — cognitive-snapshot plaintext gate):
 *   reflexion_text, rule_text, creed_text, skill_body, lore_body, whisper_plaintext
 *
 * NOTE: skill_title is the documented exception per D-25a-05; never add it here.
 *
 * Exit 0: zero violations.
 * Exit 1: grouped violation table printed to stderr.
 *
 * Run from repo root:
 *   node scripts/check-cognitive-snapshot-plaintext.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Forbidden keys (D-25a-05) ─────────────────────────────────────────────────
//
// These keys must never appear as property keys in cognitive-snapshot-scoped source.
// skill_title is the documented exception per D-25a-05; never add it to this list.
const FORBIDDEN_KEYS = [
    'reflexion_text',
    'rule_text',
    'creed_text',
    'skill_body',
    'lore_body',
    'whisper_plaintext',
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
    'scripts/check-cognitive-snapshot-plaintext.mjs',
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
 * Collect files matching a glob-style pattern (directory + filename filter).
 * Supports simple glob patterns: ** for recursive directory walk, * for wildcard in filename.
 */
function collectGlob(baseDir, filePattern) {
    const files = walk(baseDir);
    // Convert glob pattern to regex: * → [^/]*, ** already handled by walk
    const re = new RegExp(
        '^' + filePattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*') + '$'
    );
    return files.filter(f => re.test(norm(f).replace(/^.*?(?=brain\/|grid\/)/, '')));
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

// Brain HTTP layer (Python)
const brainHttpFiles = walk('brain/src/noesis_brain/http');

// Brain cognitive-snapshot tests (Python)
const brainTestFiles = walk('brain/test').filter(f => /test_cognitive_snapshot/.test(norm(f)));

// Grid cognitive-snapshot source (TypeScript)
const gridSrcFiles = walk('grid/src/api/operator').filter(f => /cognitive-snapshot/.test(norm(f)));

// Grid cognitive-snapshot tests (TypeScript)
const gridTestFiles = walk('grid/test/operator').filter(f => /cognitive-snapshot.*\.test\.ts$/.test(norm(f)));

// ── Run scans ─────────────────────────────────────────────────────────────────
let allViolations = [];

allViolations = allViolations.concat(scanFiles('brain-http', brainHttpFiles));
allViolations = allViolations.concat(scanFiles('brain-test', brainTestFiles));
allViolations = allViolations.concat(scanFiles('grid-src', gridSrcFiles));
allViolations = allViolations.concat(scanFiles('grid-test', gridTestFiles));

// ── Report ────────────────────────────────────────────────────────────────────
if (allViolations.length > 0) {
    console.error('❌ check-cognitive-snapshot-plaintext: ' + allViolations.length + ' violation(s) found:');
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

    console.error('Fix: forbidden cognitive-snapshot plaintext keys must never appear in scoped source files.');
    console.error('See: D-25a-05 (cognitive-snapshot plaintext gate) in .planning/phases/25a-observer-surfaces/');
    console.error('     Forbidden: ' + FORBIDDEN_KEYS.join(', '));
    console.error('     Exception: skill_title (D-25a-05 explicit exemption — never add it to FORBIDDEN_KEYS)');
    process.exit(1);
}

console.log('✅ check-cognitive-snapshot-plaintext: clean (0 violations across all scopes)');
