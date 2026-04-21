'use client';
/**
 * TelosRefinedBadge — panel-level chip on TelosSection.
 *
 * Renders iff useRefinedTelosHistory(did).refinedCount >= 1 (D-27, D-30:
 * panel-level, not per-goal, because compute_active_telos_hash covers the
 * whole goal set). Clicking navigates to
 *   /grid?tab=firehose&firehose_filter=dialogue_id:<lastRefinedDialogueId>
 * preserving other query params.
 *
 * 07-UI-SPEC §Copywriting — label/aria-label/title strings are LOCKED; do
 * not edit without a UI-SPEC amendment.
 *
 * PHILOSOPHY §1 + D-18: this component renders only the fact of refinement
 * (a count + a dialogue_id reference). No plaintext goal content ever.
 */
import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Chip } from '@/components/primitives';
import { useRefinedTelosHistory } from '@/lib/hooks/use-refined-telos-history';

export interface TelosRefinedBadgeProps {
    readonly did: string | null;
}

export function TelosRefinedBadge({
    did,
}: TelosRefinedBadgeProps): React.ReactElement | null {
    const { refinedCount, lastRefinedDialogueId } = useRefinedTelosHistory(did);
    const router = useRouter();
    const searchParams = useSearchParams();

    const onActivate = useCallback((): void => {
        if (!lastRefinedDialogueId) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', 'firehose');
        params.set('firehose_filter', `dialogue_id:${lastRefinedDialogueId}`);
        router.push(`?${params.toString()}`);
    }, [router, searchParams, lastRefinedDialogueId]);

    if (refinedCount === 0 || !lastRefinedDialogueId) return null;

    const label =
        refinedCount === 1
            ? '↻ refined via dialogue'
            : `↻ refined via dialogue (${refinedCount})`;
    const ariaLabel =
        refinedCount === 1
            ? 'Telos refined via peer dialogue — 1 refinement in history. Click to view triggering dialogue in firehose.'
            : `Telos refined via peer dialogue — ${refinedCount} refinements in history. Click to view most recent triggering dialogue in firehose.`;

    return (
        <span data-testid="telos-refined-badge">
            <button
                type="button"
                data-testid="telos-refined-badge-trigger"
                aria-label={ariaLabel}
                title="Refined via peer dialogue. Click to filter firehose by dialogue_id."
                onClick={onActivate}
                className="cursor-pointer rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
                <Chip label={label} color="dialogue" />
            </button>
        </span>
    );
}
