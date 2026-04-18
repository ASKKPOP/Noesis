/**
 * Smoke test — Wave 0 validation gate for Phase 3.
 *
 * Proves that the dashboard test infrastructure is alive:
 *   - vitest + jsdom environment boots
 *   - MockWebSocket mirror of grid/test/ws-hub.test.ts FakeSocket loads
 *   - ws-frames.ts fixture builders mirror grid/src/api/ws-protocol.ts shapes
 *
 * Plans 03–06 write all their tests in this workspace; if this test fails,
 * nothing downstream is trustworthy.
 */
import { describe, expect, it } from 'vitest';
import { MockWebSocket } from './mocks/mock-websocket';
import {
    makeAuditEntry,
    makeDropped,
    makeEvent,
    makeHello,
    makeNousMovedEntry,
    makeTickEntry,
    resetFixtureIds,
} from './fixtures/ws-frames';

describe('smoke: test runner is alive', () => {
    it('MockWebSocket starts in CONNECTING and advances to OPEN via emitOpen()', () => {
        const ws = new MockWebSocket('ws://test/ws/events');
        expect(ws.readyState).toBe(MockWebSocket.CONNECTING);
        ws.emitOpen();
        expect(ws.readyState).toBe(MockWebSocket.OPEN);
    });

    it('MockWebSocket delivers message events with JSON-encoded .data to listeners', () => {
        const ws = new MockWebSocket('ws://test/ws/events');
        const received: string[] = [];
        ws.addEventListener('message', (ev) => {
            // MessageEvent shape — .data is a JSON string per the browser WS API.
            received.push((ev as MessageEvent).data as string);
        });
        ws.emitOpen();
        ws.emitMessage({ type: 'hello', serverTime: 1, gridName: 'g', lastEntryId: 0 });
        expect(received).toHaveLength(1);
        const parsed = JSON.parse(received[0]);
        expect(parsed).toEqual({ type: 'hello', serverTime: 1, gridName: 'g', lastEntryId: 0 });
    });

    it('MockWebSocket.send records transmitted frames for assertions', () => {
        const ws = new MockWebSocket('ws://test/ws/events');
        ws.emitOpen();
        ws.send(JSON.stringify({ type: 'subscribe' }));
        expect(ws.sent).toEqual([JSON.stringify({ type: 'subscribe' })]);
    });

    it('makeHello() returns a well-shaped HelloFrame', () => {
        const hello = makeHello();
        expect(hello.type).toBe('hello');
        expect(typeof hello.serverTime).toBe('number');
        expect(typeof hello.gridName).toBe('string');
        expect(typeof hello.lastEntryId).toBe('number');
    });

    it('makeEvent() returns a well-shaped EventFrame with a valid AuditEntry', () => {
        resetFixtureIds();
        const ev = makeEvent({ eventType: 'tick' });
        expect(ev.type).toBe('event');
        expect(ev.entry.eventType).toBe('tick');
        expect(typeof ev.entry.actorDid).toBe('string');
        expect(ev.entry.payload).toEqual({});
        expect(typeof ev.entry.prevHash).toBe('string');
        expect(typeof ev.entry.eventHash).toBe('string');
        expect(typeof ev.entry.createdAt).toBe('number');
    });

    it('makeAuditEntry() auto-increments ids and resetFixtureIds() rewinds the counter', () => {
        resetFixtureIds();
        const a = makeAuditEntry();
        const b = makeAuditEntry();
        expect(a.id).toBe(1);
        expect(b.id).toBe(2);
        resetFixtureIds();
        const c = makeAuditEntry();
        expect(c.id).toBe(1);
    });

    it('makeDropped() returns a DroppedFrame with sinceId/latestId', () => {
        expect(makeDropped(5, 12)).toEqual({ type: 'dropped', sinceId: 5, latestId: 12 });
    });

    it('makeTickEntry() produces a tick entry with tick + tickRateMs payload', () => {
        resetFixtureIds();
        const entry = makeTickEntry(7, 30_000);
        expect(entry.eventType).toBe('tick');
        expect(entry.payload).toMatchObject({ tick: 7, tickRateMs: 30_000, epoch: 0 });
        expect(typeof (entry.payload as Record<string, unknown>).timestamp).toBe('number');
    });

    it('makeNousMovedEntry() produces a nous.moved entry with from/to/travel payload', () => {
        resetFixtureIds();
        const entry = makeNousMovedEntry('did:noesis:sophia', 'sophia', 'agora', 'hearth');
        expect(entry.eventType).toBe('nous.moved');
        expect(entry.actorDid).toBe('did:noesis:sophia');
        expect(entry.payload).toMatchObject({
            name: 'sophia',
            fromRegion: 'agora',
            toRegion: 'hearth',
            travelCost: 1,
            tick: 1,
        });
    });
});
