'use client';
/**
 * useRefinedTelosHistory — derived selector over useFirehose().
 *
 * D-28: client-only, zero new RPC, zero new WebSocket. Returns a stable
 * summary of `telos.refined` events for the selected Nous:
 *   - refinedCount — how many valid refinements in current firehose snapshot
 *   - lastRefinedDialogueId — triggered_by_dialogue_id of the most recent one
 *   - refinedAfterHashes — set of all after_goal_hash values (kept for the
 *     D-30 deferral exit path: future per-goal attribution)
 *
 * Malformed events (non-16-hex dialogue_id, missing/invalid after_goal_hash)
 * are silently dropped — matches 07-UI-SPEC §State Contract "Silent drop at
 * hook boundary" + the Phase 6 D-16 pattern.
 *
 * Plaintext invariant (PHILOSOPHY §1, D-18): this hook NEVER references
 * `new_goals`, `goal_description`, or `utterance` from a telos.refined payload.
 * Enforced by the grep-based source test in telos-refined-badge.test.tsx.
 *
 * Keep the regex constants in sync with:
 *   - grid/src/audit/append-telos-refined.ts (producer boundary)
 *   - dashboard/src/lib/hooks/use-firehose-filter.ts (sibling consumer)
 */
import { useMemo } from 'react';
import { useFirehose } from '@/app/grid/hooks';

const DIALOGUE_ID_RE = /^[0-9a-f]{16}$/;
const HEX64_RE = /^[0-9a-f]{64}$/;

interface TelosRefinedPayload {
    did: string;
    before_goal_hash: string;
    after_goal_hash: string;
    triggered_by_dialogue_id: string;
}

function isValidPayload(p: unknown, targetDid: string): p is TelosRefinedPayload {
    if (typeof p !== 'object' || p === null) return false;
    const r = p as Record<string, unknown>;
    return (
        r.did === targetDid &&
        typeof r.triggered_by_dialogue_id === 'string' &&
        DIALOGUE_ID_RE.test(r.triggered_by_dialogue_id) &&
        typeof r.after_goal_hash === 'string' &&
        HEX64_RE.test(r.after_goal_hash) &&
        typeof r.before_goal_hash === 'string' &&
        HEX64_RE.test(r.before_goal_hash)
    );
}

export interface RefinedTelosHistory {
    readonly lastRefinedDialogueId: string | null;
    readonly refinedCount: number;
    readonly refinedAfterHashes: ReadonlySet<string>;
}

const EMPTY: RefinedTelosHistory = Object.freeze({
    lastRefinedDialogueId: null,
    refinedCount: 0,
    refinedAfterHashes: new Set<string>(),
});

export function useRefinedTelosHistory(did: string | null): RefinedTelosHistory {
    const snap = useFirehose();
    return useMemo<RefinedTelosHistory>(() => {
        if (!did) return EMPTY;
        const matches = snap.entries.filter(
            (e) => e.eventType === 'telos.refined' && isValidPayload(e.payload, did),
        );
        if (matches.length === 0) return EMPTY;
        const last = matches[matches.length - 1]!;
        const hashes = new Set<string>();
        for (const m of matches) {
            hashes.add((m.payload as unknown as TelosRefinedPayload).after_goal_hash);
        }
        return {
            lastRefinedDialogueId: (last.payload as unknown as TelosRefinedPayload)
                .triggered_by_dialogue_id,
            refinedCount: matches.length,
            refinedAfterHashes: hashes,
        };
    }, [did, snap.entries]);
}
