/**
 * Migration v82 — the Work Card table (works). One row per Work; the card is text so its
 * hash is of the exact bytes stored.
 */
import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('Migration v82 — works', () => {
    const m = MIGRATIONS.find((x) => x.version === 82);

    it('creates works keyed by (grid_name, work_id) and is reversible', () => {
        expect(m?.name).toBe('create_works');
        expect(m?.up).toMatch(/CREATE TABLE IF NOT EXISTS works/);
        expect(m?.up).toMatch(/PRIMARY KEY \(grid_name, work_id\)/);
        for (const col of ['stage', 'owner_civic_did', 'builder_civic_did', 'version', 'card_hash', 'created_tick', 'updated_tick']) {
            expect(m?.up, col).toContain(col);
        }
        expect(m?.down).toMatch(/DROP TABLE IF EXISTS works/);
    });

    it('keeps the card as text, not as a JSON column', () => {
        expect(m?.up).toMatch(/card_json\s+MEDIUMTEXT/);
    });

    it('versions remain sequential through v82', () => {
        const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version);
        expect(sorted[81].version).toBe(82);
        sorted.forEach((x, i) => expect(x.version).toBe(i + 1));
    });
});
