/**
 * Civic Map state route — Phase 36 VIS-01 / D-36-12 + D-V3-32.
 *
 * ROUTE_DID_POLICY: 'public' — listed in grid/src/api/policy.ts
 *
 * GET /api/v1/civic-map/state
 *   200: {zones: Zone[], nous: NousMapEntry[]}
 *
 * Phase 36 STUB — Phase 57 (Zoning) wires real zone data model and amendment legislation.
 * Phase 37 wires real Civic-DID census for nous array population.
 *
 * D-V3-32: Every Grid has exactly 6 zones at instantiation:
 * Business, Manufacture, Shopping, Residential, Infrastructure, Government Quarter.
 * Polis can amend zone sizes/rules but cannot add/remove zone types in v3.0.
 *
 * D-V3-06 + Phase 21 raw-SVG invariant: zone layout uses server-computed coordinates.
 * Polygon coordinates: simple 2×3 grid across 800×600 viewBox.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

/** Zone shape for visitor civic-map state. */
export interface Zone {
    id: string;
    label: string;
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

/**
 * Hard-coded 6-zone stub layout for Phase 36.
 * 2×3 grid across an 800×600 SVG viewBox.
 * Phase 57 replaces with real legislatable zone data model.
 */
const STUB_ZONES: Zone[] = [
    {
        id: 'business',
        label: 'Business',
        polygon: '0,0 267,0 267,200 0,200',
        labelX: 133,
        labelY: 100,
        fillColor: '#dbeafe',
        strokeColor: '#3b82f6',
        taxRate: 0.12,
    },
    {
        id: 'manufacture',
        label: 'Manufacture',
        polygon: '267,0 534,0 534,200 267,200',
        labelX: 400,
        labelY: 100,
        fillColor: '#fef3c7',
        strokeColor: '#f59e0b',
        taxRate: 0.09,
    },
    {
        id: 'shopping',
        label: 'Shopping',
        polygon: '534,0 800,0 800,200 534,200',
        labelX: 667,
        labelY: 100,
        fillColor: '#fce7f3',
        strokeColor: '#ec4899',
        taxRate: 0.10,
    },
    {
        id: 'residential',
        label: 'Residential',
        polygon: '0,200 267,200 267,400 0,400',
        labelX: 133,
        labelY: 300,
        fillColor: '#d1fae5',
        strokeColor: '#10b981',
        taxRate: 0.05,
    },
    {
        id: 'infrastructure',
        label: 'Infrastructure',
        polygon: '267,200 534,200 534,400 267,400',
        labelX: 400,
        labelY: 300,
        fillColor: '#e5e7eb',
        strokeColor: '#6b7280',
        taxRate: 0.03,
    },
    {
        id: 'government_quarter',
        label: 'Government Quarter',
        polygon: '534,200 800,200 800,400 534,400',
        labelX: 667,
        labelY: 300,
        fillColor: '#ede9fe',
        strokeColor: '#8b5cf6',
        taxRate: 0.00,
    },
];

export function registerCivicMapRoute(
    app: FastifyInstance,
    services: GridServices,
): void {
    app.get('/api/v1/civic-map/state', async (_req, _reply) => {
        // PHASE-36 STUB — Phase 57 wires real zone data; Phase 37 populates nous array.
        // Phase 41 SLEEP-01: merge presence_status + last_seen_at from PresenceService
        // (optional chain — graceful degradation if presenceService not wired).
        const nous: NousMapEntry[] = [];

        if (services.presenceService && nous.length > 0) {
            // When Phase 37 populates nous[], this block merges presence data by civic_did.
            // Currently nous[] is empty stub — block is unreachable but type-safe for Phase 37.
            const presenceRecords = await services.presenceService.listAllPresence();
            const presenceMap = new Map(presenceRecords.map(r => [r.civicDid, r]));
            for (const entry of nous) {
                // civic_did_hash is the hash of civic_did — presence is keyed by civic_did.
                // Phase 37 will include the plaintext civic_did alongside the hash;
                // for now the block is unreachable (empty stub nous[]).
                const rec = presenceMap.get(entry.civic_did_hash);
                if (rec) {
                    entry.presence_status = rec.presenceStatus;
                    entry.last_seen_at = rec.lastSeenAt ? rec.lastSeenAt.toISOString() : null;
                }
            }
        }

        return { zones: STUB_ZONES, nous };
    });
}
