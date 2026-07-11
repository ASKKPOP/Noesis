import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('Phase 62.5-05: Migration v75 — retire the system-treasury registry record', () => {
    it('v75 exists with the retirement name', () => {
        const m = MIGRATIONS.find(m => m.version === 75);
        expect(m).toBeDefined();
        expect(m!.name).toBe('retire_system_treasury_record');
    });

    it('v75 up SQL deletes the did:noesis:system:treasury row from nous_registry', () => {
        const m = MIGRATIONS.find(m => m.version === 75);
        expect(m!.up).toMatch(/DELETE\s+FROM\s+nous_registry\s+WHERE\s+did\s*=\s*'did:noesis:system:treasury'/i);
    });

    it('v75 down is a documented no-op (the inert record is not restored)', () => {
        const m = MIGRATIONS.find(m => m.version === 75);
        expect(m!.down.trim().length).toBeGreaterThan(0);
        expect(m!.down).not.toMatch(/UPDATE|ALTER|INSERT|DELETE/i);
    });

    it('v75 is the latest migration and versions remain sequential', () => {
        const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version);
        expect(sorted[sorted.length - 1].version).toBe(75);
        sorted.forEach((m, i) => expect(m.version).toBe(i + 1));
    });
});
