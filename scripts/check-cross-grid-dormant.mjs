#!/usr/bin/env node
/**
 * Phase 55 CI gate (PORTAL-06) — the Cross-Grid framework must stay DORMANT in v3.0.
 *
 * Asserts two invariants:
 *  1. The two cross-Grid producers (append-portal-cross-grid-*) are UNREACHABLE — not imported
 *     by any non-test file under grid/src. They exist for v3.1 but must never fire in v3.0.
 *  2. The marketplace-mediation route returns 503 `not_yet_active`.
 *
 * Activation at v3.1 is a deliberate, reviewable change to this gate + the route.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'grid', 'src');
const DORMANT_PRODUCERS = ['append-portal-cross-grid-action-mediated', 'append-portal-cross-grid-identity-linked'];

function tsFiles(dir) {
    return readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) return tsFiles(p);
        return p.endsWith('.ts') ? [p] : [];
    });
}

const offenders = [];
for (const file of tsFiles(SRC)) {
    // The producer files reference their own module name; skip self-references.
    const base = file.split('/').pop().replace(/\.ts$/, '');
    if (DORMANT_PRODUCERS.includes(base)) continue;
    const code = readFileSync(file, 'utf8');
    for (const prod of DORMANT_PRODUCERS) {
        // Only flag actual imports (non-comment lines).
        code.split('\n').forEach((line, i) => {
            const stripped = line.replace(/\/\/.*$/, '');
            if (/\bimport\b/.test(stripped) && stripped.includes(prod)) offenders.push(`${file.replace(root + '/', '')}:${i + 1} imports dormant ${prod}`);
        });
    }
}

// Invariant 2: the marketplace-mediation route returns 503 not_yet_active.
const routeFile = join(SRC, 'api', 'routes', 'portal-cross-grid.ts');
const routeSrc = readFileSync(routeFile, 'utf8');
if (!/code\(503\)/.test(routeSrc) || !/not_yet_active|CROSS_GRID_DORMANT_REASON/.test(routeSrc)) {
    offenders.push('portal-cross-grid.ts: marketplace-mediation route must return 503 not_yet_active in v3.0');
}

if (offenders.length) {
    console.error('[check-cross-grid-dormant] VIOLATION — cross-Grid framework must stay dormant in v3.0:');
    offenders.forEach((o) => console.error('  - ' + o));
    process.exit(1);
}
console.log('[check-cross-grid-dormant] OK — cross-Grid producers unreachable + marketplace stub returns 503 (dormant in v3.0).');
