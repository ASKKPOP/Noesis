/**
 * Phase 9 Plan 02 Task 3 — Map-write producer boundary grep gate (D-9-05, T-09-06 CRITICAL).
 *
 * Gate 1 (this file, Wave 1): Only grid/src/relationships/listener.ts may call
 *   edges.set() / edges.delete() / edges.clear() — the sole in-memory Map writer.
 *
 * Gate 2 (Plan 03, Wave 1): Only grid/src/relationships/storage.ts may write to
 *   the MySQL `relationships` SQL table. That `it(...)` block is appended here
 *   in Plan 03 once storage.ts exists.
 *
 * Clones grid/test/audit/telos-refined-producer-boundary.test.ts structure exactly.
 * Walk scope is ALL of grid/src/ (not just relationships/) so a rogue mutation
 * in grid/src/integration/ or grid/src/api/ fires the gate.
 *
 * Edge cases handled (RESEARCH.md lines 585-588):
 * - Token `edges.` is domain-specific; verified zero hits outside planned paths.
 * - Comments containing `edges.set(` also trigger the gate. Path-allowlist is
 *   the only escape — NOT eslint-disable or comment suppression.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

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

    // Plan 03 Wave 1 appends a second `it(...)` block for SQL-write boundary.
});
