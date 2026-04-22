'use client';
/**
 * RelationshipsSection — tier-aware Relationships tab within the Inspector drawer.
 *
 * Renders three branches based on the operator's agency tier (D-9-06):
 *   H1 (default): warmth bucket labels only — no numeric valence/weight anywhere
 *                 in the DOM. "Reveal numeric weights" button triggers H2 elevation.
 *   H2 (Reviewer): numeric valence/weight per edge to 3 decimals; per-edge
 *                  "Inspect raw turns (H5)" button triggers H5 ElevationDialog before
 *                  opening EdgeEventsModal.
 *   H5 (Steward):  same as H2 but "Inspect raw turns (H5)" opens EdgeEventsModal
 *                  directly (no ElevationDialog intercept — tier already confirmed).
 *
 * Warmth colors (D-9-06, locked in 09-RESEARCH.md):
 *   cold: #9ca3af  (neutral-400)
 *   warm: #f59e0b  (amber-500)
 *   hot:  #e11d48  (rose-600)
 *
 * Copy is verbatim from 09-UI-SPEC.md §Copywriting Contract — do NOT change
 * heading/button/footnote strings without updating the spec first.
 *
 * Phase 9 threat mitigations:
 *   T-09-20: useRelationshipsH2 returns null SWR key when tier=H1 (enforced by hook)
 *   T-09-21: H1 DOM must contain zero numeric valence/weight values (test #3 enforces)
 *   T-09-24: fetchRelationshipsH2 requires explicit tier:'H2' — hook guards H1 path
 *   T-09-25: error copy comes from discriminated union, never raw server strings
 */

import { useState, useSyncExternalStore } from 'react';
import { agencyStore } from '@/lib/stores/agency-store';
import type { HumanAgencyTier } from '@/lib/protocol/agency-types';
import { EmptyState } from '@/components/primitives';
import { ElevationDialog } from '@/components/agency/elevation-dialog';
import { useRelationshipsH1, useRelationshipsH2 } from '@/lib/hooks/use-relationships';
import { EdgeEventsModal } from '@/app/grid/components/inspector-sections/edge-events-modal';
import { getOperatorId } from '@/lib/stores/agency-store';

// ---------------------------------------------------------------------------
// Warmth color palette (D-9-06, 09-RESEARCH.md — load-bearing hex values)
// ---------------------------------------------------------------------------
const WARMTH_COLOR: Record<'cold' | 'warm' | 'hot', string> = {
    cold: '#9ca3af',
    warm: '#f59e0b',
    hot: '#e11d48',
};

const WARMTH_DOT_CLASS: Record<'cold' | 'warm' | 'hot', string> = {
    cold: 'bg-neutral-400',
    warm: 'bg-amber-400',
    hot: 'bg-rose-400',
};

const WARMTH_TEXT_CLASS: Record<'cold' | 'warm' | 'hot', string> = {
    cold: 'text-neutral-400',
    warm: 'text-amber-400',
    hot: 'text-rose-400',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RelationshipsSectionProps {
    readonly did: string | null;
}

// ---------------------------------------------------------------------------
// EdgeEventsModal state
// ---------------------------------------------------------------------------

interface EdgeModalState {
    edgeKey: string;
    open: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RelationshipsSection({ did }: RelationshipsSectionProps): React.ReactElement {
    const tier = useSyncExternalStore(
        agencyStore.subscribe,
        agencyStore.getSnapshot,
        (): HumanAgencyTier => 'H1',
    );

    // H2 elevation dialog state (for "Reveal numeric weights" at H1)
    const [h2ElevOpen, setH2ElevOpen] = useState(false);
    // H5 elevation dialog state (for "Inspect raw turns" at H2)
    const [h5ElevOpen, setH5ElevOpen] = useState(false);
    // Edge modal state (for H5 edge event inspection)
    const [edgeModal, setEdgeModal] = useState<EdgeModalState>({ edgeKey: '', open: false });
    // Pending edge key when H5 elevation is in progress from H2
    const [pendingEdgeKey, setPendingEdgeKey] = useState<string>('');

    // SWR hooks — H2 hook returns null key when tier === 'H1' (T-09-20)
    const h1Result = useRelationshipsH1(did);
    const h2Result = useRelationshipsH2(did, tier);

    // Use H2 data at H2/H5 tier, H1 data otherwise
    const isH2orAbove = tier === 'H2' || tier === 'H5';
    const { data: h1Data, isLoading: h1Loading, error: h1Error } = h1Result;
    const { data: h2Data, isLoading: h2Loading, error: h2Error } = h2Result;

    const isLoading = isH2orAbove ? h2Loading : h1Loading;
    const hasError = isH2orAbove ? !!h2Error : !!h1Error;

    // -----------------------------------------------------------------------
    // Elevation handlers
    // -----------------------------------------------------------------------

    const handleRevealWeights = () => {
        setH2ElevOpen(true);
    };

    const onH2ElevConfirm = () => {
        setH2ElevOpen(false);
        agencyStore.setTier('H2');
        // SWR key changes → H2 fetch fires automatically via hook
    };

    const onH2ElevCancel = () => {
        setH2ElevOpen(false);
    };

    const handleInspectEdge = (edgeKey: string) => {
        if (tier === 'H5') {
            // H5: open modal directly (no ElevationDialog intercept)
            setEdgeModal({ edgeKey, open: true });
        } else {
            // H2: must elevate to H5 first
            setPendingEdgeKey(edgeKey);
            setH5ElevOpen(true);
        }
    };

    const onH5ElevConfirm = () => {
        setH5ElevOpen(false);
        agencyStore.setTier('H5');
        setEdgeModal({ edgeKey: pendingEdgeKey, open: true });
    };

    const onH5ElevCancel = () => {
        setH5ElevOpen(false);
        setPendingEdgeKey('');
    };

    const closeEdgeModal = () => {
        setEdgeModal({ edgeKey: '', open: false });
    };

    // -----------------------------------------------------------------------
    // Loading state
    // -----------------------------------------------------------------------

    if (isLoading) {
        return (
            <section
                data-testid="section-relationships"
                aria-labelledby="section-relationships-title"
                className="mb-4"
            >
                <div aria-live="polite" className="sr-only">Loading relationships…</div>
                <h3
                    id="section-relationships-title"
                    className="mb-2 text-sm font-semibold text-neutral-100"
                >
                    Top partners by weight
                </h3>
                <ul className="flex flex-col gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <li key={i} className="h-[48px] rounded bg-neutral-900 animate-pulse" />
                    ))}
                </ul>
            </section>
        );
    }

    // -----------------------------------------------------------------------
    // Error state
    // -----------------------------------------------------------------------

    if (hasError) {
        return (
            <section
                data-testid="section-relationships"
                aria-labelledby="section-relationships-title"
                className="mb-4"
            >
                <h3
                    id="section-relationships-title"
                    className="mb-2 text-sm font-semibold text-neutral-100"
                >
                    Top partners by weight
                </h3>
                <EmptyState
                    title="Grid unreachable."
                    description="Relationships will reload when the connection recovers."
                    testId="relationships-error"
                />
            </section>
        );
    }

    // -----------------------------------------------------------------------
    // H1 render — warmth-bucket-only, zero numeric values in DOM (T-09-21)
    // -----------------------------------------------------------------------

    if (!isH2orAbove) {
        const edges = h1Data?.edges ?? [];

        return (
            <section
                data-testid="section-relationships"
                aria-labelledby="section-relationships-title"
                className="mb-4"
            >
                <div aria-live="polite" className="sr-only">Loading relationships…</div>
                <h3
                    id="section-relationships-title"
                    className="mb-2 text-sm font-semibold text-neutral-100"
                >
                    Top partners by weight
                </h3>

                {edges.length === 0 ? (
                    <EmptyState
                        title="No relationships yet."
                        description="This Nous has not yet spoken with or traded with another Nous."
                        testId="empty-relationships"
                    />
                ) : (
                    <ul
                        role="list"
                        className="flex flex-col gap-2"
                        aria-label="Top partner relationships"
                    >
                        {edges.slice(0, 5).map((edge, i) => {
                            const bucket = edge.warmth_bucket;
                            return (
                                <li
                                    key={edge.edge_hash || i}
                                    data-testid={`relationship-row-${i}`}
                                    className="flex flex-col gap-0.5 rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            data-testid={`relationship-warmth-dot-${i}`}
                                            data-warmth-hex={WARMTH_COLOR[bucket]}
                                            aria-hidden="true"
                                            className={`inline-block h-2 w-2 rounded-full ${WARMTH_DOT_CLASS[bucket]}`}
                                            style={{ color: WARMTH_COLOR[bucket] }}
                                        />
                                        <code
                                            data-testid={`relationship-counterparty-${i}`}
                                            className="font-mono text-xs text-neutral-400"
                                        >
                                            {edge.counterparty_did}
                                        </code>
                                        <span
                                            data-testid={`relationship-bucket-${i}`}
                                            className={`ml-auto text-xs ${WARMTH_TEXT_CLASS[bucket]}`}
                                            aria-label={bucket}
                                        >
                                            {bucket}
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-neutral-600">
                                        Last interaction: tick {edge.recency_tick}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {/* H2 elevation button — visible only when tier === 'H1' */}
                <button
                    type="button"
                    data-testid="relationships-elevate-h2"
                    onClick={handleRevealWeights}
                    className="mt-3 w-full rounded border-2 border-blue-400 bg-neutral-900 px-3 py-2 text-xs text-blue-400 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-neutral-950 transition-colors"
                    aria-label="Elevate to H2 Reviewer to reveal numeric valence and weight"
                >
                    Reveal numeric weights
                </button>

                {/* H1 footnote — visible only when tier === 'H1' */}
                <p className="mt-2 text-[11px] text-neutral-500">
                    Numeric weights available at H2 Reviewer.
                </p>

                {/* H2 ElevationDialog */}
                {h2ElevOpen && (
                    <ElevationDialog
                        targetTier="H2"
                        open={h2ElevOpen}
                        onConfirm={onH2ElevConfirm}
                        onCancel={onH2ElevCancel}
                    />
                )}
            </section>
        );
    }

    // -----------------------------------------------------------------------
    // H2/H5 render — numeric valence/weight visible
    // -----------------------------------------------------------------------

    const edges = h2Data?.edges ?? [];

    return (
        <section
            data-testid="section-relationships"
            aria-labelledby="section-relationships-title"
            className="mb-4"
        >
            <div aria-live="polite" className="sr-only">Loading relationships…</div>
            <h3
                id="section-relationships-title"
                className="mb-2 text-sm font-semibold text-neutral-100"
            >
                Top partners by weight
            </h3>

            <p className="mb-2 text-[11px] text-neutral-500">
                Numeric weights available at H2 Reviewer.
            </p>

            {edges.length === 0 ? (
                <EmptyState
                    title="No relationships yet."
                    description="This Nous has not yet spoken with or traded with another Nous."
                    testId="empty-relationships"
                />
            ) : (
                <ul
                    role="list"
                    className="flex flex-col gap-2"
                    aria-label="Top partner relationships with numeric weights"
                >
                    {edges.slice(0, 5).map((edge, i) => {
                        const bucket = edge.warmth_bucket ?? 'cold';
                        // Build edge key from hash — used for H5 edge events fetch
                        const edgeKey = edge.edge_hash ?? edge.last_event_hash ?? '';
                        return (
                            <li
                                key={edgeKey || i}
                                data-testid={`relationship-row-${i}`}
                                className="flex flex-col gap-0.5 rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        data-testid={`relationship-warmth-dot-${i}`}
                                        aria-hidden="true"
                                        className={`inline-block h-2 w-2 rounded-full ${WARMTH_DOT_CLASS[bucket as 'cold' | 'warm' | 'hot']}`}
                                    />
                                    <code
                                        data-testid={`relationship-counterparty-${i}`}
                                        className="font-mono text-xs text-neutral-400"
                                    >
                                        {edge.counterparty_did}
                                    </code>
                                </div>
                                <span
                                    data-testid={`relationship-numeric-${i}`}
                                    className="text-xs text-neutral-400"
                                >
                                    valence {edge.valence >= 0 ? '+' : ''}{edge.valence.toFixed(3)} · weight {edge.weight.toFixed(3)}
                                </span>
                                <span className="text-[11px] text-neutral-600">
                                    Last interaction: tick {edge.recency_tick}
                                </span>

                                {/* H5 inspect button — rendered for H2 and H5 tiers */}
                                {(tier === 'H2' || tier === 'H5') && edgeKey && (
                                    <button
                                        type="button"
                                        data-testid={`relationship-inspect-h5-${i}`}
                                        onClick={() => handleInspectEdge(edgeKey)}
                                        className="mt-1 text-[11px] text-rose-400 hover:underline focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 focus:ring-offset-neutral-950 text-left"
                                        aria-label={`Inspect raw dialogue turns for the edge between this Nous and ${edge.counterparty_did}`}
                                    >
                                        Inspect raw turns (H5)
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* H5 ElevationDialog (for H2 operators clicking "Inspect raw turns") */}
            {h5ElevOpen && (
                <ElevationDialog
                    targetTier="H5"
                    open={h5ElevOpen}
                    onConfirm={onH5ElevConfirm}
                    onCancel={onH5ElevCancel}
                />
            )}

            {/* EdgeEventsModal — opened after H5 confirmation or directly at H5 */}
            {edgeModal.open && (
                <EdgeEventsModal
                    edgeKey={edgeModal.edgeKey}
                    operatorId={getOperatorId()}
                    onClose={closeEdgeModal}
                />
            )}
        </section>
    );
}
