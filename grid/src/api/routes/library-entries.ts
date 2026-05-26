/**
 * Library entries route — Phase 36 VIS-01 / D-36-02.
 *
 * ROUTE_DID_POLICY: 'public' — listed in grid/src/api/policy.ts
 *
 * GET /api/v1/library/entries
 *   200: {entries: LibraryEntry[]}
 *
 * Visitor view exposes title, abstract, contributor_civic_did_hash, category,
 * tick_contributed, citation_count. Full body is omitted (Phase 48 expansion endpoint).
 *
 * Phase 36 STUB — Phase 48 wires real library data source.
 * If services.lore is present, query it; else return empty stub.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';

/** Library entry shape for visitor read-only view (D-36-02). No body field exposed. */
export interface LibraryEntry {
    id: string;
    title: string;
    abstract: string;
    contributor_civic_did_hash: string;
    category: string;
    tick_contributed: number;
    citation_count: number;
}

export function registerLibraryEntriesRoute(
    app: FastifyInstance,
    _services: GridServices,
): void {
    app.get('/api/v1/library/entries', async (_req, _reply) => {
        // PHASE-36 STUB — Phase 48 wires real LoreStorage query for library entries.
        const entries: LibraryEntry[] = [];
        return { entries };
    });
}
