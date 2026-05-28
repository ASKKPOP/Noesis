import { describe, it } from 'vitest';

// Routes tested here (all Phase 42 Plan 04):
//   POST   /api/v1/p2p/announce
//   GET    /api/v1/p2p/peers/:civicDid
//   POST   /api/v1/p2p/signal/:peerDid
//   GET    /api/v1/p2p/signal/inbox
//   GET    /api/v1/p2p/turn-credentials

describe('P2P routes (Phase 42 Plan 04)', () => {

    // ---- POST /api/v1/p2p/announce ----

    it.skip('POST /p2p/announce returns 401 when no Civic-DID bearer token', () => {
        // const res = await app.inject({ method: 'POST', url: '/api/v1/p2p/announce', headers: {} });
        // expect(res.statusCode).toBe(401);
    });

    it.skip('POST /p2p/announce returns 200 + {status:"announced", next_announce_in:300} on success', () => {
        // const res = await app.inject({ method: 'POST', url: '/api/v1/p2p/announce', headers: { authorization: 'Bearer <valid-civic-jwt>' } });
        // expect(res.statusCode).toBe(200);
        // expect(res.json()).toMatchObject({ status: 'announced', next_announce_in: 300 });
    });

    it.skip('POST /p2p/announce emits p2p.peer_announced once per call', () => {
        // const spy = vi.spyOn(audit, 'append');
        // await app.inject({ method: 'POST', url: '/api/v1/p2p/announce', headers: { authorization: 'Bearer <valid-civic-jwt>' } });
        // const p2pCalls = spy.mock.calls.filter(c => c[0].eventType === 'p2p.peer_announced');
        // expect(p2pCalls.length).toBe(1);
    });

    // ---- GET /api/v1/p2p/peers/:civicDid ----

    it.skip('GET /p2p/peers/:civicDid returns {status:"online", last_seen_at} for active peer', () => {
        // const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/peers/did:civic:noesis:abc' });
        // expect(res.statusCode).toBe(200);
        // expect(res.json()).toMatchObject({ status: 'online', last_seen_at: expect.any(String) });
    });

    it.skip('GET /p2p/peers/:civicDid returns {status:"offline"} after TTL', () => {
        // vi.advanceTimersByTime(P2P_TTL_MS + 1);
        // const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/peers/did:civic:noesis:abc' });
        // expect(res.json()).toMatchObject({ status: 'offline' });
    });

    it.skip('GET /p2p/peers/:civicDid does NOT require auth (policy "public")', () => {
        // const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/peers/did:civic:noesis:abc', headers: {} });
        // expect(res.statusCode).not.toBe(401);
    });

    // ---- POST /api/v1/p2p/signal/:peerDid ----

    it.skip('POST /p2p/signal/:peerDid stores blob in SdpInboxStore and mints UUID connection_id', () => {
        // const res = await app.inject({ method: 'POST', url: '/api/v1/p2p/signal/did:civic:noesis:bob', body: { blob: 'sdp-offer' }, headers: { authorization: 'Bearer <alice-jwt>' } });
        // expect(res.statusCode).toBe(200);
        // expect(res.json().connection_id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it.skip('POST /p2p/signal/:peerDid pushes p2p.signal_received via firehose ONLY to recipient', () => {
        // // assert firehose hub pushSignalToDid called with recipient DID
        // expect(hub.pushSignalToDid).toHaveBeenCalledWith('did:civic:noesis:bob', expect.objectContaining({ type: 'p2p.signal_received' }));
    });

    it.skip('POST /p2p/signal/:peerDid emits p2p.connection_opened on first signal', () => {
        // const spy = vi.spyOn(audit, 'append');
        // await app.inject({ method: 'POST', url: '/api/v1/p2p/signal/did:civic:noesis:bob', body: { blob: 'sdp-offer' }, headers: { authorization: 'Bearer <alice-jwt>' } });
        // expect(spy.mock.calls.some(c => c[0].eventType === 'p2p.connection_opened')).toBe(true);
    });

    it.skip('POST /p2p/signal/:peerDid with body {event:"close", connection_id, close_reason} emits p2p.connection_closed', () => {
        // const spy = vi.spyOn(audit, 'append');
        // await app.inject({ method: 'POST', url: '/api/v1/p2p/signal/did:civic:noesis:bob', body: { event: 'close', connection_id: validUuid, close_reason: 'completed' }, headers: { authorization: 'Bearer <alice-jwt>' } });
        // expect(spy.mock.calls.some(c => c[0].eventType === 'p2p.connection_closed')).toBe(true);
    });

    // ---- GET /api/v1/p2p/signal/inbox ----

    it.skip('GET /p2p/signal/inbox returns drained entries for caller Civic-DID', () => {
        // const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/signal/inbox', headers: { authorization: 'Bearer <bob-jwt>' } });
        // expect(res.statusCode).toBe(200);
        // expect(Array.isArray(res.json())).toBe(true);
    });

    it.skip('GET /p2p/signal/inbox cross-DID access returns [] NOT 403 (drain scoped to bearer DID)', () => {
        // // alice's inbox from bob's token — should return empty, not 403
        // const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/signal/inbox', headers: { authorization: 'Bearer <alice-jwt>' } });
        // expect(res.statusCode).toBe(200);
        // expect(res.json()).toEqual([]);
    });

    it.skip('GET /p2p/signal/inbox requires Civic-DID (returns 401 without token)', () => {
        // const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/signal/inbox', headers: {} });
        // expect(res.statusCode).toBe(401);
    });

    // ---- GET /api/v1/p2p/turn-credentials ----

    it.skip('GET /p2p/turn-credentials returns {username, password, ttl, realm, uris:[...]}', () => {
        // const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/turn-credentials', headers: { authorization: 'Bearer <civic-jwt>' } });
        // expect(res.statusCode).toBe(200);
        // expect(res.json()).toMatchObject({ username: expect.any(String), password: expect.any(String), ttl: 3600, realm: 'noesis.grid', uris: expect.arrayContaining([expect.stringMatching(/^turn:/)]) });
    });

    it.skip('GET /p2p/turn-credentials requires Civic-DID (returns 401 without token)', () => {
        // const res = await app.inject({ method: 'GET', url: '/api/v1/p2p/turn-credentials', headers: {} });
        // expect(res.statusCode).toBe(401);
    });

    it.skip('GET /p2p/turn-credentials does NOT deduct Bios (free in v3.0)', () => {
        // // assert no bios.death or bios.debit audit event emitted
        // const spy = vi.spyOn(audit, 'append');
        // await app.inject({ method: 'GET', url: '/api/v1/p2p/turn-credentials', headers: { authorization: 'Bearer <civic-jwt>' } });
        // expect(spy.mock.calls.every(c => c[0].eventType !== 'bios.death')).toBe(true);
    });
});
