#!/usr/bin/env node
/**
 * D-V3-18 (Phase 47 Police v3) — NO operator-direct path to execute a Police sanction.
 *
 * Makes the constitutional invariant EXECUTABLE. Punitive power runs ONLY through the
 * court: Police file charges → GOVERNMENT convicts → Police execute against a *convicted*
 * charge → the sanctioned party may appeal to the Government. There must be no route by
 * which the operator (Henry), even at H5, imposes a sanction directly.
 *
 * Fails CI if:
 *   1. the sanction-execution route is missing or gated by anything but a police tier;
 *   2. the conviction gate is missing or not `government_only`;
 *   3. any route that imposes/executes a sanction is gated by an operator-ish tier.
 *
 * This gate reads grid/src/api/policy.ts (the single source of route→tier truth).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const policyPath = resolve(repoRoot, 'grid/src/api/policy.ts');

const text = readFileSync(policyPath, 'utf8');
const entries = [...text.matchAll(/'((?:GET|POST|PUT|PATCH|DELETE)\s+[^']+)':\s*'([a-z_]+)'/g)]
    .map((m) => ({ route: m[1], tier: m[2] }));

const failures = [];
const find = (substr) => entries.filter((e) => e.route.includes(substr));

// 1. The sanction-execution route exists and is a police tier (civic), never operator.
const exec = find('execute-sanction');
if (exec.length === 0) {
    failures.push('POL-04: no execute-sanction route found in policy.ts.');
}
for (const e of exec) {
    if (e.tier !== 'police_only') {
        failures.push(`execute-sanction must be 'police_only', found '${e.tier}' for ${e.route}.`);
    }
}

// 2. The conviction gate is government_only — the only path to punitive power.
const convict = find('/convict');
if (convict.length === 0) {
    failures.push('The conviction gate is missing (no /convict route) — punitive power has no court.');
}
for (const e of convict) {
    if (e.tier !== 'government_only') {
        failures.push(`convict must be 'government_only', found '${e.tier}' for ${e.route}.`);
    }
}

// 3. No route that imposes/executes a sanction may be gated by an operator-ish tier.
const OPERATOR_TIERS = ['operator_only', 'operator', 'h5', 'steward_only', 'sovereign'];
for (const e of entries) {
    if (/sanction|execute-sanction/i.test(e.route) && OPERATOR_TIERS.includes(e.tier)) {
        failures.push(`D-V3-18 VIOLATION: ${e.route} imposes a sanction under operator tier '${e.tier}'.`);
    }
}

if (failures.length > 0) {
    console.error('[check-no-operator-sanction-path] D-V3-18 VIOLATIONS:');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
}
console.log(
    '[check-no-operator-sanction-path] OK — punitive power runs only through the court ' +
    '(execute-sanction=police_only, convict=government_only); no operator-direct sanction path.',
);
process.exit(0);
