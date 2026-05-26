/**
 * Integration tests for GET /api/v1/audit/firehose WebSocket endpoint.
 *
 * Verified invariants:
 *  1. Receives HelloFrame on connect (type='hello', no lastEntryId field)
 *  2. Allowlisted entry appended → client receives it
 *  3. Non-allowlisted entry appended → client does NOT receive it
 *  4. GRID_WS_SECRET set + missing token → close 1008
 *  5. GRID_WS_SECRET set + correct token via ?token= → connects successfully
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServerWithHub } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { WebSocket as WsClient } from 'ws';
import type { FastifyInstance } from 'fastify';

interface MsgQueue {
    ws: WsClient;
    next(timeoutMs?: number): Promise<any>;
    allReceived: any[];
    waitOpen(timeoutMs?: number): Promise<void>;
    waitClose(timeoutMs?: number): Promise<{ code: number; reason: string }>;
}

function connectWs(url: string): MsgQueue {
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
                ws.once('open', () => { clearTimeout(t); resolve(); });
                ws.once('error', (e) => { clearTimeout(t); reject(e); });
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

describe('GET /api/v1/audit/firehose (WebSocket)', () => {
    let app: FastifyInstance;
    let audit: AuditChain;
    let clock: WorldClock;
    let port: number;

    beforeEach(async () => {
        clock = new WorldClock({ tickRateMs: 100_000 });
        const space = new SpatialMap();
        const logos = new LogosEngine();
        audit = new AuditChain();
        const built = buildServerWithHub({ clock, space, logos, audit, gridName: 'firehose-test' });
        app = built.app;
        await app.listen({ port: 0, host: '127.0.0.1' });
        const addr = app.server.address();
        if (!addr || typeof addr === 'string') throw new Error('no port bound');
        port = addr.port;
    });

    afterEach(async () => {
        delete process.env.GRID_WS_SECRET;
        try { await app.close(); } catch { /* swallow */ }
        try { clock.stop(); } catch { /* swallow */ }
    });

    it('receives HelloFrame on connect with type=hello and gridName', async () => {
        const c = connectWs(`ws://127.0.0.1:${port}/api/v1/audit/firehose`);
        await c.waitOpen();
        const hello = await c.next();
        expect(hello.type).toBe('hello');
        expect(hello.gridName).toBe('firehose-test');
        expect(typeof hello.serverTime).toBe('number');
        // firehose is density-first — no lastEntryId replay field
        expect(hello.lastEntryId).toBeUndefined();
        c.ws.close();
    });

    it('allowlisted entry after connect is received by client', async () => {
        const c = connectWs(`ws://127.0.0.1:${port}/api/v1/audit/firehose`);
        await c.waitOpen();
        await c.next(); // hello

        audit.append('nous.moved', 'did:noesis:alice', { to: 'regionB' });
        const ev = await c.next();
        expect(ev.type).toBe('event');
        // Phase 36 VIS-03: anonymous WS clients receive visitor-redacted frames
        // with event_type (snake_case) and family only — actorDid and payload stripped.
        expect(ev.entry.event_type).toBe('nous.moved');
        expect(ev.entry.family).toBe('nous');
        expect(ev.entry).not.toHaveProperty('actorDid');
        expect(ev.entry).not.toHaveProperty('payload');
        c.ws.close();
    });

    it('non-allowlisted entry is NOT forwarded to client', async () => {
        const c = connectWs(`ws://127.0.0.1:${port}/api/v1/audit/firehose`);
        await c.waitOpen();
        await c.next(); // hello

        audit.append('reflection.completed', 'did:noesis:alice', { secret: 'data' });
        await new Promise((r) => setTimeout(r, 300));
        // Only hello received, no event frame
        expect(c.allReceived.length).toBe(1);
        c.ws.close();
    });

    it('GRID_WS_SECRET set + missing token → close 1008', async () => {
        process.env.GRID_WS_SECRET = 'test-secret-xyz';
        const c = connectWs(`ws://127.0.0.1:${port}/api/v1/audit/firehose`);
        const { code } = await c.waitClose();
        expect(code).toBe(1008);
    });

    it('GRID_WS_SECRET set + correct ?token= → connects and receives hello', async () => {
        process.env.GRID_WS_SECRET = 'test-secret-xyz';
        const c = connectWs(`ws://127.0.0.1:${port}/api/v1/audit/firehose?token=test-secret-xyz`);
        await c.waitOpen();
        const hello = await c.next();
        expect(hello.type).toBe('hello');
        c.ws.close();
    });
});
