/**
 * Phase 57 Grid Zoning (Plan 1) — ZoneRegistry. The 6 canonical zones are constants; this
 * registry layers Polis tax-modifier amendments on top and validates per-zone activities.
 */
import { createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { appendZoningZoneAmended } from '../audit/append-zoning-zone-amended.js';
import { CANONICAL_ZONES, ZONE_TYPES, activityAllowed, type ZoneType, type ZoneDef } from './zone-types.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export class ZoneRegistry {
    constructor(private readonly pool: Pool, private readonly audit: AuditChain) {}

    /** Current tax modifier (amended override, else canonical default). */
    async taxModifierBps(gridName: string, zoneId: ZoneType): Promise<number> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT tax_modifier_bps FROM zone_config WHERE grid_name = ? AND zone_id = ? LIMIT 1`,
            [gridName, zoneId],
        );
        const r = rows as unknown as { tax_modifier_bps: number }[];
        return r.length ? r[0].tax_modifier_bps : CANONICAL_ZONES[zoneId].tax_modifier_bps;
    }

    /** The 6 zones with their current (possibly amended) tax modifiers. */
    async listZones(gridName: string): Promise<Array<ZoneDef & { current_tax_modifier_bps: number }>> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT zone_id, tax_modifier_bps FROM zone_config WHERE grid_name = ?`,
            [gridName],
        );
        const overrides = new Map((rows as unknown as { zone_id: string; tax_modifier_bps: number }[]).map((o) => [o.zone_id, o.tax_modifier_bps]));
        return ZONE_TYPES.map((z) => ({ ...CANONICAL_ZONES[z], current_tax_modifier_bps: overrides.get(z) ?? CANONICAL_ZONES[z].tax_modifier_bps }));
    }

    /** Pure activity check (canonical allowed list). */
    validateActivity(zoneId: ZoneType, activity: string): boolean {
        return activityAllowed(zoneId, activity);
    }

    /** Polis legislation amends a zone's tax modifier (the zone TYPE is never changed). */
    async amendZone(p: { gridName: string; zoneId: ZoneType; taxModifierBps: number; amendedByDid: string; tick: number }): Promise<void> {
        await this.pool.query(
            `INSERT INTO zone_config (grid_name, zone_id, tax_modifier_bps, amended_tick) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE tax_modifier_bps = VALUES(tax_modifier_bps), amended_tick = VALUES(amended_tick)`,
            [p.gridName, p.zoneId, p.taxModifierBps, p.tick],
        );
        appendZoningZoneAmended(this.audit, { amended_by_did_hash: sha256Hex(p.amendedByDid), tax_modifier_bps: p.taxModifierBps, tick: p.tick, zone_id: p.zoneId });
    }
}
