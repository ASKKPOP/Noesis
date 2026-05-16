/**
 * Phase 19 Plan 02 — Norm Migration Schema (version 7)
 *
 * Validates the version 7 migration definition without requiring a real DB.
 * Pattern mirrors grid/test/db/migration-schema.test.ts — static SQL inspection.
 *
 * The established test pattern in this repo uses in-memory mocks or static
 * SQL inspection rather than a live MySQL connection. Following the same approach.
 */

import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

const v7 = MIGRATIONS.find(m => m.version === 7);

describe('Norm migration (version 7)', () => {

    it('version 7 migration exists in MIGRATIONS array', () => {
        expect(v7).toBeDefined();
        expect(v7!.name).toBe('create_norm_tables');
    });

    it('norm_candidates table exists with correct columns in up SQL', () => {
        const up = v7!.up;
        expect(up).toContain('norm_candidates');
        expect(up).toContain('fingerprint');
        expect(up).toContain('grid_name');
        expect(up).toContain('participant_dids');
        expect(up).toContain('first_seen_tick');
        expect(up).toContain('last_updated_tick');
    });

    it('norm_registry table exists with correct columns in up SQL', () => {
        const up = v7!.up;
        expect(up).toContain('norm_registry');
        expect(up).toContain('norm_id');
        expect(up).toContain('crystallized_tick');
        expect(up).toContain('participant_count');
        expect(up).toContain('convergence_type');
        expect(up).toContain('event_hash');
    });

    it('norm_candidates primary key is (fingerprint, grid_name)', () => {
        const up = v7!.up;
        // The PRIMARY KEY declaration comes after both columns are defined
        expect(up).toMatch(/PRIMARY KEY\s*\(\s*fingerprint\s*,\s*grid_name\s*\)/);
    });

    it('norm_registry primary key is norm_id', () => {
        const up = v7!.up;
        expect(up).toMatch(/PRIMARY KEY\s*\(\s*norm_id\s*\)/);
    });

    it('norm_registry has index on (grid_name, fingerprint)', () => {
        const up = v7!.up;
        expect(up).toContain('idx_fingerprint');
        expect(up).toMatch(/idx_fingerprint\s*\(\s*grid_name\s*,\s*fingerprint\s*\)/);
    });

    it('norm_registry has index on (grid_name, crystallized_tick)', () => {
        const up = v7!.up;
        expect(up).toContain('idx_crystallized');
        expect(up).toMatch(/idx_crystallized\s*\(\s*grid_name\s*,\s*crystallized_tick\s*\)/);
    });

    it('convergence_type is ENUM with emergent and coincidental values', () => {
        const up = v7!.up;
        expect(up).toContain("ENUM('emergent','coincidental')");
    });

    it('both tables use InnoDB engine with utf8mb4 charset', () => {
        const up = v7!.up;
        const innodbCount = (up.match(/ENGINE=InnoDB/g) ?? []).length;
        expect(innodbCount).toBe(2);
        const utf8Count = (up.match(/DEFAULT CHARSET=utf8mb4/g) ?? []).length;
        expect(utf8Count).toBe(2);
    });

    it('down SQL drops norm_candidates before norm_registry', () => {
        const down = v7!.down;
        expect(down).toContain('DROP TABLE IF EXISTS norm_candidates');
        expect(down).toContain('DROP TABLE IF EXISTS norm_registry');
        const candidatesIdx = down.indexOf('norm_candidates');
        const registryIdx = down.indexOf('norm_registry');
        expect(candidatesIdx).toBeLessThan(registryIdx);
    });

    it('migration is idempotent — up uses IF NOT EXISTS on both tables', () => {
        const up = v7!.up;
        const ifNotExistsCount = (up.match(/IF NOT EXISTS/g) ?? []).length;
        expect(ifNotExistsCount).toBe(2);
    });

    it('MIGRATIONS array versions remain sequential after adding version 7', () => {
        for (let i = 0; i < MIGRATIONS.length; i++) {
            expect(MIGRATIONS[i].version).toBe(i + 1);
        }
    });
});
