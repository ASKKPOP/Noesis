#!/usr/bin/env node
/**
 * Phase 12 D-12-11 — Governance isolation CI grep gate (VOTE-05).
 *
 * Guards three isolation invariants:
 *
 * 1. NO import of operator-events.ts from governance modules.
 *    Governance must NEVER import from grid/src/audit/operator-events.ts.
 *    An operator event import in governance is an operator-exclusion violation.
 *    Pattern: import.*from\s+['"].*audit/operator-events['"]
 *
 * 2. NO operator.* event emission from governance modules.
 *    audit.append('operator.anything') is forbidden in governance scope.
 *    Pattern: audit\.append\(\s*['"]operator\.
 *
 * 3. NO import of operator law-management module from governance.
 *    grid/src/api/operator/governance-laws.ts is operator-facing;
 *    governance modules MUST NOT import from it.
 *    Pattern: from\s+['"].*api/operator/governance-laws['"]
 *
 * 4. REVERSE DIRECTION: grid/src/audit/operator-events.ts must NOT import
 *    anything from grid/src/governance/**. Governance must not be
 *    reachable from the operator audit path.
 *
 * Scanned directories:
 *   grid/src/governance/**
 *   grid/src/api/governance/**
 *   (reverse) grid/src/audit/operator-events.ts
 *
 * Exempt files:
 *   Any *.test.ts / *.test.tsx — tests may reference event names
 *   This script itself
 *
 * Exit 0: no violations.
 * Exit 1: violations listed to stderr.
 *
 * Run from repo root:
 *   node scripts/check-governance-isolation.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Forbidden import patterns in governance source ─────────────────────────────
const GOVERNANCE_FORBIDDEN_IMPORT_PATTERNS = [
    // No import of operator-events.ts into governance modules
    /import.*from\s+['"][^'"]*audit\/operator-events['"]/,
    // No audit.append('operator.*') call from governance modules
    /audit\.append\(\s*['"]operator\./,
    // No import of operator law-management module
    /from\s+['"][^'"]*api\/operator\/governance-laws['"]/,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTest(p) {
    return p.endsWith('.test.ts') || p.endsWith('.test.tsx') || p.endsWith('.spec.ts');
}

function norm(p) {
    return p.replace(/\\/g, '/');
}

function walk(dir, acc = []) {
    if (!existsSync(dir)) return acc;
    for (const entry of readdirSync(dir)) {
        if (['node_modules', '.git', 'dist', '.next', '__pycache__'].includes(entry)) continue;
        const p = join(dir, entry);
        const st = statSync(p);
        if (st.isDirectory()) walk(p, acc);
        else acc.push(p);
    }
    return acc;
}

/**
 * Scan a single file for forbidden patterns.
 * Skips single-line comments (// ... and * ...) and block comments (/* ... * /).
 */
function scanFile(filePath, patterns) {
    if (!existsSync(filePath)) {
        return [{ path: filePath, line: 0, text: '(file not found)', pattern: 'N/A' }];
    }
    const content = readFileSync(filePath, 'utf8');
    const violations = [];
    const lines = content.split('\n');

    let inBlockComment = false;

    lines.forEach((line, i) => {
        const trimmed = line.trim();

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
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        for (const rx of patterns) {
            if (rx.test(line)) {
                violations.push({
                    path: filePath,
                    line: i + 1,
                    text: trimmed.slice(0, 120),
                    pattern: String(rx),
                });
                break;
            }
        }
    });
    return violations;
}

// ── Run forward scan (governance/** must not use operator paths) ──────────────
let allViolations = [];

const governanceDirs = [
    'grid/src/governance',
    'grid/src/api/governance',
];

for (const dir of governanceDirs) {
    const files = walk(dir).filter(f => {
        const n = norm(f);
        return (n.endsWith('.ts') || n.endsWith('.tsx') || n.endsWith('.mjs')) && !isTest(n);
    });
    for (const f of files) {
        const hits = scanFile(f, GOVERNANCE_FORBIDDEN_IMPORT_PATTERNS);
        allViolations = allViolations.concat(hits.map(v => ({ direction: 'forward', ...v })));
    }
}

// ── Run reverse scan (operator-events.ts must not import from governance/) ─────
const operatorEventsPath = 'grid/src/audit/operator-events.ts';
if (existsSync(operatorEventsPath)) {
    const src = readFileSync(operatorEventsPath, 'utf8');
    const lines = src.split('\n');
    lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        // Any import that references governance/ is a reverse-direction violation
        if (/import.*from\s+['"][^'"]*governance[^'"]*['"]/.test(line)) {
            allViolations.push({
                direction: 'reverse',
                path: operatorEventsPath,
                line: i + 1,
                text: trimmed.slice(0, 120),
                pattern: 'governance import in operator-events.ts',
            });
        }
    });
}

// ── Report ────────────────────────────────────────────────────────────────────
if (allViolations.length > 0) {
    process.stderr.write('\u274C check-governance-isolation: ' + allViolations.length + ' violation(s) found:\n\n');

    const byDir = {};
    for (const v of allViolations) {
        const key = v.direction === 'reverse' ? 'reverse-direction' : v.path;
        if (!byDir[key]) byDir[key] = [];
        byDir[key].push(v);
    }

    for (const [group, hits] of Object.entries(byDir)) {
        process.stderr.write(`  File: ${group} (${hits.length} hit${hits.length !== 1 ? 's' : ''})\n`);
        for (const v of hits) {
            process.stderr.write(`    ${v.path}:${v.line}\n`);
            process.stderr.write(`      > ${v.text}\n`);
            process.stderr.write(`      Pattern: ${v.pattern}\n`);
        }
        process.stderr.write('\n');
    }

    process.stderr.write('Fix: governance modules MUST NOT import operator-events.ts or emit operator.* events.\n');
    process.stderr.write('See: D-12-11 / VOTE-05 in .planning/phases/12-governance-collective-law/\n');
    process.exit(1);
}

console.log('\u2705 check-governance-isolation: clean (0 violations — operator isolation preserved)');
process.exit(0);
