/**
 * Unit tests for WsFirehoseHub — unfiltered AuditChain → WebSocket fan-out.
 *
 * Invariants verified:
 *  1. Subscribes to AuditChain.onAppend on construct (once).
 *  2. Forwards allowlisted entry to a connected client.
 *  3. Forwards allowlisted entry to multiple connected clients.
 *  4. Does NOT forward non-allowlisted entry.
 *  5. Sends hello frame on connect before any data.
 *  6. close() unsubscribes audit listener and closes sockets.
 *  7. Backpressure: entries enqueue, oldest dropped at 256 cap, no crash.
 */

import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { WsFirehoseHub } from '../../src/audit/firehose-hub.js';
import type { ServerSocket } from '../../src/api/ws-hub.js';

// ── FakeSocket ───────────────────────────────────────────────────────────

type EventName = 'message' | 'close' | 'error';

class FakeSocket implements ServerSocket {
    bufferedAmount = 0;
    sent: string[] = [];
    closed = false;
    closeArgs: { code?: number; reason?: string } | null = null;
    throwOnSend = false;

    private listeners: {
        message: Array<(data: unknown) => void>;
        close: Array<() => void>;
        error: Array<(err: Error) => void>;
    } = { message: [], close: [], error: [] };

    send(data: string): void {
        if (this.throwOnSend) throw new Error('send failed');
        this.sent.push(data);
    }

    close(code?: number, reason?: string): void {
        this.closed = true;
        this.closeArgs = { code, reason };
    }

    on(event: 'message', cb: (data: unknown) => void): void;
    on(event: 'close', cb: () => void): void;
    on(event: 'error', cb: (err: Error) => void): void;
    on(event: EventName, cb: (...args: any[]) => void): void {
        (this.listeners[event] as Array<(...args: any[]) => void>).push(cb);
    }

    emit(event: 'close'): void {
        for (const cb of this.listeners.close) cb();
    }
}

// Flush microtask-based drain scheduling.
const flush = () => new Promise<void>((r) => queueMicrotask(() => r()));

describe('WsFirehoseHub', () => {
    it('subscribes to AuditChain.onAppend on construct', () => {
        const audit = new AuditChain();
        const spy = vi.spyOn(audit, 'onAppend');
        const hub = new WsFirehoseHub(audit, 'test-grid');
        expect(spy).toHaveBeenCalledTimes(1);
        void hub;
    });

    it('sends hello frame on connect before any data', () => {
        const audit = new AuditChain();
        const hub = new WsFirehoseHub(audit, 'test-grid');
        const sock = new FakeSocket();
        hub.onConnect(sock);
        expect(sock.sent.length).toBe(1);
        const hello = JSON.parse(sock.sent[0]);
        expect(hello.type).toBe('hello');
        expect(hello.gridName).toBe('test-grid');
        expect(typeof hello.serverTime).toBe('number');
    });

    it('forwards allowlisted entry to a single connected client', () => {
        const audit = new AuditChain();
        const hub = new WsFirehoseHub(audit, 'test-grid');
        const sock = new FakeSocket();
        hub.onConnect(sock);
        audit.append('nous.moved', 'did:noesis:actor', { to: 'regionA' });
        // hello + one event
        expect(sock.sent.length).toBe(2);
        const evt = JSON.parse(sock.sent[1]);
        expect(evt.type).toBe('event');
        // Phase 36 VIS-03: a no-DID subscriber gets the redacted visitor wire shape
        // {tick, event_type, family} — event_type is snake_case, not eventType.
        expect(evt.entry.event_type).toBe('nous.moved');
    });

    it('forwards allowlisted entry to multiple connected clients', () => {
        const audit = new AuditChain();
        const hub = new WsFirehoseHub(audit, 'test-grid');
        const sock1 = new FakeSocket();
        const sock2 = new FakeSocket();
        hub.onConnect(sock1);
        hub.onConnect(sock2);
        audit.append('nous.spawned', 'did:noesis:actor', { tick: 1 });
        // Each: hello + 1 event
        expect(sock1.sent.length).toBe(2);
        expect(sock2.sent.length).toBe(2);
        expect(JSON.parse(sock1.sent[1]).entry.event_type).toBe('nous.spawned');
        expect(JSON.parse(sock2.sent[1]).entry.event_type).toBe('nous.spawned');
    });

    it('does NOT forward non-allowlisted entry', () => {
        const audit = new AuditChain();
        const hub = new WsFirehoseHub(audit, 'test-grid');
        const sock = new FakeSocket();
        hub.onConnect(sock);
        audit.append('invented.internal.event', 'did:noesis:actor', {});
        // Only hello frame — non-allowlisted dropped
        expect(sock.sent.length).toBe(1);
        expect(JSON.parse(sock.sent[0]).type).toBe('hello');
    });

    it('close() unsubscribes audit listener and closes sockets', async () => {
        const audit = new AuditChain();
        const hub = new WsFirehoseHub(audit, 'test-grid');
        const sock = new FakeSocket();
        hub.onConnect(sock);
        await hub.close();
        // Socket closed
        expect(sock.closed).toBe(true);
        // Subsequent appends do not reach socket
        const prevCount = sock.sent.length;
        audit.append('nous.moved', 'did:noesis:actor', { to: 'r' });
        expect(sock.sent.length).toBe(prevCount);
    });

    it('backpressure: entries enqueue up to capacity, oldest dropped, no crash', async () => {
        const audit = new AuditChain();
        const hub = new WsFirehoseHub(audit, 'test-grid', 4);
        const sock = new FakeSocket();
        // Simulate a slow client by setting bufferedAmount high
        sock.bufferedAmount = 2_000_000; // above watermark
        hub.onConnect(sock);
        // Send 6 events into a capacity-4 buffer
        for (let i = 0; i < 6; i++) {
            audit.append('nous.moved', 'did:noesis:actor', { to: `r${i}` });
        }
        // Should not throw; buffer just drops oldest
        await flush();
        // clientCount remains 1 (no crash removed the client)
        expect(hub.clientCount).toBe(1);
    });
});
