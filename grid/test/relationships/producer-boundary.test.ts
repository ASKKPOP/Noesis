/**
 * Phase 9 Plans 02+03 — Producer boundary grep gates (D-9-05, T-09-06 CRITICAL).
 *
 * Gate 1 (Plan 02, Wave 1): Only grid/src/relationships/listener.ts may call
 *   edges.set() / edges.delete() / edges.clear() — the sole in-memory Map writer.
 *
 * Gate 2 (Plan 03, Wave 1): Only grid/src/relationships/storage.ts may write to
 *   the MySQL `relationships` SQL table via INSERT/UPDATE/REPLACE/DELETE.
 *
 * Both gates are now live. Walk scope is ALL of grid/src/ so a rogue mutation
 * in grid/src/integration/ or grid/src/api/ fires either gate.
 *
 * Clones grid/test/audit/telos-refined-producer-boundary.test.ts structure exactly.
 *
 * Edge cases handled (RESEARCH.md lines 585-588):
 * - Token `edges.` is domain-specific; verified zero hits outside planned paths.
 * - Comments containing `edges.set(` also trigger Gate 1. Path-allowlist is
 *   the only escape — NOT eslint-disable or comment suppression.
 * - SQL_WRITE_PATTERN is case-insensitive; matches both upper and lower case SQL.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve as _resolve } from 'path';
import { readFileSync as _readFileSync2 } from 'node:fs';

const GRID_SRC = join(__dirname, '../../src');

// Gate 1: In-memory edges Map mutations allowed ONLY in listener.ts (D-9-05).
const MAP_WRITE_PATTERN = /\b(?:this\.)?edges\.(?:set|delete|clear)\s*\(/;
const ALLOWED_MAP_WRITER = /relationships\/listener\.ts$/;

function walk(dir: string, files: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, files);
        else if (full.endsWith('.ts')) files.push(full);
    }
    return files;
}

// Gate 2: SQL writes against the `relationships` table allowed ONLY in storage.ts (D-9-05).
const SQL_WRITE_PATTERN = /\b(?:INSERT\s+INTO|UPDATE|REPLACE\s+INTO|DELETE\s+FROM)\s+[`"']?relationships[`"']?/i;
const ALLOWED_SQL_WRITER = /relationships\/storage\.ts$/;

// Gate 3: D-9-08 runtime-dep allowlist — banned client-side graph layout libs.
// These libs must NOT appear in dashboard/package.json or grid/package.json.
// Server emits {x, y} coordinates; client reads them — no client layout engine needed.

const BANNED_LIBS = [
    'd3-force', 'd3-hierarchy', 'd3-force-3d',
    'cytoscape', 'cytoscape-cola',
    'graphology', 'graphology-layout',
    'ngraph.forcelayout', 'sigma',
    'vis-network', 'react-force-graph',
    'react-force-graph-2d', 'react-force-graph-3d',
];

describe('relationships producer boundary', () => {
    const all = walk(GRID_SRC);

    it('only listener.ts mutates the edges Map (D-9-05)', () => {
        const offenders: string[] = [];
        for (const f of all) {
            const src = readFileSync(f, 'utf-8');
            if (MAP_WRITE_PATTERN.test(src) && !ALLOWED_MAP_WRITER.test(f)) {
                offenders.push(relative(GRID_SRC, f));
            }
        }
        expect(offenders).toEqual([]);
    });

    it('only storage.ts writes to the relationships SQL table (D-9-05)', () => {
        const offenders: string[] = [];
        for (const f of all) {
            const src = readFileSync(f, 'utf-8');
            if (SQL_WRITE_PATTERN.test(src) && !ALLOWED_SQL_WRITER.test(f)) {
                offenders.push(relative(GRID_SRC, f));
            }
        }
        expect(offenders).toEqual([]);
    });

    // Gate 3: D-9-08 runtime-dep allowlist — grep package.json files for banned libs.
    it('Gate 3: dashboard/package.json contains no banned graph libs (D-9-08)', () => {
        const pkgPath = _resolve(__dirname, '../../../dashboard/package.json');
        const pkg = JSON.parse(_readFileSync2(pkgPath, 'utf-8'));
        const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

        for (const banned of BANNED_LIBS) {
            expect(allDeps[banned]).toBeUndefined();
        }
    });

    it('Gate 3: grid/package.json contains no banned graph libs (D-9-08)', () => {
        const pkgPath = _resolve(__dirname, '../../package.json');
        const pkg = JSON.parse(_readFileSync2(pkgPath, 'utf-8'));
        const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

        for (const banned of BANNED_LIBS) {
            expect(allDeps[banned]).toBeUndefined();
        }
    });
});
