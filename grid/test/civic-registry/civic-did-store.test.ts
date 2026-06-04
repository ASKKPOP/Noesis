/**
 * Phase 37 — CivicDidStore unit tests.
 *
 * Uses a mock Pool that records executed SQL and returns deterministic fixtures.
 * No real MySQL required for unit tests.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { CivicDidStore } from '../../src/civic-registry/civic-did-store.js';
import type { CivicDidRecord } from '../../src/civic-registry/types.js';

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

const baseRecord: CivicDidRecord = {
    gridName: 'genesis',
    civicDid: 'did:civic:noesis:abc-123',
    existenceDid: 'did:noesis:nous:key-abc',
    credentialJson: { type: 'CivicDIDCredential', validFrom: '2026-01-01T00:00:00.000Z' },
    status: 'active',
    issuedAtTick: 100,
};

describe('CivicDidStore.insert', () => {
    it('executes one INSERT with 6 positional params in correct order', async () => {
        const { pool, queries } = makeMockPool();
        const store = new CivicDidStore(pool);
        await store.insert(baseRecord);

        expect(queries).toHaveLength(1);
        const q = queries[0];
        expect(q.sql).toMatch(/INSERT INTO civic_did_registry/);
        expect(q.params).toHaveLength(6);
        expect(q.params[0]).toBe('genesis');            // gridName
        expect(q.params[1]).toBe('did:civic:noesis:abc-123'); // civicDid
        expect(q.params[2]).toBe('did:noesis:nous:key-abc');  // existenceDid
        // credentialJson stringified
        expect(typeof q.params[3]).toBe('string');
        expect(JSON.parse(q.params[3] as string)).toEqual(baseRecord.credentialJson);
        expect(q.params[4]).toBe(100);                  // issuedAtTick
        // Phase 42 P2P-05 (migration v32): existence_public_key_jwk — null when absent.
        expect(q.params[5]).toBe(null);
    });

    it('stringifies credentialJson before passing to query', async () => {
        const { pool, queries } = makeMockPool();
        const store = new CivicDidStore(pool);
        await store.insert({ ...baseRecord, credentialJson: { foo: 'bar', num: 42 } });

        const stringified = queries[0].params[3] as string;
        expect(typeof stringified).toBe('string');
        expect(JSON.parse(stringified)).toEqual({ foo: 'bar', num: 42 });
    });
});

describe('CivicDidStore.get', () => {
    it('returns null when no rows returned', async () => {
        const { pool } = makeMockPool([]);
        const store = new CivicDidStore(pool);
        const result = await store.get('genesis', 'did:civic:noesis:abc-123');
        expect(result).toBeNull();
    });

    it('returns CivicDidRecord on hit with credential_json as string', async () => {
        const row = {
            grid_name: 'genesis',
            civic_did: 'did:civic:noesis:abc-123',
            existence_did: 'did:noesis:nous:key-abc',
            credential_json: JSON.stringify({ type: 'CivicDIDCredential' }),
            status: 'active',
            issued_at_tick: 100,
            revoked_at_tick: null,
            court_conviction_ref: null,
        };
        const { pool } = makeMockPool([row]);
        const store = new CivicDidStore(pool);
        const result = await store.get('genesis', 'did:civic:noesis:abc-123');

        expect(result).not.toBeNull();
        expect(result!.civicDid).toBe('did:civic:noesis:abc-123');
        expect(result!.status).toBe('active');
        expect(result!.credentialJson).toEqual({ type: 'CivicDIDCredential' });
    });

    it('returns CivicDidRecord on hit with credential_json as object', async () => {
        const row = {
            grid_name: 'genesis',
            civic_did: 'did:civic:noesis:abc-123',
            existence_did: 'did:noesis:nous:key-abc',
            credential_json: { type: 'CivicDIDCredential', pre_parsed: true },
            status: 'active',
            issued_at_tick: 100,
            revoked_at_tick: null,
            court_conviction_ref: null,
        };
        const { pool } = makeMockPool([row]);
        const store = new CivicDidStore(pool);
        const result = await store.get('genesis', 'did:civic:noesis:abc-123');

        expect(result!.credentialJson).toEqual({ type: 'CivicDIDCredential', pre_parsed: true });
    });

    it('maps revoked_at_tick: null to revokedAtTick: undefined', async () => {
        const row = {
            grid_name: 'genesis',
            civic_did: 'did:civic:noesis:abc-123',
            existence_did: 'did:noesis:nous:key-abc',
            credential_json: {},
            status: 'active',
            issued_at_tick: 100,
            revoked_at_tick: null,
            court_conviction_ref: null,
        };
        const { pool } = makeMockPool([row]);
        const store = new CivicDidStore(pool);
        const result = await store.get('genesis', 'did:civic:noesis:abc-123');

        expect(result!.revokedAtTick).toBeUndefined();
        expect(result!.courtConvictionRef).toBeUndefined();
    });
});

describe('CivicDidStore.getByExistenceDid', () => {
    it('executes SELECT with existence_did = ? clause', async () => {
        const { pool, queries } = makeMockPool([]);
        const store = new CivicDidStore(pool);
        await store.getByExistenceDid('genesis', 'did:noesis:nous:key-abc');

        expect(queries[0].sql).toMatch(/AND existence_did = \?/);
        expect(queries[0].params).toContain('did:noesis:nous:key-abc');
    });

    it('returns null on empty rows', async () => {
        const { pool } = makeMockPool([]);
        const store = new CivicDidStore(pool);
        const result = await store.getByExistenceDid('genesis', 'did:noesis:nous:missing');
        expect(result).toBeNull();
    });
});

describe('CivicDidStore.markRevoked', () => {
    it('returns true when affectedRows === 1', async () => {
        const { pool } = makeMockPool([{ dummy: true }], 1);
        const store = new CivicDidStore(pool);
        const result = await store.markRevoked('genesis', 'did:civic:noesis:abc-123', 200, 'case-001');
        expect(result).toBe(true);
    });

    it('returns false when affectedRows === 0 (already revoked — idempotency)', async () => {
        const { pool } = makeMockPool([], 0);
        const store = new CivicDidStore(pool);
        const result = await store.markRevoked('genesis', 'did:civic:noesis:abc-123', 200, 'case-001');
        expect(result).toBe(false);
    });

    it('SQL UPDATE clause contains AND status = \'active\' (idempotency guard)', async () => {
        const { pool, queries } = makeMockPool([{ dummy: true }], 1);
        const store = new CivicDidStore(pool);
        await store.markRevoked('genesis', 'did:civic:noesis:abc-123', 200, 'case-001');

        expect(queries[0].sql).toMatch(/AND status = 'active'/);
    });
});
