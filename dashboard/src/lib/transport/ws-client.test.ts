/**
 * Tests for WsClient — the dashboard-side WebSocket lifecycle manager.
 *
 * State machine:
 *   idle → connecting → open → reconnecting → connecting → open → ...
 *                              ↓ (bye received)
 *                              halted
 *                              ↓ (close() called anywhere)
 *                              closed
 *
 * Tests exercise connect/open, subscribe frame emission, lastSeenId
 * tracking, full-jitter reconnect, dropped forwarding, bye halt,
 * ping/pong, explicit close, and manual bumpLastSeenId for refill.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockWebSocket } from '@/test/mocks/mock-websocket';
import { makeAuditEntry, makeHello, resetFixtureIds } from '@/test/fixtures/ws-frames';
import type { AuditEntry } from '@/lib/protocol/audit-types';
import type { DroppedFrame } from '@/lib/protocol/ws-protocol';
import { WsClient } from './ws-client';

type SocketFactoryResult = { sockets: MockWebSocket[]; factory: (url: string) => WebSocket };

function makeFactory(): SocketFactoryResult {
    const sockets: MockWebSocket[] = [];
    const factory = (url: string): WebSocket => {
        const s = new MockWebSocket(url);
        sockets.push(s);
        return s as unknown as WebSocket;
    };
    return { sockets, factory };
}

describe('WsClient', () => {
    beforeEach(() => {
        resetFixtureIds();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('connect → OPEN → emits subscribe frame with sinceId=0 on first connect', () => {
        const { sockets, factory } = makeFactory();
        const client = new WsClient({ url: 'ws://test/ws/events', wsFactory: factory });
        client.connect();
        expect(sockets).toHaveLength(1);
        sockets[0]!.emitOpen();
        expect(sockets[0]!.sent).toHaveLength(1);
        expect(JSON.parse(sockets[0]!.sent[0]!)).toEqual({ type: 'subscribe', sinceId: 0 });
    });

    it('hello frame updates gridName and does NOT advance lastSeenId', () => {
        const { sockets, factory } = makeFactory();
        const client = new WsClient({ url: 'ws://test/', wsFactory: factory });
        client.connect();
        sockets[0]!.emitOpen();
        sockets[0]!.emitMessage(makeHello({ gridName: 'noesis', lastEntryId: 42 }));
        expect(client.state.gridName).toBe('noesis');
        expect(client.state.lastSeenId).toBe(0);
    });

    it('event frame advances lastSeenId monotonically and fires handlers', () => {
        const { sockets, factory } = makeFactory();
        const client = new WsClient({ url: 'ws://test/', wsFactory: factory });
        const received: AuditEntry[] = [];
        client.on('event', (e) => received.push(e));
        client.connect();
        sockets[0]!.emitOpen();
        for (const id of [5, 6, 10]) {
            sockets[0]!.emitMessage({ type: 'event', entry: makeAuditEntry({ id }) });
        }
        expect(received).toHaveLength(3);
        expect(client.state.lastSeenId).toBe(10);
    });

    it('subscribe on reconnect carries lastSeenId', () => {
        const { sockets, factory } = makeFactory();
        // Math.random → 0 so backoff delay is 0, timer fires immediately.
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const client = new WsClient({ url: 'ws://test/', wsFactory: factory });
        client.connect();
        sockets[0]!.emitOpen();
        sockets[0]!.emitMessage({ type: 'event', entry: makeAuditEntry({ id: 7 }) });
        expect(client.state.lastSeenId).toBe(7);
        sockets[0]!.emitClose(1006, 'abnormal');
        // Advance past backoff — Math.random=0 gives 0ms delay.
        vi.advanceTimersByTime(1);
        expect(sockets).toHaveLength(2);
        sockets[1]!.emitOpen();
        expect(JSON.parse(sockets[1]!.sent[0]!)).toEqual({ type: 'subscribe', sinceId: 7 });
    });

    it('dropped frame is forwarded without advancing lastSeenId', () => {
        const { sockets, factory } = makeFactory();
        const client = new WsClient({ url: 'ws://test/', wsFactory: factory });
        const spy = vi.fn<(f: DroppedFrame) => void>();
        client.on('dropped', spy);
        client.connect();
        sockets[0]!.emitOpen();
        sockets[0]!.emitMessage({ type: 'event', entry: makeAuditEntry({ id: 3 }) });
        expect(client.state.lastSeenId).toBe(3);
        sockets[0]!.emitMessage({ type: 'dropped', sinceId: 3, latestId: 99 });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith({ type: 'dropped', sinceId: 3, latestId: 99 });
        expect(client.state.lastSeenId).toBe(3);
    });

    it('bye frame halts reconnection', () => {
        const { sockets, factory } = makeFactory();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const client = new WsClient({ url: 'ws://test/', wsFactory: factory });
        client.connect();
        sockets[0]!.emitOpen();
        sockets[0]!.emitMessage({ type: 'bye', reason: 'server shutting down' });
        sockets[0]!.emitClose(1001, 'going away');
        vi.advanceTimersByTime(60_000);
        expect(sockets).toHaveLength(1);
        expect(client.state.phase).toBe('halted');
    });

    it('ping frame elicits pong with same t', () => {
        const { sockets, factory } = makeFactory();
        const client = new WsClient({ url: 'ws://test/', wsFactory: factory });
        client.connect();
        sockets[0]!.emitOpen();
        sockets[0]!.sent.length = 0; // drop the subscribe frame so indices align
        sockets[0]!.emitMessage({ type: 'ping', t: 1234567 });
        expect(sockets[0]!.sent).toHaveLength(1);
        expect(JSON.parse(sockets[0]!.sent[0]!)).toEqual({ type: 'pong', t: 1234567 });
    });

    it('close() halts reconnection and closes socket with 1000', () => {
        const { sockets, factory } = makeFactory();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const client = new WsClient({ url: 'ws://test/', wsFactory: factory });
        client.connect();
        sockets[0]!.emitOpen();
        client.close();
        // MockWebSocket.close() synchronously moves to CLOSED and fires close.
        expect(sockets[0]!.readyState).toBe(MockWebSocket.CLOSED);
        expect(client.state.phase).toBe('closed');
        vi.advanceTimersByTime(60_000);
        expect(sockets).toHaveLength(1); // no reconnect after explicit close
    });

    it('backoff grows with consecutive failed reconnects', async () => {
        const { sockets, factory } = makeFactory();
        // Spy on setTimeout to capture delays. vi fake timers replace setTimeout
        // but we can still observe pending timer queue depths via API; easier:
        // mock backoff.nextDelayMs via module mock.
        const backoff = await import('./backoff');
        const spy = vi.spyOn(backoff, 'nextDelayMs').mockImplementation((n) => n * 1000);
        const client = new WsClient({ url: 'ws://test/', wsFactory: factory });
        client.connect();
        // Socket 0: open then close — triggers reconnect with delay = 0 * 1000
        sockets[0]!.emitOpen();
        sockets[0]!.emitClose(1006, 'fail1');
        vi.advanceTimersByTime(1);
        // Socket 1: close without ever opening — still triggers reconnect,
        // attempt=1 → delay = 1 * 1000.
        expect(sockets).toHaveLength(2);
        sockets[1]!.emitClose(1006, 'fail2');
        vi.advanceTimersByTime(1000);
        expect(sockets).toHaveLength(3);
        sockets[2]!.emitClose(1006, 'fail3');
        vi.advanceTimersByTime(2000);
        expect(sockets).toHaveLength(4);
        // spy should have been invoked with 0, 1, 2 in order.
        const calledWith = spy.mock.calls.map((c) => c[0]);
        expect(calledWith).toEqual([0, 1, 2]);
    });

    it('bumpLastSeenId advances the resume pointer used on reconnect', () => {
        const { sockets, factory } = makeFactory();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const client = new WsClient({ url: 'ws://test/', wsFactory: factory });
        client.connect();
        sockets[0]!.emitOpen();
        sockets[0]!.emitMessage({ type: 'event', entry: makeAuditEntry({ id: 3 }) });
        expect(client.state.lastSeenId).toBe(3);
        client.bumpLastSeenId(99);
        expect(client.state.lastSeenId).toBe(99);
        sockets[0]!.emitClose(1006, 'drop');
        vi.advanceTimersByTime(1);
        expect(sockets).toHaveLength(2);
        sockets[1]!.emitOpen();
        expect(JSON.parse(sockets[1]!.sent[0]!)).toEqual({ type: 'subscribe', sinceId: 99 });
    });
});
