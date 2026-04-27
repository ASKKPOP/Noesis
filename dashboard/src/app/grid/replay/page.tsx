/**
 * /grid/replay — server component.
 *
 * Phase 13 (REPLAY-05 / D-13-04 / D-13-05).
 *
 * This file stays a server component (no 'use client'). Its only job is to:
 *   1. Read NEXT_PUBLIC_GRID_ORIGIN at request time.
 *   2. Best-effort fetch audit slice metadata (start tick, end tick, entry count)
 *      from /api/v1/grid/audit?limit=1 for initial slider bounds.
 *   3. Hand everything to <ReplayClient /> which owns the replay lifecycle.
 *
 * No auth tokens are rendered here; tier state is client-side per D-01.
 */

import { ReplayClient } from './replay-client';

interface AuditBoundsResponse {
    startTick?: number;
    endTick?: number;
    total?: number;
    entries?: Array<{ id: number }>;
}

async function fetchAuditBounds(origin: string): Promise<{ startTick: number; endTick: number }> {
    const res = await fetch(`${origin}/api/v1/grid/audit?limit=1`, { cache: 'no-store' });
    if (!res.ok) {
        return { startTick: 0, endTick: 0 };
    }
    const body = (await res.json()) as AuditBoundsResponse;
    const startTick = body.startTick ?? 0;
    const endTick = body.endTick ?? (body.total ?? 0);
    return { startTick, endTick };
}

export default async function ReplayPage(): Promise<React.ReactElement> {
    const origin = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
    let initialBounds = { startTick: 0, endTick: 0 };
    try {
        initialBounds = await fetchAuditBounds(origin);
    } catch {
        // Grid unavailable on load — client will show empty scrubber (graceful)
    }
    return (
        <ReplayClient
            operatorTier="H1"
            entries={[]}
            startTick={initialBounds.startTick}
            endTick={initialBounds.endTick}
            gridId=""
            origin={origin}
        />
    );
}
