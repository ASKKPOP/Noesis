/**
 * Phase 58 HOUSE-1 (NH1-01 / D-58-01 / D-58-02) — write-through ParcelStore.
 *
 * MySQL is the source of truth; the ParcelRegistry is a read cache. Every mutation
 * writes the DB row FIRST, then the route mirrors it into memory. On boot, hydrate()
 * reloads every row for the grid back into the registry.
 *
 * Lesson — HumanRegistry incident (2026-06-11): an in-memory registry not backed by
 * MySQL lost state on restart and diverged from the chain. Don't repeat it.
 *
 * Occupants are NOT persisted: presence is memory-only (R-H-09), so there is no
 * occupants column and no write for it here.
 */
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { ParcelRegistry } from './parcel-registry.js';
import type { Parcel, ZoneId, StructureType, Visibility, Interior, ParcelCondition } from './types.js';
import type { Role, RoleEdge } from './roles.js';
import { gravityPrice, GENESIS_CORE_SEED_PLAN, PURCHASABLE_RINGS } from './founding-law.js';
import { upsertIou, type IouEntry } from './credit-ledger.js';
import { upsertAgreement, type CoworkAgreement } from './cowork.js';

/** A civic_parcels DB row (snake_case columns as returned by mysql2). */
export interface ParcelRow extends RowDataPacket {
    parcel_id: string;
    grid_name: string;
    zone_id: string;
    ring: number;
    sector_deg: string | number;   // mysql2 returns DECIMAL as string
    level: number;
    owner_civic_did: string | null;
    price_bios: string | number;   // mysql2 returns BIGINT UNSIGNED as string
    acquired_at_tick: number | null;
    structure_name: string | null;
    structure_type: StructureType | null;
    visibility: Visibility | null;
    built_at_tick: number | null;
    named_address: string | null;
    entry_policy: 'open' | 'allowlist';
    entry_allowlist: string[] | string | null;
    // Phase 59 HOUSE-2 (v39) — interiors + upkeep columns.
    structure_interior: Interior | string | null;
    condition: ParcelCondition;
    last_upkeep_tick: number | null;
    missed_periods: number;
    // Phase 60 HOUSE-3 (v40) — shop⇄structure binding.
    bound_shop_id: string | null;
}

/** A civic_parcel_roles DB row (snake_case columns as returned by mysql2). */
export interface ParcelRoleRow extends RowDataPacket {
    parcel_id: string;
    holder_civic_did: string;
    role: Role;
    granted_by_civic_did: string;
    granted_tick: number;
    trust_score: string | number;   // mysql2 returns FLOAT predictably as number, defensive cast
    revoked_tick: number | null;
}

/** A civic_credit_ledger DB row (snake_case columns as returned by mysql2). */
export interface CreditLedgerRow extends RowDataPacket {
    iou_id: string;
    creditor_civic_did: string;
    debtor_civic_did: string;
    amount_bios: string | number;   // mysql2 returns BIGINT UNSIGNED as string
    reason_ref: string;
    created_tick: number;
    settled_tick: number | null;
}

/** A civic_cowork_agreements DB row (snake_case columns as returned by mysql2). */
export interface CoworkAgreementRow extends RowDataPacket {
    agreement_id: string;
    parcel_id: string;
    host_civic_did: string;
    worker_civic_did: string | null;
    scope_ref: string;
    settlement_amount_bios: string | number;
    term_ticks: number;
    status: 'posted' | 'claimed' | 'completed' | 'cancelled';
    created_tick: number;
    completed_tick: number | null;
}

/** Map a DB row into the in-memory Parcel shape (entry_allowlist may arrive as JSON text). */
function rowToParcel(row: ParcelRow): Parcel {
    const allowlist = Array.isArray(row.entry_allowlist)
        ? row.entry_allowlist
        : typeof row.entry_allowlist === 'string' && row.entry_allowlist.length > 0
            ? (JSON.parse(row.entry_allowlist) as string[])
            : [];
    const interior = parseInterior(row.structure_interior);
    return {
        id: row.parcel_id,
        gridId: row.grid_name,
        zoneId: row.zone_id as ZoneId,
        ring: row.ring,
        sector: Number(row.sector_deg),
        level: row.level,
        ownerDid: row.owner_civic_did,
        priceBios: Number(row.price_bios),
        structure: row.structure_name !== null && row.structure_type !== null
            ? {
                name: row.structure_name,
                type: row.structure_type,
                visibility: row.visibility ?? 'open',
                builtAtTick: row.built_at_tick ?? 0,
                namedAddress: row.named_address,
                ...(interior ? { interior } : {}),
                ...(row.bound_shop_id ? { boundShopId: row.bound_shop_id } : {}),
            }
            : null,
        entryPolicy: { policy: row.entry_policy, allowlist },
        acquiredAtTick: row.acquired_at_tick,
        condition: row.condition ?? 'maintained',
        ...(row.last_upkeep_tick !== null && row.last_upkeep_tick !== undefined
            ? { lastUpkeepTick: row.last_upkeep_tick }
            : {}),
        missedPeriods: row.missed_periods ?? 0,
    };
}

/** Parse the structure_interior JSON column (mysql2 may return it as text). */
function parseInterior(raw: Interior | string | null | undefined): Interior | undefined {
    if (raw === null || raw === undefined) return undefined;
    if (typeof raw === 'string') {
        if (raw.length === 0) return undefined;
        return JSON.parse(raw) as Interior;
    }
    return raw;
}

export class ParcelStore {
    constructor(
        private readonly pool: Pool,
        private readonly gridName: string = 'genesis',
    ) {}

    /**
     * Seed the Genesis Core (D-58-03) idempotently. INSERT IGNORE per
     * GENESIS_CORE_SEED_PLAN — re-running on an already-seeded grid inserts 0 rows.
     * Purchasable parcels are priced via gravityPrice(ring); civic rings get price 0.
     * Mirrors every seeded parcel into the registry. Emits NO audit events.
     * Returns the number of rows seeded.
     */
    async seedGenesisCore(registry: ParcelRegistry): Promise<number> {
        const parcels = buildGenesisCoreParcels(this.gridName);
        let inserted = 0;
        for (const p of parcels) {
            const structure = p.structure;
            const [res] = await this.pool.query<ResultSetHeader>(
                `INSERT IGNORE INTO civic_parcels
                    (parcel_id, grid_name, zone_id, ring, sector_deg, level,
                     owner_civic_did, price_bios, acquired_at_tick,
                     structure_name, structure_type, visibility, built_at_tick,
                     named_address, entry_policy, entry_allowlist)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    p.id, p.gridId, p.zoneId, p.ring, p.sector, p.level,
                    p.ownerDid, p.priceBios, p.acquiredAtTick,
                    structure?.name ?? null, structure?.type ?? null,
                    structure?.visibility ?? null, structure?.builtAtTick ?? null,
                    structure?.namedAddress ?? null,
                    p.entryPolicy.policy, JSON.stringify(p.entryPolicy.allowlist),
                ],
            );
            if (res.affectedRows > 0) inserted++;
            registry.upsert(p);
        }
        return inserted;
    }

    /**
     * Hydrate the in-memory registry from the DB on boot (DB is source of truth).
     * Reads every parcel row for this grid and upserts it into the registry.
     * Occupants are never rehydrated (presence is memory-only). Returns row count.
     */
    async hydrate(registry: ParcelRegistry): Promise<number> {
        const [rows] = await this.pool.query<ParcelRow[]>(
            `SELECT * FROM civic_parcels WHERE grid_name = ?`,
            [this.gridName],
        );
        for (const row of rows) {
            registry.upsert(rowToParcel(row));
        }
        // Phase 60 HOUSE-3 (v40 / D-60-01) — rehydrate role edges anchored to Civic-DIDs
        // so two Nous resume at their existing trust level after a restart. Revoked edges
        // (revoked_tick set) are retained as history; the registry resolves them to no role.
        const [roleRows] = await this.pool.query<ParcelRoleRow[]>(
            `SELECT r.* FROM civic_parcel_roles r
                JOIN civic_parcels p ON p.parcel_id = r.parcel_id
              WHERE p.grid_name = ?`,
            [this.gridName],
        );
        for (const r of roleRows) {
            registry.upsertRoleEdge(rowToRoleEdge(r));
        }
        // Phase 60 HOUSE-3 (v40 / D-60-05) — rehydrate the bilateral IOU ledger so
        // outstanding payables + caps survive a restart (DB is source of truth).
        const [iouRows] = await this.pool.query<CreditLedgerRow[]>(
            `SELECT * FROM civic_credit_ledger WHERE grid_name = ?`,
            [this.gridName],
        );
        for (const r of iouRows) {
            upsertIou(rowToIou(r));
        }
        // Phase 60 HOUSE-3 (v40 / D-60-06) — rehydrate the signed dual-DID Cowork
        // Agreements + board tasks. The DB 'completed' enum maps to the in-memory
        // 'settled' status once a completed_tick is stamped (settlement is recorded).
        const [coworkRows] = await this.pool.query<CoworkAgreementRow[]>(
            `SELECT * FROM civic_cowork_agreements WHERE grid_name = ?`,
            [this.gridName],
        );
        for (const r of coworkRows) {
            upsertAgreement(rowToCowork(r));
        }
        return rows.length;
    }

    /** Persist a purchase DB-first (owner + acquisition tick). The route mirrors memory after. */
    async persistPurchase(parcel: Parcel): Promise<void> {
        await this.pool.query<ResultSetHeader>(
            `UPDATE civic_parcels
                SET owner_civic_did = ?, acquired_at_tick = ?
              WHERE parcel_id = ?`,
            [parcel.ownerDid, parcel.acquiredAtTick, parcel.id],
        );
    }

    /** Persist a built structure DB-first (embedded structure columns). */
    async persistBuild(parcel: Parcel): Promise<void> {
        const s = parcel.structure;
        await this.pool.query<ResultSetHeader>(
            `UPDATE civic_parcels
                SET structure_name = ?, structure_type = ?, visibility = ?,
                    built_at_tick = ?, named_address = ?
              WHERE parcel_id = ?`,
            [
                s?.name ?? null, s?.type ?? null, s?.visibility ?? null,
                s?.builtAtTick ?? null, s?.namedAddress ?? null, parcel.id,
            ],
        );
    }

    /** Persist an entry-policy change DB-first (policy + allowlist JSON). */
    async persistEntryPolicy(parcel: Parcel): Promise<void> {
        await this.pool.query<ResultSetHeader>(
            `UPDATE civic_parcels
                SET entry_policy = ?, entry_allowlist = ?
              WHERE parcel_id = ?`,
            [parcel.entryPolicy.policy, JSON.stringify(parcel.entryPolicy.allowlist), parcel.id],
        );
    }

    /**
     * Persist a furnished interior DB-first (Phase 59 HOUSE-2). The interior tree is
     * Grid-side JSON — it lives in this column and NEVER crosses the audit chain.
     * The caller mirrors the new tree into memory after this write returns.
     */
    async persistInterior(parcel: Parcel): Promise<void> {
        const interior = parcel.structure?.interior ?? null;
        await this.pool.query<ResultSetHeader>(
            `UPDATE civic_parcels
                SET structure_interior = ?
              WHERE parcel_id = ?`,
            [interior ? JSON.stringify(interior) : null, parcel.id],
        );
    }

    /** Persist a condition-ladder change DB-first (condition + missed_periods). Wave 4. */
    async persistCondition(parcel: Parcel): Promise<void> {
        await this.pool.query<ResultSetHeader>(
            `UPDATE civic_parcels
                SET \`condition\` = ?, missed_periods = ?
              WHERE parcel_id = ?`,
            [parcel.condition, parcel.missedPeriods, parcel.id],
        );
    }

    /** Persist an upkeep collection DB-first (last_upkeep_tick + missed_periods). Wave 4. */
    async persistUpkeep(parcel: Parcel): Promise<void> {
        await this.pool.query<ResultSetHeader>(
            `UPDATE civic_parcels
                SET last_upkeep_tick = ?, missed_periods = ?
              WHERE parcel_id = ?`,
            [parcel.lastUpkeepTick ?? null, parcel.missedPeriods, parcel.id],
        );
    }

    /**
     * Persist a reclaim DB-first (Wave 4): ownership returns to the treasury, the
     * interior + structure are razed, and the condition ladder resets to maintained.
     */
    async persistReclaim(parcel: Parcel): Promise<void> {
        await this.pool.query<ResultSetHeader>(
            `UPDATE civic_parcels
                SET owner_civic_did = NULL,
                    structure_interior = NULL,
                    \`condition\` = 'maintained',
                    missed_periods = 0
              WHERE parcel_id = ?`,
            [parcel.id],
        );
    }

    /* ───────────────── Shop⇄structure binding + place name (v40 / D-60-03/07) ─────────────────
     * DB-first write-through for the Phase 60 HOUSE-3 land columns. `bound_shop_id` is new
     * in v40; `named_address` is the dormant Phase 58 column wired here. hydrate() already
     * reads both via rowToParcel — these are the writers. The caller mirrors memory after.
     */

    /** Persist the shop⇄structure binding DB-first (bound_shop_id; NULL on unbind). */
    async persistBoundShop(parcelId: string, shopId: string | null): Promise<void> {
        await this.pool.query<ResultSetHeader>(
            `UPDATE civic_parcels SET bound_shop_id = ? WHERE parcel_id = ?`,
            [shopId, parcelId],
        );
    }

    /** Persist a place:// name DB-first onto the dormant Phase 58 named_address column. */
    async persistNamedAddress(parcelId: string, namedAddress: string): Promise<void> {
        await this.pool.query<ResultSetHeader>(
            `UPDATE civic_parcels SET named_address = ? WHERE parcel_id = ?`,
            [namedAddress, parcelId],
        );
    }

    /* ───────────────────── Role edges (v40 / D-60-01 / R-60-02) ─────────────────────
     * DB-first write-through, mirroring the persist* pattern above. The owner edge is
     * NEVER written here (implicit from owner_civic_did). A revoke marks the row as
     * history (revoked_tick) and KEEPS it — trust continuity, never a hard-delete.
     */

    /**
     * Persist a role grant DB-first (UPSERT civic_parcel_roles). On a re-grant the PK
     * (parcel_id, holder_civic_did) collides and we refresh the role/grantor/tick while
     * preserving the existing trust_score and clearing any prior revoked_tick (the edge
     * is active again). The caller mirrors the edge into the registry after this returns.
     */
    async persistRole(parcelId: string, edge: RoleEdge): Promise<void> {
        await this.pool.query<ResultSetHeader>(
            `INSERT INTO civic_parcel_roles
                (parcel_id, holder_civic_did, role, granted_by_civic_did, granted_tick, trust_score, revoked_tick)
             VALUES (?, ?, ?, ?, ?, ?, NULL)
             ON DUPLICATE KEY UPDATE
                role = VALUES(role),
                granted_by_civic_did = VALUES(granted_by_civic_did),
                granted_tick = VALUES(granted_tick),
                revoked_tick = NULL`,
            [parcelId, edge.holder_civic_did, edge.role, edge.granted_by_civic_did, edge.granted_tick, edge.trust_score],
        );
    }

    /**
     * Persist a role revoke DB-first: stamp revoked_tick so the edge becomes retained
     * history. The row is KEPT (do NOT hard-delete) so a later re-grant resumes the
     * holder's trust_score (D-60-02 — severance is never a hard kill).
     */
    async persistRoleRevoke(parcelId: string, holderDid: string, revokedTick: number): Promise<void> {
        await this.pool.query<ResultSetHeader>(
            `UPDATE civic_parcel_roles
                SET revoked_tick = ?
              WHERE parcel_id = ? AND holder_civic_did = ?`,
            [revokedTick, parcelId, holderDid],
        );
    }

    /* ───────────────── IOU ledger (v40 / D-60-05 / R-60-07) ─────────────────
     * DB-first write-through for the bilateral mutual-credit ledger. Recording an IOU
     * persists the payable; settlement / counter-net stamps settled_tick. Recording
     * emits NOTHING on chain (private bookkeeping); the caller mirrors memory after.
     */

    /**
     * Persist an IOU DB-first (UPSERT civic_credit_ledger). On a counter-net the amount +
     * settled_tick may change, so an existing iou_id refreshes those fields in place.
     */
    async persistIou(entry: IouEntry): Promise<void> {
        await this.pool.query<ResultSetHeader>(
            `INSERT INTO civic_credit_ledger
                (iou_id, grid_name, creditor_civic_did, debtor_civic_did,
                 amount_bios, reason_ref, created_tick, settled_tick)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                amount_bios = VALUES(amount_bios),
                settled_tick = VALUES(settled_tick)`,
            [
                entry.iou_id, this.gridName, entry.creditor_civic_did, entry.debtor_civic_did,
                entry.amount_bios, entry.reason_ref, entry.created_tick, entry.settled_tick,
            ],
        );
    }

    /** Persist an IOU settlement DB-first (stamp settled_tick). */
    async persistIouSettle(iouId: string, settledTick: number): Promise<void> {
        await this.pool.query<ResultSetHeader>(
            `UPDATE civic_credit_ledger SET settled_tick = ? WHERE iou_id = ?`,
            [settledTick, iouId],
        );
    }

    /* ─────────────── Cowork Agreements (v40 / D-60-06 / R-60-08) ───────────────
     * DB-first write-through for the signed dual-DID agreements + board tasks. The
     * in-memory 'settled' status maps to the DB 'completed' enum + a completed_tick
     * stamp (the DB enum has no 'settled' member — settlement is recorded as a tick).
     */

    /** Persist a cowork agreement DB-first (UPSERT civic_cowork_agreements). */
    async persistCowork(agreement: CoworkAgreement, ticks: { created: number; completed?: number }): Promise<void> {
        const worker = agreement.parties[1] || null;
        const dbStatus = agreement.status === 'settled' ? 'completed' : agreement.status;
        const completedTick = agreement.status === 'settled' || agreement.status === 'completed'
            ? ticks.completed ?? null
            : null;
        await this.pool.query<ResultSetHeader>(
            `INSERT INTO civic_cowork_agreements
                (agreement_id, grid_name, parcel_id, host_civic_did, worker_civic_did,
                 scope_ref, settlement_amount_bios, term_ticks, status, created_tick, completed_tick)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                worker_civic_did = VALUES(worker_civic_did),
                status = VALUES(status),
                completed_tick = VALUES(completed_tick)`,
            [
                agreement.agreement_id, this.gridName, agreement.parcel_id, agreement.parties[0], worker,
                agreement.scope_ref, agreement.settlement_amount_bios, agreement.term_ticks,
                dbStatus, ticks.created, completedTick,
            ],
        );
    }
}

/** Map a civic_credit_ledger DB row into the in-memory IouEntry shape. */
function rowToIou(row: CreditLedgerRow): IouEntry {
    return {
        iou_id: row.iou_id,
        creditor_civic_did: row.creditor_civic_did,
        debtor_civic_did: row.debtor_civic_did,
        amount_bios: Number(row.amount_bios),
        reason_ref: row.reason_ref,
        created_tick: row.created_tick,
        settled_tick: row.settled_tick,
    };
}

/**
 * Map a civic_cowork_agreements DB row into the in-memory CoworkAgreement shape. The DB
 * 'completed' enum + a completed_tick stamp resolves to the in-memory 'settled' status
 * (settlement is recorded once a session completes); an empty worker reads as '' (unclaimed).
 */
function rowToCowork(row: CoworkAgreementRow): CoworkAgreement {
    const status: CoworkAgreement['status'] =
        row.status === 'completed' && row.completed_tick !== null ? 'settled'
            : row.status === 'cancelled' ? 'completed'  // closed terminal — no in-memory 'cancelled'
                : row.status;
    return {
        agreement_id: row.agreement_id,
        parcel_id: row.parcel_id,
        parties: [row.host_civic_did, row.worker_civic_did ?? ''],
        scope_ref: row.scope_ref,
        settlement_amount_bios: Number(row.settlement_amount_bios),
        term_ticks: row.term_ticks,
        status,
    };
}

/** Map a civic_parcel_roles DB row into the in-memory RoleEdge shape. */
function rowToRoleEdge(row: ParcelRoleRow): RoleEdge {
    return {
        parcel_id: row.parcel_id,
        holder_civic_did: row.holder_civic_did,
        role: row.role,
        granted_by_civic_did: row.granted_by_civic_did,
        granted_tick: row.granted_tick,
        trust_score: Number(row.trust_score),
        ...(row.revoked_tick !== null && row.revoked_tick !== undefined
            ? { revoked_tick: row.revoked_tick }
            : {}),
    };
}

/**
 * Materialize the Genesis Core seed plan into concrete Parcel rows (pure — no I/O).
 * Civic rings (not in PURCHASABLE_RINGS) get price 0 and any pre-built structure;
 * purchasable rings get gravityPrice(ring). Sectors are spread evenly per band.
 */
export function buildGenesisCoreParcels(gridName: string): Parcel[] {
    const out: Parcel[] = [];
    for (const entry of GENESIS_CORE_SEED_PLAN) {
        const purchasable = PURCHASABLE_RINGS.includes(entry.ring);
        const priceBios = purchasable ? gravityPrice(entry.ring) : 0;
        for (let i = 0; i < entry.count; i++) {
            const seq = String(i + 1).padStart(4, '0');
            const id = `${gridName}:${entry.zoneId}:${seq}`;
            const sector = entry.count > 0 ? (360 * i) / entry.count : 0;
            out.push({
                id,
                gridId: gridName,
                zoneId: entry.zoneId,
                ring: entry.ring,
                sector,
                level: 0,
                ownerDid: null,
                priceBios,
                structure: entry.prebuiltStructure
                    ? {
                        name: `${entry.zoneId}-venue-${seq}`,
                        type: entry.prebuiltStructure.type,
                        visibility: entry.prebuiltStructure.visibility,
                        builtAtTick: 0,
                        namedAddress: null,
                    }
                    : null,
                entryPolicy: { policy: 'open', allowlist: [] },
                acquiredAtTick: null,
                condition: 'maintained',
                missedPeriods: 0,
            });
        }
    }
    return out;
}
