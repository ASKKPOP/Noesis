import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendP2pPeerAnnounced } from '../../src/audit/append-p2p-peer-announced.js';
import { appendP2pConnectionOpened } from '../../src/audit/append-p2p-connection-opened.js';
import { appendP2pConnectionClosed } from '../../src/audit/append-p2p-connection-closed.js';

// Test fixtures
const VALID_HEX64 = 'a'.repeat(64);
const VALID_HEX64_B = 'b'.repeat(64);
const VALID_UUID = '12345678-1234-1234-1234-123456789012';

function makeChain(): AuditChain {
    return new AuditChain();
}

describe('Phase 42 — P2P sole-producers', () => {

    // ---- appendP2pPeerAnnounced ----

    it('appendP2pPeerAnnounced: rejects non-object payload', () => {
        const chain = makeChain();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => appendP2pPeerAnnounced(chain, null as any)).toThrow(TypeError);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => appendP2pPeerAnnounced(chain, 'string' as any)).toThrow(TypeError);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => appendP2pPeerAnnounced(chain, [] as any)).toThrow(TypeError);
    });

    it('appendP2pPeerAnnounced: rejects missing key civic_did_hash', () => {
        const chain = makeChain();
        // Missing civic_did_hash → HEX64 guard fires on undefined value
        expect(() => appendP2pPeerAnnounced(chain, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            endpoint_hash: VALID_HEX64, tick: 1,
        } as any)).toThrow(TypeError);
    });

    it('appendP2pPeerAnnounced: rejects missing key endpoint_hash', () => {
        const chain = makeChain();
        // Missing endpoint_hash → HEX64 guard fires on undefined value
        expect(() => appendP2pPeerAnnounced(chain, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            civic_did_hash: VALID_HEX64, tick: 1,
        } as any)).toThrow(TypeError);
    });

    it('appendP2pPeerAnnounced: rejects missing key tick', () => {
        const chain = makeChain();
        // Missing tick → integer guard fires on undefined value
        expect(() => appendP2pPeerAnnounced(chain, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            civic_did_hash: VALID_HEX64, endpoint_hash: VALID_HEX64_B,
        } as any)).toThrow(TypeError);
    });

    it('appendP2pPeerAnnounced: rejects extra key (closed-tuple)', () => {
        const chain = makeChain();
        expect(() => appendP2pPeerAnnounced(chain, {
            civic_did_hash: VALID_HEX64,
            endpoint_hash: VALID_HEX64_B,
            tick: 1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extra: 'x',
        } as any)).toThrow(/closed-tuple/);
    });

    it('appendP2pPeerAnnounced: rejects non-HEX64 civic_did_hash', () => {
        const chain = makeChain();
        expect(() => appendP2pPeerAnnounced(chain, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            civic_did_hash: 'not-hex', endpoint_hash: VALID_HEX64_B, tick: 1,
        } as any)).toThrow(TypeError);
    });

    it('appendP2pPeerAnnounced: rejects negative tick', () => {
        const chain = makeChain();
        expect(() => appendP2pPeerAnnounced(chain, {
            civic_did_hash: VALID_HEX64,
            endpoint_hash: VALID_HEX64_B,
            tick: -1,
        })).toThrow(TypeError);
    });

    it('appendP2pPeerAnnounced: passes payloadPrivacyCheck on valid payload', () => {
        const chain = makeChain();
        const payload = { civic_did_hash: VALID_HEX64, endpoint_hash: VALID_HEX64_B, tick: 1 };
        expect(() => appendP2pPeerAnnounced(chain, payload)).not.toThrow();
    });

    it('appendP2pPeerAnnounced: calls audit.append exactly once with eventType "p2p.peer_announced"', () => {
        const chain = makeChain();
        const spy = vi.spyOn(chain, 'append');
        const payload = { civic_did_hash: VALID_HEX64, endpoint_hash: VALID_HEX64_B, tick: 1 };
        const result = appendP2pPeerAnnounced(chain, payload);
        expect(spy).toHaveBeenCalledOnce();
        expect(result.eventType).toBe('p2p.peer_announced');
        expect(spy.mock.calls[0][0]).toBe('p2p.peer_announced');
    });

    // ---- appendP2pConnectionOpened ----

    it('appendP2pConnectionOpened: rejects missing key connection_id', () => {
        const chain = makeChain();
        // Missing connection_id → UUID guard fires on undefined value
        expect(() => appendP2pConnectionOpened(chain, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            from_did_hash: VALID_HEX64, to_did_hash: VALID_HEX64_B, tick: 1,
        } as any)).toThrow(TypeError);
    });

    it('appendP2pConnectionOpened: rejects missing key from_did_hash', () => {
        const chain = makeChain();
        // Missing from_did_hash → HEX64 guard fires on undefined value
        expect(() => appendP2pConnectionOpened(chain, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            connection_id: VALID_UUID, to_did_hash: VALID_HEX64_B, tick: 1,
        } as any)).toThrow(TypeError);
    });

    it('appendP2pConnectionOpened: rejects missing key to_did_hash', () => {
        const chain = makeChain();
        // Missing to_did_hash → HEX64 guard fires on undefined value
        expect(() => appendP2pConnectionOpened(chain, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            connection_id: VALID_UUID, from_did_hash: VALID_HEX64, tick: 1,
        } as any)).toThrow(TypeError);
    });

    it('appendP2pConnectionOpened: rejects non-UUID connection_id', () => {
        const chain = makeChain();
        expect(() => appendP2pConnectionOpened(chain, {
            connection_id: 'not-uuid',
            from_did_hash: VALID_HEX64,
            to_did_hash: VALID_HEX64_B,
            tick: 1,
        })).toThrow(TypeError);
    });

    it('appendP2pConnectionOpened: rejects non-HEX64 from_did_hash', () => {
        const chain = makeChain();
        expect(() => appendP2pConnectionOpened(chain, {
            connection_id: VALID_UUID,
            from_did_hash: 'short',
            to_did_hash: VALID_HEX64_B,
            tick: 1,
        })).toThrow(TypeError);
    });

    it('appendP2pConnectionOpened: rejects non-HEX64 to_did_hash', () => {
        const chain = makeChain();
        expect(() => appendP2pConnectionOpened(chain, {
            connection_id: VALID_UUID,
            from_did_hash: VALID_HEX64,
            to_did_hash: 'not-hex',
            tick: 1,
        })).toThrow(TypeError);
    });

    it('appendP2pConnectionOpened: passes privacy check on valid payload', () => {
        const chain = makeChain();
        const payload = {
            connection_id: VALID_UUID,
            from_did_hash: VALID_HEX64,
            tick: 1,
            to_did_hash: VALID_HEX64_B,
        };
        expect(() => appendP2pConnectionOpened(chain, payload)).not.toThrow();
    });

    it('appendP2pConnectionOpened: calls audit.append exactly once with "p2p.connection_opened"', () => {
        const chain = makeChain();
        const spy = vi.spyOn(chain, 'append');
        const payload = {
            connection_id: VALID_UUID,
            from_did_hash: VALID_HEX64,
            tick: 1,
            to_did_hash: VALID_HEX64_B,
        };
        const result = appendP2pConnectionOpened(chain, payload);
        expect(spy).toHaveBeenCalledOnce();
        expect(result.eventType).toBe('p2p.connection_opened');
        expect(spy.mock.calls[0][0]).toBe('p2p.connection_opened');
    });

    // ---- appendP2pConnectionClosed ----

    it('appendP2pConnectionClosed: rejects missing key close_reason', () => {
        const chain = makeChain();
        // Missing close_reason → close_reason guard fires (enum check gets undefined → not in CLOSE_REASONS)
        expect(() => appendP2pConnectionClosed(chain, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            connection_id: VALID_UUID, duration_ticks: 5, tick: 1,
        } as any)).toThrow(TypeError);
    });

    it('appendP2pConnectionClosed: rejects missing key connection_id', () => {
        const chain = makeChain();
        // Missing connection_id → UUID guard fires after enum check passes
        expect(() => appendP2pConnectionClosed(chain, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            close_reason: 'completed', duration_ticks: 5, tick: 1,
        } as any)).toThrow(TypeError);
    });

    it('appendP2pConnectionClosed: rejects missing key duration_ticks (closed-tuple)', () => {
        const chain = makeChain();
        // Missing duration_ticks → integer guard fires (NaN check on undefined)
        expect(() => appendP2pConnectionClosed(chain, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            connection_id: VALID_UUID, close_reason: 'completed', tick: 1,
        } as any)).toThrow(TypeError);
    });

    it('appendP2pConnectionClosed: rejects close_reason not in {completed,timeout,error,initiated}', () => {
        const chain = makeChain();
        expect(() => appendP2pConnectionClosed(chain, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            connection_id: VALID_UUID, close_reason: 'unknown' as any, duration_ticks: 5, tick: 1,
        })).toThrow(TypeError);
    });

    it('appendP2pConnectionClosed: rejects negative duration_ticks', () => {
        const chain = makeChain();
        expect(() => appendP2pConnectionClosed(chain, {
            connection_id: VALID_UUID,
            close_reason: 'completed',
            duration_ticks: -1,
            tick: 1,
        })).toThrow(TypeError);
    });

    it('appendP2pConnectionClosed: passes privacy check on valid payload', () => {
        const chain = makeChain();
        const payload = {
            close_reason: 'completed' as const,
            connection_id: VALID_UUID,
            duration_ticks: 5,
            tick: 1,
        };
        expect(() => appendP2pConnectionClosed(chain, payload)).not.toThrow();
    });

    it('appendP2pConnectionClosed: calls audit.append exactly once with "p2p.connection_closed"', () => {
        const chain = makeChain();
        const spy = vi.spyOn(chain, 'append');
        const payload = {
            close_reason: 'timeout' as const,
            connection_id: VALID_UUID,
            duration_ticks: 100,
            tick: 42,
        };
        const result = appendP2pConnectionClosed(chain, payload);
        expect(spy).toHaveBeenCalledOnce();
        expect(result.eventType).toBe('p2p.connection_closed');
        expect(spy.mock.calls[0][0]).toBe('p2p.connection_closed');
    });

    it('appendP2pConnectionClosed: accepts all valid close_reasons', () => {
        for (const reason of ['completed', 'timeout', 'error', 'initiated'] as const) {
            const chain = makeChain();
            const payload = {
                close_reason: reason,
                connection_id: VALID_UUID,
                duration_ticks: 10,
                tick: 5,
            };
            expect(() => appendP2pConnectionClosed(chain, payload)).not.toThrow();
        }
    });
});
