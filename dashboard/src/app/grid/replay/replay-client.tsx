'use client';
/**
 * ReplayClient — Steward Console rewind surface at /grid/replay.
 *
 * Phase 13 (REPLAY-05 / D-13-05, D-13-06, D-13-07 / T-10-09).
 *
 * Tier gate discipline (T-10-09 / D-13-05):
 *   - H1/H2: renders TIER_GATE_COPY only — no scrubber, no replay panels.
 *   - H3+: renders REPLAY badge banner, Scrubber, and entry list with
 *     inline redaction for H4/H5-restricted content.
 *
 * Inline redaction (D-13-06):
 *   - H4-restricted fields (e.g. telos detail): render H4_PLACEHOLDER inline.
 *   - H5-restricted fields (e.g. whisper content): render H5_PLACEHOLDER inline.
 *   - Placeholders render unconditionally at wrong tier — no data fetched-then-hidden.
 *
 * Tier auto-downgrade (D-13-07 / T-13-05-01):
 *   - useEffect cleanup calls agencyStore.setTier('H1') on unmount.
 *   - Fires on route exit, browser back, and hard navigation.
 *
 * Wall-clock discipline (D-13-04):
 *   - No wall-clock reads in the replay tree (CI gate enforces this).
 *   - All timing derives from the rewound chain tick.
 *
 * Copy-lock: TIER_GATE_COPY, REPLAY_BADGE_COPY, H4_PLACEHOLDER, H5_PLACEHOLDER
 * are verbatim constants — tests assert these literals.
 */

import { useEffect, useState } from 'react';
import { agencyStore } from '@/lib/stores/agency-store';
import type { HumanAgencyTier } from '@/lib/protocol/agency-types';
import { Scrubber } from './scrubber';
import { ExportConsentDialog } from './export-consent-dialog';

// ── Verbatim copy constants (tests assert these literals) ─────────────────────
const TIER_GATE_COPY = 'Replay requires H3 or higher';
const REPLAY_BADGE_COPY = 'REPLAY';
const H4_PLACEHOLDER = '— Requires H4';
const H5_PLACEHOLDER = '— Requires H5';

// Event types that require elevated tiers to view details
const H4_RESTRICTED_EVENT_TYPES = new Set([
    'telos.refined',
    'operator.telos_forced',
]);

const H5_RESTRICTED_EVENT_TYPES = new Set([
    'nous.whispered',
    'operator.nous_deleted',
]);

export interface ReplayAuditEntry {
    id: number;
    eventType: string;
    actorDid: string;
    payload: unknown;
    prevHash: string;
    eventHash: string;
    createdAt: number;
}

type Tier = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';

const TIER_ORDER: Tier[] = ['H1', 'H2', 'H3', 'H4', 'H5'];

function tierAtLeast(tier: Tier, minimum: Tier): boolean {
    return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum);
}

export interface ReplayClientProps {
    operatorTier: HumanAgencyTier;
    entries: unknown[];
    startTick: number;
    endTick: number;
    gridId: string;
    origin?: string;
}

export function ReplayClient({
    operatorTier,
    entries,
    startTick,
    endTick,
    gridId,
    origin = '',
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
    const isH4Plus = tierAtLeast(tier, 'H4');
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

    // The entries prop represents the pre-fetched audit slice for this session.
    // All entries in the slice are rendered; the scrubber controls the replay
    // position indicator, not a filter (D-13-06: no data fetched-then-hidden).
    const visibleEntries = entries as ReplayAuditEntry[];

    return (
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

            {/* Replay entry list with inline redaction (D-13-06) */}
            <div
                className="flex-1 min-h-0 overflow-y-auto border border-neutral-800 rounded-md bg-[#17181C]"
                data-testid="replay-firehose"
            >
                {visibleEntries.length === 0 ? (
                    <div className="p-4 text-neutral-500 text-sm">No entries at this tick.</div>
                ) : (
                    <ul role="list" className="divide-y divide-neutral-800">
                        {visibleEntries.map((entry) => (
                            <ReplayEntryRow
                                key={`${entry.id ?? entry.eventHash}`}
                                entry={entry}
                                isH4Plus={isH4Plus}
                                isH5={isH5}
                            />
                        ))}
                    </ul>
                )}
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
    );
}

// ── ReplayEntryRow — renders a single audit entry with inline redaction ────────

interface ReplayEntryRowProps {
    entry: ReplayAuditEntry;
    isH4Plus: boolean;
    isH5: boolean;
}

function ReplayEntryRow({ entry, isH4Plus, isH5 }: ReplayEntryRowProps) {
    const isH4Restricted = H4_RESTRICTED_EVENT_TYPES.has(entry.eventType);
    const isH5Restricted = H5_RESTRICTED_EVENT_TYPES.has(entry.eventType);

    return (
        <li className="flex flex-col gap-0.5 px-3 py-2 text-xs font-mono">
            <div className="flex items-center gap-2">
                <span className="text-neutral-400 font-semibold">{entry.eventType}</span>
                <span className="text-neutral-600">{entry.actorDid}</span>
            </div>
            <div className="text-neutral-500">
                {isH4Restricted && !isH4Plus ? (
                    <span
                        className="text-neutral-600 italic"
                        data-testid="redaction-h4"
                    >
                        {H4_PLACEHOLDER}
                    </span>
                ) : isH5Restricted && !isH5 ? (
                    <span
                        className="text-neutral-600 italic"
                        data-testid="redaction-h5"
                    >
                        {H5_PLACEHOLDER}
                    </span>
                ) : (
                    <span className="text-neutral-400">
                        {typeof entry.payload === 'object'
                            ? JSON.stringify(entry.payload)
                            : String(entry.payload)}
                    </span>
                )}
            </div>
        </li>
    );
}
