import { describe, it, expect } from 'vitest';
import { MIGRATIONS } from '../../src/db/schema.js';

describe('Phase 62.5-04: Migration v74 — retire Ledger B faucet money', () => {
    it('v74 exists with the retirement name', () => {
        const m = MIGRATIONS.find(m => m.version === 74);
        expect(m).toBeDefined();
        expect(m!.name).toBe('retire_ledger_b_faucet_money');
    });

    it('v74 up SQL zeroes nous_registry.balance_wei', () => {
        const m = MIGRATIONS.find(m => m.version === 74);
        expect(m!.up).toMatch(/UPDATE\s+nous_registry\s+SET\s+balance_wei\s*=\s*0/i);
    });

    it('v74 down is a documented no-op (the zeroing is irreversible)', () => {
        const m = MIGRATIONS.find(m => m.version === 74);
        // down must be non-empty (schema invariant) but performs no restore.
        expect(m!.down.trim().length).toBeGreaterThan(0);
        expect(m!.down).not.toMatch(/UPDATE|ALTER|INSERT|DELETE/i);
    });

    it('migration versions remain sequential (no gaps / dupes)', () => {
        const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version);
        sorted.forEach((m, i) => expect(m.version).toBe(i + 1));
    });
});
