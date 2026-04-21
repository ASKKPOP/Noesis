import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { FirehoseSnapshot } from '@/lib/stores/firehose-store';
import type { AuditEntry } from '@/lib/protocol/audit-types';

/**
 * Plan 07-04 Task 1 — useRefinedTelosHistory hook tests.
 *
 * D-28: client-only derived selector over useFirehose(). Zero new RPC, zero new
 * WebSocket. Returns {lastRefinedDialogueId, refinedCount, refinedAfterHashes}
 * filtered to the selected Nous DID.
 *
 * Malformed telos.refined payloads (non-16-hex dialogue_id, missing/malformed
 * hash fields) are silently dropped — matches 07-UI-SPEC §State Contract.
 */

// Mutable snapshot the test body rewrites per-case.
let mockSnapshot: FirehoseSnapshot = {
    entries: [],
    filteredEntries: [],
    filter: null,
    size: 0,
};

vi.mock('@/app/grid/hooks', () => ({
    useFirehose: () => mockSnapshot,
}));

import { useRefinedTelosHistory } from './use-refined-telos-history';

function makeSnapshot(entries: readonly AuditEntry[]): FirehoseSnapshot {
    return {
        entries,
        filteredEntries: entries,
        filter: null,
        size: entries.length,
    };
}

function makeEntry(
    eventType: string,
    actorDid: string,
    payload: Record<string, unknown>,
    id: number,
): AuditEntry {
    return {
        id,
        eventType,
        actorDid,
        payload,
        prevHash: `prev${id}`,
        eventHash: `hash${id}`,
        createdAt: 1_700_000_000_000 + id * 1000,
    };
}

// Valid 64-hex fixture (padding).
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);

// Valid 16-hex dialogue ids.
const DID_ID_1 = 'a1b2c3d4e5f6a7b8';
const DID_ID_2 = 'b2c3d4e5f6a7b8a1';
const DID_ID_3 = 'c3d4e5f6a7b8a1b2';

beforeEach(() => {
    mockSnapshot = makeSnapshot([]);
});

describe('useRefinedTelosHistory — null/empty states', () => {
    it('returns zero-state when did is null', () => {
        mockSnapshot = makeSnapshot([
            makeEntry(
                'telos.refined',
                'did:noesis:alice',
                {
                    did: 'did:noesis:alice',
                    before_goal_hash: HASH_A,
                    after_goal_hash: HASH_B,
                    triggered_by_dialogue_id: DID_ID_1,
                },
                1,
            ),
        ]);
        const { result } = renderHook(() => useRefinedTelosHistory(null));
        expect(result.current.refinedCount).toBe(0);
        expect(result.current.lastRefinedDialogueId).toBeNull();
        expect(result.current.refinedAfterHashes.size).toBe(0);
    });

    it('returns zero-state when firehose has no matching entries', () => {
        mockSnapshot = makeSnapshot([]);
        const { result } = renderHook(() => useRefinedTelosHistory('did:noesis:alice'));
        expect(result.current.refinedCount).toBe(0);
        expect(result.current.lastRefinedDialogueId).toBeNull();
        expect(result.current.refinedAfterHashes.size).toBe(0);
    });
});

describe('useRefinedTelosHistory — well-formed matching', () => {
    it('counts three matching telos.refined entries and returns last dialogue_id', () => {
        mockSnapshot = makeSnapshot([
            makeEntry(
                'telos.refined',
                'did:noesis:alice',
                {
                    did: 'did:noesis:alice',
                    before_goal_hash: HASH_A,
                    after_goal_hash: HASH_B,
                    triggered_by_dialogue_id: DID_ID_1,
                },
                1,
            ),
            makeEntry(
                'telos.refined',
                'did:noesis:alice',
                {
                    did: 'did:noesis:alice',
                    before_goal_hash: HASH_B,
                    after_goal_hash: HASH_C,
                    triggered_by_dialogue_id: DID_ID_2,
                },
                2,
            ),
            makeEntry(
                'telos.refined',
                'did:noesis:alice',
                {
                    did: 'did:noesis:alice',
                    before_goal_hash: HASH_C,
                    after_goal_hash: HASH_D,
                    triggered_by_dialogue_id: DID_ID_3,
                },
                3,
            ),
        ]);
        const { result } = renderHook(() => useRefinedTelosHistory('did:noesis:alice'));
        expect(result.current.refinedCount).toBe(3);
        // oldest-first in entries array → last entry is newest → DID_ID_3
        expect(result.current.lastRefinedDialogueId).toBe(DID_ID_3);
        expect(result.current.refinedAfterHashes.size).toBe(3);
        expect(result.current.refinedAfterHashes.has(HASH_B)).toBe(true);
        expect(result.current.refinedAfterHashes.has(HASH_C)).toBe(true);
        expect(result.current.refinedAfterHashes.has(HASH_D)).toBe(true);
    });

    it('filters by target did when mixed stream contains alice + bob entries', () => {
        mockSnapshot = makeSnapshot([
            makeEntry(
                'telos.refined',
                'did:noesis:alice',
                {
                    did: 'did:noesis:alice',
                    before_goal_hash: HASH_A,
                    after_goal_hash: HASH_B,
                    triggered_by_dialogue_id: DID_ID_1,
                },
                1,
            ),
            makeEntry(
                'telos.refined',
                'did:noesis:bob',
                {
                    did: 'did:noesis:bob',
                    before_goal_hash: HASH_A,
                    after_goal_hash: HASH_C,
                    triggered_by_dialogue_id: DID_ID_2,
                },
                2,
            ),
            makeEntry(
                'telos.refined',
                'did:noesis:alice',
                {
                    did: 'did:noesis:alice',
                    before_goal_hash: HASH_B,
                    after_goal_hash: HASH_D,
                    triggered_by_dialogue_id: DID_ID_3,
                },
                3,
            ),
            makeEntry(
                'telos.refined',
                'did:noesis:bob',
                {
                    did: 'did:noesis:bob',
                    before_goal_hash: HASH_C,
                    after_goal_hash: HASH_D,
                    triggered_by_dialogue_id: DID_ID_1,
                },
                4,
            ),
        ]);
        const { result: alice } = renderHook(() =>
            useRefinedTelosHistory('did:noesis:alice'),
        );
        expect(alice.current.refinedCount).toBe(2);
        expect(alice.current.lastRefinedDialogueId).toBe(DID_ID_3);

        const { result: bob } = renderHook(() => useRefinedTelosHistory('did:noesis:bob'));
        expect(bob.current.refinedCount).toBe(2);
        expect(bob.current.lastRefinedDialogueId).toBe(DID_ID_1);
    });
});

describe('useRefinedTelosHistory — malformed drop', () => {
    it('silently drops entries whose triggered_by_dialogue_id is not 16-hex', () => {
        mockSnapshot = makeSnapshot([
            makeEntry(
                'telos.refined',
                'did:noesis:alice',
                {
                    did: 'did:noesis:alice',
                    before_goal_hash: HASH_A,
                    after_goal_hash: HASH_B,
                    triggered_by_dialogue_id: 'NOTHEX',
                },
                1,
            ),
        ]);
        const { result } = renderHook(() => useRefinedTelosHistory('did:noesis:alice'));
        expect(result.current.refinedCount).toBe(0);
        expect(result.current.lastRefinedDialogueId).toBeNull();
    });

    it('silently drops entries missing after_goal_hash', () => {
        mockSnapshot = makeSnapshot([
            makeEntry(
                'telos.refined',
                'did:noesis:alice',
                {
                    did: 'did:noesis:alice',
                    before_goal_hash: HASH_A,
                    triggered_by_dialogue_id: DID_ID_1,
                },
                1,
            ),
        ]);
        const { result } = renderHook(() => useRefinedTelosHistory('did:noesis:alice'));
        expect(result.current.refinedCount).toBe(0);
    });

    it('ignores non-telos.refined events even if payload.did matches', () => {
        mockSnapshot = makeSnapshot([
            makeEntry(
                'nous.spoke',
                'did:noesis:alice',
                {
                    did: 'did:noesis:alice',
                    before_goal_hash: HASH_A,
                    after_goal_hash: HASH_B,
                    triggered_by_dialogue_id: DID_ID_1,
                },
                1,
            ),
        ]);
        const { result } = renderHook(() => useRefinedTelosHistory('did:noesis:alice'));
        expect(result.current.refinedCount).toBe(0);
    });
});

describe('useRefinedTelosHistory — reference stability (useMemo discipline)', () => {
    it('returns referentially equal refinedAfterHashes across re-renders with identical entries', () => {
        const entries = [
            makeEntry(
                'telos.refined',
                'did:noesis:alice',
                {
                    did: 'did:noesis:alice',
                    before_goal_hash: HASH_A,
                    after_goal_hash: HASH_B,
                    triggered_by_dialogue_id: DID_ID_1,
                },
                1,
            ),
        ];
        mockSnapshot = makeSnapshot(entries);
        const { result, rerender } = renderHook(() =>
            useRefinedTelosHistory('did:noesis:alice'),
        );
        const first = result.current.refinedAfterHashes;
        rerender();
        const second = result.current.refinedAfterHashes;
        // Reference equality — useMemo deps [did, snap.entries] stable.
        expect(first).toBe(second);
    });
});
