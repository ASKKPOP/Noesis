'use client';
/**
 * AgencyIndicator — persistent tier chip mounted in the dashboard root
 * layout (every route, SC#1 / AGENCY-01 / D-02). Subscribes to the
 * localStorage-backed agencyStore via useSyncExternalStore and shows a
 * tooltip on hover/focus with the authoritative H1–H5 definitions.
 *
 * The SSR snapshot is locked to 'H1' per D-01 — on first paint with empty
 * localStorage the chip reads "H1 Observer" and the aria-label carries the
 * "Read-only." state suffix.
 */

import { useState, useSyncExternalStore } from 'react';
import { Chip, type ChipColor } from '@/components/primitives/chip';
import { agencyStore } from '@/lib/stores/agency-store';
import { TIER_NAME, type HumanAgencyTier } from '@/lib/protocol/agency-types';
import { TierTooltip } from './tier-tooltip';

const TIER_COLOR: Record<HumanAgencyTier, ChipColor> = {
    H1: 'neutral',
    H2: 'blue',
    H3: 'amber',
    H4: 'red',
    H5: 'muted',
};

// UI-SPEC §Copywriting Contract — aria-label state suffix carries the
// same semantic weight as the border color, so screen-reader users get
// the tier state without depending on visual cues.
const STATE_SUFFIX: Record<HumanAgencyTier, string> = {
    H1: 'Read-only.',
    H2: 'Elevation active.',
    H3: 'Elevation active.',
    H4: 'Elevation active.',
    H5: 'Disabled — requires Phase 8.',
};

const SSR_DEFAULT_TIER = (): HumanAgencyTier => 'H1';

export function AgencyIndicator(): React.ReactElement {
    const tier = useSyncExternalStore(
        agencyStore.subscribe,
        agencyStore.getSnapshot,
        SSR_DEFAULT_TIER,
    );
    const [tooltipOpen, setTooltipOpen] = useState(false);

    const label = `${tier} ${TIER_NAME[tier]}`;
    const ariaLabel = `Current agency tier: ${tier} ${TIER_NAME[tier]}. ${STATE_SUFFIX[tier]}`;

    return (
        <div
            className="relative"
            data-testid="agency-indicator"
            onMouseEnter={() => setTooltipOpen(true)}
            onMouseLeave={() => setTooltipOpen(false)}
        >
            <button
                type="button"
                aria-label={ariaLabel}
                aria-describedby="tier-tooltip"
                aria-expanded={tooltipOpen}
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-950 focus:ring-sky-300"
                onClick={() => setTooltipOpen((v) => !v)}
                onFocus={() => setTooltipOpen(true)}
                onBlur={() => setTooltipOpen(false)}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') setTooltipOpen(false);
                }}
            >
                <span role="status">
                    <Chip label={label} color={TIER_COLOR[tier]} testId="agency-chip" />
                </span>
            </button>
            {tooltipOpen ? <TierTooltip activeTier={tier} /> : null}
        </div>
    );
}
