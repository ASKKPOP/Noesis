/**
 * Sprint 12 — Migration Schema
 *
 * Validates the static migration definitions without requiring a real DB.
 */

import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('Sprint 12: Migration Schema', () => {

    it('has at least 5 migrations', () => {
        expect(MIGRATIONS.length).toBeGreaterThanOrEqual(5);
    });

    it('versions are sequential starting from 1', () => {
        for (let i = 0; i < MIGRATIONS.length; i++) {
            expect(MIGRATIONS[i].version).toBe(i + 1);
        }
    });

    it('all versions are unique', () => {
        const versions = MIGRATIONS.map(m => m.version);
        expect(new Set(versions).size).toBe(versions.length);
    });

    it('every migration has a non-empty name', () => {
        for (const m of MIGRATIONS) {
            expect(m.name.trim().length).toBeGreaterThan(0);
        }
    });

    it('every migration has non-empty up and down SQL', () => {
        for (const m of MIGRATIONS) {
            expect(m.up.trim().length).toBeGreaterThan(0);
            expect(m.down.trim().length).toBeGreaterThan(0);
        }
    });

    it('migration 1 creates the migrations table', () => {
        const first = MIGRATIONS[0];
        expect(first.name).toBe('create_migrations_table');
        expect(first.up).toContain('grid_migrations');
    });

    it('migration 2 creates audit_trail', () => {
        const m = MIGRATIONS.find(m => m.name === 'create_audit_trail');
        expect(m).toBeDefined();
        expect(m!.up).toContain('audit_trail');
        expect(m!.up).toContain('event_type');
        expect(m!.up).toContain('event_hash');
        expect(m!.up).toContain('prev_hash');
    });

    it('migration 3 creates nous_registry', () => {
        const m = MIGRATIONS.find(m => m.name === 'create_nous_registry');
        expect(m).toBeDefined();
        expect(m!.up).toContain('nous_registry');
        expect(m!.up).toContain('lifecycle_phase');
        expect(m!.up).toContain('ousia');
    });

    it('migration 4 creates nous_positions', () => {
        const m = MIGRATIONS.find(m => m.name === 'create_nous_positions');
        expect(m).toBeDefined();
        expect(m!.up).toContain('nous_positions');
        expect(m!.up).toContain('region_id');
    });

    it('down SQL contains DROP TABLE for all non-meta migrations', () => {
        for (const m of MIGRATIONS) {
            expect(m.down.toUpperCase()).toContain('DROP TABLE');
        }
    });
});
