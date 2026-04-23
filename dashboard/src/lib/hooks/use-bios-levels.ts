'use client';
/**
 * useBiosLevels — derived selector over useFirehose() that returns a
 * per-need {level, direction} map for the selected Nous.
 *
 * Phase 10b BIOS render-surface contract:
 *   - client-only, zero new RPC, zero new WebSocket
 *   - source-of-truth: existing audit buffer (ananke.drive_crossed entries
 *     for hunger and safety drives — D-10b-02 elevator mapping)
 *   - needs with no crossings fall back to NEED_BASELINE_LEVEL with
 *     direction=null ("stable", no glyph)
 *   - foreign-DID entries are filtered out (actorDid !== did)
 *   - non-ananke event types are silently dropped at the hook boundary
 *   - later entries overwrite earlier ones for the same need
 *   - raw float values NEVER enter the dashboard pipeline — only bucket
 *     levels already present in ananke.drive_crossed payloads
 *
 * Zero wall-clock reads. Zero timers. The returned Map is memoised on
 * (entries, did); re-renders only when the firehose snapshot changes or
 * the DID selection flips.
 *
 * D-10b-02: Bios elevates hunger (energy) and safety (sustenance).
 * The dashboard receives ananke.drive_crossed for these drives and projects
 * them back to Bios needs for display. No bios.* event carries level data
 * — this is by design.
 */

import { useMemo } from 'react';
import { useFirehose } from '@/app/grid/hooks';
import {
    NEED_ORDER,
    NEED_BASELINE_LEVEL,
    type NeedName,
    type BiosLevelEntry,
    type NeedLevel,
} from '@/lib/protocol/bios-types';
import type { AnankeDriveCrossedPayload } from '@/lib/protocol/ananke-types';

const ANANKE_DRIVE_CROSSED = 'ananke.drive_crossed';

/**
 * Maps the two Bios-relevant Ananke drives to their corresponding need names.
 * Drives not in this map (curiosity, boredom, loneliness) are silently ignored.
 */
const DRIVE_TO_NEED: Partial<Record<string, NeedName>> = {
    hunger: 'energy',
    safety: 'sustenance',
};

function baselineMap(): Map<NeedName, BiosLevelEntry> {
    const map = new Map<NeedName, BiosLevelEntry>();
    for (const need of NEED_ORDER) {
        map.set(need, {
            level: NEED_BASELINE_LEVEL[need],
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
    const level = r.level as NeedLevel;
    if (level !== 'low' && level !== 'med' && level !== 'high') return false;
    if (r.direction !== 'rising' && r.direction !== 'falling') return false;
    if (typeof r.tick !== 'number') return false;
    return true;
}

export function useBiosLevels(did: string | null): Map<NeedName, BiosLevelEntry> {
    const snap = useFirehose();
    return useMemo<Map<NeedName, BiosLevelEntry>>(() => {
        const map = baselineMap();
        if (!did) return map;

        // Walk entries in chronological order; overwriting ensures the last
        // crossing per drive wins. The audit buffer is already time-ordered
        // (firehose-store append-only).
        for (const entry of snap.entries) {
            if (entry.eventType !== ANANKE_DRIVE_CROSSED) continue;
            if (entry.actorDid !== did) continue;
            if (!isAnankeCrossingPayload(entry.payload, did)) continue;
            const need = DRIVE_TO_NEED[entry.payload.drive];
            if (!need) continue;  // curiosity, boredom, loneliness — not a Bios need
            map.set(need, {
                level: entry.payload.level,
                direction: entry.payload.direction,
            });
        }
        return map;
    }, [snap.entries, did]);
}
