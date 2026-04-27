#!/usr/bin/env node
/**
 * Phase 10b D-10b-06 / D-10b-09 — wall-clock reads forbidden gate.
 *
 * Bios, Chronos, and the retrieval scorer MUST NOT read wall-clock time.
 * Determinism requires all timing to derive from the Grid system tick.
 *
 * Scanned paths:
 *   brain/src/noesis_brain/bios/      — Python: no datetime import allowed
 *   brain/src/noesis_brain/chronos/   — Python: no datetime import allowed
 *   brain/src/noesis_brain/memory/retrieval.py — Python: no datetime.now() call
 *   grid/src/bios/                    — TypeScript: no Date.now / performance.now
 *
 * Two tiers of forbidden patterns:
 *
 *   Tier A (strict — bios/ and chronos/ only):
 *     Any `datetime` word, `time.time`, `time.monotonic`.
 *     In these pure-deterministic modules, even importing the datetime
 *     type annotation is prohibited (use noesis_brain.ananke.types DriveLevel
 *     for time-related state; never wall-clock).
 *
 *   Tier B (call-only — retrieval.py and grid/src/bios/):
 *     datetime.now(), time.time(), time.monotonic() as actual calls.
 *     `from datetime import datetime` for type annotations is allowed;
 *     calling datetime.now() or passing no `now=` argument is the violation.
 *     TypeScript: Date.now(), performance.now() as calls.
 *
 * Exits 0 with green "OK" line when clean.
 * Exits 1 with path:line details on any violation.
 *
 * Run from repo root:
 *   node scripts/check-wallclock-forbidden.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Target directories (Tier A — strict) ─────────────────────────────────────
const TIER_A_ROOTS = [
    'brain/src/noesis_brain/bios',
    'brain/src/noesis_brain/chronos',
    // Phase 11 (D-11-13): whisper Brain tree — deterministic derivation only,
    // no wall-clock reads permitted (seed+tick+counter basis for all crypto ops).
    'brain/src/noesis_brain/whisper',
    // Phase 12 (D-12-11): governance Brain tree — commit-reveal timing derives
    // from Grid system tick only; no wall-clock reads permitted.
    'brain/src/noesis_brain/governance',
];

// ── Tier A forbidden patterns (any match in above roots = violation) ──────────
const TIER_A_PATTERNS = [
    /\bdatetime\b/,           // datetime type or datetime.now — neither allowed in bios/chronos
    /\btime\.time\b/,         // time.time() wall-clock call
    /\btime\.monotonic\b/,    // time.monotonic() wall-clock call
    /\bDate\.now\b/,          // JS/TS Date.now() — should not appear in Python paths
    /\bperformance\.now\b/,   // JS/TS performance.now()
];

// ── Individual files (Tier B — call-only) ────────────────────────────────────
const TIER_B_FILES = [
    'brain/src/noesis_brain/memory/retrieval.py',
];

// ── Tier B forbidden patterns (actual wall-clock calls, not type imports) ─────
const TIER_B_PATTERNS = [
    /datetime\.now\s*\(/,         // datetime.now() or datetime.now( — the wall-clock call
    /datetime\.utcnow\s*\(/,      // datetime.utcnow() — deprecated but equally bad
    /\btime\.time\s*\(/,          // time.time() call
    /\btime\.monotonic\s*\(/,     // time.monotonic() call
];

// ── Grid TypeScript paths (Tier B — call-only) ───────────────────────────────
const TIER_B_TS_ROOTS = [
    'grid/src/bios',
    // Phase 11 (D-11-13): whisper Grid tree — nonce derivation is tick-indexed;
    // Date.now/performance.now/Math.random are forbidden. @fastify/rate-limit's
    // internal Date.now usage is third-party and already exempt via import-only clause.
    // Dashboard whisper tree is render-only counts (Date.now allowed for UI state);
    // do NOT extend to dashboard/src/whisper/** per plan interfaces block.
    'grid/src/whisper',
    // Phase 12 (D-12-11): governance Grid tree — commit-reveal and tally logic
    // must derive timing from Grid system tick only; Date.now/performance.now/
    // Math.random are forbidden. Dashboard governance tree is render-only
    // counts/aggregates (Date.now allowed for UI state); do NOT extend to
    // dashboard/src/app/grid/governance/** per plan interfaces block.
    'grid/src/governance',
];

const TIER_B_TS_PATTERNS = [
    /\bDate\.now\s*\(/,           // Date.now() wall-clock call
    /\bperformance\.now\s*\(/,    // performance.now() wall-clock call
    /\bMath\.random\s*\(/,        // Math.random() — non-deterministic (D-10b-09)
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function walk(dir, acc = []) {
    if (!existsSync(dir)) return acc;
    for (const entry of readdirSync(dir)) {
        // Skip Python bytecode cache directories — they contain compiled .pyc files
        // that duplicate source comments (including forbidden-word mentions in docstrings)
        // and would produce false positives.
        if (entry === '__pycache__') continue;
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
 *   - Content inside JS/TS block comments (/** ... *\/)
 */
function scan(filePath, patterns) {
    if (!existsSync(filePath)) {
        return [{ path: filePath, line: 0, text: '(file not found)', pattern: 'N/A' }];
    }
    const content = readFileSync(filePath, 'utf8');
    const violations = [];
    const lines = content.split('\n');

    let inTripleQuote = false;  // Python """ ... """ docstring
    let inBlockComment = false; // JS/TS /* ... */ block comment

    lines.forEach((line, i) => {
        const trimmed = line.trim();

        // Track Python triple-quoted string blocks.
        // A line with an odd number of """ toggles the state.
        // We count occurrences; each pair is an open+close on the same line.
        const tripleCount = (line.match(/"""/g) || []).length;
        if (inTripleQuote) {
            if (tripleCount % 2 !== 0) {
                // Closing triple-quote found on this line — this line is still
                // inside the docstring; skip it, then exit triple-quote mode.
                inTripleQuote = false;
            }
            return; // inside docstring — skip entirely
        } else if (tripleCount % 2 !== 0) {
            // Opening triple-quote on a line we haven't entered yet.
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

// ── Run scans ─────────────────────────────────────────────────────────────────
let allViolations = [];

// Tier A: strict scan of bios/ and chronos/ directories.
for (const root of TIER_A_ROOTS) {
    const files = walk(root);
    for (const f of files) {
        allViolations = allViolations.concat(scan(f, TIER_A_PATTERNS));
    }
}

// Tier B: individual Python files — call-only patterns.
for (const file of TIER_B_FILES) {
    allViolations = allViolations.concat(scan(file, TIER_B_PATTERNS));
}

// Tier B TS: Grid bios/ directory — call-only TypeScript patterns.
for (const root of TIER_B_TS_ROOTS) {
    const files = walk(root).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    for (const f of files) {
        allViolations = allViolations.concat(scan(f, TIER_B_TS_PATTERNS));
    }
}

// ── Report ────────────────────────────────────────────────────────────────────
if (allViolations.length > 0) {
    console.error('\u274C Wall-clock forbidden violations found:');
    for (const v of allViolations) {
        console.error(`  ${v.path}:${v.line} matches ${v.pattern}`);
        console.error(`    > ${v.text}`);
    }
    console.error('\nFix: replace wall-clock calls with tick-based equivalents.');
    console.error('See: D-10b-09 in .planning/phases/10b-bios-needs-chronos-*/10b-CONTEXT.md');
    process.exit(1);
}

console.log('\u2705 No wall-clock reads in Bios/Chronos/retrieval paths (D-10b-09 OK)');
