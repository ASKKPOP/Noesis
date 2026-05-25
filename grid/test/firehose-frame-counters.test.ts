/**
 * Phase 32 OBS-05 frame-counter regression test (D-32-A1, D-32-A2, D-32-A3, D-32-A4).
 *
 * Coverage:
 *  - All-zeros sentinel for a fresh hub (no clients, no sends, no drops).
 *  - frames_sent_total + last_frame_at increment after successful socket.send.
 *  - frames_dropped_total increments when ring buffer is at capacity in enqueue().
 *  - Pitfall 3: tryDrain re-queue path does NOT increment frames_dropped_total.
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

describe('WsFirehoseHub.stats() — frame counters (D-32-A1/A2/A3/A4)', () => {
    it('returns all-zeros sentinel for a fresh hub with no clients', () => {
        const audit = new AuditChain();
        const hub = new WsFirehoseHub(audit, 'test-grid');
        const s = hub.stats();
        expect(s.client_count).toBe(0);
        expect(s.frames_sent_total).toBe(0);
        expect(s.frames_dropped_total).toBe(0);
        expect(s.last_frame_at).toBeNull();
        expect(s.watermark_bytes).toBe(1_048_576); // DEFAULT_WATERMARK_BYTES
    });

    it('frames_sent_total + last_frame_at increment on successful socket.send', async () => {
        const audit = new AuditChain();
        const hub = new WsFirehoseHub(audit, 'test-grid');
        const sock = new FakeSocket();
        const before = Date.now();
        hub.onConnect(sock);
        // hello frame is sent directly via socket.send in onConnect, NOT via trySend,
        // so frames_sent_total starts at 0 until the first trySend call.
        expect(hub.stats().frames_sent_total).toBe(0);
        expect(hub.stats().last_frame_at).toBeNull();

        audit.append('nous.moved', 'did:noesis:actor', { to: 'r1' });
        await flush();
        const afterEvent = hub.stats();
        expect(afterEvent.frames_sent_total).toBe(1);
        expect(afterEvent.client_count).toBe(1);
        expect(afterEvent.last_frame_at).not.toBeNull();
        expect(afterEvent.last_frame_at!).toBeGreaterThanOrEqual(before);
    });

    it('frames_dropped_total increments when ring buffer is at capacity in enqueue', async () => {
        const audit = new AuditChain();
        const hub = new WsFirehoseHub(audit, 'test-grid', 4, 1_000); // capacity 4, watermark 1KB
        const sock = new FakeSocket();
        sock.bufferedAmount = 2_000; // above watermark — forces buffering, no direct send
        hub.onConnect(sock);

        // Fill buffer to capacity (4 entries) — no drops yet.
        for (let i = 0; i < 4; i++) {
            audit.append('nous.moved', 'did:noesis:actor', { to: `r${i}` });
        }
        expect(hub.stats().frames_dropped_total).toBe(0);

        // 5th entry triggers the size===capacity pre-check → drop +1.
        audit.append('nous.moved', 'did:noesis:actor', { to: 'r5' });
        expect(hub.stats().frames_dropped_total).toBe(1);

        // 6th and 7th entries continue to drop.
        audit.append('nous.moved', 'did:noesis:actor', { to: 'r6' });
        audit.append('nous.moved', 'did:noesis:actor', { to: 'r7' });
        expect(hub.stats().frames_dropped_total).toBe(3);
    });

    it('Pitfall 3: tryDrain re-queue path does NOT increment frames_dropped_total', async () => {
        const audit = new AuditChain();
        const hub = new WsFirehoseHub(audit, 'test-grid', 4, 1_000);
        const sock = new FakeSocket();
        sock.bufferedAmount = 2_000; // above watermark for the whole test
        hub.onConnect(sock);

        // Fill to capacity then overflow once — drop counter = 1.
        for (let i = 0; i < 5; i++) {
            audit.append('nous.moved', 'did:noesis:actor', { to: `r${i}` });
        }
        const dropAfterFirstOverflow = hub.stats().frames_dropped_total;
        expect(dropAfterFirstOverflow).toBe(1);

        // Trigger several microtask drain cycles — bufferedAmount stays above
        // watermark, so tryDrain's `for (; i < items.length; i++) buffer.push(items[i])`
        // re-queue path runs. Pitfall 3 says THIS push MUST NOT increment dropped.
        for (let cycle = 0; cycle < 5; cycle++) {
            await flush();
        }
        // Drop counter must remain pinned at the original enqueue-side drop count.
        expect(hub.stats().frames_dropped_total).toBe(dropAfterFirstOverflow);
    });
});
