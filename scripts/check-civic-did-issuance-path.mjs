#!/usr/bin/env node
/**
 * scripts/check-civic-did-issuance-path.mjs
 *
 * Phase 37 / REG-06 / D-V3-33 — Portal-gating constitutional CI gate.
 *
 * Enforces that the four Phase 37 audit producers
 *   - append-registry-civic-did-issued
 *   - append-registry-civic-did-revoked
 *   - append-registry-business-did-registered
 *   - append-registry-business-did-dissolved
 * are imported ONLY by approved registry service files. This is the
 * constitutional invariant carried in CLAUDE.md: any Civic-DID issuance,
 * revocation, business-registration, or dissolution code path that
 * routes around the DID Registry breaks D-V3-33 and is a build failure.
 *
 * APPROVED_IMPORTERS:
 *   - grid/src/api/routes/registry.ts          (HTTP route handlers)
 *   - grid/src/civic-registry/civic-did-store.ts (anticipated v3.x — forward-compat)
 *   - grid/src/civic-registry/business-did-store.ts (anticipated v3.x — forward-compat)
 *
 * Self-references in the producer files themselves are ignored
 * (filename matches its module name).
 *
 * Comment-only references (e.g. broadcast-allowlist.ts documenting which
 * sole-producer emits each event) are intentionally excluded: only lines
 * that are not pure // comments are checked. This prevents false-positives
 * from documentation comments that mention the producer file path.
 *
 * Exit codes:
 *   0 — clean: no unauthorized importers.
 *   1 — at least one violation; output identifies file → import token.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOT = join(ROOT, 'grid', 'src');

const FORBIDDEN_IMPORT_TOKENS = [
    'append-registry-civic-did-issued',
    'append-registry-civic-did-revoked',
    'append-registry-business-did-registered',
    'append-registry-business-did-dissolved',
];

const APPROVED_IMPORTERS = new Set([
    'grid/src/api/routes/registry.ts',
    'grid/src/civic-registry/civic-did-store.ts',
    'grid/src/civic-registry/business-did-store.ts',
]);

const PRODUCER_FILES = new Set([
    'grid/src/audit/append-registry-civic-did-issued.ts',
    'grid/src/audit/append-registry-civic-did-revoked.ts',
    'grid/src/audit/append-registry-business-did-registered.ts',
    'grid/src/audit/append-registry-business-did-dissolved.ts',
]);

const EXCLUDE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', '.next']);
const EXCLUDE_FILE_PATTERNS = [/\.test\.ts$/, /\.d\.ts$/];

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
            if (EXCLUDE_DIR_NAMES.has(e.name)) continue;
            yield* walkDir(p);
        } else if (e.isFile() && /\.ts$/.test(e.name)) {
            if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(p))) continue;
            yield p;
        }
    }
}

/**
 * Returns true if a non-comment line in the file contains the given token.
 * A line is considered a pure comment if its first non-whitespace characters are '//'
 * or if it is inside a block comment (starts after a leading ' *').
 * For simplicity we only strip single-line '//' and ' * ' block-comment lines.
 */
function fileHasNonCommentToken(text, token) {
    const lines = text.split('\n');
    for (const line of lines) {
        const trimmed = line.trimStart();
        // Skip pure single-line comments and block-comment continuation lines.
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            continue;
        }
        if (trimmed.includes(token)) return true;
    }
    return false;
}

function scanFile(filePath) {
    const rel = relative(ROOT, filePath);
    if (PRODUCER_FILES.has(rel)) return [];
    if (APPROVED_IMPORTERS.has(rel)) return [];
    const text = readFileSync(filePath, 'utf8');
    const violations = [];
    for (const token of FORBIDDEN_IMPORT_TOKENS) {
        if (fileHasNonCommentToken(text, token)) {
            violations.push({ file: rel, token });
        }
    }
    return violations;
}

const allViolations = [];
const filesScanned = [];
for (const file of walkDir(SCAN_ROOT)) {
    filesScanned.push(relative(ROOT, file));
    allViolations.push(...scanFile(file));
}

if (allViolations.length === 0) {
    console.log(
        `[check-civic-did-issuance-path] OK — ${filesScanned.length} files scanned; ` +
        `APPROVED_IMPORTERS (${APPROVED_IMPORTERS.size}) and PRODUCER_FILES (${PRODUCER_FILES.size}) ` +
        `are the only paths permitted to reference append-registry-*.`,
    );
    process.exit(0);
}

console.error('[check-civic-did-issuance-path] VIOLATIONS FOUND:');
console.error('  file → forbidden-import-token');
for (const v of allViolations) {
    console.error(`  ${v.file} → ${v.token}`);
}
console.error('');
console.error('D-V3-33 Portal-gating invariant: only the DID Registry service may emit registry.* audit events.');
console.error('Approved importers:');
for (const a of APPROVED_IMPORTERS) console.error(`  ${a}`);
console.error('');
console.error('To fix: move the import to grid/src/api/routes/registry.ts (or expand APPROVED_IMPORTERS in');
console.error('scripts/check-civic-did-issuance-path.mjs WITH a code-review justification documenting the new');
console.error('constitutional carve-out).');
console.error('');
console.error('D-V3-33 Portal-gating invariant is a constitutional requirement. See CLAUDE.md for details.');
process.exit(1);
