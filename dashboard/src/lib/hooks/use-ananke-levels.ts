'use client';
/**
 * useAnankeLevels — derived selector over useFirehose() that returns a
 * per-drive {level, direction} map for the selected Nous.
 *
 * Plan 10a-05 DRIVE-05 render-surface contract:
 *   - client-only, zero new RPC, zero new WebSocket
 *   - source-of-truth: existing audit buffer (ananke.drive_crossed entries)
 *   - drives with no crossings fall back to DRIVE_BASELINE_LEVEL with
 *     direction=null ("stable", no glyph)
 *   - foreign-DID entries are filtered out (actorDid !== did)
 *   - non-ananke event types are silently dropped at the hook boundary
 *   - later entries overwrite earlier ones for the same drive
 *
 * Zero wall-clock reads. Zero timers. The returned Map is memoised on
 * (entries, did); re-renders only when the firehose snapshot changes or
 * the DID selection flips.
 *
 * Mirrors the pattern in use-refined-telos-history.ts.
 */

import { useMemo } from 'react';
import { useFirehose } from '@/app/grid/hooks';
import {
    DRIVE_ORDER,
    DRIVE_BASELINE_LEVEL,
    type DriveName,
    type AnankeLevelEntry,
    type AnankeDriveCrossedPayload,
} from '@/lib/protocol/ananke-types';

const ANANKE_DRIVE_CROSSED = 'ananke.drive_crossed';

function baselineMap(): Map<DriveName, AnankeLevelEntry> {
    const map = new Map<DriveName, AnankeLevelEntry>();
    for (const drive of DRIVE_ORDER) {
        map.set(drive, {
            level: DRIVE_BASELINE_LEVEL[drive],
            direction: null,
        });
    }
    return map;
}

function isAnankeCrossingPayload(
    p: unknown,
    targetDid: string,
): p is AnankeDriveCrossedPayload {
    if (typeof p !== 'object' || p === null) return false;
    const r = p as Record<string, unknown>;
    if (r.did !== targetDid) return false;
    if (typeof r.drive !== 'string') return false;
    if (!DRIVE_ORDER.includes(r.drive as DriveName)) return false;
    if (r.level !== 'low' && r.level !== 'med' && r.level !== 'high') {
        return false;
    }
    if (r.direction !== 'rising' && r.direction !== 'falling') return false;
    if (typeof r.tick !== 'number') return false;
    return true;
}

export function useAnankeLevels(
    did: string | null,
): Map<DriveName, AnankeLevelEntry> {
    const snap = useFirehose();
    return useMemo<Map<DriveName, AnankeLevelEntry>>(() => {
        const map = baselineMap();
        if (!did) return map;

        // Walk entries in chronological order; overwriting ensures the last
        // crossing per drive wins. The audit buffer is already time-ordered
        // (firehose-store append-only).
        for (const entry of snap.entries) {
            if (entry.eventType !== ANANKE_DRIVE_CROSSED) continue;
            if (entry.actorDid !== did) continue;
            if (!isAnankeCrossingPayload(entry.payload, did)) continue;
            map.set(entry.payload.drive, {
                level: entry.payload.level,
                direction: entry.payload.direction,
            });
        }
        return map;
    }, [snap.entries, did]);
}
