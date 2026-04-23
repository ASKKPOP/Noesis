'use client';
/**
 * useWhisperCounts — derived selector over useFirehose() that returns
 * whisper activity counts for the selected Nous.
 *
 * Phase 11 WHISPER-02 / D-11-15 counts-only render-surface contract:
 *   - client-only, zero new RPC, zero new WebSocket
 *   - source-of-truth: existing audit buffer (nous.whispered entries)
 *   - filters by eventType === 'nous.whispered'
 *   - counts sent (from_did === did) and received (to_did === did)
 *   - tracks lastTick = max(lastTick, entry.payload.tick)
 *   - builds top-5 partner list by total interaction count
 *   - foreign-DID entries are filtered out
 *   - non-whisper event types are silently dropped at the hook boundary
 *
 * PRIVACY (WHISPER-02):
 *   - Only counts, tick, and DID strings are derived
 *   - NO ciphertext_hash exposed (not derived, never displayed)
 *   - NO ciphertext content
 *   - NO plaintext of any kind
 *
 * Clone of dashboard/src/lib/hooks/use-ananke-levels.ts (Plan 10a-05).
 * Zero wall-clock reads. Zero timers. Memoised on (entries, did).
 *
 * See: 11-CONTEXT.md D-11-15. WHISPER-02.
 */

import { useMemo } from 'react';
import { useFirehose } from '@/app/grid/hooks';
import type { WhisperState, WhisperPartner } from '@/lib/stores/whisperStore';

const NOUS_WHISPERED = 'nous.whispered';

/** Shape of a nous.whispered payload — only the fields needed for counts. */
interface WhisperedPayload {
    from_did: string;
    to_did: string;
    tick: number;
}

function isWhisperedPayload(p: unknown): p is WhisperedPayload {
    if (typeof p !== 'object' || p === null) return false;
    const r = p as Record<string, unknown>;
    return (
        typeof r.from_did === 'string' &&
        typeof r.to_did === 'string' &&
        typeof r.tick === 'number'
    );
}

/**
 * Returns whisper activity counts for the given DID, derived from the
 * live firehose snapshot. Re-renders only when the firehose snapshot
 * changes or the DID selection flips.
 *
 * @param did - The inspected Nous DID (null returns zero-state)
 */
export function useWhisperCounts(did: string | null): WhisperState {
    const snap = useFirehose();

    return useMemo<WhisperState>(() => {
        if (!did) {
            return { sent: 0, received: 0, lastTick: null, topPartners: [] };
        }

        let sent = 0;
        let received = 0;
        let lastTick: number | null = null;
        const partnerCounts = new Map<string, number>();

        for (const entry of snap.entries) {
            if (entry.eventType !== NOUS_WHISPERED) continue;
            if (!isWhisperedPayload(entry.payload)) continue;

            const { from_did, to_did, tick } = entry.payload;

            if (from_did === did) {
                sent += 1;
                partnerCounts.set(to_did, (partnerCounts.get(to_did) ?? 0) + 1);
            } else if (to_did === did) {
                received += 1;
                partnerCounts.set(from_did, (partnerCounts.get(from_did) ?? 0) + 1);
            } else {
                continue;
            }

            if (lastTick === null || tick > lastTick) {
                lastTick = tick;
            }
        }

        const topPartners: WhisperPartner[] = Array.from(partnerCounts.entries())
            .map(([partnerDid, count]) => ({ did: partnerDid, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return { sent, received, lastTick, topPartners };
    }, [snap.entries, did]);
}
