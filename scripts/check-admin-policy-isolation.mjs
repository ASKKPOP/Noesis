#!/usr/bin/env node
/**
 * scripts/check-admin-policy-isolation.mjs
 *
 * Phase 36 OBS-36-02 (D-36-10) CI gate.
 *
 * Verifies that no /admin/* route in ROUTE_DID_POLICY is assigned a permissive
 * policy ('public' or 'portal_session_required'). All directly-addressed admin
 * routes MUST be 'civic_did_required' or higher.
 *
 * "Directly-addressed" means: the path segment immediately after the HTTP method
 * starts with /admin/ — e.g., "GET /admin/config". Routes at "/api/v1/admin/"
 * are pre-Phase-36 legacy routes that use their own internal auth mechanism and
 * are intentionally excluded from this gate (those are Tier 2/3 management routes
 * with their own auth layer, not the civic auth layer checked here).
 *
 * Policy tiers accepted for /admin/* routes:
 *   - civic_did_required  (minimum)
 *   - business_did_required
 *   - government_only
 *   - police_only
 *
 * Exit 0: all direct /admin/* routes have the required policy (or no such routes exist).
 * Exit 1: at least one /admin/* route has a permissive policy.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const POLICY_FILE = join(ROOT, 'grid', 'src', 'api', 'policy.ts');

const PERMISSIVE_POLICIES = new Set(['public', 'portal_session_required']);

const ACCEPTED_ADMIN_POLICIES = [
    'civic_did_required',
    'business_did_required',
    'government_only',
    'police_only',
];

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
    console.error(`[check-admin-policy-isolation] ERROR: cannot read ${POLICY_FILE}:`);
    console.error(`  ${err.message}`);
    process.exit(1);
}

const declared = parseDeclaredPolicy(policyText);

const violations = [];
let adminRouteCount = 0;

for (const [key, value] of declared) {
    // Extract path from key (e.g., "GET /admin/config" -> "/admin/config")
    const spaceIdx = key.indexOf(' ');
    const path = spaceIdx >= 0 ? key.slice(spaceIdx + 1) : key;

    // Only check direct /admin/* routes (not /api/v1/admin/ legacy routes)
    if (!path.startsWith('/admin/')) continue;

    adminRouteCount++;

    if (PERMISSIVE_POLICIES.has(value)) {
        violations.push(
            `ROUTE_DID_POLICY['${key}'] = '${value}' — /admin/* routes must be '${ACCEPTED_ADMIN_POLICIES[0]}' or higher`,
        );
    }
}

if (violations.length === 0) {
    console.log(
        `[check-admin-policy-isolation] OK — ${adminRouteCount} direct /admin/* route(s) checked, ` +
        `0 violations. All have civic_did_required or higher.`,
    );
    process.exit(0);
}

console.error('[check-admin-policy-isolation] VIOLATIONS FOUND:');
for (const v of violations) {
    console.error('  -', v);
}
console.error('');
console.error('Phase 36 D-36-10: /admin/* routes must be civic_did_required, business_did_required,');
console.error('government_only, or police_only. Assigning public or portal_session_required to an');
console.error('/admin/* route is a Tier 2/3 management surface exposure violation.');
console.error('See CONTEXT.md D-36-10 and CLAUDE.md §3-tier management taxonomy (D-V3-36).');
process.exit(1);
