#!/usr/bin/env node
/**
 * Phase 11 D-11-08 / D-11-04 — Whisper plaintext grep gate + keyring-isolation check.
 *
 * Two invariants enforced in one pass:
 *
 * 1. THREE-TIER PLAINTEXT GATE (D-11-08 T-10-01, T-10-03)
 *    Forbidden property keys that must NEVER appear in whisper-scoped source files:
 *    text | body | content | message | utterance | offer | amount | ousia |
 *    price | value | plaintext | decrypted | payload_plain
 *
 *    Tier scopes — each tier scans whisper|envelope|mesh-scoped paths:
 *      Grid   (grid/src/**)        : paths matching /whisper|envelope|mesh/
 *      Brain  (brain/src/**)       : paths matching /whisper|envelope|mesh/
 *      Dash   (dashboard/src/**)   : paths matching /whisper|envelope|mesh/
 *
 *    Note: grid/src/whisper/ and grid/src/api/whisper/ are the Grid whisper paths.
 *    Non-whisper grid files (operator/, dialogue/, etc.) use 'body'/'text'/'amount'
 *    legitimately in their own domain schemas — they are not whisper envelope paths.
 *
 * 2. KEYRING-ISOLATION CHECK (D-11-04 T-10-03)
 *    No grid/src/** file may import brain/src/noesis_brain/whisper/keyring.py.
 *    Keyring on Grid = plaintext leak surface; one gate catches both.
 *
 * Exempt files (hardcoded with rationale):
 *   grid/src/audit/broadcast-allowlist.ts — WHISPER_FORBIDDEN_KEYS const IS the forbidden-key list by design
 *   grid/src/whisper/router.ts             — ciphertext field is opaque base64, not a forbidden key
 *   grid/src/whisper/crypto.ts             — encryptFor parameter 'plaintext: Uint8Array' is the opaque bytes parameter name
 *   brain/src/noesis_brain/whisper/keyring.py — no forbidden keys; isolation-checked separately
 *   brain/src/noesis_brain/whisper/sender.py  — 'plaintext' is the pre-encrypt local var; encryption
 *                                               happens before any wire emission; per D-11-04 this is
 *                                               Brain-internal and the gate covers the Grid wire surface.
 *   brain/src/noesis_brain/whisper/receiver.py — same: 'plaintext' is post-decrypt local var; Brain-local.
 *   brain/src/noesis_brain/whisper/trade_guard.py — 'plaintext' param name in trade_guard.assert_no_trade_keywords
 *   Any *.test.ts / *.test.tsx / test_*.py / *.drift.test.ts — tests assert forbidden keys are rejected
 *   This script itself (scripts/check-whisper-plaintext.mjs)
 *
 * Clones scripts/check-wallclock-forbidden.mjs skeleton (Plan 10b-07).
 *
 * Exit 0: zero violations across all tiers + keyring-isolation.
 * Exit 1: grouped violation table printed to stderr.
 *
 * Run from repo root:
 *   node scripts/check-whisper-plaintext.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Forbidden key pattern ─────────────────────────────────────────────────────
//
// Matches a key in "property-position" usage: the word appears at the start of a
// context (or preceded by a non-identifier char), followed immediately by
// whitespace? then `:` or `=` — key-in-dict / key-in-object-literal / assignment.
//
// Does NOT match mid-word (e.g. "ciphertext_hash" contains "text" but doesn't
// match because the suffix `_hash` means there's no `:` / `=` immediately after).
// "encryptFor(plaintext:" matches because `, plaintext:` has a non-ident char before it.
//
// The 13 keys from D-11-09:
//   8 whisper-only    : text, body, content, message, utterance, plaintext, decrypted, payload_plain
//   5 trade-compatible: offer, amount, ousia, price, value  (forbidden in whisper scope)
// Only match property-key syntax (KEY:) — NOT standalone variable assignments (KEY =).
// This avoids false positives on `const body = req.body` (HTTP handler boilerplate).
// Real envelope-key leaks always appear as `{ body: ..., text: ... }` property syntax.
export const FORBIDDEN_KEY_PATTERN =
    /(?:^|[^a-zA-Z0-9_])(?:text|body|content|message|utterance|offer|amount|ousia|price|value|plaintext|decrypted|payload_plain)\s*:/;

// ── Exempt paths (normalised to forward slashes, matched as suffix) ───────────
const EXEMPT_PATHS = new Set([
    // WHISPER_FORBIDDEN_KEYS const IS the forbidden-key list — intentional presence
    'grid/src/audit/broadcast-allowlist.ts',
    // ciphertext field is opaque base64, not a forbidden key
    'grid/src/whisper/router.ts',
    // encryptFor parameter name 'plaintext: Uint8Array' — opaque bytes, not a whisper key
    'grid/src/whisper/crypto.ts',
    // Brain-side: 'plaintext' is the pre/post-encrypt local variable — Brain-internal
    'brain/src/noesis_brain/whisper/keyring.py',
    'brain/src/noesis_brain/whisper/sender.py',
    'brain/src/noesis_brain/whisper/receiver.py',
    'brain/src/noesis_brain/whisper/trade_guard.py',
    // This script — the constant IS the pattern
    'scripts/check-whisper-plaintext.mjs',
]);

/** Returns true when a path is a test file. */
function isTest(p) {
    const norm = p.replace(/\\/g, '/');
    return (
        norm.endsWith('.test.ts') ||
        norm.endsWith('.test.tsx') ||
        norm.endsWith('.drift.test.ts') ||
        /\/test_[^/]+\.py$/.test(norm) ||
        /\/tests?\//.test(norm) ||
        norm.includes('/test/')
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
function scan(filePath, patterns) {
    if (!existsSync(filePath)) {
        return [{ path: filePath, line: 0, text: '(file not found)', pattern: 'N/A' }];
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

        // Code line — check against forbidden patterns.
        for (const rx of patterns) {
            if (rx.test(trimmed)) {
                violations.push({
                    path: filePath,
                    line: i + 1,
                    text: trimmed,
                    pattern: String(rx),
                });
                break; // one violation per line is enough
            }
        }
    });
    return violations;
}

// ── Scan tier helper ──────────────────────────────────────────────────────────

function scanTier(tierName, files) {
    const hits = [];
    for (const f of files) {
        const rel = norm(f);
        // Normalise to repo-relative path for exempt matching
        // The walk returns paths like 'grid/src/whisper/types.ts' (relative to cwd)
        const repoRel = rel.replace(/^.*\/(grid\/|brain\/|dashboard\/|scripts\/)/, '$1');
        // Skip exempt files
        if (EXEMPT_PATHS.has(repoRel) || EXEMPT_PATHS.has(rel)) continue;
        // Skip tests
        if (isTest(rel)) continue;
        const violations = scan(f, [FORBIDDEN_KEY_PATTERN]);
        if (violations.length > 0) {
            hits.push(...violations.map(v => ({ tier: tierName, ...v })));
        }
    }
    return hits;
}

// ── Run scans ─────────────────────────────────────────────────────────────────
let allViolations = [];

// Tier 1: Grid — scan whisper|envelope|mesh-scoped paths in grid/src
// (prevents plaintext keys appearing in whisper envelope handler code)
const gridAllFiles = walk('grid/src');
const gridWhisperFiles = gridAllFiles.filter(p => /whisper|envelope|mesh/.test(norm(p)));
allViolations = allViolations.concat(scanTier('grid', gridWhisperFiles));

// Tier 2: Brain — scan only whisper|envelope|mesh scoped paths
const brainFiles = walk('brain/src').filter(p => /whisper|envelope|mesh/.test(norm(p)));
allViolations = allViolations.concat(scanTier('brain', brainFiles));

// Tier 3: Dashboard — scan only whisper|envelope|mesh scoped paths
const dashFiles = walk('dashboard/src').filter(p => /whisper|envelope|mesh/.test(norm(p)));
allViolations = allViolations.concat(scanTier('dashboard', dashFiles));

// ── Keyring-isolation check (D-11-04 T-10-03) ────────────────────────────────
//
// No grid/src/** TypeScript file may import brain/src/noesis_brain/whisper/keyring.py.
// Brain keyring is Brain-private — Grid importing it would allow plaintext access.
const KEYRING_IMPORT_RE = /from\s+['"][^'"]*brain[^'"]*whisper[^'"]*keyring['"]/;
const KEYRING_IMPORT_RE2 = /import[^'"]*brain[^'"]*whisper[^'"]*keyring/;
const gridTsFiles = gridAllFiles.filter(p => {
    const n = norm(p);
    return (n.endsWith('.ts') || n.endsWith('.tsx') || n.endsWith('.mjs')) && !isTest(n);
});
for (const f of gridTsFiles) {
    const src = readFileSync(f, 'utf8');
    if (KEYRING_IMPORT_RE.test(src) || KEYRING_IMPORT_RE2.test(src)) {
        allViolations.push({
            tier: 'keyring-isolation',
            path: f,
            line: 0,
            text: '(import of brain whisper keyring detected — D-11-04 T-10-03 violation)',
            pattern: 'brain/*/whisper/keyring import',
        });
    }
}

// ── Report ────────────────────────────────────────────────────────────────────
if (allViolations.length > 0) {
    console.error('\u274C check-whisper-plaintext: ' + allViolations.length + ' violation(s) found:');
    console.error('');

    // Group by tier
    const byTier = {};
    for (const v of allViolations) {
        if (!byTier[v.tier]) byTier[v.tier] = [];
        byTier[v.tier].push(v);
    }

    for (const [tier, hits] of Object.entries(byTier)) {
        console.error(`  Tier: ${tier} (${hits.length} hit${hits.length !== 1 ? 's' : ''})`);
        for (const v of hits) {
            console.error(`    ${v.path}:${v.line}`);
            if (v.text && !v.text.includes('file not found')) {
                console.error(`      > ${v.text.slice(0, 120)}`);
            }
        }
        console.error('');
    }

    console.error('Fix: plaintext whisper content must never appear as a property key in whisper-scoped paths.');
    console.error('See: D-11-08 (three-tier plaintext gate) + D-11-04 (keyring isolation).');
    console.error('     WHISPER-02 / T-10-01 / T-10-03 in .planning/phases/11-mesh-whisper/');
    process.exit(1);
}

console.log('\u2705 check-whisper-plaintext: clean (0 violations across 3 tiers + keyring-isolation)');
