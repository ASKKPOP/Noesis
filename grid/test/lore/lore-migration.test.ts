/**
 * RED stub — becomes GREEN in Plan 02 when migration v8 is added to schema.ts.
 * Inspects the SQL string of migration version 8 for required table shape.
 */
import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('lore_commons migration — version 8', () => {
    const migration8 = MIGRATIONS.find((m) => m.version === 8);

    it('migration version 8 exists', () => {
        expect(migration8).toBeDefined();
    });

    it('migration is named create_lore_commons', () => {
        expect(migration8?.name).toBe('create_lore_commons');
    });

    it('up SQL creates lore_commons table', () => {
        expect(migration8?.up).toContain('CREATE TABLE IF NOT EXISTS lore_commons');
    });

    it('lore_commons has content_hash CHAR(64)', () => {
        expect(migration8?.up).toMatch(/content_hash\s+CHAR\(64\)/);
    });

    it('lore_commons has title_hash CHAR(64)', () => {
        expect(migration8?.up).toMatch(/title_hash\s+CHAR\(64\)/);
    });

    it('lore_commons has citation_count INT UNSIGNED', () => {
        expect(migration8?.up).toMatch(/citation_count\s+INT UNSIGNED/);
    });

    it('lore_commons has category_tag column', () => {
        expect(migration8?.up).toContain('category_tag');
    });

    it('down SQL drops lore_commons', () => {
        expect(migration8?.down).toContain('DROP TABLE IF EXISTS lore_commons');
    });
});
