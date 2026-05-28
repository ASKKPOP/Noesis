import { describe, it } from 'vitest';

// WsFirehoseHub.pushSignalToDid — Phase 42 Plan 04
// p2p.signal_received is a private per-DID WSS push, NOT on the broadcast allowlist (D-42-06).
// These tests verify the targeted delivery contract and that it does not touch the audit chain.

describe('WsFirehoseHub.pushSignalToDid (Phase 42 Plan 04)', () => {
    it.skip('pushSignalToDid sends frame ONLY to clients whose didContext.did matches target DID', () => {
        // const hub = new WsFirehoseHub();
        // const aliceSock = mockSocket({ did: 'did:civic:noesis:alice' });
        // const bobSock = mockSocket({ did: 'did:civic:noesis:bob' });
        // hub.pushSignalToDid('did:civic:noesis:alice', { type: 'p2p.signal_received', blob: 'sdp' });
        // expect(aliceSock.send).toHaveBeenCalledOnce();
        // expect(bobSock.send).not.toHaveBeenCalled();
    });

    it.skip('pushSignalToDid does NOT increment audit chain (does not call onAuditEvent)', () => {
        // const onAuditEvent = vi.fn();
        // const hub = new WsFirehoseHub({ onAuditEvent });
        // hub.pushSignalToDid('did:civic:noesis:alice', { type: 'p2p.signal_received', blob: 'sdp' });
        // expect(onAuditEvent).not.toHaveBeenCalled();
    });

    it.skip('frame type "p2p.signal_received" is NOT broadcast to allowlist subscribers', () => {
        // // allowlist subscriber (no DID context) must NOT receive p2p.signal_received frames
        // const hub = new WsFirehoseHub();
        // const subscriber = mockSocket({ did: undefined }); // no DID — allowlist subscriber only
        // hub.pushSignalToDid('did:civic:noesis:alice', { type: 'p2p.signal_received', blob: 'sdp' });
        // expect(subscriber.send).not.toHaveBeenCalled();
    });

    it.skip('pushSignalToDid swallows send errors on broken socket without throwing', () => {
        // const hub = new WsFirehoseHub();
        // const brokenSock = mockSocket({ did: 'did:civic:noesis:alice', sendThrows: true });
        // expect(() => hub.pushSignalToDid('did:civic:noesis:alice', { type: 'p2p.signal_received', blob: 'sdp' })).not.toThrow();
    });

    it.skip('pushSignalToDid increments frames_sent_total counter per delivered frame', () => {
        // const hub = new WsFirehoseHub();
        // const aliceSock = mockSocket({ did: 'did:civic:noesis:alice' });
        // hub.pushSignalToDid('did:civic:noesis:alice', { type: 'p2p.signal_received', blob: 'sdp' });
        // expect(hub.metrics.frames_sent_total).toBeGreaterThan(0);
    });
});
