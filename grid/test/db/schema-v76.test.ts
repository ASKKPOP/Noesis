import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('D-V3-39: Migration v76 — bind a Nous registration to its Brain key', () => {
    const m = MIGRATIONS.find(m => m.version === 76);

    it('v76 exists and adds a nullable brain_key_x column to nous_registrations', () => {
        expect(m?.name).toBe('nous_registrations_add_brain_key');
        expect(m!.up).toMatch(/ALTER\s+TABLE\s+nous_registrations\s+ADD\s+COLUMN\s+brain_key_x\s+VARCHAR\(64\)\s+NULL/i);
    });

    it('v76 down drops the column', () => {
        expect(m!.down).toMatch(/ALTER\s+TABLE\s+nous_registrations\s+DROP\s+COLUMN\s+brain_key_x/i);
    });

    it('v76 is the latest migration and versions remain sequential', () => {
        const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version);
        expect(sorted[sorted.length - 1].version).toBe(76);
        sorted.forEach((m, i) => expect(m.version).toBe(i + 1));
    });
});
