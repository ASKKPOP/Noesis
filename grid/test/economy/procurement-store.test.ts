import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { ProcurementStore } from '../../src/economy/procurement-store.js';

describe('migration v50 — procurement tables', () => {
    it('creates notices, bids, contracts', () => {
        const m = MIGRATIONS.find((x) => x.version === 50);
        expect(m, 'v50 must exist').toBeDefined();
        expect(m!.name).toBe('create_procurement');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS procurement_notices');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS procurement_bids');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS procurement_contracts');
        expect(m!.up).toContain('budget_wei');
        expect(m!.up).toContain('DECIMAL(65,0)');
        expect(m!.down).toContain('DROP TABLE IF EXISTS procurement_contracts');
    });
    it('migration v50 has a unique version number', () => {
        expect(MIGRATIONS.filter((x) => x.version === 50)).toHaveLength(1);
    });
});
