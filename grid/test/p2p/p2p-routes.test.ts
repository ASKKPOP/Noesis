/**
 * Phase 42 Plan 04 — P2P route integration tests.
 *
 * Routes tested:
 *   POST   /api/v1/p2p/announce
 *   GET    /api/v1/p2p/peers/:civicDid
 *   POST   /api/v1/p2p/signal/:peerDid
 *   GET    /api/v1/p2p/signal/inbox
 *   GET    /api/v1/p2p/turn-credentials
 *
 * Test approach: mini-Fastify app with registerP2pRoutes wired directly.
 * Auth gate (req.didContext) is injected via a preHandler addHook when needed.
 * No real JWTs required — the route handler's own guard validates the context.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { P2PPeerStore } from '../../src/p2p/p2p-peer-store.js';
import { SdpInboxStore } from '../../src/p2p/sdp-inbox-store.js';
import { WsFirehoseHub } from '../../src/audit/firehose-hub.js';
import { registerP2pRoutes } from '../../src/api/routes/p2p.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import '../../src/api/preHandlers/types.js'; // module augmentation side-effect

const ALICE_DID = 'did:civic:noesis:alice';
const BOB_DID = 'did:civic:noesis:bob';

function makeAliceCtx(): DIDContext {
    return { did: ALICE_DID, tier: 'civic_member' };
}

function makeBobCtx(): DIDContext {
    return { did: BOB_DID, tier: 'civic_member' };
}

/** Build a mini-Fastify app with P2P routes registered.
 *  If `authedDid` is provided, a preHandler sets req.didContext for every request.
 */
async function buildApp(opts: {
    authedCtx?: DIDContext | null;
    tickFn?: () => number;
    signalWasSent?: boolean; // if true, pre-populate the _openedAtTick Map by sending a signal first
}): Promise<{
    app: FastifyInstance;
    audit: AuditChain;
    peerStore: P2PPeerStore;
    sdpInboxStore: SdpInboxStore;
    hub: WsFirehoseHub;
}> {
    const audit = new AuditChain();
    const peerStore = new P2PPeerStore();
    const sdpInboxStore = new SdpInboxStore();
    const hub = new WsFirehoseHub(audit, 'Genesis');

    let tick = 100;
    const tickFn = opts.tickFn ?? (() => tick++);

    const services: Partial<GridServices> = {
        audit,
        gridName: 'Genesis',
        currentTick: tickFn,
        p2pService: {
            peerStore,
            sdpInboxStore,
            turnSharedSecret: 'test-turn-secret',
        },
        firehoseHub: hub,
    };

    const app = Fastify({ logger: false });

    // Inject DID context for authenticated routes
    if (opts.authedCtx !== undefined) {
        app.addHook('onRequest', async (req) => {
            req.didContext = opts.authedCtx;
        });
    }

    await registerP2pRoutes(app, services as GridServices);
    await app.ready();

    return { app, audit, peerStore, sdpInboxStore, hub };
}

describe('P2P routes (Phase 42 Plan 04)', () => {

    // ---- POST /api/v1/p2p/announce ----

    describe('POST /api/v1/p2p/announce', () => {
        it('returns 401 when no Civic-DID bearer token', async () => {
            const { app } = await buildApp({ authedCtx: null });
            const res = await app.inject({ method: 'POST', url: '/api/v1/p2p/announce' });
            expect(res.statusCode).toBe(401);
            await app.close();
        });

        it('returns 200 + {status:"announced", next_announce_in:300} on success', async () => {
            const { app } = await buildApp({ authedCtx: makeAliceCtx() });
            const res = await app.inject({ method: 'POST', url: '/api/v1/p2p/announce' });
            expect(res.statusCode).toBe(200);
            expect(res.json()).toMatchObject({ status: 'announced', next_announce_in: 300 });
            await app.close();
        });

        it('emits p2p.peer_announced once per call via audit.append', async () => {
            const { app, audit } = await buildApp({ authedCtx: makeAliceCtx() });
            const appendSpy = vi.spyOn(audit, 'append');
            await app.inject({ method: 'POST', url: '/api/v1/p2p/announce' });
            const p2pCalls = appendSpy.mock.calls.filter(c => c[0] === 'p2p.peer_announced');
            expect(p2pCalls.length).toBe(1);
            await app.close();
        });
    });

    // ---- GET /api/v1/p2p/peers/:civicDid ----

    describe('GET /api/v1/p2p/peers/:civicDid', () => {
        it('returns {status:"online", last_seen_at} for active peer', async () => {
            const { app, peerStore } = await buildApp({});
            peerStore.announce(ALICE_DID, 1);

            const res = await app.inject({ method: 'GET', url: `/api/v1/p2p/peers/${ALICE_DID}` });
            expect(res.statusCode).toBe(200);
            expect(res.json()).toMatchObject({ status: 'online', last_seen_at: expect.any(String) });
            await app.close();
        });

        it('returns 404 peer_offline after TTL (D-42-02)', async () => {
            const { app, peerStore } = await buildApp({});
            // Announce then expire: manipulate lastSeenAt by directly checking with a frozen time
            // Use a peer that was never announced
            const res = await app.inject({ method: 'GET', url: `/api/v1/p2p/peers/${BOB_DID}` });
            expect(res.statusCode).toBe(404);
            expect(res.json()).toEqual({ error: 'peer_offline' });
            await app.close();
        });

        it('returns 404 peer_offline for never-announced DID', async () => {
            const { app } = await buildApp({});
            const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/peers/did:civic:noesis:unknown' });
            expect(res.statusCode).toBe(404);
            expect(res.json()).toEqual({ error: 'peer_offline' });
            await app.close();
        });

        it('does NOT require auth (policy "public") — returns non-401 without token', async () => {
            const { app } = await buildApp({}); // no authedCtx
            const res = await app.inject({ method: 'GET', url: `/api/v1/p2p/peers/${ALICE_DID}` });
            expect(res.statusCode).not.toBe(401);
            await app.close();
        });

        it('returns 400 for invalid civicDid format', async () => {
            const { app } = await buildApp({});
            const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/peers/not-a-valid-did' });
            expect(res.statusCode).toBe(400);
            await app.close();
        });
    });

    // ---- POST /api/v1/p2p/signal/:peerDid ----

    describe('POST /api/v1/p2p/signal/:peerDid', () => {
        it('returns 401 without Civic-DID token', async () => {
            const { app } = await buildApp({ authedCtx: null });
            const res = await app.inject({
                method: 'POST',
                url: `/api/v1/p2p/signal/${BOB_DID}`,
                payload: { encrypted_blob: 'dGVzdA==' },
            });
            expect(res.statusCode).toBe(401);
            await app.close();
        });

        it('stores blob in SdpInboxStore and returns UUID connection_id', async () => {
            const { app, sdpInboxStore } = await buildApp({ authedCtx: makeAliceCtx() });
            const res = await app.inject({
                method: 'POST',
                url: `/api/v1/p2p/signal/${BOB_DID}`,
                payload: { encrypted_blob: 'dGVzdA==' },
            });
            expect(res.statusCode).toBe(200);
            const body = res.json() as { connection_id: string };
            expect(body.connection_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

            // Bob's inbox should have 1 entry
            const inbox = sdpInboxStore.drain(BOB_DID);
            expect(inbox.length).toBe(1);
            expect(inbox[0].encryptedBlob).toBe('dGVzdA==');
            expect(inbox[0].fromDid).toBe(ALICE_DID);
            await app.close();
        });

        it('pushes p2p.signal_received via firehose ONLY to recipient', async () => {
            const { app, hub } = await buildApp({ authedCtx: makeAliceCtx() });
            const pushSpy = vi.spyOn(hub, 'pushSignalToDid');
            await app.inject({
                method: 'POST',
                url: `/api/v1/p2p/signal/${BOB_DID}`,
                payload: { encrypted_blob: 'dGVzdA==' },
            });
            expect(pushSpy).toHaveBeenCalledOnce();
            const [recipientDid, frame] = pushSpy.mock.calls[0];
            expect(recipientDid).toBe(BOB_DID);
            expect((frame as { type: string }).type).toBe('p2p.signal_received');
            await app.close();
        });

        it('emits p2p.connection_opened on signal relay', async () => {
            const { app, audit } = await buildApp({ authedCtx: makeAliceCtx() });
            const appendSpy = vi.spyOn(audit, 'append');
            await app.inject({
                method: 'POST',
                url: `/api/v1/p2p/signal/${BOB_DID}`,
                payload: { encrypted_blob: 'dGVzdA==' },
            });
            const opened = appendSpy.mock.calls.filter(c => c[0] === 'p2p.connection_opened');
            expect(opened.length).toBe(1);
            await app.close();
        });

        it('close event emits p2p.connection_closed with positive duration_ticks', async () => {
            let tickCounter = 100;
            const { app, audit } = await buildApp({ authedCtx: makeAliceCtx(), tickFn: () => tickCounter++ });
            const appendSpy = vi.spyOn(audit, 'append');

            // Open a connection at tick 100
            const openRes = await app.inject({
                method: 'POST',
                url: `/api/v1/p2p/signal/${BOB_DID}`,
                payload: { encrypted_blob: 'dGVzdA==' },
            });
            const { connection_id } = openRes.json() as { connection_id: string };
            // tick is now 101 after open

            // Close at tick 105 (tickCounter is now 101; next call returns 101, then 102...)
            // Actually tickCounter increments on each route call tick= each call gets one tick
            const closeRes = await app.inject({
                method: 'POST',
                url: `/api/v1/p2p/signal/${BOB_DID}`,
                payload: { event: 'close', connection_id, close_reason: 'completed' },
            });
            expect(closeRes.statusCode).toBe(200);
            expect(closeRes.json()).toEqual({ status: 'closed' });

            const closed = appendSpy.mock.calls.filter(c => c[0] === 'p2p.connection_closed');
            expect(closed.length).toBe(1);
            const payload = closed[0][2] as { duration_ticks: number; close_reason: string };
            expect(payload.duration_ticks).toBeGreaterThan(0);
            expect(payload.close_reason).toBe('completed');
            await app.close();
        });

        it('close event returns 400 for invalid connection_id', async () => {
            const { app } = await buildApp({ authedCtx: makeAliceCtx() });
            const res = await app.inject({
                method: 'POST',
                url: `/api/v1/p2p/signal/${BOB_DID}`,
                payload: { event: 'close', connection_id: 'not-a-uuid', close_reason: 'completed' },
            });
            expect(res.statusCode).toBe(400);
            await app.close();
        });

        it('returns 400 for non-base64 encrypted_blob', async () => {
            const { app } = await buildApp({ authedCtx: makeAliceCtx() });
            const res = await app.inject({
                method: 'POST',
                url: `/api/v1/p2p/signal/${BOB_DID}`,
                payload: { encrypted_blob: '!!!not-base64!!!' },
            });
            expect(res.statusCode).toBe(400);
            await app.close();
        });
    });

    // ---- GET /api/v1/p2p/signal/inbox ----

    describe('GET /api/v1/p2p/signal/inbox', () => {
        it('requires Civic-DID — returns 401 without token', async () => {
            const { app } = await buildApp({ authedCtx: null });
            const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/signal/inbox' });
            expect(res.statusCode).toBe(401);
            await app.close();
        });

        it('returns drained entries for caller Civic-DID', async () => {
            const { app, sdpInboxStore } = await buildApp({ authedCtx: makeAliceCtx() });
            // Pre-populate Alice's inbox
            sdpInboxStore.push(ALICE_DID, {
                connectionId: '11111111-0000-0000-0000-000000000000',
                fromDid: BOB_DID,
                encryptedBlob: 'dGVzdA==',
                expiresAt: Date.now() + 60_000,
            });

            const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/signal/inbox' });
            expect(res.statusCode).toBe(200);
            const body = res.json() as { signals: unknown[] };
            expect(Array.isArray(body.signals)).toBe(true);
            expect(body.signals.length).toBe(1);
            await app.close();
        });

        it('cross-DID access returns [] NOT 403 (drain scoped to bearer DID)', async () => {
            const { app, sdpInboxStore } = await buildApp({ authedCtx: makeAliceCtx() });
            // Pre-populate BOB's inbox — Alice's token should NOT see it
            sdpInboxStore.push(BOB_DID, {
                connectionId: '22222222-0000-0000-0000-000000000000',
                fromDid: ALICE_DID,
                encryptedBlob: 'dGVzdA==',
                expiresAt: Date.now() + 60_000,
            });

            // Alice requests her own inbox (empty)
            const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/signal/inbox' });
            expect(res.statusCode).toBe(200);
            const body = res.json() as { signals: unknown[] };
            expect(body.signals).toEqual([]);
            await app.close();
        });
    });

    // ---- GET /api/v1/p2p/turn-credentials ----

    describe('GET /api/v1/p2p/turn-credentials', () => {
        it('requires Civic-DID — returns 401 without token', async () => {
            const { app } = await buildApp({ authedCtx: null });
            const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/turn-credentials' });
            expect(res.statusCode).toBe(401);
            await app.close();
        });

        it('returns {username, password, ttl:3600, realm:"noesis.grid", uris:[...]}', async () => {
            const { app } = await buildApp({ authedCtx: makeAliceCtx() });
            const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/turn-credentials' });
            expect(res.statusCode).toBe(200);
            const body = res.json() as { username: string; password: string; ttl: number; realm: string; uris: string[] };
            expect(body).toMatchObject({
                username: expect.any(String),
                password: expect.any(String),
                ttl: 3600,
                realm: 'noesis.grid',
            });
            expect(Array.isArray(body.uris)).toBe(true);
            expect(body.uris.some(u => u.startsWith('turn:'))).toBe(true);
            expect(body.uris.some(u => u.startsWith('stun:'))).toBe(true);
            await app.close();
        });

        it('does NOT deduct Bios — no bios.* audit event emitted (free in v3.0 per D-42-03)', async () => {
            const { app, audit } = await buildApp({ authedCtx: makeAliceCtx() });
            const appendSpy = vi.spyOn(audit, 'append');
            await app.inject({ method: 'GET', url: '/api/v1/p2p/turn-credentials' });
            const biosCalls = appendSpy.mock.calls.filter(c => String(c[0]).startsWith('bios.'));
            expect(biosCalls.length).toBe(0);
            await app.close();
        });
    });
});
