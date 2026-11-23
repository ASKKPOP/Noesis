#!/usr/bin/env node
/**
 * scripts/check-gates-wired.mjs
 *
 * Every scripts/check-*.mjs gate must be run by a CI workflow.
 *
 * Found 2026-11-22: 13 of 29 gates were run by no workflow (9 only under the
 * root `npm test` pretest chain, 4 nowhere), so a gate could be written,
 * documented as "CI-enforced", and never run on a pull request.
 *
 * Exit 0: every gate file name appears in a .github/workflows/*.yml `run:` line.
 * Exit 1: at least one gate is not run by any workflow.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = join(ROOT, '.github', 'workflows');

const gates = readdirSync(join(ROOT, 'scripts'))
    .filter((f) => /^check-.*\.mjs$/.test(f))
    .sort();

const runLines = readdirSync(WORKFLOWS)
    .filter((f) => /\.ya?ml$/.test(f))
    .flatMap((f) => readFileSync(join(WORKFLOWS, f), 'utf8').split('\n'))
    .filter((line) => /^\s*(-\s*)?run:/.test(line))
    .join('\n');

const unwired = gates.filter((g) => !runLines.includes(`scripts/${g}`));

if (unwired.length === 0) {
    console.log(`[check-gates-wired] OK — all ${gates.length} scripts/check-*.mjs gates are run by a CI workflow.`);
    process.exit(0);
}

console.error('[check-gates-wired] GATES NOT RUN BY ANY WORKFLOW:');
for (const g of unwired) console.error(`  scripts/${g}`);
console.error('');
console.error('Add a step to .github/workflows/rig-invariants.yml for each one:');
console.error('      - name: <what it guards>');
console.error('        run: node scripts/<gate>.mjs');
process.exit(1);
