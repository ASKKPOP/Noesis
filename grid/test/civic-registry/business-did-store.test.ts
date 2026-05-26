/**
 * Phase 37 — BusinessDidStore unit tests.
 *
 * Uses a mock Pool that records executed SQL and returns deterministic fixtures.
 * No real MySQL required for unit tests.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { BusinessDidStore } from '../../src/civic-registry/business-did-store.js';
import type { BusinessDidRecord } from '../../src/civic-registry/types.js';

function makeMockPool(rows: object[] = [], affectedRows = 1) {
    const queries: { sql: string; params: unknown[] }[] = [];
    const pool = {
        query: vi.fn(async (sql: string, params: unknown[]) => {
            queries.push({ sql, params });
            if (sql.trimStart().startsWith('SELECT')) return [rows, []];
            if (sql.trimStart().startsWith('UPDATE')) return [{ affectedRows: rows.length === 0 ? 0 : affectedRows }, []];
            return [{ insertId: 1, affectedRows: 1 }, []];
        }),
    };
    return { pool: pool as unknown as Pool, queries };
}

const baseRecord: BusinessDidRecord = {
    gridName: 'genesis',
    businessDid: 'did:biz:noesis:biz-001',
    civicDid: 'did:civic:noesis:owner-001',
    businessName: 'Acme Corp',
    category: 'retail',
    credentialJson: { type: 'BusinessDIDCredential', validFrom: '2026-01-01T00:00:00.000Z' },
    status: 'active',
    issuedAtTick: 200,
    biosCostPaid: 100,
};

describe('BusinessDidStore.insert', () => {
    it('executes one INSERT with 8 positional params in correct order', async () => {
        const { pool, queries } = makeMockPool();
        const store = new BusinessDidStore(pool);
        await store.insert(baseRecord);

        expect(queries).toHaveLength(1);
        const q = queries[0];
        expect(q.sql).toMatch(/INSERT INTO business_did_registry/);
        expect(q.params).toHaveLength(8);
        expect(q.params[0]).toBe('genesis');                    // gridName
        expect(q.params[1]).toBe('did:biz:noesis:biz-001');     // businessDid
        expect(q.params[2]).toBe('did:civic:noesis:owner-001'); // civicDid
        expect(q.params[3]).toBe('Acme Corp');                  // businessName
        expect(q.params[4]).toBe('retail');                     // category
        // credentialJson stringified
        expect(typeof q.params[5]).toBe('string');
        expect(JSON.parse(q.params[5] as string)).toEqual(baseRecord.credentialJson);
        expect(q.params[6]).toBe(200);                          // issuedAtTick
        expect(q.params[7]).toBe(100);                          // biosCostPaid
    });

    it('stringifies credentialJson before passing to query', async () => {
        const { pool, queries } = makeMockPool();
        const store = new BusinessDidStore(pool);
        await store.insert({ ...baseRecord, credentialJson: { foo: 'biz', num: 99 } });

        const stringified = queries[0].params[5] as string;
        expect(typeof stringified).toBe('string');
        expect(JSON.parse(stringified)).toEqual({ foo: 'biz', num: 99 });
    });
});

describe('BusinessDidStore.get', () => {
    it('returns null when no rows returned', async () => {
        const { pool } = makeMockPool([]);
        const store = new BusinessDidStore(pool);
        const result = await store.get('genesis', 'did:biz:noesis:biz-001');
        expect(result).toBeNull();
    });

    it('returns BusinessDidRecord on hit with credential_json as string', async () => {
        const row = {
            grid_name: 'genesis',
            business_did: 'did:biz:noesis:biz-001',
            civic_did: 'did:civic:noesis:owner-001',
            business_name: 'Acme Corp',
            category: 'retail',
            credential_json: JSON.stringify({ type: 'BusinessDIDCredential' }),
            status: 'active',
            issued_at_tick: 200,
            dissolved_at_tick: null,
            bios_cost_paid: 100,
        };
        const { pool } = makeMockPool([row]);
        const store = new BusinessDidStore(pool);
        const result = await store.get('genesis', 'did:biz:noesis:biz-001');

        expect(result).not.toBeNull();
        expect(result!.businessDid).toBe('did:biz:noesis:biz-001');
        expect(result!.civicDid).toBe('did:civic:noesis:owner-001');
        expect(result!.status).toBe('active');
        expect(result!.credentialJson).toEqual({ type: 'BusinessDIDCredential' });
        expect(result!.biosCostPaid).toBe(100);
    });

    it('returns BusinessDidRecord on hit with credential_json as object', async () => {
        const row = {
            grid_name: 'genesis',
            business_did: 'did:biz:noesis:biz-001',
            civic_did: 'did:civic:noesis:owner-001',
            business_name: 'Acme Corp',
            category: 'retail',
            credential_json: { type: 'BusinessDIDCredential', pre_parsed: true },
            status: 'active',
            issued_at_tick: 200,
            dissolved_at_tick: null,
            bios_cost_paid: 100,
        };
        const { pool } = makeMockPool([row]);
        const store = new BusinessDidStore(pool);
        const result = await store.get('genesis', 'did:biz:noesis:biz-001');

        expect(result!.credentialJson).toEqual({ type: 'BusinessDIDCredential', pre_parsed: true });
    });

    it('maps dissolved_at_tick: null to dissolvedAtTick: undefined', async () => {
        const row = {
            grid_name: 'genesis',
            business_did: 'did:biz:noesis:biz-001',
            civic_did: 'did:civic:noesis:owner-001',
            business_name: 'Acme Corp',
            category: 'retail',
            credential_json: {},
            status: 'active',
            issued_at_tick: 200,
            dissolved_at_tick: null,
            bios_cost_paid: 100,
        };
        const { pool } = makeMockPool([row]);
        const store = new BusinessDidStore(pool);
        const result = await store.get('genesis', 'did:biz:noesis:biz-001');

        expect(result!.dissolvedAtTick).toBeUndefined();
    });
});

describe('BusinessDidStore.listByCivicDid', () => {
    it('SQL contains ORDER BY issued_at_tick ASC (chronological listing contract)', async () => {
        const { pool, queries } = makeMockPool([]);
        const store = new BusinessDidStore(pool);
        await store.listByCivicDid('genesis', 'did:civic:noesis:owner-001');

        expect(queries[0].sql).toMatch(/ORDER BY issued_at_tick ASC/);
    });

    it('returns array of BusinessDidRecord objects in order returned by pool', async () => {
        const rows = [
            {
                grid_name: 'genesis',
                business_did: 'did:biz:noesis:biz-001',
                civic_did: 'did:civic:noesis:owner-001',
                business_name: 'Alpha',
                category: 'retail',
                credential_json: {},
                status: 'active',
                issued_at_tick: 100,
                dissolved_at_tick: null,
                bios_cost_paid: 100,
            },
            {
                grid_name: 'genesis',
                business_did: 'did:biz:noesis:biz-002',
                civic_did: 'did:civic:noesis:owner-001',
                business_name: 'Beta',
                category: 'services',
                credential_json: {},
                status: 'active',
                issued_at_tick: 200,
                dissolved_at_tick: null,
                bios_cost_paid: 100,
            },
        ];
        const { pool } = makeMockPool(rows);
        const store = new BusinessDidStore(pool);
        const result = await store.listByCivicDid('genesis', 'did:civic:noesis:owner-001');

        expect(result).toHaveLength(2);
        expect(result[0].businessDid).toBe('did:biz:noesis:biz-001');
        expect(result[1].businessDid).toBe('did:biz:noesis:biz-002');
    });

    it('returns empty array when no businesses found', async () => {
        const { pool } = makeMockPool([]);
        const store = new BusinessDidStore(pool);
        const result = await store.listByCivicDid('genesis', 'did:civic:noesis:nobody');
        expect(result).toEqual([]);
    });
});

describe('BusinessDidStore.markDissolved', () => {
    it('returns true when affectedRows === 1', async () => {
        const { pool } = makeMockPool([{ dummy: true }], 1);
        const store = new BusinessDidStore(pool);
        const result = await store.markDissolved('genesis', 'did:biz:noesis:biz-001', 300);
        expect(result).toBe(true);
    });

    it('returns false when affectedRows === 0 (already dissolved — idempotency)', async () => {
        const { pool } = makeMockPool([], 0);
        const store = new BusinessDidStore(pool);
        const result = await store.markDissolved('genesis', 'did:biz:noesis:biz-001', 300);
        expect(result).toBe(false);
    });

    it('SQL UPDATE clause contains AND status = \'active\' (idempotency guard)', async () => {
        const { pool, queries } = makeMockPool([{ dummy: true }], 1);
        const store = new BusinessDidStore(pool);
        await store.markDissolved('genesis', 'did:biz:noesis:biz-001', 300);

        expect(queries[0].sql).toMatch(/AND status = 'active'/);
    });
});
