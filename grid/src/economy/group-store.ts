/**
 * Groups & Holdings · Phase 1 — GroupStore (write-through persistence).
 *
 * DB-first: MySQL `civic_groups` is the source of truth. seedGenesisGroups
 * idempotently INSERT IGNOREs the five founding Businesses (D-GROUP-04) and emits
 * one group.founded per row actually inserted (mirrors the parcel seed pattern,
 * except Groups DO emit a founding event). listGroups powers the orbital map +
 * Group pages. Membership + treasury arrive in later phases.
 */
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { appendGroupFounded } from '../audit/append-group-founded.js';
import { buildGenesisGroups, type GroupDomain, type GroupKind } from './genesis-groups.js';

export interface GroupRow extends RowDataPacket {
    group_id: string;
    grid_name: string;
    kind: GroupKind;
    domain: GroupDomain;
    display_name: string;
    crest_path: string | null;
    ring: number;
    sector_deg: string | number;
    status: string;
}

/** A Group summary for the map + Group pages (no member/treasury detail in Phase 1). */
export interface GroupSummary {
    readonly groupId: string;
    readonly kind: GroupKind;
    readonly domain: GroupDomain;
    readonly displayName: string;
    readonly crestPath: string | null;
    readonly ring: number;
    readonly sectorDeg: number;
    readonly status: string;
}

export class GroupStore {
    constructor(
        private readonly pool: Pool,
        private readonly gridName: string = 'genesis',
    ) {}

    /**
     * Seed the five founding Businesses (D-GROUP-04) idempotently. INSERT IGNORE per
     * buildGenesisGroups — a re-run on an already-seeded grid inserts 0 rows and emits
     * 0 events. Each freshly-inserted Group emits one group.founded onto the chain.
     * Returns the number of rows seeded.
     */
    async seedGenesisGroups(audit: AuditChain, tick: number): Promise<number> {
        const groups = buildGenesisGroups(this.gridName);
        let inserted = 0;
        for (const g of groups) {
            const [res] = await this.pool.query<ResultSetHeader>(
                `INSERT IGNORE INTO civic_groups
                    (group_id, grid_name, kind, domain, display_name, crest_path,
                     charter_text, zone_id, ring, sector_deg, level,
                     founder_civic_did, status, created_at_tick)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
                [
                    g.groupId, g.gridName, g.kind, g.domain, g.displayName, g.crestPath,
                    g.charter, g.zoneId, g.ring, g.sectorDeg, 0,
                    null, tick,
                ],
            );
            if (res.affectedRows > 0) {
                inserted++;
                appendGroupFounded(audit, {
                    domain: g.domain,
                    group_id: g.groupId,
                    kind: g.kind,
                    tick,
                });
            }
        }
        return inserted;
    }

    /** List all Groups for this grid (DB source of truth). */
    async listGroups(): Promise<GroupSummary[]> {
        const [rows] = await this.pool.query<GroupRow[]>(
            `SELECT * FROM civic_groups WHERE grid_name = ? ORDER BY sector_deg`,
            [this.gridName],
        );
        return rows.map((r) => ({
            groupId: r.group_id,
            kind: r.kind,
            domain: r.domain,
            displayName: r.display_name,
            crestPath: r.crest_path,
            ring: r.ring,
            sectorDeg: Number(r.sector_deg),
            status: r.status,
        }));
    }
}
