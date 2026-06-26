/**
 * Phase 48 Library v3 — Plan 1 (CIVLIB-01/02): public reading room + contribute/cite.
 *
 *   GET  /api/v1/library/entries          — visitor reading room (search/category/page)
 *   GET  /api/v1/library/entries/:entryId — full content of one entry (visitor-readable)
 *   POST /api/v1/library/contribute       — Civic-DID contributes (K=3/epoch quota)
 *   POST /api/v1/library/cite             — Civic-DID registers a citation
 *
 * Reads/writes the readable `library_entries` and mirrors into the v2.4 lore commons,
 * emitting the existing lore.contributed / lore.cited (no new allowlist entries).
 */
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { LibraryStore } from '../../library/library-store.js';
import { LoreQuotaTracker } from '../../lore/LoreQuotaTracker.js';
import { VALID_LORE_CATEGORIES } from '../../lore/types.js';

const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

export function registerLibraryRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';
    const tick = (): number => (services.currentTick ? services.currentTick() : 0);
    // K=3 contributions per Nous per 30-tick epoch (D-20-03), shared across this server.
    const quota = new LoreQuotaTracker();

    // CIVLIB-01 — visitor reading room (public).
    app.get<{ Querystring: { search?: string; category?: string; page?: string; limit?: string } }>(
        '/api/v1/library/entries',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.send({ entries: [], count: 0 });
            const limit = Math.min(Math.max(parseInt(req.query.limit ?? '50', 10) || 50, 1), 100);
            const page = Math.max(parseInt(req.query.page ?? '0', 10) || 0, 0);
            const category = typeof req.query.category === 'string' && req.query.category.trim() ? req.query.category.trim() : undefined;
            const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim().slice(0, 100) : undefined;
            const entries = await new LibraryStore(pool, services.audit!).listEntries({ gridName: grid, search, category, limit, offset: page * limit });
            return reply.send({ entries, count: entries.length, page, limit });
        },
    );

    // CIVLIB-01 — per-entry full content (public).
    app.get<{ Params: { entryId: string } }>(
        '/api/v1/library/entries/:entryId',
        async (req, reply) => {
            const pool = services.pool;
            if (!pool) return reply.code(503).send({ error: 'library_unavailable' });
            const entry = await new LibraryStore(pool, services.audit!).getEntry(grid, req.params.entryId);
            if (!entry || entry.status !== 'published') return reply.code(404).send({ error: 'unknown_entry' });
            return reply.send({ entry });
        },
    );

    // CIVLIB-02 — contribute (civic_did_required + K=3 quota).
    app.post<{ Body: { title?: unknown; body?: unknown; category?: unknown } }>(
        '/api/v1/library/contribute',
        async (req, reply) => {
            const contributor = req.didContext?.did;
            if (!contributor || req.didContext?.tier !== 'civic_member' || !CIVIC_DID_RE.test(contributor)) {
                return reply.code(401).send({ error: 'civic_did_required' });
            }
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'library_unavailable' });
            const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
            const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
            const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
            if (!title) return reply.code(400).send({ error: 'empty_title' });
            if (!body) return reply.code(400).send({ error: 'empty_body' });
            if (!VALID_LORE_CATEGORIES.has(category)) return reply.code(400).send({ error: 'invalid_category' });

            if (!quota.tryConsume(contributor, tick())) {
                return reply.code(429).send({ error: 'quota_exhausted', detail: 'K=3 contributions per epoch' });
            }
            const { entryId, contentHash } = await new LibraryStore(pool, audit).contribute({
                gridName: grid, contributorDid: contributor, title, body, category, tick: tick(),
            });
            return reply.code(201).send({ entry_id: entryId, content_hash: contentHash, status: 'published' });
        },
    );

    // CIVLIB-02 — cite an entry (civic_did_required).
    app.post<{ Body: { content_hash?: unknown } }>(
        '/api/v1/library/cite',
        async (req, reply) => {
            const citer = req.didContext?.did;
            if (!citer || req.didContext?.tier !== 'civic_member' || !CIVIC_DID_RE.test(citer)) {
                return reply.code(401).send({ error: 'civic_did_required' });
            }
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'library_unavailable' });
            const contentHash = typeof req.body?.content_hash === 'string' ? req.body.content_hash.trim() : '';
            if (!HEX64_RE.test(contentHash)) return reply.code(400).send({ error: 'invalid_content_hash' });
            await new LibraryStore(pool, audit).cite({ gridName: grid, citingDid: citer, contentHash, tick: tick() });
            return reply.send({ ok: true });
        },
    );
}
