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
import { CURATE_ACTIONS, type CurateAction } from '../../library/types.js';
import { IrsStore } from '../../irs/irs-store.js';
import { appendIrsDisbursementAuthorized } from '../../audit/append-irs-disbursement-authorized.js';
import { appendIrsDisbursementExecuted } from '../../audit/append-irs-disbursement-executed.js';
import { GOV_SESSION_ISSUER_DID } from '../../civic-registry/government-session.js';
import { createHash } from 'node:crypto';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');
const TREASURY_CIVIC_DID = 'did:civic:noesis:treasury';
const CIVIC_DID_RE = /^did:civic:noesis:[a-z0-9_:\-]+$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

    // CIVLIB-03 — the Government enacts a curator election (government_only).
    app.post<{ Body: { curators?: unknown; term_ticks?: unknown } }>(
        '/api/v1/library/curators/elect',
        async (req, reply) => {
            if (req.didContext?.tier !== 'government') return reply.code(403).send({ error: 'government_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'library_unavailable' });
            const curators = Array.isArray(req.body?.curators) ? (req.body.curators as unknown[]).map(String) : [];
            if (curators.length === 0 || !curators.every((c) => CIVIC_DID_RE.test(c))) {
                return reply.code(400).send({ error: 'invalid_curators' });
            }
            const termTicks = Number.isInteger(req.body?.term_ticks) && (req.body.term_ticks as number) > 0 ? (req.body.term_ticks as number) : 259200; // ~90 days at 30s/tick
            const start = tick(); const end = start + termTicks;
            const store = new LibraryStore(pool, audit);
            for (const curatorDid of curators) {
                await store.electCurator({ gridName: grid, curatorDid, termStartTick: start, termEndTick: end, tick: start });
            }
            return reply.code(201).send({ elected: curators.length, term_start_tick: start, term_end_tick: end });
        },
    );

    // CIVLIB-03 — the active council (public).
    app.get('/api/v1/library/curators', async (_req, reply) => {
        const pool = services.pool;
        if (!pool) return reply.send({ curators: [], count: 0 });
        const curators = await new LibraryStore(pool, services.audit!).listCurators(grid);
        return reply.send({ curators, count: curators.length });
    });

    // CIVLIB-03 — a curator pins / flags / re-categorises / links an entry.
    app.post<{ Params: { entryId: string }; Body: { action?: unknown; category?: unknown; related_entry_id?: unknown } }>(
        '/api/v1/library/curate/:entryId',
        async (req, reply) => {
            const caller = req.didContext?.did;
            if (!caller || req.didContext?.tier !== 'civic_member' || !CIVIC_DID_RE.test(caller)) {
                return reply.code(401).send({ error: 'civic_did_required' });
            }
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'library_unavailable' });
            const entryId = req.params.entryId;
            if (!UUID_RE.test(entryId)) return reply.code(400).send({ error: 'invalid_entry_id' });
            const action = typeof req.body?.action === 'string' ? req.body.action : '';
            if (!CURATE_ACTIONS.includes(action as CurateAction)) return reply.code(400).send({ error: 'invalid_action' });

            const store = new LibraryStore(pool, audit);
            if (!(await store.isActiveCurator(grid, caller, tick()))) return reply.code(403).send({ error: 'not_a_curator' });

            const category = typeof req.body?.category === 'string' && VALID_LORE_CATEGORIES.has(req.body.category) ? req.body.category : undefined;
            const relatedEntryId = typeof req.body?.related_entry_id === 'string' && UUID_RE.test(req.body.related_entry_id) ? req.body.related_entry_id : undefined;
            if (action === 'categorize' && !category) return reply.code(400).send({ error: 'invalid_category' });
            if (action === 'link' && !relatedEntryId) return reply.code(400).send({ error: 'invalid_related_entry_id' });

            await store.curate({ gridName: grid, curatorDid: caller, entryId, action: action as CurateAction, category, relatedEntryId, tick: tick() });
            return reply.send({ ok: true, action });
        },
    );

    // CIVLIB-04 — curator compensation from the civic treasury, via the Phase 45 IRS
    // disburse flow (government_only). Auditable through GET /api/v1/irs/audit/:period
    // (reuses irs.disbursement_authorized/executed — no new allowlist entries).
    app.post<{ Body: { rate_bios?: unknown } }>(
        '/api/v1/library/curators/pay',
        async (req, reply) => {
            if (req.didContext?.tier !== 'government') return reply.code(403).send({ error: 'government_required' });
            const pool = services.pool; const audit = services.audit;
            if (!pool || !audit) return reply.code(503).send({ error: 'library_unavailable' });
            let rate: bigint;
            try { rate = BigInt(String(req.body?.rate_bios ?? '0')); } catch { return reply.code(400).send({ error: 'invalid_rate_bios' }); }
            if (rate <= 0n) return reply.code(400).send({ error: 'invalid_rate_bios' });

            const store = new LibraryStore(pool, audit);
            const curators = await store.listCurators(grid);
            if (curators.length === 0) return reply.code(400).send({ error: 'no_curators' });

            const irs = new IrsStore(pool); const t = tick(); let paid = 0;
            for (const c of curators) {
                const legislationRef = `curator-pay:${c.curator_civic_did}`;
                appendIrsDisbursementAuthorized(audit, {
                    amount_bios: Number(rate), authorized_by_civic_did_hash: sha256Hex(GOV_SESSION_ISSUER_DID),
                    grid_name: grid, legislation_ref_hash: sha256Hex(legislationRef), tick: t,
                });
                try {
                    await irs.disburse({ gridName: grid, amountBios: rate, legislationRef, currentTick: t });
                } catch (err) {
                    const msg = err instanceof Error ? err.message : 'unknown';
                    if (msg === 'insufficient_treasury_balance') {
                        return reply.code(402).send({ error: 'insufficient_treasury_balance', paid });
                    }
                    return reply.code(500).send({ error: 'internal', paid });
                }
                appendIrsDisbursementExecuted(audit, {
                    amount_bios: Number(rate), cause: 'government_disbursement', civic_did: TREASURY_CIVIC_DID, grid_name: grid, tick: t,
                });
                paid += 1;
            }
            return reply.send({ paid, rate_bios: rate.toString(), total_bios: (rate * BigInt(paid)).toString() });
        },
    );
}
