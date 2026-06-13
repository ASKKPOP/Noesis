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
import type { Parcel, ZoneId, StructureType, Visibility } from './types.js';
import { gravityPrice, GENESIS_CORE_SEED_PLAN, PURCHASABLE_RINGS } from './founding-law.js';

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
}

/** Map a DB row into the in-memory Parcel shape (entry_allowlist may arrive as JSON text). */
function rowToParcel(row: ParcelRow): Parcel {
    const allowlist = Array.isArray(row.entry_allowlist)
        ? row.entry_allowlist
        : typeof row.entry_allowlist === 'string' && row.entry_allowlist.length > 0
            ? (JSON.parse(row.entry_allowlist) as string[])
            : [];
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
            }
            : null,
        entryPolicy: { policy: row.entry_policy, allowlist },
        acquiredAtTick: row.acquired_at_tick,
    };
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
            });
        }
    }
    return out;
}
