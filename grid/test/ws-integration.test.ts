/**
 * WS integration tests — spin up a real Fastify server on an ephemeral port,
 * open real `ws` clients, and exercise the full /ws/events contract:
 *
 *   1. Hello frame on connect
 *   2. Live event after audit.append
 *   3. Non-allowlisted event dropped
 *   4. Topic filter subscribe narrows the stream
 *   5. Two concurrent clients each see the same event
 *   6. app.close() delivers Bye + 1001
 *   7. GRID_WS_SECRET gates the upgrade
 *   8. 10,000 connect/disconnect cycles leave clientCount at 0 (M8 leak guard)
 *   9. Reconnect with sinceId receives replay (ROADMAP Phase 2 SC#5, §C6)
 *
 * The dropped-frame-on-overflow scenario is covered by the unit suite
 * (grid/test/ws-hub.test.ts) because a real OS socket drains too quickly
 * to reliably hold the watermark for the test window. We rely on the unit
 * coverage there and keep this suite focused on transport-level invariants.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServerWithHub } from '../src/api/server.js';
import { WorldClock } from '../src/clock/ticker.js';
import { SpatialMap } from '../src/space/map.js';
import { LogosEngine } from '../src/logos/engine.js';
import { AuditChain } from '../src/audit/chain.js';
import { WebSocket as WsClient } from 'ws';
import type { FastifyInstance } from 'fastify';
import type { WsHub } from '../src/api/ws-hub.js';

/**
 * A wrapper around a WsClient that queues incoming messages from the moment
 * the socket is constructed — so callers can await the next frame without
 * racing the message listener against the `open` event.
 */
interface MsgQueue {
    ws: WsClient;
    next(timeoutMs?: number): Promise<any>;
    allReceived: any[];
    waitOpen(timeoutMs?: number): Promise<void>;
    waitClose(timeoutMs?: number): Promise<{ code: number; reason: string }>;
}

function connect(url: string): MsgQueue {
    const ws = new WsClient(url);
    const queue: any[] = [];
    const waiters: Array<(v: any) => void> = [];
    const allReceived: any[] = [];
    ws.on('message', (buf) => {
        const parsed = JSON.parse(buf.toString());
        allReceived.push(parsed);
        const w = waiters.shift();
        if (w) w(parsed);
        else queue.push(parsed);
    });
    return {
        ws,
        allReceived,
        next(timeoutMs = 1500): Promise<any> {
            return new Promise((resolve, reject) => {
                if (queue.length > 0) {
                    resolve(queue.shift());
                    return;
                }
                const t = setTimeout(() => {
                    const idx = waiters.indexOf(resolve);
                    if (idx >= 0) waiters.splice(idx, 1);
                    reject(new Error('message timeout'));
                }, timeoutMs);
                waiters.push((v) => {
                    clearTimeout(t);
                    resolve(v);
                });
            });
        },
        waitOpen(timeoutMs = 2000): Promise<void> {
            return new Promise((resolve, reject) => {
                if (ws.readyState === WsClient.OPEN) {
                    resolve();
                    return;
                }
                const t = setTimeout(() => reject(new Error('open timeout')), timeoutMs);
                ws.once('open', () => {
                    clearTimeout(t);
                    resolve();
                });
                ws.once('error', (e) => {
                    clearTimeout(t);
                    reject(e);
                });
            });
        },
        waitClose(timeoutMs = 3000): Promise<{ code: number; reason: string }> {
            return new Promise((resolve, reject) => {
                const t = setTimeout(() => reject(new Error('close timeout')), timeoutMs);
                ws.once('close', (code, reason) => {
                    clearTimeout(t);
                    resolve({ code, reason: reason.toString() });
                });
            });
        },
    };
}

describe('WS integration', () => {
    let app: FastifyInstance;
    let wsHub: WsHub;
    let audit: AuditChain;
    let clock: WorldClock;
    let port: number;

    async function setup(): Promise<void> {
        clock = new WorldClock({ tickRateMs: 100_000 });
        const space = new SpatialMap();
        const logos = new LogosEngine();
        audit = new AuditChain();
        const services = { clock, space, logos, audit, gridName: 'itest-grid' };
        const built = buildServerWithHub(services);
        app = built.app;
        wsHub = built.wsHub;
        await app.listen({ port: 0, host: '127.0.0.1' });
        const addr = app.server.address();
        if (!addr || typeof addr === 'string') throw new Error('no port bound');
        port = addr.port;
    }

    beforeEach(async () => {
        await setup();
    });

    afterEach(async () => {
        delete process.env.GRID_WS_SECRET;
        try {
            await app.close();
        } catch {
            /* swallow */
        }
        try {
            clock.stop();
        } catch {
            /* swallow */
        }
    });

    it('ws client connects and receives HelloFrame', async () => {
        const c = connect(`ws://127.0.0.1:${port}/ws/events`);
        await c.waitOpen();
        const hello = await c.next();
        expect(hello.type).toBe('hello');
        expect(hello.gridName).toBe('itest-grid');
        expect(typeof hello.lastEntryId).toBe('number');
        expect(typeof hello.serverTime).toBe('number');
        c.ws.close();
    });

    it('live event after audit.append arrives on connected client', async () => {
        const c = connect(`ws://127.0.0.1:${port}/ws/events`);
        await c.waitOpen();
        await c.next(); // hello

        audit.append('nous.moved', 'did:key:alice', { to: 'market' });
        const ev = await c.next();
        expect(ev.type).toBe('event');
        expect(ev.entry.eventType).toBe('nous.moved');
        expect(ev.entry.id).toBeGreaterThan(0);
        c.ws.close();
    });

    it('non-allowlisted event does NOT arrive', async () => {
        const c = connect(`ws://127.0.0.1:${port}/ws/events`);
        await c.waitOpen();
        await c.next(); // hello

        audit.append('reflection.completed', 'x', { foo: 1 });
        await new Promise((r) => setTimeout(r, 300));
        // No message should have arrived beyond the hello.
        expect(c.allReceived.length).toBe(1);
        c.ws.close();
    });

    it('subscribe filter narrows the stream to nous.*', async () => {
        const c = connect(`ws://127.0.0.1:${port}/ws/events`);
        await c.waitOpen();
        await c.next(); // hello

        c.ws.send(JSON.stringify({ type: 'subscribe', filters: ['nous.*'] }));
        await new Promise((r) => setTimeout(r, 100)); // let server install filter

        audit.append('nous.moved', 'a', { to: 'x' });
        audit.append('trade.settled', 'b', {});
        await new Promise((r) => setTimeout(r, 300));

        const eventTypes = c.allReceived
            .filter((f) => f.type === 'event')
            .map((f) => f.entry.eventType);
        expect(eventTypes).toContain('nous.moved');
        expect(eventTypes).not.toContain('trade.settled');
        c.ws.close();
    });

    it('two concurrent clients receive the same event', async () => {
        const a = connect(`ws://127.0.0.1:${port}/ws/events`);
        const b = connect(`ws://127.0.0.1:${port}/ws/events`);
        await Promise.all([a.waitOpen(), b.waitOpen()]);
        await Promise.all([a.next(), b.next()]); // hellos

        audit.append('tick', 'g', { n: 1 });
        const [evA, evB] = await Promise.all([a.next(), b.next()]);
        expect(evA.type).toBe('event');
        expect(evB.type).toBe('event');
        expect(evA.entry.id).toBe(evB.entry.id);
        a.ws.close();
        b.ws.close();
    });

    it('wsHub.close() sends ByeFrame and closes ws with code 1001', async () => {
        // Graceful shutdown contract: callers must drain the hub BEFORE
        // stopping the HTTP server. @fastify/websocket moves sockets into
        // CLOSING state during its own plugin teardown, so if we relied on
        // app.close() alone the ByeFrame would be written into an already-
        // closing socket and dropped on the floor (see preClose hook comment
        // in server.ts). The test exercises the drain contract directly.
        const c = connect(`ws://127.0.0.1:${port}/ws/events`);
        await c.waitOpen();
        await c.next(); // hello

        const closePromise = c.waitClose(3000);
        await wsHub.close();
        const closeInfo = await closePromise;

        expect(c.allReceived.some((f) => f.type === 'bye')).toBe(true);
        expect(closeInfo.code).toBe(1001);
    });

    it('GRID_WS_SECRET env gates the upgrade', async () => {
        delete process.env.GRID_WS_SECRET;
        await app.close();
        process.env.GRID_WS_SECRET = 'secret-xyz';
        await setup();

        // Attempt WITHOUT token — server should close the socket.
        const wrong = connect(`ws://127.0.0.1:${port}/ws/events`);
        const wrongClose = wrong.waitClose(2000);
        try {
            await wrong.waitOpen(2000);
        } catch {
            /* upgrade rejection is also acceptable */
        }
        const info = await wrongClose;
        expect([1008, 1006, 1005]).toContain(info.code);

        // Attempt WITH correct token — hello arrives normally.
        const ok = connect(`ws://127.0.0.1:${port}/ws/events?token=secret-xyz`);
        await ok.waitOpen();
        const hello = await ok.next();
        expect(hello.type).toBe('hello');
        ok.ws.close();
    });

    it('10_000 connect/disconnect cycles leave hub.clientCount === 0', async () => {
        const N = 10_000;
        for (let i = 0; i < N; i++) {
            const ws = new WsClient(`ws://127.0.0.1:${port}/ws/events`);
            await new Promise<void>((resolve, reject) => {
                const to = setTimeout(() => reject(new Error('open timeout')), 2000);
                ws.once('open', () => {
                    clearTimeout(to);
                    ws.close();
                    resolve();
                });
                ws.once('error', (e) => {
                    clearTimeout(to);
                    reject(e);
                });
            });
        }
        // Give close events a moment to propagate.
        await new Promise((r) => setTimeout(r, 500));
        expect(wsHub.clientCount).toBe(0);
    }, 120_000);

    // ── ROADMAP Phase 2 Success Criterion #5 + PITFALLS §C6 ──────────────────
    it('reconnect with lastSeenId receives replay', async () => {
        // Phase A: first connection sees 3 live events.
        const a = connect(`ws://127.0.0.1:${port}/ws/events`);
        await a.waitOpen();
        await a.next(); // hello

        const firstIds: number[] = [];
        for (let i = 0; i < 3; i++) {
            const pending = a.next(1000);
            audit.append('tick', 'g', { n: i });
            const ev = await pending;
            expect(ev.type).toBe('event');
            firstIds.push(ev.entry.id);
        }
        const lastSeenId = firstIds[firstIds.length - 1];
        expect(lastSeenId).toBeGreaterThan(0);

        a.ws.close();
        await new Promise((r) => setTimeout(r, 150));
        expect(wsHub.clientCount).toBe(0);

        // Append two "missed" events while disconnected.
        audit.append('tick', 'g', { n: 'missed-1' });
        audit.append('tick', 'g', { n: 'missed-2' });

        // Phase B: reconnect with sinceId, expect replay before live.
        const b = connect(`ws://127.0.0.1:${port}/ws/events`);
        await b.waitOpen();
        await b.next(); // hello

        b.ws.send(JSON.stringify({ type: 'subscribe', sinceId: lastSeenId }));

        // Give replay a moment, then append one live event.
        await new Promise((r) => setTimeout(r, 150));
        audit.append('tick', 'g', { n: 'live-after-replay' });

        // Collect up to 3 frames (or time out at 2s).
        const deadline = Date.now() + 2000;
        while (
            b.allReceived.filter((f) => f.type === 'event' || f.type === 'dropped').length < 3 &&
            Date.now() < deadline
        ) {
            await new Promise((r) => setTimeout(r, 50));
        }

        const events = b.allReceived.filter((f) => f.type === 'event');
        const dropped = b.allReceived.filter((f) => f.type === 'dropped');
        expect(dropped.length).toBe(0);
        expect(events.length).toBeGreaterThanOrEqual(3);

        const missedPayloads = events.slice(0, 2).map((e) => e.entry.payload.n);
        expect(missedPayloads).toEqual(['missed-1', 'missed-2']);
        expect(events[0].entry.id).toBe(lastSeenId + 1);
        expect(events[1].entry.id).toBe(lastSeenId + 2);
        expect(events[2].entry.payload.n).toBe('live-after-replay');
        expect(events[2].entry.id).toBe(lastSeenId + 3);

        b.ws.close();
        await new Promise((r) => setTimeout(r, 50));
    });
});
