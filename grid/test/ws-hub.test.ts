import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditChain } from '../src/audit/chain.js';
import { WsHub, globMatch, REPLAY_WINDOW, type ServerSocket } from '../src/api/ws-hub.js';

// ── FakeSocket: a minimal ServerSocket double, no real network ──────────

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
        // Each listener list is typed to its callback shape; runtime is untyped.
        (this.listeners[event] as Array<(...args: any[]) => void>).push(cb);
    }

    emit(event: 'message', data: unknown): void;
    emit(event: 'close'): void;
    emit(event: 'error', err: Error): void;
    emit(event: EventName, arg?: unknown): void {
        for (const cb of this.listeners[event]) {
            (cb as (...args: any[]) => void)(arg);
        }
    }
}

function setup(opts?: { bufferCapacity?: number; watermarkBytes?: number }) {
    const audit = new AuditChain();
    const hub = new WsHub({
        audit,
        gridName: 'test-grid',
        bufferCapacity: opts?.bufferCapacity,
        watermarkBytes: opts?.watermarkBytes,
    });
    return { audit, hub };
}

// Flush queueMicrotask-based drain scheduling.
const flush = () => new Promise<void>((r) => queueMicrotask(() => r()));

describe('WsHub', () => {
    it('construction subscribes to audit.onAppend exactly once', () => {
        const audit = new AuditChain();
        const spy = vi.spyOn(audit, 'onAppend');
        const hub = new WsHub({ audit, gridName: 'g' });
        expect(spy).toHaveBeenCalledTimes(1);
        void hub; // keep ref
    });

    it('onConnect sends a HelloFrame immediately', () => {
        const { hub, audit } = setup();
        // Seed so lastEntryId is non-zero.
        audit.append('tick', 'g', {});
        const sock = new FakeSocket();
        hub.onConnect(sock);
        expect(sock.sent.length).toBe(1);
        const hello = JSON.parse(sock.sent[0]);
        expect(hello).toMatchObject({
            type: 'hello',
            gridName: 'test-grid',
            lastEntryId: audit.length,
        });
        expect(typeof hello.serverTime).toBe('number');
    });

    it('allowlisted event reaches connected client', () => {
        const { hub, audit } = setup();
        const sock = new FakeSocket();
        hub.onConnect(sock);
        audit.append('nous.moved', 'actor-1', { to: 'regionA' });
        // hello + one event
        expect(sock.sent.length).toBe(2);
        const evt = JSON.parse(sock.sent[1]);
        expect(evt.type).toBe('event');
        expect(evt.entry.eventType).toBe('nous.moved');
    });

    it('non-allowlisted event is dropped silently', () => {
        const { hub, audit } = setup();
        const sock = new FakeSocket();
        hub.onConnect(sock);
        const before = sock.sent.length;
        audit.append('reflection.completed', 'actor-1', {});
        expect(sock.sent.length).toBe(before);
    });

    it("topic filter 'nous.*' admits nous.moved and rejects trade.settled", () => {
        const { hub, audit } = setup();
        const sock = new FakeSocket();
        hub.onConnect(sock);
        sock.emit('message', JSON.stringify({ type: 'subscribe', filters: ['nous.*'] }));
        const before = sock.sent.length;
        audit.append('nous.moved', 'a', {});
        audit.append('trade.settled', 'a', {});
        const after = sock.sent.slice(before).map((s) => JSON.parse(s));
        expect(after.length).toBe(1);
        expect(after[0].entry.eventType).toBe('nous.moved');
    });

    it('two clients with different filters receive disjoint streams', () => {
        const { hub, audit } = setup();
        const a = new FakeSocket();
        const b = new FakeSocket();
        hub.onConnect(a);
        hub.onConnect(b);
        a.emit('message', JSON.stringify({ type: 'subscribe', filters: ['nous.*'] }));
        b.emit('message', JSON.stringify({ type: 'subscribe', filters: ['trade.*'] }));
        const aBefore = a.sent.length;
        const bBefore = b.sent.length;
        audit.append('nous.moved', 'x', {});
        audit.append('trade.settled', 'x', {});
        const aNew = a.sent.slice(aBefore).map((s) => JSON.parse(s));
        const bNew = b.sent.slice(bBefore).map((s) => JSON.parse(s));
        expect(aNew.length).toBe(1);
        expect(aNew[0].entry.eventType).toBe('nous.moved');
        expect(bNew.length).toBe(1);
        expect(bNew[0].entry.eventType).toBe('trade.settled');
    });

    it('fast client: when bufferedAmount === 0, send happens synchronously during append', () => {
        const { hub, audit } = setup();
        const sock = new FakeSocket();
        hub.onConnect(sock);
        const before = sock.sent.length;
        audit.append('tick', 'g', {});
        // Immediately after append returns, send must have happened (no microtask wait).
        expect(sock.sent.length).toBe(before + 1);
    });

    it('slow client: high bufferedAmount causes enqueue without immediate send', () => {
        const { hub, audit } = setup({ watermarkBytes: 1000 });
        const sock = new FakeSocket();
        hub.onConnect(sock);
        const before = sock.sent.length;
        sock.bufferedAmount = 2000; // above watermark
        audit.append('tick', 'g', {});
        // No new send synchronously.
        expect(sock.sent.length).toBe(before);
    });

    it('ring-buffer overflow emits DroppedFrame with correct sinceId/latestId on drain', async () => {
        const { hub, audit } = setup({ bufferCapacity: 8, watermarkBytes: 1000 });
        const sock = new FakeSocket();
        hub.onConnect(sock);
        sock.bufferedAmount = 5000; // permanently backpressured during burst

        // Append 12 events; capacity 8 means ids 1..4 get evicted, 5..12 retained.
        for (let i = 0; i < 12; i++) {
            audit.append('tick', 'g', { i });
        }
        await flush();
        // Still backpressured — nothing drained yet (only hello).
        const duringBackpressure = sock.sent.length;
        expect(duringBackpressure).toBe(1);

        // Relieve backpressure + trigger drain via a final append.
        sock.bufferedAmount = 0;
        // Invoke drain manually by appending one more event; enqueue path
        // runs direct-send gate, which will push to buffer because droppedMin
        // is set, then schedule microtask drain.
        audit.append('tick', 'g', { i: 999 });
        await flush();

        const frames = sock.sent.slice(1).map((s) => JSON.parse(s));
        expect(frames.length).toBeGreaterThan(0);
        // First frame out must be the dropped summary.
        expect(frames[0].type).toBe('dropped');
        expect(frames[0].sinceId).toBe(1);
        // The 13th append also evicts id 5 (buffer was full at ids 5..12),
        // so droppedMax advances to 5 and the retained buffer is 6..13.
        expect(frames[0].latestId).toBe(5);
        const eventFrames = frames.slice(1);
        expect(eventFrames.every((f: any) => f.type === 'event')).toBe(true);
        expect(eventFrames.map((f: any) => f.entry.id)).toEqual([6, 7, 8, 9, 10, 11, 12, 13]);
    });

    it('disconnect removes client from hub.clientCount and stops delivery', () => {
        const { hub, audit } = setup();
        const sock = new FakeSocket();
        hub.onConnect(sock);
        expect(hub.clientCount).toBe(1);
        sock.emit('close');
        expect(hub.clientCount).toBe(0);
        const before = sock.sent.length;
        audit.append('tick', 'g', {});
        expect(sock.sent.length).toBe(before);
    });

    it('close() sends ByeFrame to all clients, calls socket.close(1001), and clears clients', async () => {
        const { hub } = setup();
        const socks = [new FakeSocket(), new FakeSocket(), new FakeSocket()];
        for (const s of socks) hub.onConnect(s);
        await hub.close();
        for (const s of socks) {
            const last = JSON.parse(s.sent[s.sent.length - 1]);
            expect(last).toEqual({ type: 'bye', reason: 'shutting down' });
            expect(s.closed).toBe(true);
            expect(s.closeArgs?.code).toBe(1001);
        }
        expect(hub.clientCount).toBe(0);
    });

    it('close() unsubscribes from audit — further appends do not trigger sends', async () => {
        const { hub, audit } = setup();
        const sock = new FakeSocket();
        hub.onConnect(sock);
        await hub.close();
        const before = sock.sent.length;
        // After close we cannot re-use the (already-closed) socket meaningfully,
        // but assert no *new* sends happen to it.
        audit.append('tick', 'g', {});
        expect(sock.sent.length).toBe(before);
    });

    it('throwing socket.send does not propagate out of append', () => {
        const { hub, audit } = setup();
        const sock = new FakeSocket();
        sock.throwOnSend = true;
        hub.onConnect(sock);
        const lenBefore = audit.length;
        expect(() => audit.append('nous.moved', 'a', {})).not.toThrow();
        expect(audit.length).toBe(lenBefore + 1);
    });

    it('malformed client frame is ignored silently', () => {
        const { hub, audit } = setup();
        const sock = new FakeSocket();
        hub.onConnect(sock);
        sock.emit('message', 'not json');
        // No throw, no close, filter state unchanged → allowlisted event still arrives.
        const before = sock.sent.length;
        audit.append('nous.moved', 'a', {});
        expect(sock.sent.length).toBe(before + 1);
        expect(sock.closed).toBe(false);
    });

    it('globMatch basic patterns', () => {
        expect(globMatch('nous.*', 'nous.moved')).toBe(true);
        expect(globMatch('nous.*', 'trade.settled')).toBe(false);
        expect(globMatch('tick', 'tick')).toBe(true);
        expect(globMatch('tick', 'nous.moved')).toBe(false);
        expect(globMatch('*', 'anything.here')).toBe(true);
    });

    // ── sinceId replay (Phase 2 SC#5 + PITFALLS §C6) ──────────────────

    it('subscribe with recent sinceId replays missed events', () => {
        const { hub, audit } = setup();
        for (let i = 0; i < 5; i++) audit.append('tick', 'g', { n: i });
        const sock = new FakeSocket();
        hub.onConnect(sock);
        const helloCount = sock.sent.length; // 1
        sock.emit('message', JSON.stringify({ type: 'subscribe', sinceId: 2 }));
        const replayed = sock.sent.slice(helloCount).map((s) => JSON.parse(s));
        expect(replayed.length).toBe(3);
        expect(replayed.every((f: any) => f.type === 'event')).toBe(true);
        expect(replayed.map((f: any) => f.entry.id)).toEqual([3, 4, 5]);
    });

    it('subscribe with stale sinceId emits DroppedFrame (gap > REPLAY_WINDOW)', () => {
        const { hub, audit } = setup();
        const N = REPLAY_WINDOW + 100; // 612
        for (let i = 0; i < N; i++) audit.append('tick', 'g', { n: i });
        const sock = new FakeSocket();
        hub.onConnect(sock);
        const helloCount = sock.sent.length;
        sock.emit('message', JSON.stringify({ type: 'subscribe', sinceId: 10 }));
        const afterSub = sock.sent.slice(helloCount).map((s) => JSON.parse(s));
        expect(afterSub.length).toBe(1);
        expect(afterSub[0]).toEqual({ type: 'dropped', sinceId: 10, latestId: N });
        const before = sock.sent.length;
        audit.append('tick', 'g', { n: 'live' });
        expect(sock.sent.length).toBe(before + 1);
        const live = JSON.parse(sock.sent[sock.sent.length - 1]);
        expect(live.type).toBe('event');
        expect(live.entry.payload).toEqual({ n: 'live' });
    });

    it('subscribe with current sinceId is a no-op (no replay, no dropped)', () => {
        const { hub, audit } = setup();
        for (let i = 0; i < 3; i++) audit.append('tick', 'g', { n: i });
        const sock = new FakeSocket();
        hub.onConnect(sock);
        const before = sock.sent.length;
        sock.emit('message', JSON.stringify({ type: 'subscribe', sinceId: audit.length }));
        expect(sock.sent.length).toBe(before);
        audit.append('tick', 'g', { n: 'live' });
        expect(sock.sent.length).toBe(before + 1);
        const live = JSON.parse(sock.sent[sock.sent.length - 1]);
        expect(live.type).toBe('event');
    });
});
