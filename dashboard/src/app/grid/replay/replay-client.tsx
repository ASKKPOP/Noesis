'use client';
/**
 * ReplayClient — Steward Console rewind surface at /grid/replay.
 *
 * Phase 13 (REPLAY-05 / D-13-05, D-13-06, D-13-07 / T-10-09).
 *
 * Tier gate discipline (T-10-09 / D-13-05):
 *   - H1/H2: renders TIER_GATE_COPY only — no scrubber, no replay panels.
 *   - H3+: renders REPLAY badge banner, Scrubber, Firehose, Inspector, RegionMap.
 *
 * Store switching (D-13-03 / gap-closure 13-07):
 *   - ReplayStoresProvider wraps the panel surface and overrides the context
 *     with replay-scoped FirehoseStore + PresenceStore seeded from `entries`.
 *   - Firehose, Inspector, RegionMap call useStores() inside this provider
 *     and therefore read from the replay-scoped stores, not the live ones.
 *
 * Inline redaction (D-13-06):
 *   - H4-restricted fields: FirehoseRow renders H4_PLACEHOLDER inline.
 *   - H5-restricted fields: FirehoseRow renders H5_PLACEHOLDER inline.
 *   - Tier is read by Firehose and plumbed to each FirehoseRow.
 *
 * Tier auto-downgrade (D-13-07 / T-13-05-01):
 *   - useEffect cleanup calls agencyStore.setTier('H1') on unmount.
 *   - Fires on route exit, browser back, and hard navigation.
 *
 * Wall-clock discipline (D-13-04):
 *   - No wall-clock reads in the replay tree (CI gate enforces this).
 *   - All timing derives from the rewound chain tick.
 *
 * Copy-lock: TIER_GATE_COPY, REPLAY_BADGE_COPY are verbatim constants — tests
 * assert these literals. H4_PLACEHOLDER + H5_PLACEHOLDER are single-sourced
 * from replay-redaction-copy.ts and re-exported here for test continuity.
 */

import { useEffect, useState } from 'react';
import { agencyStore } from '@/lib/stores/agency-store';
import type { HumanAgencyTier } from '@/lib/protocol/agency-types';
import type { Region, RegionConnection } from '@/lib/protocol/region-types';
import type { AuditEntry } from '@/lib/protocol/audit-types';
import { Scrubber } from './scrubber';
import { ExportConsentDialog } from './export-consent-dialog';
import { Firehose } from '../components/firehose';
import { Inspector } from '../components/inspector';
import { RegionMap } from '../components/region-map';
import { ReplayStoresProvider } from './replay-stores';
// Re-export verbatim copy constants for test assertion continuity (D-13-08).
export { H4_PLACEHOLDER, H5_PLACEHOLDER } from './replay-redaction-copy';

// ── Verbatim copy constants (tests assert these literals) ─────────────────────
const TIER_GATE_COPY = 'Replay requires H3 or higher';
const REPLAY_BADGE_COPY = 'REPLAY';

type Tier = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';

const TIER_ORDER: Tier[] = ['H1', 'H2', 'H3', 'H4', 'H5'];

function tierAtLeast(tier: Tier, minimum: Tier): boolean {
    return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum);
}

export interface ReplayClientProps {
    operatorTier: HumanAgencyTier;
    entries: readonly AuditEntry[];
    startTick: number;
    endTick: number;
    gridId: string;
    origin?: string;
    regions?: readonly Region[];
    connections?: readonly RegionConnection[];
}

export function ReplayClient({
    operatorTier,
    entries,
    startTick,
    endTick,
    gridId,
    origin = '',
    regions = [],
    connections = [],
}: ReplayClientProps) {
    const [targetTick, setTargetTick] = useState<number>(startTick);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);

    // D-13-07 / T-13-05-01: tier auto-downgrade on route exit (unmount).
    // useEffect cleanup fires on unmount AND on dependency change.
    useEffect(() => {
        return () => {
            agencyStore.setTier('H1');
        };
    }, []);

    const tier = operatorTier as Tier;
    const isH3Plus = tierAtLeast(tier, 'H3');
    const isH5 = tier === 'H5';

    // Tier gate: H1/H2 sees only the gate message.
    if (!isH3Plus) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <div
                    className="text-sm text-neutral-400"
                    data-testid="tier-gate"
                >
                    {TIER_GATE_COPY}
                </div>
            </div>
        );
    }

    // H3+: render the replay shell.
    // Clamp scrubber changes to [startTick, endTick] range.
    const handleScrubberChange = (tick: number) => {
        const min = startTick;
        const max = endTick;
        const clamped = tick < min ? min : tick > max ? max : tick;
        setTargetTick(clamped);
    };

    return (
        <ReplayStoresProvider entries={entries}>
            <div className="flex flex-col min-h-0 gap-4 p-4">
                {/* REPLAY badge banner (amber border — T-10-09 visual indicator) */}
                <div
                    className="replay-badge amber-border flex items-center gap-2 border border-amber-500 rounded px-3 py-1.5 text-amber-400 text-xs font-semibold"
                    data-testid="replay-badge"
                >
                    {REPLAY_BADGE_COPY}
                </div>

                {/* Scrubber */}
                <Scrubber
                    value={targetTick}
                    startTick={startTick}
                    endTick={endTick}
                    onChange={handleScrubberChange}
                />

                {/* Export button — H5-gated (T-13-05-03) */}
                <div>
                    <button
                        type="button"
                        onClick={() => setExportDialogOpen(true)}
                        disabled={!isH5}
                        title={!isH5 ? 'Export requires H5' : undefined}
                        data-testid="replay-export-button"
                        className={
                            isH5
                                ? 'px-3 py-1 text-xs text-amber-400 border border-amber-600 rounded hover:bg-amber-900/20'
                                : 'px-3 py-1 text-xs text-neutral-600 border border-neutral-700 rounded cursor-not-allowed'
                        }
                    >
                        Export
                    </button>
                </div>

                {/* Three-panel surface mounted with replayMode (D-13-03 / gap-closure 13-07) */}
                <div className="grid grid-cols-[1fr_2fr_1fr] gap-4 flex-1 min-h-0">
                    <div className="min-h-0">
                        <RegionMap
                            regions={regions}
                            connections={connections}
                            replayMode
                        />
                    </div>
                    <div className="min-h-0">
                        <Firehose replayMode />
                    </div>
                    <div className="min-h-0">
                        <Inspector replayMode />
                    </div>
                </div>

                {/* ExportConsentDialog (H5-gated — T-10-10) */}
                {exportDialogOpen && (
                    <ExportConsentDialog
                        open={exportDialogOpen}
                        gridId={gridId}
                        onConfirm={() => {
                            setExportDialogOpen(false);
                            // Fetch the export — parent owns the fetch call (T-10-10)
                            if (origin) {
                                fetch(
                                    `${origin}/api/v1/operator/replay/export`,
                                    {
                                        method: 'POST',
                                        headers: { 'content-type': 'application/json' },
                                        body: JSON.stringify({
                                            tier: 'H5',
                                            operator_id: gridId,
                                            start_tick: startTick,
                                            end_tick: endTick,
                                        }),
                                    },
                                ).then((res) => {
                                    if (res.ok) {
                                        return res.blob().then((blob) => {
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `replay-${startTick}-${endTick}.tar`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        });
                                    }
                                }).catch(() => {
                                    // Export fetch failed — silently ignore for now
                                });
                            }
                        }}
                        onCancel={() => setExportDialogOpen(false)}
                    />
                )}
            </div>
        </ReplayStoresProvider>
    );
}
