#!/usr/bin/env node
/**
 * Phase 12 D-12-11 — Governance body-privacy CI grep gate (T-09-12 / VOTE-05).
 *
 * Guards: no forbidden plaintext body/content/proposal-text keys appear in
 * governance source files outside the explicitly allowlisted filepaths.
 *
 * Forbidden keys (clone of GOVERNANCE_FORBIDDEN_KEYS minus vote-weighting):
 *   text, body, content, description, rationale, proposal_text, law_text, body_text
 *
 * IMPORTANT — this gate uses PROPERTY-KEY syntax matching (KEY:) only,
 * NOT standalone variable assignments (KEY =). This prevents false positives on:
 *   - `const body = req.body`  (HTTP handler boilerplate — 'body' as rhs, not key)
 *   - `request.body` property access (reads the HTTP request body object)
 *   The real body-privacy leak is always `{ body_text: ..., text: ... }` (object literal key).
 *
 * Regex design:
 *   Matches only when the key word appears in a property-key context:
 *     preceded by a non-identifier char (or start of line) AND
 *     followed by optional whitespace + ':'
 *   Does NOT match:
 *     request.body       — no preceding non-ident boundary required before .body
 *     bodyText           — suffix 'Text' prevents word boundary match
 *     'body' in a comment line
 *
 * Filepath allowlist (body_text is structurally necessary at these call sites):
 *   grid/src/db/schema.ts                            — CREATE TABLE body_text column
 *   grid/src/api/governance/routes.ts                — HTTP request.body destructuring + body_text field access
 *   grid/src/governance/store.ts                     — MySQL INSERT/SELECT includes body_text column
 *   grid/src/governance/appendProposalOpened.ts      — receives body_text, hashes it, discards plaintext
 *   brain/src/noesis_brain/governance/proposer.py    — builds the action with body_text param
 *
 * Scanned directories:
 *   grid/src/governance/**
 *   grid/src/api/governance/**
 *   brain/src/noesis_brain/governance/**
 *
 * Exempt files:
 *   Files in ALLOWLISTED_PATHS set
 *   Any *.test.ts / *.test.tsx / test_*.py — tests may reference forbidden keys to assert rejection
 *   This script itself
 *
 * Exit 0: no violations outside the allowlist.
 * Exit 1: violations listed to stderr with file:line:match.
 *
 * Run from repo root:
 *   node scripts/check-governance-plaintext.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Forbidden property-key pattern ─────────────────────────────────────────────
//
// Matches: text: | body: | content: | description: | rationale: |
//          proposal_text: | law_text: | body_text:
// when preceded by a non-identifier character (or start of string).
//
// Does NOT match: request.body (preceded by '.', which IS a non-ident char BUT
// 'body' there is a property ACCESS, not a property KEY definition; the colon
// constraint discriminates because "request.body" is followed by nothing / newline / space).
//
// The regex matches 'body:' or '"body":' — both are property-key leaks.
// '['body']' (computed key) is NOT matched — this is an edge-case we accept as
// a false-negative because governance source uses no computed string keys.
const FORBIDDEN_KEY_PATTERN =
    /(?:^|[^a-zA-Z0-9_])(?:text|body|content|description|rationale|proposal_text|law_text|body_text)\s*:/;

// ── Filepath allowlist (forward-slash, repo-relative, no leading ./) ───────────
// These files are known to contain 'body_text' or 'description' by structural necessity:
// (1) Schema column definition
// (2) HTTP handler input destructuring
// (3) Store SQL INSERT/SELECT (body_text column)
// (4) Emitter that receives body_text, hashes it, and discards plaintext
// (5) Brain proposer action builder (body_text is the parameter name)
// (6) appendLawTriggered: builds a canonical law hash using law.description (Law DSL field,
//     not governance proposal body) — the description key is part of the Law object shape
// (7) replay.ts: deterministic zero-diff test harness that builds a fixture FixtureDefinition
//     with body_text and a law description — both passed to allowlisted functions.
//     body_text in the fixture is the proposal body (passed to appendProposalOpened, allowlisted).
//     description inside body_text JSON is the Law DSL field, not a governance audit payload.
// ANY other occurrence of body_text or description in governance source is a violation.
const ALLOWLISTED_PATHS = new Set([
    'grid/src/db/schema.ts',
    'grid/src/api/governance/routes.ts',
    'grid/src/governance/store.ts',
    'grid/src/governance/appendProposalOpened.ts',
    'grid/src/governance/appendLawTriggered.ts',   // law.description is Law DSL, not proposal body
    'grid/src/governance/replay.ts',               // zero-diff fixture: body_text param to appendProposalOpened
    'brain/src/noesis_brain/governance/proposer.py',
    // This script — the pattern IS the constant
    'scripts/check-governance-plaintext.mjs',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTest(p) {
    const n = p.replace(/\\/g, '/');
    return (
        n.endsWith('.test.ts') ||
        n.endsWith('.test.tsx') ||
        /\/test_[^/]+\.py$/.test(n) ||
        n.includes('/test/') ||
        n.includes('/tests/')
    );
}

function norm(p) {
    return p.replace(/\\/g, '/');
}

function repoRel(fullPath) {
    // Strip everything up to and including the workspace root prefix
    const n = norm(fullPath);
    for (const prefix of ['grid/', 'brain/', 'dashboard/', 'scripts/']) {
        const idx = n.indexOf(prefix);
        if (idx !== -1) return n.slice(idx);
    }
    return n;
}

function walk(dir, acc = []) {
    if (!existsSync(dir)) return acc;
    for (const entry of readdirSync(dir)) {
        if (['node_modules', '.git', 'dist', '.next', '__pycache__', 'build'].includes(entry)) continue;
        const p = join(dir, entry);
        const st = statSync(p);
        if (st.isDirectory()) walk(p, acc);
        else acc.push(p);
    }
    return acc;
}

/**
 * Scan a single file for the forbidden property-key pattern.
 * Skips comment lines and block comments.
 */
function scanFile(filePath) {
    if (!existsSync(filePath)) return [];
    const content = readFileSync(filePath, 'utf8');
    const violations = [];
    const lines = content.split('\n');

    let inBlockComment = false;
    let inTripleQuote = false;

    lines.forEach((line, i) => {
        const trimmed = line.trim();

        // Track Python triple-quoted string blocks.
        const tripleCount = (line.match(/"""/g) || []).length;
        if (inTripleQuote) {
            if (tripleCount % 2 !== 0) inTripleQuote = false;
            return;
        } else if (tripleCount % 2 !== 0) {
            inTripleQuote = true;
            return;
        }

        // Track JS/TS block comments.
        if (inBlockComment) {
            if (trimmed.includes('*/')) inBlockComment = false;
            return;
        }
        if (trimmed.startsWith('/*') || trimmed.startsWith('/**')) {
            if (!trimmed.includes('*/') || trimmed.indexOf('*/') <= 2) {
                inBlockComment = true;
            }
            return;
        }

        // Skip single-line comment lines.
        if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        if (FORBIDDEN_KEY_PATTERN.test(trimmed)) {
            violations.push({
                path: filePath,
                line: i + 1,
                text: trimmed.slice(0, 120),
            });
        }
    });
    return violations;
}

// ── Scan scoped directories ───────────────────────────────────────────────────
let allViolations = [];

const scanDirs = [
    'grid/src/governance',
    'grid/src/api/governance',
    'brain/src/noesis_brain/governance',
];

for (const dir of scanDirs) {
    const files = walk(dir);
    for (const f of files) {
        const rel = repoRel(f);
        if (ALLOWLISTED_PATHS.has(rel)) continue;
        if (isTest(norm(f))) continue;
        const hits = scanFile(f);
        allViolations = allViolations.concat(hits);
    }
}

// ── Report ────────────────────────────────────────────────────────────────────
if (allViolations.length > 0) {
    process.stderr.write('\u274C check-governance-plaintext: ' + allViolations.length + ' violation(s) found:\n\n');
    for (const v of allViolations) {
        process.stderr.write(`  ${v.path}:${v.line}\n`);
        process.stderr.write(`    > ${v.text}\n`);
    }
    process.stderr.write('\n');
    process.stderr.write('Fix: remove forbidden body/text/content/etc. property keys from governance source.\n');
    process.stderr.write('Allowlisted paths (body_text structurally required):\n');
    for (const p of ALLOWLISTED_PATHS) {
        if (p !== 'scripts/check-governance-plaintext.mjs') {
            process.stderr.write(`  ${p}\n`);
        }
    }
    process.stderr.write('See: T-09-12 / D-12-11 in .planning/phases/12-governance-collective-law/\n');
    process.exit(1);
}

console.log('\u2705 check-governance-plaintext: clean (0 body/text/content violations outside allowlist)');
process.exit(0);
