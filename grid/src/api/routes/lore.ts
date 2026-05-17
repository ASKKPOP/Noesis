/**
 * Lore Commons REST endpoint — Phase 20 D-20-11.
 * GET /api/v1/grid/lore?category={tag}&limit={n}
 * Response: { entries: LoreEntryRow[], total: number }
 */
import type { FastifyInstance } from 'fastify';
import type { LoreStorage } from '../../lore/LoreStorage.js';
import { VALID_LORE_CATEGORIES } from '../../lore/types.js';

interface LoreQuery {
    category?: string;
    limit?: string;
}

export async function registerLoreRoutes(
    fastify: FastifyInstance,
    storage: LoreStorage,
    gridName: string,
): Promise<void> {
    fastify.get<{ Querystring: LoreQuery }>('/api/v1/grid/lore', async (request, reply) => {
        const { category, limit: limitStr } = request.query;
        const limit = Math.min(100, Math.max(1, parseInt(limitStr ?? '20', 10) || 20));

        // Validate category against known categories (D-20-03)
        if (category !== undefined && !VALID_LORE_CATEGORIES.has(category)) {
            return reply.code(400).send({ error: `unknown category_tag: ${category}` });
        }

        try {
            const entries = await storage.queryEntries(gridName, category, limit);
            return reply.code(200).send({
                entries: entries.map((row) => ({
                    contributor_did: row.contributor_did,
                    tick: row.tick,
                    content_hash: row.content_hash,
                    category_tag: row.category_tag,
                    citation_count: row.citation_count,
                })),
                total: entries.length,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            request.log.error({ msg: 'lore_query_failed', err: msg });
            return reply.code(500).send({ error: 'lore query failed' });
        }
    });
}
