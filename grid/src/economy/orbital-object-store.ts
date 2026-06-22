/**
 * L3 — Orbital object: a built object made real. Created ONLY from a settled
 * procurement contract (L2) and ONLY if its spec passes the server-side physics
 * gate against the Grid's environment. The object belongs to the commons
 * (owner = the treasury, since the Polis paid for it) and is attributed to its
 * builder (the contract winner); its cost is the award. One object per contract.
 *
 * This is the thesis made literal: objects backed by the economy + obeying physics,
 * not cosmetic sprites. Audit event (orbital.object_built) is wired in L3b; the
 * Grid-Viz render (L4) reads listObjects.
 */
import { createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { appendOrbitalObjectBuilt } from '../audit/append-orbital-object-built.js';
import { checkObjectPhysics, type ObjectPhysicsSpec } from './object-physics.js';
import { type GridEnvironment, EARTH_ORBIT } from '../registry/grid-environments.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/** Procurement-built objects belong to the commons (matches grid/src/api/routes/irs.ts). */
const TREASURY_CIVIC_DID = 'did:civic:noesis:treasury';

export interface OrbitalObjectRow {
    object_id: string; grid_name: string; owner_did: string; builder_did: string;
    build_cost_wei: string; function_type: string; output_rate: string;
    physics_spec: string; provenance_contract_id: string; zone: string; status: string;
}

export class OrbitalObjectStore {
    constructor(
        private readonly pool: Pool,
        private readonly audit?: AuditChain,
    ) {}

    /** Realize a built object from a settled contract. Physics-gated; one per contract. */
    async createFromContract(p: { gridName: string; objectId: string; contractId: string; functionType: string; outputRate: bigint; physicsSpec: ObjectPhysicsSpec; zone: string; currentTick: number; env?: GridEnvironment }): Promise<void> {
        const conn = await this.pool.getConnection();
        let winnerDid: string | undefined;
        let awardWei: string | undefined;
        try {
            await conn.beginTransaction();
            const [contractRows] = await conn.query<RowDataPacket[]>(
                `SELECT status, winner_did, award_wei FROM procurement_contracts WHERE contract_id = ? AND grid_name = ? FOR UPDATE`,
                [p.contractId, p.gridName],
            );
            const contract = contractRows[0];
            if (!contract || contract.status !== 'settled') {
                await conn.rollback();
                throw new Error('contract_not_settled');
            }
            const [existing] = await conn.query<RowDataPacket[]>(
                `SELECT object_id FROM orbital_objects WHERE provenance_contract_id = ?`,
                [p.contractId],
            );
            if (existing[0]) {
                await conn.rollback();
                throw new Error('object_already_built');
            }
            const physics = checkObjectPhysics(p.physicsSpec, p.env ?? EARTH_ORBIT);
            if (!physics.ok) {
                await conn.rollback();
                throw new Error(`physics_violation:${physics.violations.join(',')}`);
            }
            await conn.query(
                `INSERT INTO orbital_objects
                   (object_id, grid_name, owner_did, builder_did, build_cost_wei, function_type, output_rate, physics_spec, provenance_contract_id, zone, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
                [p.objectId, p.gridName, TREASURY_CIVIC_DID, String(contract.winner_did), String(contract.award_wei),
                 p.functionType, p.outputRate.toString(), JSON.stringify(p.physicsSpec), p.contractId, p.zone, p.currentTick, p.currentTick],
            );
            winnerDid = String(contract.winner_did);
            awardWei = String(contract.award_wei);
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
        // Emit after commit + connection release — audit failure does NOT trigger rollback.
        if (this.audit && winnerDid !== undefined && awardWei !== undefined) {
            appendOrbitalObjectBuilt(this.audit, {
                build_cost_wei: awardWei,
                builder_did_hash: sha256Hex(winnerDid),
                contract_id: p.contractId,
                function_type: p.functionType,
                object_id: p.objectId,
                output_rate: p.outputRate.toString(),
                tick: p.currentTick,
            });
        }
    }

    /** Active objects for a grid (the L4 render reads this). */
    async listObjects(gridName: string): Promise<OrbitalObjectRow[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT object_id, grid_name, owner_did, builder_did, build_cost_wei, function_type, output_rate, physics_spec, provenance_contract_id, zone, status
             FROM orbital_objects WHERE grid_name = ? AND status = 'active' ORDER BY created_at ASC LIMIT 500`,
            [gridName],
        );
        return rows as unknown as OrbitalObjectRow[];
    }

    async getObject(gridName: string, objectId: string): Promise<OrbitalObjectRow | undefined> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT object_id, grid_name, owner_did, builder_did, build_cost_wei, function_type, output_rate, physics_spec, provenance_contract_id, zone, status
             FROM orbital_objects WHERE grid_name = ? AND object_id = ?`,
            [gridName, objectId],
        );
        return rows[0] as unknown as OrbitalObjectRow | undefined;
    }
}
