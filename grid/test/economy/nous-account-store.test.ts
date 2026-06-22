import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('migration v45 — nous_accounts', () => {
    it('exists with a wei balance column and the composite key', () => {
        const m = MIGRATIONS.find((x) => x.version === 45);
        expect(m, 'migration v45 must exist').toBeDefined();
        expect(m!.name).toBe('create_nous_accounts');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS nous_accounts');
        expect(m!.up).toContain('balance_wei');
        expect(m!.up).toContain('DECIMAL(65,0)');
        expect(m!.up).toContain('PRIMARY KEY (grid_name, civic_did)');
        expect(m!.down).toContain('DROP TABLE IF EXISTS nous_accounts');
    });

    it('is the highest version (appended, not inserted)', () => {
        const max = Math.max(...MIGRATIONS.map((x) => x.version));
        expect(max).toBe(45);
    });
});
