#!/usr/bin/env node
/**
 * scripts/check-did-policy-coverage.mjs
 *
 * Phase 36 OBS-36-01 (VIS-04) CI gate.
 *
 * Verifies that every Fastify route discovered via static source scan under
 * grid/src/api/ has a corresponding entry in ROUTE_DID_POLICY (policy.ts).
 *
 * Default-deny rule: a route MISSING from the table is still enforced as
 * 'civic_did_required', but missing a policy entry means developer intent is
 * undocumented — this gate makes that explicit.
 *
 * Route discovery regex:
 *   app.(get|post|put|delete|patch)(<TypeParam>)?('path', ...)
 * Skips commented lines. Skips __tests__, node_modules, dist directories.
 *
 * ROUTE_DID_POLICY parsing: regex against source text (no TypeScript import).
 *
 * Note on stale entries: ROUTE_DID_POLICY may contain entries for routes
 * registered via app.register() plugins that aren't discoverable via static
 * inline regex scan. The gate only checks the forward direction
 * (discovered routes → policy table) to avoid false positives from
 * plugin-based registrations. Future phases adding inline direct-register routes
 * without policy entries will fail this gate.
 *
 * Exit 0: all statically-discovered routes are covered in ROUTE_DID_POLICY.
 * Exit 1: at least one discovered route is missing from ROUTE_DID_POLICY.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const API_DIR = join(ROOT, 'grid', 'src', 'api');
const POLICY_FILE = join(ROOT, 'grid', 'src', 'api', 'policy.ts');

const EXCLUDE_DIRS = new Set(['__tests__', 'node_modules', 'dist', 'build', '.next']);

// ── File walker ───────────────────────────────────────────────────────────────

function* walkDir(dir) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
        if (err && err.code === 'ENOENT') return;
        throw err;
    }
    for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
            if (EXCLUDE_DIRS.has(e.name)) continue;
            yield* walkDir(p);
        } else if (e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) {
            yield p;
        }
    }
}

// ── ROUTE_DID_POLICY parser ───────────────────────────────────────────────────

function parseDeclaredPolicy(policyText) {
    const declared = new Map(); // "METHOD /path" -> policy value
    // Matches: 'GET /some/path': 'public'  or  "POST /some/path": "civic_did_required"
    const entryRe = /['"]((?:GET|POST|PUT|DELETE|PATCH)\s+\/[^'"]+)['"]\s*:\s*['"](\w+)['"]/g;
    let m;
    while ((m = entryRe.exec(policyText)) !== null) {
        declared.set(m[1], m[2]);
    }
    return declared;
}

// ── Route registration scanner ────────────────────────────────────────────────

function extractRoutesFromFile(filePath) {
    const text = readFileSync(filePath, 'utf8');
    const lines = text.split('\n');
    const routes = [];

    // Matches: app.get('/path', ...) or app.post<T>('/path', ...) etc.
    // Also handles generics: app.get<{...}>('/path', ...)
    const routeRe = /\bapp\.(get|post|put|delete|patch)(?:<[^>]*>)?\s*\(\s*['"]([^'"]+)['"]/gi;

    let inBlockComment = false;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        // Track block comments
        if (inBlockComment) {
            if (trimmed.includes('*/')) inBlockComment = false;
            continue;
        }
        if (trimmed.startsWith('/*') || trimmed.startsWith('/**')) {
            if (!trimmed.includes('*/') || trimmed.indexOf('*/') <= 2) {
                inBlockComment = true;
            }
            continue;
        }
        // Skip single-line comments and JSDoc continuation lines
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

        let match;
        routeRe.lastIndex = 0;
        while ((match = routeRe.exec(lines[i])) !== null) {
            const method = match[1].toUpperCase();
            const path = match[2];
            // Skip paths that look like variables or template strings
            if (path.includes('${') || path.startsWith('http')) continue;
            routes.push({
                method,
                path,
                file: relative(ROOT, filePath),
                line: i + 1,
                key: `${method} ${path}`,
            });
        }
    }

    return routes;
}

// ── Main ──────────────────────────────────────────────────────────────────────

let policyText;
try {
    policyText = readFileSync(POLICY_FILE, 'utf8');
} catch (err) {
    console.error(`[check-did-policy-coverage] ERROR: cannot read ${POLICY_FILE}:`);
    console.error(`  ${err.message}`);
    process.exit(1);
}

const declared = parseDeclaredPolicy(policyText);

// Discover all registered routes via static inline scan
const allRoutes = [];
for (const file of walkDir(API_DIR)) {
    allRoutes.push(...extractRoutesFromFile(file));
}

// De-duplicate (same METHOD+path may appear in multiple files via re-exports or overloads)
const seenKeys = new Set();
const uniqueRoutes = [];
for (const r of allRoutes) {
    if (!seenKeys.has(r.key)) {
        seenKeys.add(r.key);
        uniqueRoutes.push(r);
    }
}

const violations = [];

// Forward check: every statically-discovered route must be in ROUTE_DID_POLICY.
// Routes registered via app.register() plugins are NOT scanned here (they appear
// in ROUTE_DID_POLICY but are invisible to static inline regex — this is expected).
for (const route of uniqueRoutes) {
    if (!declared.has(route.key)) {
        violations.push(`${route.file}:${route.line}: route '${route.key}' missing from ROUTE_DID_POLICY`);
    }
}

if (violations.length === 0) {
    console.log(
        `[check-did-policy-coverage] OK — ${uniqueRoutes.length} inline routes covered by ROUTE_DID_POLICY, ` +
        `${declared.size} total policy entries, 0 violations.`,
    );
    process.exit(0);
}

console.error('[check-did-policy-coverage] VIOLATIONS FOUND:');
for (const v of violations) {
    console.error('  -', v);
}
console.error('');
console.error('Phase 36 VIS-04: every directly-registered Fastify route must have an explicit');
console.error('ROUTE_DID_POLICY entry in grid/src/api/policy.ts.');
console.error('Add the missing entry with the appropriate policy level, or register the route');
console.error('via a plugin module (which appears in ROUTE_DID_POLICY by its policy entry).');
process.exit(1);
