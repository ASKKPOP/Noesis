/**
 * Phase 44 Plan 04 — Police stub route tests (D-44-05).
 *
 * POST /api/v1/police/investigate — civic_did_required
 *
 * Verifies:
 *  - 401 without civic DID
 *  - 400 for invalid source (wrong source_type, missing source_ref, non-UUID source_ref)
 *  - 201 with investigation_id for valid marketplace_dispute input
 *  - DB row inserted with status='pending'
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { AuditChain } from '../src/audit/chain.js';
import { registerMarketRoutes } from '../src/api/routes/market.js';
import type { GridServices } from '../src/api/server.js';
import type { DIDContext } from '../src/api/preHandlers/types.js';
import '../src/api/preHandlers/types.js';

const ALICE_DID = 'did:civic:noesis:alice';
const VALID_SOURCE_REF = '44444444-4444-4444-4444-444444444444';

function makeAliceCtx(): DIDContext {
    return { did: ALICE_DID, tier: 'civic_member' };
}

async function buildPoliceApp(opts: {
    authedCtx?: DIDContext | null;
    captureInsert?: { called: boolean; params: unknown[] };
}) {
    const audit = new AuditChain();
    const captureInsert = opts.captureInsert ?? { called: false, params: [] };

    const mockPool = {
        query: vi.fn(async (sql: unknown, params: unknown[]) => {
            if (typeof sql === 'string' && sql.includes('police_investigations')) {
                captureInsert.called = true;
                captureInsert.params = params;
                return [{ affectedRows: 1 }];
            }
            return [[]];
        }),
        getConnection: vi.fn(),
    };

    const app = Fastify({ logger: false });
    if (opts.authedCtx !== undefined) {
        app.addHook('onRequest', async (req) => { req.didContext = opts.authedCtx; });
    }

    await registerMarketRoutes(app, {
        audit,
        gridName: 'Genesis',
        currentTick: () => 200,
        pool: mockPool as unknown as import('mysql2/promise').Pool,
        businessDidStore: { listByCivicDid: vi.fn(async () => []) } as unknown as import('../src/civic-registry/business-did-store.js').BusinessDidStore,
    } as GridServices);
    await app.ready();
    return { app, captureInsert };
}

describe('POST /api/v1/police/investigate — D-44-05 stub', () => {
    it('returns 401 without civic-DID token', async () => {
        const { app } = await buildPoliceApp({ authedCtx: null });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/police/investigate',
            payload: { source_type: 'marketplace_dispute', source_ref: VALID_SOURCE_REF },
        });
        expect(res.statusCode).toBe(401);
        await app.close();
    });

    it('returns 400 invalid_source for source_type other than marketplace_dispute', async () => {
        const { app } = await buildPoliceApp({ authedCtx: makeAliceCtx() });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/police/investigate',
            payload: { source_type: 'something_else', source_ref: VALID_SOURCE_REF },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_source' });
        await app.close();
    });

    it('returns 400 invalid_source for non-UUID source_ref', async () => {
        const { app } = await buildPoliceApp({ authedCtx: makeAliceCtx() });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/police/investigate',
            payload: { source_type: 'marketplace_dispute', source_ref: 'not-a-uuid' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_source' });
        await app.close();
    });

    it('returns 400 invalid_source when source_ref is missing', async () => {
        const { app } = await buildPoliceApp({ authedCtx: makeAliceCtx() });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/police/investigate',
            payload: { source_type: 'marketplace_dispute' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ error: 'invalid_source' });
        await app.close();
    });

    it('returns 201 with investigation_id for valid marketplace_dispute input', async () => {
        const capture = { called: false, params: [] as unknown[] };
        const { app } = await buildPoliceApp({ authedCtx: makeAliceCtx(), captureInsert: capture });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/police/investigate',
            payload: { source_type: 'marketplace_dispute', source_ref: VALID_SOURCE_REF },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json() as { investigation_id: string };
        expect(body.investigation_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        await app.close();
    });

    it('inserts police_investigations row with status=pending', async () => {
        const capture = { called: false, params: [] as unknown[] };
        const { app } = await buildPoliceApp({ authedCtx: makeAliceCtx(), captureInsert: capture });
        await app.inject({
            method: 'POST', url: '/api/v1/police/investigate',
            payload: { source_type: 'marketplace_dispute', source_ref: VALID_SOURCE_REF },
        });
        expect(capture.called).toBe(true);
        // SQL: INSERT INTO police_investigations (investigation_id, grid_name, source_type, source_ref, status, opened_at_tick)
        // VALUES (?, ?, ?, ?, 'pending', ?)
        // params array: [investigationId, gridName, source_type, source_ref, tick]
        // 'pending' is a SQL literal, not a param
        expect(capture.params[2]).toBe('marketplace_dispute');
        expect(capture.params[3]).toBe(VALID_SOURCE_REF);
        // investigation_id is a UUID
        expect(String(capture.params[0])).toMatch(/^[0-9a-f]{8}-/i);
        await app.close();
    });

    it('emits no audit event (police stub does not touch audit chain)', async () => {
        const audit = new AuditChain();
        const appendSpy = vi.spyOn(audit, 'append');
        const mockPool = {
            query: vi.fn(async () => [{ affectedRows: 1 }]),
            getConnection: vi.fn(),
        };
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { req.didContext = makeAliceCtx(); });
        await registerMarketRoutes(app, {
            audit,
            gridName: 'Genesis',
            currentTick: () => 200,
            pool: mockPool as unknown as import('mysql2/promise').Pool,
            businessDidStore: { listByCivicDid: vi.fn(async () => []) } as unknown as import('../src/civic-registry/business-did-store.js').BusinessDidStore,
        } as GridServices);
        await app.ready();
        await app.inject({
            method: 'POST', url: '/api/v1/police/investigate',
            payload: { source_type: 'marketplace_dispute', source_ref: VALID_SOURCE_REF },
        });
        expect(appendSpy).not.toHaveBeenCalled();
        await app.close();
    });
});
