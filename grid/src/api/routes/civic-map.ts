/**
 * Civic Map state route — Phase 36 VIS-01 / D-36-12, zones live per D-V3-40.
 *
 * ROUTE_DID_POLICY: 'public' — listed in grid/src/api/policy.ts
 *
 * GET /api/v1/civic-map/state
 *   200: {zones: Zone[], nous: NousMapEntry[]}
 *
 * D-V3-40: the zone set belongs to each Grid. The zones here are the Grid's CURRENT set
 * (ZoneRegistry: the six-zone template unless its Polis legislated otherwise), with the
 * Polis's labels and the live structure-revenue rate. Without a database the Grid has no
 * zone law, so the set is the template.
 *
 * D-V3-06 + Phase 21 raw-SVG invariant: zone layout uses server-computed coordinates —
 * three columns across an 800×600 viewBox, as many rows as the zone set needs.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { ZoneRegistry } from '../../zoning/zone-registry.js';
import { templateGridZones, type GridZone, type ZoneKind } from '../../zoning/zone-types.js';
import { getZoneTaxBps } from '../../civic/founding-law.js';

/** Zone shape for visitor civic-map state. */
export interface Zone {
    id: string;
    label: string;
    kind: ZoneKind;
    polygon: string;
    labelX: number;
    labelY: number;
    fillColor: string;
    strokeColor: string;
    taxRate: number;
}

/** Nous map entry for visitor civic-map state. */
export interface NousMapEntry {
    civic_did_hash: string;
    x: number;
    y: number;
    display_name: string;
    type: 'A' | 'B';
    status: 'online' | 'away';
    zone_label: string;
    /** Phase 41 SLEEP-01 — civic presence state. Optional; absent when PresenceService not wired. */
    presence_status?: 'awake' | 'away' | 'absent' | 'presumed_departed';
    /** Phase 41 SLEEP-01 — ISO timestamp of last Brain heartbeat. Optional. */
    last_seen_at?: string | null;
}

/** Template zones keep their own colours; a zone the Polis added takes its kind's colour. */
const TEMPLATE_COLORS: Readonly<Record<string, readonly [fill: string, stroke: string]>> = {
    business: ['#dbeafe', '#3b82f6'],
    manufacture: ['#fef3c7', '#f59e0b'],
    shopping: ['#fce7f3', '#ec4899'],
    residential: ['#d1fae5', '#10b981'],
    infrastructure: ['#e5e7eb', '#6b7280'],
    government_quarter: ['#ede9fe', '#8b5cf6'],
};
const KIND_COLORS: Readonly<Record<ZoneKind, readonly [fill: string, stroke: string]>> = {
    home: TEMPLATE_COLORS.residential,
    business: TEMPLATE_COLORS.business,
    civic: TEMPLATE_COLORS.infrastructure,
};

const COLS = 3;
const X_EDGES = [0, 267, 534, 800];

/** This Grid's current zone set (the template when the Grid has no database). */
export async function currentZones(services: GridServices): Promise<GridZone[]> {
    if (!services.pool || !services.audit) return templateGridZones();
    return new ZoneRegistry(services.pool, services.audit).listZones(services.gridName ?? 'genesis');
}

/** Structure-revenue rate of a zone as a fraction (founding law + Polis amendments). */
export function zoneTaxRate(zoneId: string): number {
    return getZoneTaxBps(zoneId) / 10000;
}

/** Lay the zone set out as map cells: three per row, rows no taller than 200. */
export function layoutZones(zones: readonly GridZone[]): Zone[] {
    const rows = Math.max(1, Math.ceil(zones.length / COLS));
    const rowH = Math.min(200, Math.floor(600 / rows));
    return zones.map((z, i) => {
        const col = i % COLS; const row = Math.floor(i / COLS);
        const x0 = X_EDGES[col]; const x1 = X_EDGES[col + 1];
        const y0 = row * rowH; const y1 = y0 + rowH;
        const [fillColor, strokeColor] = (z.template ? TEMPLATE_COLORS[z.zone_id] : undefined) ?? KIND_COLORS[z.kind];
        return {
            id: z.zone_id, label: z.label, kind: z.kind,
            polygon: `${x0},${y0} ${x1},${y0} ${x1},${y1} ${x0},${y1}`,
            labelX: Math.round((x0 + x1) / 2), labelY: Math.round((y0 + y1) / 2),
            fillColor, strokeColor, taxRate: zoneTaxRate(z.zone_id),
        };
    });
}

export function registerCivicMapRoute(
    app: FastifyInstance,
    services: GridServices,
): void {
    app.get('/api/v1/civic-map/state', async (_req, _reply) => {
        // Phase 37 populates the nous array.
        // Phase 41 SLEEP-01: merge presence_status + last_seen_at from PresenceService
        // (optional chain — graceful degradation if presenceService not wired).
        const nous: NousMapEntry[] = [];

        if (services.presenceService && nous.length > 0) {
            // When Phase 37 populates nous[], this block merges presence data by civic_did.
            // Currently nous[] is empty — block is unreachable but type-safe for Phase 37.
            const presenceRecords = await services.presenceService.listAllPresence();
            const presenceMap = new Map(presenceRecords.map(r => [r.civicDid, r]));
            for (const entry of nous) {
                // civic_did_hash is the hash of civic_did — presence is keyed by civic_did.
                const rec = presenceMap.get(entry.civic_did_hash);
                if (rec) {
                    entry.presence_status = rec.presenceStatus;
                    entry.last_seen_at = rec.lastSeenAt ? rec.lastSeenAt.toISOString() : null;
                }
            }
        }

        return { zones: layoutZones(await currentZones(services)), nous };
    });
}
