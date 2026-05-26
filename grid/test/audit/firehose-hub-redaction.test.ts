/**
 * Phase 36 Wave 0 — WsFirehoseHub visitor-serializer redaction test.
 *
 * Asserts:
 * - Civic-member subscriber receives a full frame (actor_did + payload present).
 * - Anonymous subscriber receives a stripped frame ({tick, event_type, family} only;
 *   actor_did and payload are ABSENT).
 * - frame.entry.family === first segment of event_type (split on '.').
 *
 * Tests fail RED because onConnect() does not yet accept a `didContext` parameter.
 * Plan 03 extends WsFirehoseHub.onConnect with the DID context parameter.
 */
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { WsFirehoseHub } from '../../src/audit/firehose-hub.js';
import { appendPortalAuthLogin } from '../../src/audit/append-portal-auth-login.js';

// Minimal mock socket — captures all sent messages.
class MockSocket {
    sent: string[] = [];
    bufferedAmount = 0;
    send(msg: string) { this.sent.push(msg); }
    on(_event: string, _handler: () => void) {}
    close(_code?: number, _reason?: string) {}
}

// DID context type expected by the extended onConnect signature (Plan 03).
interface DIDContext {
    tier: 'anonymous' | 'human_visitor' | 'civic_member';
    did?: string;
}

describe('WsFirehoseHub — visitor redaction', () => {
    it('civic_member receives full frame; anonymous receives family-prefix-only frame', async () => {
        const chain = new AuditChain();
        const hub = new WsFirehoseHub(chain, 'genesis');

        const civicSocket = new MockSocket();
        const anonSocket = new MockSocket();

        const civicCtx: DIDContext = { tier: 'civic_member', did: 'did:civic:noesis:test1' };
        const anonCtx: DIDContext | null = null;

        // onConnect extended in Plan 03 to accept optional didContext
        hub.onConnect(civicSocket as unknown as Parameters<typeof hub.onConnect>[0], civicCtx as unknown as Parameters<typeof hub.onConnect>[1]);
        hub.onConnect(anonSocket as unknown as Parameters<typeof hub.onConnect>[0], anonCtx as unknown as Parameters<typeof hub.onConnect>[1]);

        // Trigger an audit event
        appendPortalAuthLogin(chain, {
            human_did: 'did:noesis:human:0xabc',
            method: 'siwe',
            tick: 5,
        });

        // Allow microtask queue to flush
        await new Promise<void>((r) => queueMicrotask(r));

        // civic_member gets all frames PLUS the hello frame
        // Find the event frame (not the hello frame)
        const civicEventFrames = civicSocket.sent
            .map((s) => JSON.parse(s))
            .filter((f) => f.type === 'event');

        expect(civicEventFrames.length).toBeGreaterThan(0);
        const civicFrame = civicEventFrames[0];

        // Civic member sees full actor_did and payload
        expect(civicFrame.entry).toHaveProperty('actorDid');
        expect(civicFrame.entry).toHaveProperty('payload');

        // Anonymous gets stripped frames
        const anonEventFrames = anonSocket.sent
            .map((s) => JSON.parse(s))
            .filter((f) => f.type === 'event');

        expect(anonEventFrames.length).toBeGreaterThan(0);
        const anonFrame = anonEventFrames[0];

        // Anonymous sees only {tick, event_type, family} — NO actor_did, NO payload
        expect(anonFrame.entry).not.toHaveProperty('actorDid');
        expect(anonFrame.entry).not.toHaveProperty('actor_did');
        expect(anonFrame.entry).not.toHaveProperty('payload');

        // family = first segment of event_type (split on '.')
        expect(anonFrame.entry).toHaveProperty('family');
        expect(anonFrame.entry.family).toBe('portal');
    });
});
