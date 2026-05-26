#!/usr/bin/env node
// Phase 36 / D-36-21 / D-V3-15 — assert exactly 5 no-DID auth exception endpoints (SIWE + email/signup + email/signin + oauth/google + oauth/apple). Update this gate if intentionally adding a 6th exception via a future CONTEXT.md decision.

/**
 * scripts/check-no-did-exception-count.mjs
 *
 * Phase 36 OBS-36-04 (D-V3-15 amended by D-36-21) CI gate.
 *
 * Verifies that ROUTE_DID_POLICY contains EXACTLY 5 entries with:
 *   - key matching /^POST \/portal\/auth\//
 *   - value equal to 'public'
 *
 * The 5 accepted no-DID auth exceptions per D-36-21:
 *   1. POST /portal/auth/siwe
 *   2. POST /portal/auth/email/signup
 *   3. POST /portal/auth/email/signin
 *   4. POST /portal/auth/oauth/google
 *   5. POST /portal/auth/oauth/apple
 *
 * A count != 5 means either:
 *   - A 6th exception was silently added (raises D-V3-15 sovereignty concern)
 *   - An existing exception was removed (should be intentional + documented)
 *
 * To intentionally change this count: update this gate AND add a CONTEXT.md
 * decision entry documenting the rationale.
 *
 * Exit 0: exactly 5 no-DID portal/auth exceptions.
 * Exit 1: count != 5 (reports actual count vs expected 5).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const POLICY_FILE = join(ROOT, 'grid', 'src', 'api', 'policy.ts');

const EXPECTED_COUNT = 5;

// ── ROUTE_DID_POLICY parser ───────────────────────────────────────────────────

function parseDeclaredPolicy(policyText) {
    const declared = new Map(); // "METHOD /path" -> policy value
    const entryRe = /['"]((?:GET|POST|PUT|DELETE|PATCH)\s+\/[^'"]+)['"]\s*:\s*['"](\w+)['"]/g;
    let m;
    while ((m = entryRe.exec(policyText)) !== null) {
        declared.set(m[1], m[2]);
    }
    return declared;
}

// ── Main ──────────────────────────────────────────────────────────────────────

let policyText;
try {
    policyText = readFileSync(POLICY_FILE, 'utf8');
} catch (err) {
    console.error(`[check-no-did-exception-count] ERROR: cannot read ${POLICY_FILE}:`);
    console.error(`  ${err.message}`);
    process.exit(1);
}

const declared = parseDeclaredPolicy(policyText);

// Count entries: key starts with "POST /portal/auth/" AND value is 'public'
const exceptions = [];
for (const [key, value] of declared) {
    if (key.startsWith('POST /portal/auth/') && value === 'public') {
        exceptions.push(key);
    }
}

const count = exceptions.length;

if (count === EXPECTED_COUNT) {
    console.log(
        `[check-no-did-exception-count] OK — exactly ${EXPECTED_COUNT} no-DID auth exceptions found ` +
        `(D-V3-15 amended by D-36-21: SIWE + email/signup + email/signin + oauth/google + oauth/apple).`,
    );
    process.exit(0);
}

console.error('[check-no-did-exception-count] VIOLATION:');
console.error(`  Expected exactly ${EXPECTED_COUNT} no-DID auth exceptions, found ${count}.`);
console.error('');
if (count > EXPECTED_COUNT) {
    console.error(`  EXTRA entries (${count - EXPECTED_COUNT} above limit):`);
    for (const key of exceptions) {
        console.error(`    - ${key}`);
    }
    console.error('');
    console.error('  A new no-DID portal/auth exception was added without a CONTEXT.md decision.');
    console.error('  If intentional: update this gate to the new expected count AND add a CONTEXT.md');
    console.error('  entry citing the decision number (e.g., D-36-21 pattern).');
} else {
    console.error(`  MISSING entries (expected ${EXPECTED_COUNT}, found ${count}):`);
    for (const key of exceptions) {
        console.error(`    - ${key} (still present)`);
    }
    console.error('');
    console.error('  A no-DID portal/auth exception was removed. If intentional: update this gate.');
}
console.error('');
console.error('Phase 36 D-V3-15 (amended D-36-21): exactly 5 no-DID write exception endpoints');
console.error('are authorized. See CONTEXT.md §D-36-21 for the rationale.');
process.exit(1);
