/**
 * Phase 8 AGENCY-05 — zero-diff invariant for operator.nous_deleted.
 *
 * Asserts that the audit chain head hash is byte-identical whether 0 or N
 * listeners are subscribed to AuditChain.onAppend at the time the
 * operator.nous_deleted event is emitted (D-26).
 *
 * AuditChain.computeHash incorporates Date.now() — fake timers are required
 * so both chain builds produce identical timestamps and thus identical hashes.
 * Mirrors the Phase 5 zero-diff test pattern (review/zero-diff.test.ts).
 *
 * Listeners are side-channel observers only — they must not influence the
 * deterministic hash state of the chain.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendNousDeleted } from '../../src/audit/append-nous-deleted.js';
import { combineStateHash } from '../../src/audit/state-hash.js';

const OPERATOR = 'op:11111111-1111-4111-8111-111111111111';
const TARGET   = 'did:noesis:alpha';
const FIXED_TIME = new Date('2026-01-01T00:00:00.000Z').getTime();

const BRAIN_HASHES = {
    psyche_hash:        'a'.repeat(64),
    thymos_hash:        'b'.repeat(64),
    telos_hash:         'c'.repeat(64),
    memory_stream_hash: 'd'.repeat(64),
};

const STATE_HASH = combineStateHash(BRAIN_HASHES);

const PAYLOAD = {
    tier: 'H5' as const,
    action: 'delete' as const,
    operator_id: OPERATOR,
    target_did: TARGET,
    pre_deletion_state_hash: STATE_HASH,
};

function buildChainWithPriorEvents(): AuditChain {
    const chain = new AuditChain();
    chain.append('nous.spawned', TARGET, { name: 'Alpha', region: 'agora', tick: 0 });
    chain.append('nous.spoke',   TARGET, { name: 'Alpha', channel: 'agora', text: 'hello', tick: 5 });
    chain.append('nous.moved',   TARGET, { name: 'Alpha', fromRegion: 'agora', toRegion: 'market', tick: 10 });
    return chain;
}

describe('operator.nous_deleted — zero-diff invariant (AGENCY-05 D-26)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_TIME);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('0 listeners vs 1 listener: same head hash after appendNousDeleted', () => {
        // Chain with 0 listeners
        const chain0 = buildChainWithPriorEvents();
        appendNousDeleted(chain0, OPERATOR, PAYLOAD);
        const head0 = chain0.head;

        // Chain with 1 listener — same fixed time → same hash
        const chain1 = buildChainWithPriorEvents();
        const observed: string[] = [];
        chain1.onAppend((entry) => { observed.push(entry.eventType); });
        appendNousDeleted(chain1, OPERATOR, PAYLOAD);
        const head1 = chain1.head;

        expect(head0).toBe(head1);
        expect(head0).toMatch(/^[0-9a-f]{64}$/);
        // Listener fired once for the deletion event only (registered after prior 3 events)
        expect(observed).toEqual(['operator.nous_deleted']);
    });

    it('0 listeners vs 3 listeners: same head hash after appendNousDeleted', () => {
        const chain0 = buildChainWithPriorEvents();
        appendNousDeleted(chain0, OPERATOR, PAYLOAD);
        const head0 = chain0.head;

        const chainN = buildChainWithPriorEvents();
        let listenerCount = 0;
        chainN.onAppend(() => { listenerCount++; });
        chainN.onAppend(() => { listenerCount++; });
        chainN.onAppend(() => { listenerCount++; });
        appendNousDeleted(chainN, OPERATOR, PAYLOAD);
        const headN = chainN.head;

        expect(head0).toBe(headN);
        // Listeners registered AFTER prior 3 events — only fire for the deletion event
        expect(listenerCount).toBe(1 * 3);
    });

    it('listener that throws does NOT corrupt chain head hash', () => {
        const chain0 = buildChainWithPriorEvents();
        appendNousDeleted(chain0, OPERATOR, PAYLOAD);
        const head0 = chain0.head;

        const chainThrow = buildChainWithPriorEvents();
        chainThrow.onAppend(() => { throw new Error('observer crash'); });
        // Should NOT throw out of appendNousDeleted
        expect(() => appendNousDeleted(chainThrow, OPERATOR, PAYLOAD)).not.toThrow();
        expect(chainThrow.head).toBe(head0);
    });
});
