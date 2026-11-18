/**
 * Grid Zoning — ZoneRegistry. Each Grid's zone set (D-V3-40).
 *
 * The 6 canonical zones are the TEMPLATE a Grid starts from. `grid_zones` holds what the
 * Grid's Polis has legislated on top: zones it added, template zones it relabeled, and
 * zones it removed (active = 0). `zone_config` holds tax-modifier amendments. A Grid with
 * no rows therefore has exactly the template — nothing is seeded.
 */
import { createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { appendZoningZoneAmended } from '../audit/append-zoning-zone-amended.js';
import { appendZoningZoneSetChanged } from '../audit/append-zoning-zone-set-changed.js';
import {
    CANONICAL_ZONES, TEMPLATE_ZONE_META, ZONE_TYPES, ZONE_KINDS, ZONE_ID_RE, ZONE_ACTIVITY_RE,
    activityAllowed, isZoneType, type ZoneType, type ZoneKind, type GridZone, type ZoneSetAction,
} from './zone-types.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export type ZoneErrorCode =
    | 'unknown_zone' | 'zone_exists' | 'zone_occupied' | 'last_zone'
    | 'invalid_zone_id' | 'invalid_label' | 'invalid_kind' | 'invalid_activities' | 'invalid_tax_modifier';

export class ZoneError extends Error {
    constructor(readonly code: ZoneErrorCode) { super(code); this.name = 'ZoneError'; }
}

interface GridZoneRow { zone_id: string; label: string; zone_kind: string; tax_modifier_bps: number; allowed_activities: unknown; active: number | boolean }

const MAX_ACTIVITIES = 12;

function parseActivities(v: unknown): string[] {
    const arr = typeof v === 'string' ? (JSON.parse(v) as unknown) : v;   // mysql2 may hand back JSON parsed or raw
    return Array.isArray(arr) ? arr.filter((a): a is string => typeof a === 'string') : [];
}

function validLabel(label: unknown): string {
    const l = typeof label === 'string' ? label.trim() : '';
    if (l.length < 1 || l.length > 63) throw new ZoneError('invalid_label');
    return l;
}

export class ZoneRegistry {
    constructor(private readonly pool: Pool, private readonly audit: AuditChain) {}

    /** The Grid's current zone set: template zones it has not removed + zones it added. */
    async listZones(gridName: string): Promise<GridZone[]> {
        const [zoneRows] = await this.pool.query<RowDataPacket[]>(
            `SELECT zone_id, label, zone_kind, tax_modifier_bps, allowed_activities, active FROM grid_zones WHERE grid_name = ?`,
            [gridName],
        );
        const [taxRows] = await this.pool.query<RowDataPacket[]>(
            `SELECT zone_id, tax_modifier_bps FROM zone_config WHERE grid_name = ?`,
            [gridName],
        );
        const law = new Map((zoneRows as unknown as GridZoneRow[]).map((r) => [r.zone_id, r]));
        const amended = new Map((taxRows as unknown as { zone_id: string; tax_modifier_bps: number }[]).map((o) => [o.zone_id, o.tax_modifier_bps]));

        const fromRow = (r: GridZoneRow, template: boolean): GridZone => {
            const kind = (ZONE_KINDS as readonly string[]).includes(r.zone_kind) ? (r.zone_kind as ZoneKind) : 'business';
            return {
                zone_id: r.zone_id, label: r.label, kind, tax_modifier_bps: r.tax_modifier_bps,
                allowed_activities: parseActivities(r.allowed_activities), for_sale: kind !== 'civic', template,
                current_tax_modifier_bps: amended.get(r.zone_id) ?? r.tax_modifier_bps,
            };
        };

        const out: GridZone[] = [];
        for (const z of ZONE_TYPES) {
            const r = law.get(z);
            if (r) { if (r.active) out.push(fromRow(r, true)); continue; }
            const c = CANONICAL_ZONES[z];
            out.push({
                zone_id: z, label: TEMPLATE_ZONE_META[z].label, kind: TEMPLATE_ZONE_META[z].kind,
                tax_modifier_bps: c.tax_modifier_bps, allowed_activities: c.allowed_activities, for_sale: c.for_sale,
                template: true, current_tax_modifier_bps: amended.get(z) ?? c.tax_modifier_bps,
            });
        }
        for (const r of law.values()) {
            if (!isZoneType(r.zone_id) && r.active) out.push(fromRow(r, false));
        }
        return out;
    }

    async getZone(gridName: string, zoneId: string): Promise<GridZone | undefined> {
        return (await this.listZones(gridName)).find((z) => z.zone_id === zoneId);
    }

    async hasZone(gridName: string, zoneId: string): Promise<boolean> {
        return (await this.getZone(gridName, zoneId)) !== undefined;
    }

    /** Current tax modifier (amended override, else the zone's own default). */
    async taxModifierBps(gridName: string, zoneId: string): Promise<number> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT tax_modifier_bps FROM zone_config WHERE grid_name = ? AND zone_id = ? LIMIT 1`,
            [gridName, zoneId],
        );
        const r = rows as unknown as { tax_modifier_bps: number }[];
        if (r.length) return r[0].tax_modifier_bps;
        if (isZoneType(zoneId)) return CANONICAL_ZONES[zoneId].tax_modifier_bps;
        return (await this.getZone(gridName, zoneId))?.tax_modifier_bps ?? 0;
    }

    /** Pure activity check against the template's allowed list. */
    validateActivity(zoneId: ZoneType, activity: string): boolean {
        return activityAllowed(zoneId, activity);
    }

    /** Polis legislation amends a zone's tax modifier. The zone must be in this Grid's set. */
    async amendZone(p: { gridName: string; zoneId: string; taxModifierBps: number; amendedByDid: string; tick: number }): Promise<void> {
        if (!(await this.hasZone(p.gridName, p.zoneId))) throw new ZoneError('unknown_zone');
        await this.pool.query(
            `INSERT INTO zone_config (grid_name, zone_id, tax_modifier_bps, amended_tick) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE tax_modifier_bps = VALUES(tax_modifier_bps), amended_tick = VALUES(amended_tick)`,
            [p.gridName, p.zoneId, p.taxModifierBps, p.tick],
        );
        appendZoningZoneAmended(this.audit, { amended_by_did_hash: sha256Hex(p.amendedByDid), tax_modifier_bps: p.taxModifierBps, tick: p.tick, zone_id: p.zoneId });
    }

    /** Polis legislation adds a zone to this Grid (or brings back one it removed). */
    async addZone(p: { gridName: string; zoneId: string; label: string; kind: ZoneKind; allowedActivities: readonly string[]; taxModifierBps: number; changedByDid: string; tick: number }): Promise<void> {
        if (typeof p.zoneId !== 'string' || !ZONE_ID_RE.test(p.zoneId)) throw new ZoneError('invalid_zone_id');
        const label = validLabel(p.label);
        if (!(ZONE_KINDS as readonly string[]).includes(p.kind)) throw new ZoneError('invalid_kind');
        if (!Array.isArray(p.allowedActivities) || p.allowedActivities.length > MAX_ACTIVITIES
            || !p.allowedActivities.every((a) => typeof a === 'string' && ZONE_ACTIVITY_RE.test(a))) throw new ZoneError('invalid_activities');
        if (!Number.isInteger(p.taxModifierBps) || p.taxModifierBps < 0 || p.taxModifierBps > 10000) throw new ZoneError('invalid_tax_modifier');
        if (await this.hasZone(p.gridName, p.zoneId)) throw new ZoneError('zone_exists');
        await this.upsert(p.gridName, { zone_id: p.zoneId, label, kind: p.kind, tax_modifier_bps: p.taxModifierBps, allowed_activities: p.allowedActivities }, true, p.tick);
        this.emit('added', p.zoneId, label, p.changedByDid, p.tick);
    }

    /** Polis legislation renames a zone. Its id, kind and rules are unchanged. */
    async relabelZone(p: { gridName: string; zoneId: string; label: string; changedByDid: string; tick: number }): Promise<void> {
        const label = validLabel(p.label);
        const zone = await this.getZone(p.gridName, p.zoneId);
        if (!zone) throw new ZoneError('unknown_zone');
        await this.upsert(p.gridName, { ...zone, label }, true, p.tick);
        this.emit('relabeled', p.zoneId, label, p.changedByDid, p.tick);
    }

    /** Polis legislation removes a zone. Blocked while it still holds land or residents,
     *  and a Grid always keeps at least one zone. */
    async removeZone(p: { gridName: string; zoneId: string; changedByDid: string; tick: number }): Promise<void> {
        const zones = await this.listZones(p.gridName);
        const zone = zones.find((z) => z.zone_id === p.zoneId);
        if (!zone) throw new ZoneError('unknown_zone');
        if (zones.length <= 1) throw new ZoneError('last_zone');
        if ((await this.count(`SELECT COUNT(*) AS n FROM civic_parcels WHERE grid_name = ? AND zone_id = ?`, [p.gridName, p.zoneId])) > 0) {
            throw new ZoneError('zone_occupied');
        }
        // Residences are assigned in the template Residential zone (ResidenceStore).
        if (p.zoneId === 'residential'
            && (await this.count(`SELECT COUNT(*) AS n FROM residence_assignments WHERE grid_name = ?`, [p.gridName])) > 0) {
            throw new ZoneError('zone_occupied');
        }
        await this.upsert(p.gridName, zone, false, p.tick);
        this.emit('removed', p.zoneId, zone.label, p.changedByDid, p.tick);
    }

    private async count(sql: string, params: unknown[]): Promise<number> {
        const [rows] = await this.pool.query<RowDataPacket[]>(sql, params);
        return Number((rows as unknown as { n: number }[])[0]?.n ?? 0);
    }

    private async upsert(gridName: string, z: Pick<GridZone, 'zone_id' | 'label' | 'kind' | 'tax_modifier_bps' | 'allowed_activities'>, active: boolean, tick: number): Promise<void> {
        await this.pool.query(
            `INSERT INTO grid_zones (grid_name, zone_id, label, zone_kind, tax_modifier_bps, allowed_activities, active, changed_tick)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE label = VALUES(label), zone_kind = VALUES(zone_kind), tax_modifier_bps = VALUES(tax_modifier_bps),
                 allowed_activities = VALUES(allowed_activities), active = VALUES(active), changed_tick = VALUES(changed_tick)`,
            [gridName, z.zone_id, z.label, z.kind, z.tax_modifier_bps, JSON.stringify(z.allowed_activities), active ? 1 : 0, tick],
        );
    }

    private emit(action: ZoneSetAction, zoneId: string, label: string, changedByDid: string, tick: number): void {
        appendZoningZoneSetChanged(this.audit, { action, changed_by_did_hash: sha256Hex(changedByDid), label_hash: sha256Hex(label), tick, zone_id: zoneId });
    }
}
