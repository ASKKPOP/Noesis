import { createHash } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { OrbitalObjectStore } from '../../src/economy/orbital-object-store.js';
import { AuditChain } from '../../src/audit/chain.js';

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

// Valid UUIDs required by the emitter's closed-tuple guards.
const CONTRACT_UUID = '33345678-1234-1234-1234-123456789abc';
const OBJECT_UUID   = '44445678-1234-1234-1234-123456789abc';

function auditArgs(over = {}) {
    return { gridName: 'genesis', objectId: OBJECT_UUID, contractId: CONTRACT_UUID, functionType: 'Energy', outputRate: 120n, physicsSpec: validSpec, zone: 'infrastructure', currentTick: 10, ...over };
}

describe('OrbitalObjectStore.createFromContract — L3b audit emit', () => {
    it('emits orbital.object_built with hashed builder DID when AuditChain is provided', async () => {
        const winnerDid = 'did:civic:noesis:builder-x';
        const m = makeMockPool([
            rows([{ status: 'settled', winner_did: winnerDid, award_wei: '4000' }]),
            rows([]),
            [{}, {}],
        ]);
        const chain = new AuditChain();
        const appendSpy = vi.spyOn(chain, 'append');
        await new OrbitalObjectStore(m.pool, chain).createFromContract(auditArgs());
        expect(appendSpy).toHaveBeenCalledOnce();
        const call = appendSpy.mock.calls[0];
        expect(call[0]).toBe('orbital.object_built');
        // actorDid must be sha256(winnerDid)
        const expectedHash = createHash('sha256').update(winnerDid).digest('hex');
        expect(call[1]).toBe(expectedHash);
        // payload fields
        const payload = call[2] as Record<string, unknown>;
        expect(payload.builder_did_hash).toBe(expectedHash);
        expect(payload.build_cost_wei).toBe('4000');
        expect(payload.contract_id).toBe(CONTRACT_UUID);
        expect(payload.object_id).toBe(OBJECT_UUID);
        expect(payload.function_type).toBe('Energy');
        expect(payload.output_rate).toBe('120');
        expect(payload.tick).toBe(10);
    });

    it('does NOT emit when no AuditChain is provided (default off — L3a tests unaffected)', async () => {
        const m = makeMockPool([
            rows([{ status: 'settled', winner_did: 'did:civic:noesis:builder-y', award_wei: '4000' }]),
            rows([]),
            [{}, {}],
        ]);
        // No audit passed — uses original test-style args (non-UUID ids) to show compatibility
        await new OrbitalObjectStore(m.pool).createFromContract(args());
        // No throw, no emit needed — just verify the commit happened
        expect(m.conn.commit).toHaveBeenCalled();
    });
});

// ── W-C3: Nous-driven upgradeability ─────────────────────────────────────────
describe('migration v72 — orbital_objects level', () => {
    it('adds level + upgraded_at_tick columns', () => {
        const m = MIGRATIONS.find((x) => x.version === 72);
        expect(m, 'v72 must exist').toBeDefined();
        expect(m!.name).toBe('orbital_objects_add_level');
        expect(m!.up).toContain('ADD COLUMN level');
        expect(m!.up).toContain('upgraded_at_tick');
        expect(m!.down).toContain('DROP COLUMN level');
    });
    it('v72 version is unique', () => {
        expect(MIGRATIONS.filter((x) => x.version === 72)).toHaveLength(1);
    });
});

const UUID_O = '11111111-1111-4111-8111-111111111111';
const UUID_C = '22222222-2222-4222-8222-222222222222';
function upArgs(over = {}) {
    return { gridName: 'genesis', objectId: UUID_O, contractId: UUID_C, newOutputRate: 240n, newPhysicsSpec: validSpec, skillHash: 'skill-abc', currentTick: 50, ...over };
}
function auditWithSkill(learner = 'w', skill = 'skill-abc'): AuditChain {
    const a = new AuditChain();
    a.append('skill.taught', 'teacher', { learner_did: learner, skill_hash: skill });
    return a;
}

describe('OrbitalObjectStore.upgradeFromContract (W-C3)', () => {
    it('upgrades a built object: skill-gated, physics re-gated, level++, emits orbital.object_upgraded', async () => {
        const m = makeMockPool([rows([{ status: 'settled', winner_did: 'w' }]), rows([{ level: 1 }]), [{}, {}]]);
        const audit = auditWithSkill();
        await new OrbitalObjectStore(m.pool, audit).upgradeFromContract(upArgs());
        expect(m.calls().join('\n')).toContain('UPDATE orbital_objects SET level');
        expect(m.conn.commit).toHaveBeenCalled();
        const ev = audit.all().filter((e) => e.eventType === 'orbital.object_upgraded');
        expect(ev).toHaveLength(1);
        expect(ev[0].payload).toMatchObject({ new_level: 2, object_id: UUID_O, contract_id: UUID_C, skill_hash: 'skill-abc' });
    });

    it('refuses when the contract winner has NOT learned the skill (skill_not_held)', async () => {
        const m = makeMockPool([rows([{ status: 'settled', winner_did: 'w' }]), rows([{ level: 1 }])]);
        const audit = auditWithSkill('someone-else', 'skill-abc');  // learner is not the winner 'w'
        await expect(new OrbitalObjectStore(m.pool, audit).upgradeFromContract(upArgs())).rejects.toThrow('skill_not_held');
        expect(m.conn.rollback).toHaveBeenCalled();
        expect(audit.all().filter((e) => e.eventType === 'orbital.object_upgraded')).toHaveLength(0);
    });

    it('refuses a physically invalid upgrade spec (never persisted)', async () => {
        const m = makeMockPool([rows([{ status: 'settled', winner_did: 'w' }]), rows([{ level: 1 }])]);
        await expect(new OrbitalObjectStore(m.pool, auditWithSkill()).upgradeFromContract(upArgs({ newPhysicsSpec: { ...validSpec, massOut_kg: 9 } }))).rejects.toThrow('physics_violation');
        expect(m.conn.rollback).toHaveBeenCalled();
    });

    it('refuses a non-settled contract', async () => {
        const m = makeMockPool([rows([{ status: 'active', winner_did: 'w' }])]);
        await expect(new OrbitalObjectStore(m.pool, auditWithSkill()).upgradeFromContract(upArgs())).rejects.toThrow('contract_not_settled');
        expect(m.conn.rollback).toHaveBeenCalled();
    });

    it('refuses when the object does not exist or is not active', async () => {
        const m = makeMockPool([rows([{ status: 'settled', winner_did: 'w' }]), rows([])]);
        await expect(new OrbitalObjectStore(m.pool, auditWithSkill()).upgradeFromContract(upArgs())).rejects.toThrow('object_not_found');
        expect(m.conn.rollback).toHaveBeenCalled();
    });
});
