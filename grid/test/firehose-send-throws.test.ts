/**
 * Phase 32 OBS-05 R-32-03 regression test (D-32-A3 + Pitfall 3 from RESEARCH.md).
 *
 * Pins the placement contract: frames_sent_total++ MUST happen AFTER socket.send
 * succeeds and BEFORE the catch. A socket.send-throwing client never increments
 * the counter. Hub does not panic. Other clients keep receiving.
 *
 * If a future refactor moves the increment BEFORE socket.send (or outside the
 * try/catch entirely), Test 1 and Test 2 here fail RED.
 *
 * NOTE: The hello frame (sent in onConnect via direct socket.send, not via
 * ClientConnection.trySend) does NOT increment frames_sent_total. Only
 * ClientConnection.trySend increments the counter (D-32-A3). This is confirmed
 * in 32-01-SUMMARY.md "decisions" section.
 */

import { describe, it, expect } from 'vitest';
import { AuditChain } from '../src/audit/chain.js';
import { WsFirehoseHub } from '../src/audit/firehose-hub.js';
import type { ServerSocket } from '../src/api/ws-hub.js';

type EventName = 'message' | 'close' | 'error';

class FakeSocket implements ServerSocket {
    bufferedAmount = 0;
    sent: string[] = [];
    closed = false;
    closeArgs: { code?: number; reason?: string } | null = null;
    throwOnSend = false;
    private listeners: Partial<Record<EventName, (...args: unknown[]) => void>> = {};

    send(data: string): void {
        if (this.throwOnSend) throw new Error('send failed');
        this.sent.push(data);
    }
    close(code?: number, reason?: string): void {
        this.closed = true;
        this.closeArgs = { code, reason };
    }
    on(event: EventName, cb: (...args: unknown[]) => void): void {
        this.listeners[event] = cb;
    }
    emit(event: 'close'): void {
        this.listeners[event]?.();
    }
}

const flush = () => new Promise<void>((r) => queueMicrotask(() => r()));

describe('WsFirehoseHub R-32-03 send-throws regression (D-32-A3)', () => {
    it('frames_sent_total stays 0 when single client.socket.send always throws', async () => {
        const audit = new AuditChain();
        const hub = new WsFirehoseHub(audit, 'test-grid');
        const badSock = new FakeSocket();
        badSock.throwOnSend = true;
        // onConnect directly calls socket.send for hello (not via trySend) — throws but
        // hub must not propagate. frames_sent_total stays 0 (hello path does not count).
        expect(() => hub.onConnect(badSock)).not.toThrow();
        expect(hub.stats().frames_sent_total).toBe(0); // hello threw → no increment

        // Append an allowlisted event — broadcast attempt throws inside trySend, swallowed.
        expect(() => audit.append('nous.moved', 'did:noesis:actor', { to: 'r' })).not.toThrow();
        await flush();
        expect(hub.stats().frames_sent_total).toBe(0);
    });

    it('other clients continue receiving when one throws — counter reflects only successful sends', async () => {
        const audit = new AuditChain();
        const hub = new WsFirehoseHub(audit, 'test-grid');
        const badSock = new FakeSocket();
        badSock.throwOnSend = true;
        const goodSock = new FakeSocket();

        // onConnect sends hello via direct socket.send (NOT trySend) — no counter increment.
        hub.onConnect(badSock);  // bad hello throws → counter 0; hello path not counted
        hub.onConnect(goodSock); // good hello succeeds via direct socket.send → counter still 0

        // Hello is not routed through trySend, so frames_sent_total stays 0 after connects.
        expect(hub.stats().frames_sent_total).toBe(0);
        expect(goodSock.sent.length).toBe(1); // hello received

        const goodSentBefore = goodSock.sent.length;
        audit.append('nous.moved', 'did:noesis:actor', { to: 'r' });
        await flush();

        // good client received the event via trySend; bad client did NOT (trySend threw)
        expect(goodSock.sent.length).toBe(goodSentBefore + 1);
        expect(badSock.sent.length).toBe(0); // throwOnSend means sent[] never populated

        // counter = 1 (good event via trySend); bad client contributed 0; hellos not counted
        expect(hub.stats().frames_sent_total).toBe(1);
        expect(hub.stats().client_count).toBe(2);
    });

    it('hub survives 50 sequential events to a single throwing client without panic', async () => {
        const audit = new AuditChain();
        const hub = new WsFirehoseHub(audit, 'test-grid');
        const badSock = new FakeSocket();
        badSock.throwOnSend = true;
        hub.onConnect(badSock);

        for (let i = 0; i < 50; i++) {
            expect(() => audit.append('nous.moved', 'did:noesis:actor', { to: `r${i}` })).not.toThrow();
        }
        await flush();

        expect(hub.stats().frames_sent_total).toBe(0);
        expect(hub.stats().client_count).toBe(1); // bad client still in the set (close event never fired)
    });
});
