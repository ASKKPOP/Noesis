import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { OrbitalObjectStore } from '../../src/economy/orbital-object-store.js';

describe('migration v51 — orbital_objects', () => {
    it('creates the orbital_objects table', () => {
        const m = MIGRATIONS.find((x) => x.version === 51);
        expect(m, 'v51 must exist').toBeDefined();
        expect(m!.name).toBe('create_orbital_objects');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS orbital_objects');
        expect(m!.up).toContain('provenance_contract_id');
        expect(m!.up).toContain('UNIQUE KEY uniq_provenance');
        expect(m!.down).toContain('DROP TABLE IF EXISTS orbital_objects');
    });
    it('migration v51 has a unique version number', () => {
        expect(MIGRATIONS.filter((x) => x.version === 51)).toHaveLength(1);
    });
});

function makeMockPool(responses: Array<[unknown, unknown]> = []): { pool: Pool; conn: PoolConnection; calls: () => string[] } {
    let i = 0; const sql: string[] = [];
    const query = vi.fn().mockImplementation((q: string) => { sql.push(String(q)); return Promise.resolve(responses[i++] ?? [[], {}]); });
    const conn = { beginTransaction: vi.fn().mockResolvedValue(undefined), commit: vi.fn().mockResolvedValue(undefined), rollback: vi.fn().mockResolvedValue(undefined), release: vi.fn(), query } as unknown as PoolConnection;
    const pool = { query, getConnection: vi.fn().mockResolvedValue(conn) } as unknown as Pool;
    return { pool, conn, calls: () => sql };
}
const rows = (r: unknown): [RowDataPacket[], unknown] => [r as RowDataPacket[], {}];
const validSpec = { mass_kg: 1000, massIn_kg: 5, massOut_kg: 5, energyIn_J: 1000, energyOut_J: 900, load_N: 200, yield_N: 500, dissipated_W: 50, radiated_W: 80, generation_W: 120, consumption_W: 100, altitude_km: 420 };

function args(over = {}) {
    return { gridName: 'genesis', objectId: 'o1', contractId: 'c1', functionType: 'Energy', outputRate: 120n, physicsSpec: validSpec, zone: 'infrastructure', currentTick: 10, ...over };
}

describe('OrbitalObjectStore.createFromContract', () => {
    it('builds the object from a settled contract (commons-owned, builder-attributed)', async () => {
        // contract FOR UPDATE (settled, winner w, award 4000); no existing object; INSERT object
        const m = makeMockPool([rows([{ status: 'settled', winner_did: 'w', award_wei: '4000' }]), rows([]), [{}, {}]]);
        await new OrbitalObjectStore(m.pool).createFromContract(args());
        const sql = m.calls().join('\n');
        expect(sql).toContain('INSERT INTO orbital_objects');
        expect(m.conn.commit).toHaveBeenCalled();
    });
    it('refuses a non-settled contract', async () => {
        const m = makeMockPool([rows([{ status: 'active', winner_did: 'w', award_wei: '4000' }])]);
        await expect(new OrbitalObjectStore(m.pool).createFromContract(args())).rejects.toThrow('contract_not_settled');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
    it('refuses a physically invalid spec (never persisted)', async () => {
        const m = makeMockPool([rows([{ status: 'settled', winner_did: 'w', award_wei: '4000' }])]);
        await expect(new OrbitalObjectStore(m.pool).createFromContract(args({ physicsSpec: { ...validSpec, massOut_kg: 9 } }))).rejects.toThrow('physics_violation');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
    it('refuses a duplicate build for the same contract', async () => {
        const m = makeMockPool([rows([{ status: 'settled', winner_did: 'w', award_wei: '4000' }]), rows([{ object_id: 'existing' }])]);
        await expect(new OrbitalObjectStore(m.pool).createFromContract(args())).rejects.toThrow('object_already_built');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
});

describe('OrbitalObjectStore reads', () => {
    it('listObjects returns active objects for the grid', async () => {
        const m = makeMockPool([rows([{ object_id: 'o1', function_type: 'Energy' }])]);
        const list = await new OrbitalObjectStore(m.pool).listObjects('genesis');
        expect(list).toHaveLength(1);
        expect(m.calls()[0]).toContain('FROM orbital_objects');
    });
});
