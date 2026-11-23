/**
 * GET /api/v1/civic/catalog — the Grid's catalog, read-only and public
 * (Grid House Objects sheet §14–§15).
 *
 * Serves what the boot seed wrote and hydrated: Tier 0 (the core every Grid is
 * initialized with) and, once they exist, this Grid's Tier 1 and Tier 2 entries.
 * No entry carries a secret or a price, so the whole catalog is public. 503 when the
 * Grid runs without a database (nothing was seeded).
 *
 *   ?type=material|finish|shell_element|kind|algorithm|starter_set narrows the list.
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { CatalogEntryType } from '../../civic/genesis-catalog.js';
import { GENESIS_CATALOG_VERSION } from '../../civic/genesis-catalog.js';

const TYPES: readonly CatalogEntryType[] = ['material', 'finish', 'shell_element', 'kind', 'algorithm', 'starter_set'];

export function registerCivicCatalogRoutes(app: FastifyInstance, services: GridServices): void {
    app.get<{ Querystring: { type?: string } }>('/api/v1/civic/catalog', async (req, reply) => {
        const store = services.catalogStore;
        if (!store) return reply.code(503).send({ error: 'catalog_not_wired' });
        const type = req.query.type;
        if (type !== undefined && !(TYPES as readonly string[]).includes(type)) {
            return reply.code(400).send({ error: 'unknown_type', types: TYPES });
        }
        const entries = store.list(type as CatalogEntryType | undefined);
        const counts: Record<string, number> = {};
        for (const t of TYPES) counts[t] = 0;
        for (const e of store.list()) counts[e.type] += 1;
        return reply.send({
            grid: services.gridName,
            core_version: GENESIS_CATALOG_VERSION,
            counts,
            entries: entries.map((e) => ({
                entry_id: e.entryId,
                tier: e.tier,
                type: e.type,
                version: e.version,
                level: e.level,
                body_hash: e.bodyHash,
                body: e.body,
            })),
        });
    });
}
