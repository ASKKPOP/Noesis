import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WsFirehoseHub } from '../../src/audit/firehose-hub.js';
import { AuditChain } from '../../src/audit/chain.js';
import type { ServerSocket } from '../../src/api/ws-hub.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';

// WsFirehoseHub.pushSignalToDid — Phase 42 Plan 04
// p2p.signal_received is a private per-DID WSS push, NOT on the broadcast allowlist (D-42-06).
// These tests verify the targeted delivery contract and that it does not touch the audit chain.

function makeMockSocket(overrides?: { sendThrows?: boolean }): ServerSocket {
    return {
        send: vi.fn(() => {
            if (overrides?.sendThrows) throw new Error('broken socket');
        }),
        close: vi.fn(),
        on: vi.fn(),
        bufferedAmount: 0,
        readyState: 1,
    } as unknown as ServerSocket;
}

function makeDidContext(did: string): DIDContext {
    return { did, tier: 'civic_member', existenceDid: 'did:existence:test', gridName: 'Genesis' };
}

describe('WsFirehoseHub.pushSignalToDid (Phase 42 Plan 04)', () => {
    let audit: AuditChain;
    let hub: WsFirehoseHub;

    beforeEach(() => {
        audit = new AuditChain();
        hub = new WsFirehoseHub(audit, 'Genesis');
    });

    it('pushSignalToDid sends frame ONLY to clients whose didContext.did matches target DID', () => {
        const aliceSock = makeMockSocket();
        const bobSock = makeMockSocket();

        hub.onConnect(aliceSock, makeDidContext('did:civic:noesis:alice'));
        hub.onConnect(bobSock, makeDidContext('did:civic:noesis:bob'));

        const frame = { type: 'p2p.signal_received', connection_id: 'test-uuid', from_did: 'did:civic:noesis:alice' };
        hub.pushSignalToDid('did:civic:noesis:alice', frame);

        // Alice gets the hello frame from onConnect + the signal frame
        const aliceCalls = vi.mocked(aliceSock.send).mock.calls;
        const aliceSignalCalls = aliceCalls.filter(([arg]) => {
            try { return (JSON.parse(arg as string) as {type:string}).type === 'p2p.signal_received'; }
            catch { return false; }
        });
        expect(aliceSignalCalls.length).toBe(1);

        // Bob only gets the hello frame — no signal frame
        const bobCalls = vi.mocked(bobSock.send).mock.calls;
        const bobSignalCalls = bobCalls.filter(([arg]) => {
            try { return (JSON.parse(arg as string) as {type:string}).type === 'p2p.signal_received'; }
            catch { return false; }
        });
        expect(bobSignalCalls.length).toBe(0);
    });

    it('pushSignalToDid does NOT increment audit chain (does not call onAuditEvent)', () => {
        // Spy on audit.append — if pushSignalToDid called onAuditEvent it would append
        const appendSpy = vi.spyOn(audit, 'append');
        const sock = makeMockSocket();
        hub.onConnect(sock, makeDidContext('did:civic:noesis:alice'));

        // Clear calls from onConnect (grid.started etc. do not exist in test mode; hello frame is WS not audit)
        appendSpy.mockClear();

        hub.pushSignalToDid('did:civic:noesis:alice', { type: 'p2p.signal_received', connection_id: 'uuid', from_did: 'did:civic:noesis:bob' });

        // audit.append must NOT have been called
        expect(appendSpy).not.toHaveBeenCalled();
    });

    it('frame type "p2p.signal_received" is NOT broadcast to allowlist subscribers', () => {
        // A subscriber with NO didContext (allowlist/visitor subscriber) must NOT receive the frame
        const visitorSock = makeMockSocket();
        hub.onConnect(visitorSock, null); // null = visitor/no DID

        const callsBefore = vi.mocked(visitorSock.send).mock.calls.length;

        hub.pushSignalToDid('did:civic:noesis:alice', { type: 'p2p.signal_received', connection_id: 'uuid', from_did: 'did:civic:noesis:bob' });

        // Visitor should have received no additional frames after onConnect hello
        const callsAfter = vi.mocked(visitorSock.send).mock.calls.length;
        expect(callsAfter).toBe(callsBefore); // no extra frames
    });

    it('pushSignalToDid swallows send errors on broken socket without throwing', () => {
        const brokenSock = makeMockSocket({ sendThrows: true });
        hub.onConnect(brokenSock, makeDidContext('did:civic:noesis:alice'));

        expect(() =>
            hub.pushSignalToDid('did:civic:noesis:alice', { type: 'p2p.signal_received', connection_id: 'uuid', from_did: 'did:civic:noesis:bob' })
        ).not.toThrow();
    });

    it('pushSignalToDid increments frames_sent_total counter per delivered frame', () => {
        const aliceSock = makeMockSocket();
        hub.onConnect(aliceSock, makeDidContext('did:civic:noesis:alice'));

        const before = hub.stats().frames_sent_total;
        hub.pushSignalToDid('did:civic:noesis:alice', { type: 'p2p.signal_received', connection_id: 'uuid', from_did: 'did:civic:noesis:bob' });
        const after = hub.stats().frames_sent_total;

        expect(after).toBeGreaterThan(before);
    });
});
