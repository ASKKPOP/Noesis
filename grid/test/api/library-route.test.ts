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

function app(opts: { ctx?: DIDContext | null; rows?: unknown[]; treasuryBios?: string }): FastifyInstance {
    const conn = {
        beginTransaction: vi.fn(async () => {}),
        query: vi.fn(async () => [[{ balance_bios: opts.treasuryBios ?? '1000000' }]]),
        commit: vi.fn(async () => {}), rollback: vi.fn(async () => {}), release: vi.fn(() => {}),
    };
    const pool = {
        query: vi.fn().mockResolvedValue([(opts.rows ?? []) as RowDataPacket[], {}]),
        getConnection: vi.fn(async () => conn),
    } as unknown as Pool;
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

const govCtx = (): DIDContext => ({ did: 'did:gov:noesis:session', tier: 'government' });
const ENTRY = '99999999-9999-4999-8999-999999999999';

describe('Library curation (CIVLIB-03)', () => {
    it('201 — Government elects curators', async () => {
        const a = app({ ctx: govCtx() });
        const res = await a.inject({ method: 'POST', url: '/api/v1/library/curators/elect', payload: { curators: [ALICE], term_ticks: 1000 } });
        expect(res.statusCode).toBe(201);
        expect(res.json().elected).toBe(1);
        await a.close();
    });
    it('403 — a civic member cannot elect curators', async () => {
        const a = app({ ctx: aliceCtx() });
        const res = await a.inject({ method: 'POST', url: '/api/v1/library/curators/elect', payload: { curators: [ALICE] } });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
    it('GET /curators is public', async () => {
        const a = app({ ctx: null, rows: [{ curator_civic_did: ALICE, term_start_tick: 1, term_end_tick: 100, status: 'active' }] });
        const res = await a.inject({ method: 'GET', url: '/api/v1/library/curators' });
        expect(res.statusCode).toBe(200);
        expect(res.json().count).toBe(1);
        await a.close();
    });
    it('200 — an active curator pins an entry', async () => {
        const a = app({ ctx: aliceCtx(), rows: [{ '1': 1 }] }); // isActiveCurator → truthy
        const res = await a.inject({ method: 'POST', url: `/api/v1/library/curate/${ENTRY}`, payload: { action: 'pin' } });
        expect(res.statusCode).toBe(200);
        await a.close();
    });
    it('403 — a non-curator civic member cannot curate', async () => {
        const a = app({ ctx: aliceCtx(), rows: [] }); // isActiveCurator → false
        const res = await a.inject({ method: 'POST', url: `/api/v1/library/curate/${ENTRY}`, payload: { action: 'pin' } });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('not_a_curator');
        await a.close();
    });
    it('400 — invalid curate action', async () => {
        const a = app({ ctx: aliceCtx(), rows: [{ '1': 1 }] });
        const res = await a.inject({ method: 'POST', url: `/api/v1/library/curate/${ENTRY}`, payload: { action: 'delete' } });
        expect(res.statusCode).toBe(400);
        await a.close();
    });
});

describe('POST /api/v1/library/curators/pay (CIVLIB-04 — reuses IRS disburse)', () => {
    it('200 — Government pays the active council from the treasury', async () => {
        const a = app({ ctx: govCtx(), rows: [{ curator_civic_did: ALICE, term_start_tick: 1, term_end_tick: 100, status: 'active' }], treasuryBios: '1000000' });
        const res = await a.inject({ method: 'POST', url: '/api/v1/library/curators/pay', payload: { rate_bios: '500' } });
        expect(res.statusCode).toBe(200);
        expect(res.json().paid).toBe(1);
        expect(res.json().total_bios).toBe('500');
        await a.close();
    });
    it('403 — a civic member cannot pay curators', async () => {
        const a = app({ ctx: aliceCtx(), rows: [{ curator_civic_did: ALICE, status: 'active' }] });
        const res = await a.inject({ method: 'POST', url: '/api/v1/library/curators/pay', payload: { rate_bios: '500' } });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
    it('400 — no active curators to pay', async () => {
        const a = app({ ctx: govCtx(), rows: [] });
        const res = await a.inject({ method: 'POST', url: '/api/v1/library/curators/pay', payload: { rate_bios: '500' } });
        expect(res.statusCode).toBe(400);
        await a.close();
    });
    it('402 — insufficient treasury balance', async () => {
        const a = app({ ctx: govCtx(), rows: [{ curator_civic_did: ALICE, status: 'active' }], treasuryBios: '100' });
        const res = await a.inject({ method: 'POST', url: '/api/v1/library/curators/pay', payload: { rate_bios: '500' } });
        expect(res.statusCode).toBe(402);
        await a.close();
    });
});
