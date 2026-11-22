/**
 * D-V3-40: Migration v77 — per-Grid zone law (grid_zones). No rows = the six-zone template,
 * so the migration creates an empty table and backfills nothing.
 */
import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('D-V3-40: Migration v77 — grid_zones', () => {
    const m = MIGRATIONS.find((x) => x.version === 77);

    it('creates grid_zones keyed by (grid_name, zone_id) and is reversible', () => {
        expect(m?.name).toBe('create_grid_zones');
        expect(m?.up).toMatch(/CREATE TABLE IF NOT EXISTS grid_zones/);
        expect(m?.up).toMatch(/PRIMARY KEY \(grid_name, zone_id\)/);
        for (const col of ['label', 'zone_kind', 'tax_modifier_bps', 'allowed_activities', 'active', 'changed_tick']) {
            expect(m?.up, col).toContain(col);
        }
        expect(m?.down).toMatch(/DROP TABLE IF EXISTS grid_zones/);
    });

    it('backfills nothing — existing Grids keep the template', () => {
        expect(m?.up).not.toMatch(/INSERT/i);
    });

    it('versions remain sequential through v77', () => {
        const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version);
        expect(sorted[76].version).toBe(77);
        sorted.forEach((x, i) => expect(x.version).toBe(i + 1));
    });
});
