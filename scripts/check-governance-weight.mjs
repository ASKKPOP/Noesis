#!/usr/bin/env node
/**
 * Phase 12 D-12-11 — Vote-weighting CI grep gate (T-09-14 / VOTE-06).
 *
 * Guards: no vote-weighting or reputation keys appear in governance source.
 *
 * Forbidden keys (GOVERNANCE_FORBIDDEN_KEYS vote-weighting subset):
 *   weight, reputation, relationship_score, ousia_weight
 *
 * Uses the same property-key syntax matching approach as check-governance-plaintext.mjs:
 * Only matches KEY: form (property key definition), not standalone KEY = or KEY.xxx
 * access patterns. This prevents false positives on unrelated uses of 'weight' as
 * a variable name in non-key contexts.
 *
 * No allowlist exceptions for v2.2. Any occurrence of these keys in governance
 * source is a violation — quadratic/reputation-weighted voting is explicitly
 * deferred to v2.3 (GOV-MULTI-01).
 *
 * Scanned directories:
 *   grid/src/governance/**
 *   grid/src/api/governance/**
 *   brain/src/noesis_brain/governance/**
 *
 * Exempt files:
 *   Any *.test.ts / *.test.tsx / test_*.py — tests may reference forbidden keys to assert rejection
 *   This script itself
 *   grid/src/audit/broadcast-allowlist.ts — GOVERNANCE_FORBIDDEN_KEYS declares these as the forbidden list
 *   grid/src/governance/types.ts           — GOVERNANCE_FORBIDDEN_KEYS re-export and SYNC doc reference
 *   dashboard/src/lib/protocol/governance-types.ts — mirror declaration of GOVERNANCE_FORBIDDEN_KEYS
 *
 * Exit 0: no violations.
 * Exit 1: violations listed to stderr.
 *
 * Run from repo root:
 *   node scripts/check-governance-weight.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Forbidden property-key pattern (vote-weighting keys) ──────────────────────
//
// Matches: weight: | reputation: | relationship_score: | ousia_weight:
// Preceded by a non-identifier char (or start of line).
// Does NOT match: relationship_score.toString(), or weight in a comment.
const FORBIDDEN_WEIGHT_PATTERN =
    /(?:^|[^a-zA-Z0-9_])(?:weight|reputation|relationship_score|ousia_weight)\s*:/;

// ── Exempt paths (forward-slash, repo-relative) ──────────────────────────────
// These files DECLARE the forbidden list — they must mention the key names.
const ALLOWLISTED_PATHS = new Set([
    'grid/src/audit/broadcast-allowlist.ts',
    'grid/src/governance/types.ts',
    'dashboard/src/lib/protocol/governance-types.ts',
    'scripts/check-governance-weight.mjs',
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
 * Scan a single file for the forbidden weight-key pattern.
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

        if (FORBIDDEN_WEIGHT_PATTERN.test(trimmed)) {
            violations.push({
                path: filePath,
                line: i + 1,
                text: trimmed.slice(0, 120),
            });
        }
    });
    return violations;
}

// ── Scan governance directories ───────────────────────────────────────────────
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
    process.stderr.write('\u274C check-governance-weight: ' + allViolations.length + ' violation(s) found:\n\n');
    for (const v of allViolations) {
        process.stderr.write(`  ${v.path}:${v.line}\n`);
        process.stderr.write(`    > ${v.text}\n`);
    }
    process.stderr.write('\n');
    process.stderr.write('Fix: remove weight/reputation/relationship_score/ousia_weight keys from governance source.\n');
    process.stderr.write('Vote-weighting is explicitly forbidden (VOTE-06 / T-09-14). Deferred to v2.3.\n');
    process.stderr.write('See: D-12-11 in .planning/phases/12-governance-collective-law/\n');
    process.exit(1);
}

console.log('\u2705 check-governance-weight: clean (0 vote-weighting violations — VOTE-06 OK)');
process.exit(0);
