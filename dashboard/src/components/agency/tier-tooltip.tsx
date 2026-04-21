'use client';
/**
 * TierTooltip — authoritative H1–H5 definitions panel for the Agency
 * Indicator, rendered on hover/focus of the chip.
 *
 * The five tier strings in TIER_DEFINITIONS are COPIED VERBATIM from
 * PHILOSOPHY.md §7 lines 71–75. Do not paraphrase, wrap, or edit punctuation;
 * tier-tooltip.test.tsx asserts every byte. The H5 row renders with
 * line-through + muted color + "(requires Phase 8)" suffix per D-20.
 */

import type { HumanAgencyTier } from '@/lib/protocol/agency-types';

export const TIER_DEFINITIONS: ReadonlyArray<{
    tier: HumanAgencyTier;
    text: string;
    suffix?: string;
}> = [
    { tier: 'H1', text: 'H1 Observer — read-only (firehose, map, inspector); leaves no trace' },
    { tier: 'H2', text: 'H2 Reviewer — query Nous memory; read-only, audit-logged' },
    {
        tier: 'H3',
        text: 'H3 Partner — co-decision (pause sim, change broadcast allowlist, amend a Grid law); explicit elevation dialog',
    },
    {
        tier: 'H4',
        text: "H4 Driver — force-mutate a specific Nous's Telos; operator drives, system executes",
    },
    {
        tier: 'H5',
        text: 'H5 Sovereign — delete a Nous; irreversibility dialog, DID-typed confirm, full state hash preserved for forensic reconstruction',
        suffix: '(requires Phase 8)',
    },
];

export interface TierTooltipProps {
    readonly activeTier: HumanAgencyTier;
}

export function TierTooltip({ activeTier }: TierTooltipProps): React.ReactElement {
    return (
        <div
            id="tier-tooltip"
            role="tooltip"
            data-testid="tier-tooltip"
            className="absolute right-0 top-full mt-1 w-[360px] rounded border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-200 shadow-lg"
        >
            <h3 className="mb-2 text-sm font-semibold">Agency Scale</h3>
            <ul className="space-y-1.5">
                {TIER_DEFINITIONS.map((row) => {
                    const isH5 = row.tier === 'H5';
                    const isActive = row.tier === activeTier;
                    const className = [
                        isH5 ? 'line-through text-neutral-500' : '',
                        isActive && !isH5 ? 'font-semibold border-l-2 border-neutral-200 pl-2' : '',
                    ]
                        .filter(Boolean)
                        .join(' ');
                    return (
                        <li
                            key={row.tier}
                            data-testid={`tier-row-${row.tier}`}
                            className={className}
                        >
                            {row.text}
                            {row.suffix ? (
                                <span className="ml-1 text-neutral-500"> {row.suffix}</span>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
