/**
 * Phase 36 Wave 0 — WsFirehoseHub R-31-01 zero-diff regression guard.
 *
 * // R-31-01 zero-diff: chain head hash MUST NOT vary with subscriber composition
 *
 * Asserts that chain.head (chain hash head) is byte-identical across three
 * subscriber scenarios after appending the same canonical event:
 *   - Scenario A: 0 subscribers
 *   - Scenario B: 1 anonymous subscriber
 *   - Scenario C: 1 civic_member + 1 anonymous subscriber
 *
 * Tests fail RED because:
 * 1. onConnect() does not yet accept a `didContext` parameter (Plan 03 adds it).
 * 2. The visitor serializer may not yet exist (Plan 03 adds it).
 * However, the chain.head assertion verifies the zero-diff invariant is not
 * broken even after the hub is attached.
 */
import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { WsFirehoseHub } from '../../src/audit/firehose-hub.js';
import { appendPortalAuthLogin } from '../../src/audit/append-portal-auth-login.js';

// Minimal mock socket.
class MockSocket {
    sent: string[] = [];
    bufferedAmount = 0;
    send(msg: string) { this.sent.push(msg); }
    on(_event: string, _handler: () => void) {}
    close(_code?: number, _reason?: string) {}
}

const CANONICAL_PAYLOAD = {
    human_did: 'did:noesis:human:0xabcdef0123456789',
    method: 'siwe' as const,
    tick: 1,
};

// DID context types expected by the extended onConnect signature.
interface DIDContext {
    tier: 'anonymous' | 'human_visitor' | 'civic_member';
    did?: string;
}

describe('WsFirehoseHub — R-31-01 zero-diff invariant', () => {
    it('chain.head is byte-identical with 0, 1 anon, and 1+1 mixed subscribers after same event append', async () => {
        // Pin Date.now to a fixed value for ALL calls during this test.
        // This ensures the createdAt in AuditChain.append() is identical
        // across all three scenarios regardless of hello-frame or other Date.now calls.
        const FIXED_NOW = 1_700_000_000_000;
        const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);

        // Scenario A: 0 subscribers
        const chainA = new AuditChain();
        new WsFirehoseHub(chainA, 'genesis');
        appendPortalAuthLogin(chainA, CANONICAL_PAYLOAD);
        const head0Sub = chainA.head;

        // Scenario B: 1 anonymous subscriber
        const chainB = new AuditChain();
        const hubB = new WsFirehoseHub(chainB, 'genesis');
        const anonSocket = new MockSocket();
        const anonCtx: DIDContext | null = null;
        hubB.onConnect(
            anonSocket as unknown as Parameters<typeof hubB.onConnect>[0],
            anonCtx as unknown as Parameters<typeof hubB.onConnect>[1],
        );
        appendPortalAuthLogin(chainB, CANONICAL_PAYLOAD);
        const head1Anon = chainB.head;

        // Scenario C: 1 civic_member + 1 anonymous subscriber
        const chainC = new AuditChain();
        const hubC = new WsFirehoseHub(chainC, 'genesis');
        const civicSocket = new MockSocket();
        const anonSocket2 = new MockSocket();
        const civicCtx: DIDContext = { tier: 'civic_member', did: 'did:civic:noesis:gen-001' };
        hubC.onConnect(
            civicSocket as unknown as Parameters<typeof hubC.onConnect>[0],
            civicCtx as unknown as Parameters<typeof hubC.onConnect>[1],
        );
        hubC.onConnect(
            anonSocket2 as unknown as Parameters<typeof hubC.onConnect>[0],
            null as unknown as Parameters<typeof hubC.onConnect>[1],
        );
        appendPortalAuthLogin(chainC, CANONICAL_PAYLOAD);
        const headMixed = chainC.head;

        nowSpy.mockRestore();

        // R-31-01 zero-diff: chain head hash MUST NOT vary with subscriber composition
        expect(head0Sub).toBe(head1Anon);
        expect(head1Anon).toBe(headMixed);
    });
});
