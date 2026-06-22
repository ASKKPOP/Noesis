import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('migration v46 — civic_treasury.balance_wei', () => {
    it('adds a wei DECIMAL column to civic_treasury', () => {
        const m = MIGRATIONS.find((x) => x.version === 46);
        expect(m, 'migration v46 must exist').toBeDefined();
        expect(m!.name).toBe('civic_treasury_add_balance_wei');
        expect(m!.up).toContain('ALTER TABLE civic_treasury');
        expect(m!.up).toContain('balance_wei');
        expect(m!.up).toContain('DECIMAL(65,0)');
        expect(m!.down).toContain('DROP COLUMN balance_wei');
    });
    it('is the highest version (appended)', () => {
        expect(Math.max(...MIGRATIONS.map((x) => x.version))).toBe(46);
    });
});
