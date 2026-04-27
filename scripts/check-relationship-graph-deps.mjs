#!/usr/bin/env node
/**
 * D-9-08: no client-side graph layout libs. Server emits {x, y}; client reads them.
 * SC#5: grid/src/audit/broadcast-allowlist.ts line count MUST match pre-Phase-9 baseline.
 *
 * Fails CI if either invariant breaks.
 *
 * Gate A — D-9-08 runtime-dep allowlist:
 *   Scans dashboard/package.json and grid/package.json for banned graph layout libs.
 *   Fails with an explicit remediation message if any banned lib is found.
 *
 * Gate B — SC#5 broadcast-allowlist.ts line-count invariant:
 *   The weakest of three SC#5 layers (the strongest is allowlist-frozen.test.ts
 *   which asserts ALLOWLIST.size === 18 and no relationship.* members).
 *   This gate catches structural edits (comments, whitespace churn, new exports)
 *   that would not change the array size but would indicate unauthorised edits.
 *
 * Baseline recorded during Plan 06 Task 3 execution:
 *   wc -l grid/src/audit/broadcast-allowlist.ts → 146 lines
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot  = resolve(__dirname, '..');

const BANNED = [
    'd3-force', 'd3-hierarchy', 'd3-force-3d',
    'cytoscape', 'cytoscape-cola',
    'graphology', 'graphology-layout',
    'ngraph.forcelayout', 'sigma',
    'vis-network', 'react-force-graph',
    'react-force-graph-2d', 'react-force-graph-3d',
];

const TARGETS = [
    resolve(repoRoot, 'dashboard/package.json'),
    resolve(repoRoot, 'grid/package.json'),
];

// SC#5 — broadcast-allowlist.ts baseline line count.
// Updated 2026-04-27 (Phase 13 gap-closure): Phase 12 added proposal.opened + ballot.committed +
// ballot.revealed + proposal.tallied (+4 entries); Phase 13 added operator.exported (+1 entry).
// Each addition was approved in its own CONTEXT.md.
// Update ONLY when a deliberate post-Phase-9 change is made AND the plan-checker
// approves the amendment of D-9-13. Do NOT update to suppress a failing gate.
// History: Phase 9 baseline = 147, Phase 10b post-ship = 213, Phase 11 post-ship = 266,
//          Phase 12 post-ship = 321 (4 governance events), Phase 13 Wave 3 = 321 (operator.exported).
const ALLOWLIST_FILE = resolve(repoRoot, 'grid/src/audit/broadcast-allowlist.ts');
const ALLOWLIST_BASELINE_LINES = 321;

let hadError = false;

// ── Gate A — banned runtime deps ─────────────────────────────────────────────

for (const target of TARGETS) {
    if (!existsSync(target)) continue;
    let pkg;
    try {
        pkg = JSON.parse(readFileSync(target, 'utf8'));
    } catch (err) {
        console.error(`[check-relationship-graph-deps] ERROR: could not parse ${target}: ${err.message}`);
        hadError = true;
        continue;
    }
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const banned of BANNED) {
        if (allDeps[banned] !== undefined) {
            console.error(`[check-relationship-graph-deps] D-9-08 VIOLATION: "${banned}" found in ${target}`);
            console.error(`  Phase 9 forbids client-side graph layout libs. Layout runs server-side.`);
            console.error(`  If you need this lib, amend D-9-08 via /gsd-discuss-phase first.`);
            hadError = true;
        }
    }
}

// ── Gate B — SC#5 broadcast-allowlist.ts line-count invariant ────────────────

if (existsSync(ALLOWLIST_FILE)) {
    const contents  = readFileSync(ALLOWLIST_FILE, 'utf8');
    const lineCount = contents.split('\n').length;
    if (lineCount !== ALLOWLIST_BASELINE_LINES) {
        console.error(`[check-relationship-graph-deps] SC#5 VIOLATION: broadcast-allowlist.ts line count changed.`);
        console.error(`  baseline: ${ALLOWLIST_BASELINE_LINES} lines`);
        console.error(`  actual:   ${lineCount} lines`);
        console.error(`  Phase 9 invariant: broadcast allowlist is frozen (D-9-13). No additions, no structural edits.`);
        console.error(`  If this is intentional (e.g. a post-Phase-9 plan unfroze it), update ALLOWLIST_BASELINE_LINES`);
        console.error(`  in this script AND obtain plan-checker approval first.`);
        hadError = true;
    }
} else {
    console.warn(`[check-relationship-graph-deps] SC#5 WARNING: ${ALLOWLIST_FILE} not found; SC#5 gate skipped.`);
}

// ── Result ────────────────────────────────────────────────────────────────────

if (hadError) {
    process.exit(1);
}
console.log('[check-relationship-graph-deps] OK — no banned graph libs; broadcast-allowlist.ts at baseline line count.');
process.exit(0);
