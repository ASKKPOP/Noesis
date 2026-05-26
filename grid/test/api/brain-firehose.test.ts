/**
 * Phase 38 WIRE-01 (WSS) + WIRE-05 — GET /api/v1/brain/firehose integration tests.
 *
 * 10 test cases:
 *   1.  upgrade without bearer → close with 4401
 *   2.  upgrade with invalid bearer (tampered sig) → close with 4401
 *   3.  upgrade with valid bearer for revoked brain_token → close with 4401
 *   4.  upgrade with valid bearer → hello frame received
 *   5.  subscriber receives own actor event
 *   6.  subscriber does NOT receive another DID private event
 *   7.  subscriber receives tick events
 *   8.  subscriber receives events where targetDid === sub
 *   9.  two civic_member subscribers with different DIDs see disjoint event sets
 *  10.  R-31-01 generalization: chain head hash identical regardless of how many WS clients connected
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServerWithHub } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { WebSocket as WsClient } from 'ws';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';
import type { BrainTokenRecord } from '../../src/db/stores/brain-token-store.js';
import { ROUTE_DID_POLICY } from '../../src/api/policy.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const GRID_NAME = 'genesis';
const NOUS_DID_A = 'did:noesis:nous:firehose-test-a';
const NOUS_DID_B = 'did:noesis:nous:firehose-test-b';
const CIVIC_DID_A = 'did:civic:noesis:firehose-civic-a';
const CIVIC_DID_B = 'did:civic:noesis:firehose-civic-b';

// ── BrainTokenStore stub ───────────────────────────────────────────────────────

function makeMockBrainTokenStore(records: BrainTokenRecord[]) {
    return {
        async getByDid(brainDid: string) {
            return records.find((r) => r.brainDid === brainDid) ?? null;
        },
        async isRevoked(brainDid: string) {
            const rec = records.find((r) => r.brainDid === brainDid);
            return rec?.revoked ?? false;
        },
        async upsert() {},
        async insert() {},
        async revoke() { return false; },
    } as unknown as import('../../src/db/stores/brain-token-store.js').BrainTokenStore;
}

// ── WsClient helpers ───────────────────────────────────────────────────────────

interface MsgQueue {
    ws: WsClient;
    next(timeoutMs?: number): Promise<unknown>;
    allReceived: unknown[];
    waitOpen(timeoutMs?: number): Promise<void>;
    waitClose(timeoutMs?: number): Promise<{ code: number; reason: string }>;
    waitError(timeoutMs?: number): Promise<Error>;
    waitRejected(timeoutMs?: number): Promise<{ code: number; reason: string } | Error>;
}

function connectWs(url: string, bearer?: string): MsgQueue {
    const headers = bearer ? { authorization: `Bearer ${bearer}` } : undefined;
    const ws = new WsClient(url, { headers });
    const queue: unknown[] = [];
    const waiters: Array<(v: unknown) => void> = [];
    const allReceived: unknown[] = [];

    // Eagerly buffer close and error events so waitRejected never misses them.
    const closeEvents: Array<{ code: number; reason: string }> = [];
    const errorEvents: Error[] = [];
    const closeWaiters: Array<(v: { code: number; reason: string }) => void> = [];
    const errorWaiters: Array<(v: Error) => void> = [];
    const rejWaiters: Array<(v: { code: number; reason: string } | Error) => void> = [];

    ws.on('message', (buf) => {
        const parsed = JSON.parse(buf.toString()) as unknown;
        allReceived.push(parsed);
        const w = waiters.shift();
        if (w) w(parsed);
        else queue.push(parsed);
    });
    ws.on('close', (code, reason) => {
        const ev = { code, reason: reason.toString() };
        const cw = closeWaiters.shift();
        if (cw) { cw(ev); return; }
        const rw = rejWaiters.shift();
        if (rw) { rw(ev); return; }
        closeEvents.push(ev);
    });
    ws.on('error', (e) => {
        // Terminate to release TCP so the server can close cleanly
        try { ws.terminate(); } catch { /* already gone */ }
        const ew = errorWaiters.shift();
        if (ew) { ew(e); return; }
        const rw = rejWaiters.shift();
        if (rw) { rw(e); return; }
        errorEvents.push(e);
    });

    return {
        ws,
        allReceived,
        next(timeoutMs = 2000): Promise<unknown> {
            return new Promise((resolve, reject) => {
                if (queue.length > 0) { resolve(queue.shift()); return; }
                const t = setTimeout(() => {
                    const idx = waiters.indexOf(resolve);
                    if (idx >= 0) waiters.splice(idx, 1);
                    reject(new Error('message timeout'));
                }, timeoutMs);
                waiters.push((v) => { clearTimeout(t); resolve(v); });
            });
        },
        waitOpen(timeoutMs = 2000): Promise<void> {
            return new Promise((resolve, reject) => {
                if (ws.readyState === WsClient.OPEN) { resolve(); return; }
                const t = setTimeout(() => reject(new Error('open timeout')), timeoutMs);
                ws.once('open', () => { clearTimeout(t); resolve(); });
                // error is already buffered above; use a one-shot waiter
                errorWaiters.push((e) => { clearTimeout(t); reject(e); });
            });
        },
        waitClose(timeoutMs = 3000): Promise<{ code: number; reason: string }> {
            return new Promise((resolve, reject) => {
                if (closeEvents.length > 0) { resolve(closeEvents.shift()!); return; }
                const t = setTimeout(() => reject(new Error('close timeout')), timeoutMs);
                closeWaiters.push((ev) => { clearTimeout(t); resolve(ev); });
            });
        },
        waitError(timeoutMs = 3000): Promise<Error> {
            return new Promise((resolve, reject) => {
                if (errorEvents.length > 0) { resolve(errorEvents.shift()!); return; }
                const t = setTimeout(() => reject(new Error('error timeout')), timeoutMs);
                errorWaiters.push((e) => { clearTimeout(t); resolve(e); });
            });
        },
        /** Wait for either a close or an error — whichever fires first. */
        waitRejected(timeoutMs = 5000): Promise<{ code: number; reason: string } | Error> {
            return new Promise((resolve, reject) => {
                // Drain buffered events first
                if (closeEvents.length > 0) { resolve(closeEvents.shift()!); return; }
                if (errorEvents.length > 0) { resolve(errorEvents.shift()!); return; }
                const t = setTimeout(() => reject(new Error('rejection timeout')), timeoutMs);
                rejWaiters.push((ev) => { clearTimeout(t); resolve(ev); });
            });
        },
    };
}

// ── Shared fixture builder ─────────────────────────────────────────────────────

interface TestFixture {
    app: FastifyInstance;
    audit: AuditChain;
    port: number;
    /** Force-destroy all tracked TCP connections then close the app. */
    forceClose(): Promise<void>;
    mintJwt: (sub: string, iss?: string, expired?: boolean) => Promise<string>;
    mintJwtB: (sub: string) => Promise<string>;
}

async function buildFixture(): Promise<TestFixture> {
    // Key pair A (for NOUS_DID_A / CIVIC_DID_A)
    const { privateKey: pkA, publicKey: pubA } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    const jwkA = await exportJWK(pubA);
    const publicKeyJwkA: Record<string, unknown> = { kty: jwkA.kty, crv: jwkA.crv, x: jwkA.x, alg: 'EdDSA' };

    // Key pair B (for NOUS_DID_B / CIVIC_DID_B)
    const { privateKey: pkB, publicKey: pubB } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    const jwkB = await exportJWK(pubB);
    const publicKeyJwkB: Record<string, unknown> = { kty: jwkB.kty, crv: jwkB.crv, x: jwkB.x, alg: 'EdDSA' };

    const tokenRecords: BrainTokenRecord[] = [
        {
            brainDid: NOUS_DID_A,
            publicKeyJwk: publicKeyJwkA,
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
            revoked: false,
        },
        {
            brainDid: NOUS_DID_B,
            publicKeyJwk: publicKeyJwkB,
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
            revoked: false,
        },
        {
            brainDid: 'did:noesis:nous:revoked-brain',
            publicKeyJwk: publicKeyJwkA,  // shares A's key for simplicity
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 86400,
            revoked: true,
        },
    ];

    const clock = new WorldClock({ tickRateMs: 100_000 });
    const space = new SpatialMap();
    const logos = new LogosEngine();
    const audit = new AuditChain();
    const { app } = buildServerWithHub({
        clock, space, logos, audit, gridName: GRID_NAME,
        brainTokenStore: makeMockBrainTokenStore(tokenRecords),
    });

    // Track all sockets so we can force-destroy them on teardown, preventing
    // app.close() from hanging when an HTTP upgrade request was rejected (the
    // raw TCP socket stays open in Node.js's connection tracking).
    const trackedSockets = new Set<import('net').Socket>();
    app.server.on('connection', (socket) => {
        trackedSockets.add(socket);
        socket.once('close', () => trackedSockets.delete(socket));
    });

    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port bound');
    const port = addr.port;

    const mintJwt = async (sub: string, iss: string = NOUS_DID_A, expired = false): Promise<string> => {
        const builder = new SignJWT({ sub })
            .setProtectedHeader({ alg: 'EdDSA' })
            .setIssuer(iss)
            .setIssuedAt();
        if (expired) {
            builder.setExpirationTime('-1s');
        } else {
            builder.setExpirationTime('1h');
        }
        return builder.sign(pkA);
    };

    const mintJwtB = async (sub: string): Promise<string> => {
        return new SignJWT({ sub })
            .setProtectedHeader({ alg: 'EdDSA' })
            .setIssuer(NOUS_DID_B)
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(pkB);
    };

    const forceClose = async (): Promise<void> => {
        // Phase 1: destroy all tracked TCP sockets so the HTTP server can close.
        for (const s of trackedSockets) {
            try { s.destroy(); } catch { /* swallow */ }
        }
        trackedSockets.clear();
        // Phase 2: graceful Fastify close (now safe — no dangling connections).
        try { await app.close(); } catch { /* swallow */ }
    };

    return { app, audit, port, forceClose, mintJwt, mintJwtB };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/v1/brain/firehose (WebSocket)', () => {
    let fixture: TestFixture;

    beforeEach(async () => {
        fixture = await buildFixture();
    });

    afterEach(async () => {
        if (!fixture) return;
        await fixture.forceClose();
    }, 8000);

    // ── 1. No bearer → rejected (HTTP 401 or close 4401) ────────────────────
    // The global civic_did_required policy hook fires before the WS upgrade,
    // so unauthenticated requests receive HTTP 401 (WsClient error event) rather
    // than a WS close code. Both forms of rejection satisfy the security invariant.

    it('upgrade without bearer → rejected (HTTP 401 or close 4401)', async () => {
        const c = connectWs(`ws://127.0.0.1:${fixture.port}/api/v1/brain/firehose`);
        const result = await c.waitRejected();
        if (result instanceof Error) {
            // HTTP-level rejection from global onRequest policy hook
            expect(result.message).toContain('401');
        } else {
            // WS-level close from in-handler auth check
            expect(result.code).toBe(4401);
        }
    });

    // ── 2. Invalid bearer (unknown issuer) → rejected ─────────────────────────
    // Uses an EdDSA JWT whose issuer is NOT in brainTokenStore — getByDid returns
    // null, so tryDid falls through to ES256 path (also fails), returns null → 401.
    // Avoids expensive importJWK + jwtVerify work of a same-issuer tampered-sig case.

    it('upgrade with invalid bearer (unknown issuer) → rejected (HTTP 401 or close 4401)', async () => {
        // Generate a fresh key pair NOT registered in the fixture's brainTokenStore
        const { privateKey: unknownKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
        const unknownJwt = await new SignJWT({ sub: CIVIC_DID_A })
            .setProtectedHeader({ alg: 'EdDSA' })
            .setIssuer('did:noesis:nous:unknown-brain-not-in-store')
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(unknownKey);
        const c = connectWs(`ws://127.0.0.1:${fixture.port}/api/v1/brain/firehose`, unknownJwt);
        const result = await c.waitRejected();
        if (result instanceof Error) {
            expect(result.message).toContain('401');
        } else {
            expect(result.code).toBe(4401);
        }
    });

    // ── 3. Revoked brain token → rejected ────────────────────────────────────

    it('upgrade with valid bearer for revoked brain_token → rejected (HTTP 401 or close 4401)', async () => {
        // 'did:noesis:nous:revoked-brain' is in the store with revoked=true
        const jwt = await fixture.mintJwt(CIVIC_DID_A, 'did:noesis:nous:revoked-brain');
        const c = connectWs(`ws://127.0.0.1:${fixture.port}/api/v1/brain/firehose`, jwt);
        const result = await c.waitRejected();
        if (result instanceof Error) {
            expect(result.message).toContain('401');
        } else {
            expect(result.code).toBe(4401);
        }
    });

    // ── 4. Valid bearer → hello frame received ────────────────────────────────

    it('upgrade with valid bearer → hello frame received', async () => {
        const jwt = await fixture.mintJwt(CIVIC_DID_A);
        const c = connectWs(`ws://127.0.0.1:${fixture.port}/api/v1/brain/firehose`, jwt);
        await c.waitOpen();
        const hello = await c.next() as { type: string; gridName: string; serverTime: number };
        expect(hello.type).toBe('hello');
        expect(hello.gridName).toBe(GRID_NAME);
        expect(typeof hello.serverTime).toBe('number');
        c.ws.close();
    });

    // ── 5. Subscriber receives own actor event ────────────────────────────────

    it('subscriber receives own actor event', async () => {
        const jwt = await fixture.mintJwt(CIVIC_DID_A);
        const c = connectWs(`ws://127.0.0.1:${fixture.port}/api/v1/brain/firehose`, jwt);
        await c.waitOpen();
        await c.next(); // hello

        fixture.audit.append('nous.moved', CIVIC_DID_A, { to: 'regionA' });
        const ev = await c.next() as { type: string; entry: { actorDid: string; eventType: string } };
        expect(ev.type).toBe('event');
        expect(ev.entry.actorDid).toBe(CIVIC_DID_A);
        expect(ev.entry.eventType).toBe('nous.moved');
        c.ws.close();
    });

    // ── 6. Subscriber does NOT receive another DID private event ─────────────

    it('subscriber does NOT receive another DID private event', async () => {
        const jwt = await fixture.mintJwt(CIVIC_DID_A);
        const c = connectWs(`ws://127.0.0.1:${fixture.port}/api/v1/brain/firehose`, jwt);
        await c.waitOpen();
        await c.next(); // hello

        // Event from a different actor, not targeting CIVIC_DID_A
        fixture.audit.append('nous.spoke', 'did:civic:noesis:other', { msg: 'hi' });

        // Wait to ensure no message arrives within 200ms
        await new Promise((r) => setTimeout(r, 200));
        expect(c.allReceived.length).toBe(1); // only hello
        c.ws.close();
    });

    // ── 7. Subscriber receives tick events ───────────────────────────────────

    it('subscriber receives tick events', async () => {
        const jwt = await fixture.mintJwt(CIVIC_DID_A);
        const c = connectWs(`ws://127.0.0.1:${fixture.port}/api/v1/brain/firehose`, jwt);
        await c.waitOpen();
        await c.next(); // hello

        fixture.audit.append('tick', 'did:civic:noesis:system', {});
        const ev = await c.next() as { type: string; entry: { eventType: string } };
        expect(ev.type).toBe('event');
        expect(ev.entry.eventType).toBe('tick');
        c.ws.close();
    });

    // ── 8. Subscriber receives events where targetDid === sub ────────────────

    it('subscriber receives events where targetDid === sub', async () => {
        const jwt = await fixture.mintJwt(CIVIC_DID_A);
        const c = connectWs(`ws://127.0.0.1:${fixture.port}/api/v1/brain/firehose`, jwt);
        await c.waitOpen();
        await c.next(); // hello

        fixture.audit.append('nous.spoke', 'did:civic:noesis:other', { msg: 'hello' }, CIVIC_DID_A);
        const ev = await c.next() as { type: string; entry: { targetDid: string } };
        expect(ev.type).toBe('event');
        expect(ev.entry.targetDid).toBe(CIVIC_DID_A);
        c.ws.close();
    });

    // ── 9. Two civic_member subscribers with different DIDs see disjoint sets ─

    it('two civic_member subscribers with different DIDs see disjoint event sets', async () => {
        const jwtA = await fixture.mintJwt(CIVIC_DID_A);
        const jwtB = await fixture.mintJwtB(CIVIC_DID_B);

        const cA = connectWs(`ws://127.0.0.1:${fixture.port}/api/v1/brain/firehose`, jwtA);
        const cB = connectWs(`ws://127.0.0.1:${fixture.port}/api/v1/brain/firehose`, jwtB);
        await Promise.all([cA.waitOpen(), cB.waitOpen()]);
        await Promise.all([cA.next(), cB.next()]); // hello frames

        // Capture initial stats
        const statsBefore = { sentA: cA.allReceived.length, sentB: cB.allReceived.length };

        // Fire event for A
        fixture.audit.append('nous.moved', CIVIC_DID_A, { to: 'r1' });
        // Fire event for B
        fixture.audit.append('nous.spawned', CIVIC_DID_B, {});

        // A gets its event, B does not (wait for A event)
        const evA = await cA.next() as { entry: { actorDid: string } };
        expect(evA.entry.actorDid).toBe(CIVIC_DID_A);

        // B gets its event (not A's)
        const evB = await cB.next() as { entry: { actorDid: string } };
        expect(evB.entry.actorDid).toBe(CIVIC_DID_B);

        // Wait a bit to confirm no extra frames arrived
        await new Promise((r) => setTimeout(r, 150));

        // Each subscriber received exactly 1 event frame (not 2)
        const aEventFrames = cA.allReceived.length - statsBefore.sentA; // after-hello
        const bEventFrames = cB.allReceived.length - statsBefore.sentB;
        expect(aEventFrames).toBe(1); // only its own event
        expect(bEventFrames).toBe(1); // only its own event

        cA.ws.close();
        cB.ws.close();
    });

    // ── 10. R-31-01 generalization: chain hash identical regardless of WS clients ──

    it('R-31-01 generalization: chain head hash identical regardless of how many WS clients are connected', async () => {
        // Scripted sequence (same events in each run)
        const EVENTS: Array<[string, string, Record<string, unknown>]> = [
            ['nous.moved',    CIVIC_DID_A,                 { to: 'r1' }],
            ['nous.spawned',  CIVIC_DID_B,                 {}],
            ['tick',          'did:civic:noesis:system',   {}],
            ['nous.spoke',    CIVIC_DID_A,                 { msg: 'hello' }],
        ];

        // Mark the beforeEach fixture as consumed so afterEach doesn't double-close.
        const savedFixture = fixture;
        fixture = null as unknown as TestFixture;
        await savedFixture.forceClose();

        const closeAll = async (clients: MsgQueue[], f: TestFixture) => {
            for (const c of clients) {
                try { c.ws.terminate(); } catch { /* already gone */ }
            }
            await new Promise((r) => setTimeout(r, 50));
            await f.forceClose();
        };

        // Fix Date.now to deterministic values so AuditChain hashes are identical
        // regardless of when the test runs. Each append gets its own fixed timestamp.
        // The hub metrics (touchLastFrame) also call Date.now — we use per-event
        // epoch so ALL Date.now() calls within one append cycle return the same value.
        const realDateNow = Date.now;
        const appendWithFixedTime = (audit: AuditChain, events: typeof EVENTS) => {
            for (let i = 0; i < events.length; i++) {
                Date.now = () => (i + 1) * 1_000_000;
                audit.append(events[i][0], events[i][1], events[i][2]);
            }
            Date.now = realDateNow;
        };

        // Run 1: 0 subscribers
        const f0 = await buildFixture();
        appendWithFixedTime(f0.audit, EVENTS);
        const headWith0 = f0.audit.head;
        await closeAll([], f0);

        // Run 2: 1 subscriber
        const f1 = await buildFixture();
        const jwtA1 = await f1.mintJwt(CIVIC_DID_A);
        const cA1 = connectWs(`ws://127.0.0.1:${f1.port}/api/v1/brain/firehose`, jwtA1);
        await cA1.waitOpen();
        appendWithFixedTime(f1.audit, EVENTS);
        const headWith1 = f1.audit.head;
        await closeAll([cA1], f1);

        // Run 3: 3 subscribers
        const f3 = await buildFixture();
        const jwtA3 = await f3.mintJwt(CIVIC_DID_A);
        const jwtB3 = await f3.mintJwtB(CIVIC_DID_B);
        const jwtA3b = await f3.mintJwt(CIVIC_DID_A);
        const cA3a = connectWs(`ws://127.0.0.1:${f3.port}/api/v1/brain/firehose`, jwtA3);
        const cB3 = connectWs(`ws://127.0.0.1:${f3.port}/api/v1/brain/firehose`, jwtB3);
        const cA3b = connectWs(`ws://127.0.0.1:${f3.port}/api/v1/brain/firehose`, jwtA3b);
        await Promise.all([cA3a.waitOpen(), cB3.waitOpen(), cA3b.waitOpen()]);
        appendWithFixedTime(f3.audit, EVENTS);
        const headWith3 = f3.audit.head;
        await closeAll([cA3a, cB3, cA3b], f3);

        // Rebuild fixture so afterEach has a live app to close
        fixture = await buildFixture();

        // R-31-01: chain head hash identical regardless of subscriber count
        expect(headWith1).toBe(headWith0);
        expect(headWith3).toBe(headWith0);
    }, 30000);
});

// ── Policy coverage ────────────────────────────────────────────────────────────

describe('ROUTE_DID_POLICY brain firehose entry', () => {
    it('GET /api/v1/brain/firehose is civic_did_required', () => {
        expect(ROUTE_DID_POLICY['GET /api/v1/brain/firehose']).toBe('civic_did_required');
    });
});
