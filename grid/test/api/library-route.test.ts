/**
 * Phase 48 Library v3 (Plan 1) — reading room + contribute/cite routes.
 *
 *   GET  /api/v1/library/entries          (public)
 *   GET  /api/v1/library/entries/:entryId (public)
 *   POST /api/v1/library/contribute       (civic_did_required + K=3 quota)
 *   POST /api/v1/library/cite             (civic_did_required)
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { AuditChain } from '../../src/audit/chain.js';
import { registerLibraryRoutes } from '../../src/api/routes/library.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';

const ALICE = 'did:civic:noesis:alice';
const aliceCtx = (): DIDContext => ({ did: ALICE, tier: 'civic_member' });
const HASH = 'a'.repeat(64);

function app(opts: { ctx?: DIDContext | null; rows?: unknown[] }): FastifyInstance {
    const pool = { query: vi.fn().mockResolvedValue([(opts.rows ?? []) as RowDataPacket[], {}]) } as unknown as Pool;
    const services = { gridName: 'genesis', currentTick: () => 5, pool, audit: new AuditChain() } as unknown as GridServices;
    const a = Fastify({ logger: false });
    if (opts.ctx !== undefined) a.addHook('onRequest', async (req) => { req.didContext = opts.ctx ?? undefined; });
    registerLibraryRoutes(a, services);
    return a;
}

describe('GET /api/v1/library/entries (public reading room)', () => {
    it('returns published entries (no auth needed)', async () => {
        const a = app({ ctx: null, rows: [{ entry_id: 'e1', title: 'T', category: 'synthesis', contributor_civic_did: ALICE, citation_count: 0, contributed_tick: 1, content_hash: 'b'.repeat(64) }] });
        const res = await a.inject({ method: 'GET', url: '/api/v1/library/entries?category=synthesis&search=T' });
        expect(res.statusCode).toBe(200);
        expect(res.json().count).toBe(1);
        await a.close();
    });
});

describe('GET /api/v1/library/entries/:id', () => {
    it('200 with full content for a published entry', async () => {
        const a = app({ ctx: null, rows: [{ entry_id: 'e1', title: 'T', body: 'full', category: 'synthesis', status: 'published', contributor_civic_did: ALICE, citation_count: 0, contributed_tick: 1, content_hash: 'b'.repeat(64) }] });
        const res = await a.inject({ method: 'GET', url: '/api/v1/library/entries/e1' });
        expect(res.statusCode).toBe(200);
        expect(res.json().entry.body).toBe('full');
        await a.close();
    });
    it('404 for an unknown entry', async () => {
        const a = app({ ctx: null, rows: [] });
        const res = await a.inject({ method: 'GET', url: '/api/v1/library/entries/nope' });
        expect(res.statusCode).toBe(404);
        await a.close();
    });
});

describe('POST /api/v1/library/contribute (CIVLIB-02)', () => {
    it('201 for a valid Civic-DID contribution', async () => {
        const a = app({ ctx: aliceCtx() });
        const res = await a.inject({ method: 'POST', url: '/api/v1/library/contribute', payload: { title: 'On Minds', body: 'A study.', category: 'observation' } });
        expect(res.statusCode).toBe(201);
        expect(res.json().entry_id).toMatch(/^[0-9a-f-]{36}$/i);
        await a.close();
    });
    it('401 without a Civic-DID', async () => {
        const a = app({ ctx: null });
        const res = await a.inject({ method: 'POST', url: '/api/v1/library/contribute', payload: { title: 'x', body: 'y', category: 'observation' } });
        expect(res.statusCode).toBe(401);
        await a.close();
    });
    it('400 on an invalid category', async () => {
        const a = app({ ctx: aliceCtx() });
        const res = await a.inject({ method: 'POST', url: '/api/v1/library/contribute', payload: { title: 'x', body: 'y', category: 'spicy' } });
        expect(res.statusCode).toBe(400);
        await a.close();
    });
    it('429 once the K=3 epoch quota is exhausted', async () => {
        const a = app({ ctx: aliceCtx() });
        const post = () => a.inject({ method: 'POST', url: '/api/v1/library/contribute', payload: { title: 'x', body: 'y', category: 'observation' } });
        expect((await post()).statusCode).toBe(201);
        expect((await post()).statusCode).toBe(201);
        expect((await post()).statusCode).toBe(201);
        expect((await post()).statusCode).toBe(429); // 4th in the same epoch
        await a.close();
    });
});

describe('POST /api/v1/library/cite (CIVLIB-02)', () => {
    it('200 for a valid citation', async () => {
        const a = app({ ctx: aliceCtx() });
        const res = await a.inject({ method: 'POST', url: '/api/v1/library/cite', payload: { content_hash: HASH } });
        expect(res.statusCode).toBe(200);
        await a.close();
    });
    it('400 on an invalid content_hash', async () => {
        const a = app({ ctx: aliceCtx() });
        const res = await a.inject({ method: 'POST', url: '/api/v1/library/cite', payload: { content_hash: 'short' } });
        expect(res.statusCode).toBe(400);
        await a.close();
    });
});
