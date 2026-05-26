/**
 * Phase 38 WIRE-05 — firehose-filter unit tests
 *
 * 8 tests:
 *   1. anonymous tier bypasses filter — returns true for any entry
 *   2. human_visitor tier bypasses filter — returns true for any entry
 *   3. civic_member sees own actor events
 *   4. civic_member sees events targeting them (targetDid)
 *   5. civic_member sees tick events
 *   6. civic_member sees community.* where actor === did, NOT where actor !== did
 *   7. civic_member does NOT see another DID private events
 *   8. R-31-01: chain head hash identical whether 0, 1, or 3 Brain subscribers connected
 */

import { describe, it, expect } from 'vitest';
import { isRelevantFor } from '../../src/audit/firehose-filter.js';
import { AuditChain } from '../../src/audit/chain.js';
import { WsFirehoseHub } from '../../src/audit/firehose-hub.js';
import type { AuditEntry } from '../../src/audit/types.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import type { ServerSocket } from '../../src/api/ws-hub.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeEntry(
    eventType: string,
    actorDid: string,
    targetDid?: string,
): AuditEntry {
    return {
        id: 1,
        eventType,
        actorDid,
        targetDid,
        payload: {},
        prevHash: '0'.repeat(64),
        eventHash: 'a'.repeat(64),
        createdAt: Date.now(),
    };
}

function civicCtx(did: string): DIDContext {
    return { did, tier: 'civic_member' };
}

// ── FakeSocket for R-31-01 hub test ──────────────────────────────────────

type EventName = 'message' | 'close' | 'error';

class FakeSocket implements ServerSocket {
    bufferedAmount = 0;
    sent: string[] = [];
    closed = false;

    private listeners: {
        message: Array<(data: unknown) => void>;
        close: Array<() => void>;
        error: Array<(err: Error) => void>;
    } = { message: [], close: [], error: [] };

    send(data: string): void {
        this.sent.push(data);
    }

    close(_code?: number, _reason?: string): void {
        this.closed = true;
    }

    on(event: 'message', cb: (data: unknown) => void): void;
    on(event: 'close', cb: () => void): void;
    on(event: 'error', cb: (err: Error) => void): void;
    on(event: EventName, cb: (...args: any[]) => void): void {
        (this.listeners[event] as Array<(...args: any[]) => void>).push(cb);
    }
}

// Scripted event sequence (deterministic — same input regardless of wall clock).
const SCRIPTED_EVENTS: Array<[string, string, Record<string, unknown>]> = [
    ['nous.moved',        'did:civic:noesis:a',      { to: 'r1' }],
    ['nous.spoke',        'did:civic:noesis:b',      { msg: 'hi' }],
    ['tick',              'did:civic:noesis:system',  {}],
    ['nous.moved',        'did:civic:noesis:a',      { to: 'r2' }],
    ['community.joined',  'did:civic:noesis:b',      {}],
    ['nous.spoke',        'did:civic:noesis:a',      { msg: 'hey' }],
    ['nous.moved',        'did:civic:noesis:c',      { to: 'r3' }],
    ['tick',              'did:civic:noesis:system',  {}],
    ['nous.spawned',      'did:civic:noesis:d',      {}],
    ['nous.moved',        'did:civic:noesis:a',      { to: 'r4' }],
];

// Run the scripted sequence through a fresh chain + hub.
// Returns the chain's head hash after all events.
// The R-31-01 proof: the head hash must be the same regardless of how
// many (or which) civic_member subscribers are attached to the hub.
//
// We use per-event fixed timestamps (event_index * 1000) so each
// audit.append() call gets a stable, pre-agreed timestamp regardless of
// how many other Date.now() calls the hub metrics may make in between.
function runScriptedSequence(
    civic_subscribers: DIDContext[],
): string {
    const audit = new AuditChain();
    const originalNow = Date.now;

    try {
        // Setup phase: use a fixed timestamp for hub construction + onConnect.
        Date.now = () => 0;

        const hub = new WsFirehoseHub(audit, 'test-grid');
        for (const ctx of civic_subscribers) {
            const sock = new FakeSocket();
            hub.onConnect(sock, ctx);
        }

        // Chain append phase: each event gets a fixed per-event timestamp.
        // This is independent of how many Date.now() calls the hub metrics make
        // (touchLastFrame etc.) — those calls see the same fixed value.
        for (let i = 0; i < SCRIPTED_EVENTS.length; i++) {
            const [eventType, actorDid, payload] = SCRIPTED_EVENTS[i];
            // Lock Date.now to this event's slot for the duration of the append.
            const eventTs = (i + 1) * 1_000_000;
            Date.now = () => eventTs;
            audit.append(eventType, actorDid, payload);
        }

        return audit.head;
    } finally {
        Date.now = originalNow;
    }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('isRelevantFor', () => {
    it('anonymous tier (null didContext) bypasses filter — returns true for any entry', () => {
        const entry = makeEntry('nous.spoke', 'did:civic:noesis:other');
        expect(isRelevantFor(entry, null)).toBe(true);
    });

    it('human_visitor tier bypasses filter — returns true for any entry', () => {
        const entry = makeEntry('nous.spoke', 'did:civic:noesis:other');
        const ctx: DIDContext = { did: 'did:civic:noesis:human', tier: 'human_visitor' };
        expect(isRelevantFor(entry, ctx)).toBe(true);
    });

    it('civic_member sees own actor events', () => {
        const did = 'did:civic:noesis:me';
        const entry = makeEntry('nous.moved', did, undefined);
        expect(isRelevantFor(entry, civicCtx(did))).toBe(true);
    });

    it('civic_member sees events targeting them (targetDid)', () => {
        const did = 'did:civic:noesis:me';
        const entry = makeEntry('nous.spoke', 'did:civic:noesis:other', did);
        expect(isRelevantFor(entry, civicCtx(did))).toBe(true);
    });

    it('civic_member sees tick events', () => {
        const did = 'did:civic:noesis:me';
        const entry = makeEntry('tick', 'did:civic:noesis:system', undefined);
        expect(isRelevantFor(entry, civicCtx(did))).toBe(true);
    });

    it('civic_member sees community.* where actor === did, NOT where actor !== did', () => {
        const did = 'did:civic:noesis:me';
        const other = 'did:civic:noesis:other';
        const myEntry = makeEntry('community.joined', did, undefined);
        const otherEntry = makeEntry('community.joined', other, undefined);
        expect(isRelevantFor(myEntry, civicCtx(did))).toBe(true);
        expect(isRelevantFor(otherEntry, civicCtx(did))).toBe(false);
    });

    it('civic_member does NOT see another DID private events', () => {
        const did = 'did:civic:noesis:me';
        // entry with different actorDid, no targetDid, non-tick non-community type
        const entry = makeEntry('nous.spoke', 'did:noesis:nous:other', undefined);
        expect(isRelevantFor(entry, civicCtx(did))).toBe(false);
    });

    it('R-31-01: chain head hash identical whether 0, 1, or 3 Brain subscribers connected', () => {
        // Run 0 subscribers
        const hash0 = runScriptedSequence([]);

        // Run 1 civic_member subscriber with DID a
        const hash1 = runScriptedSequence([
            civicCtx('did:civic:noesis:a'),
        ]);

        // Run 3 civic_member subscribers with different DIDs
        const hash3 = runScriptedSequence([
            civicCtx('did:civic:noesis:a'),
            civicCtx('did:civic:noesis:b'),
            civicCtx('did:civic:noesis:c'),
        ]);

        expect(hash1).toBe(hash0);
        expect(hash3).toBe(hash0);
    });
});
