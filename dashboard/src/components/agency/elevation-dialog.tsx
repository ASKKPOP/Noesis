/**
 * ElevationDialog — native <dialog> primitive for the H1→H2/H3/H4 elevation
 * flow (D-06, D-08, UI-SPEC §Elevation dialog).
 *
 * Uses the browser's HTMLDialogElement.showModal() for automatic focus-trap
 * and inert background — no Radix, no portal, no hand-rolled trap. Native
 * Escape press fires the `close` event which this component's onClose routes
 * to props.onCancel.
 *
 * Body copy is REQ-verbatim per AGENCY-04: `Entering H{N} — {TierName}. This
 * will be logged.` TIER_NAME map (Reviewer/Partner/Driver) is the canonical
 * one from PHILOSOPHY.md §7 (D-06).
 *
 * autoFocus on Cancel: UI-SPEC line 617 — safer default so Enter-on-dialog-open
 * cannot dispatch an action the operator hasn't read yet.
 */

'use client';

import { useEffect, useRef, type ReactElement } from 'react';
import { TIER_NAME, type HumanAgencyTier } from '@/lib/protocol/agency-types';

export type ElevatedTier = Exclude<HumanAgencyTier, 'H1' | 'H5'>;

export interface ElevationDialogProps {
    readonly targetTier: ElevatedTier;
    readonly open: boolean;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
}

const CONFIRM_FILL: Record<ElevatedTier, string> = {
    H2: 'bg-blue-400 text-neutral-950',
    H3: 'bg-amber-300 text-neutral-950',
    H4: 'bg-red-400 text-neutral-950',
};

export function ElevationDialog({
    targetTier,
    open,
    onConfirm,
    onCancel,
}: ElevationDialogProps): ReactElement {
    const ref = useRef<HTMLDialogElement | null>(null);

    useEffect(() => {
        const dlg = ref.current;
        if (!dlg) return;
        if (open && !dlg.open) dlg.showModal();
        else if (!open && dlg.open) dlg.close();
    }, [open]);

    const tierName = TIER_NAME[targetTier];
    const bodyText = `Entering ${targetTier} — ${tierName}. This will be logged.`;

    return (
        <dialog
            ref={ref}
            onClose={onCancel}
            data-testid="elevation-dialog"
            aria-labelledby="elevation-title"
            className="min-w-[384px] p-6 bg-neutral-900 text-neutral-100 border border-neutral-800 rounded"
        >
            <h2 id="elevation-title" className="text-base font-semibold">
                Entering {targetTier} — {tierName}
            </h2>
            <p className="mt-2 text-sm" data-testid="elevation-body">
                {bodyText}
            </p>
            <div className="mt-4 flex gap-2 justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    autoFocus
                    data-testid="elevation-cancel"
                    className="px-3 py-1 text-sm font-semibold text-neutral-200"
                    aria-label={`Cancel elevation to ${targetTier}. No action will be taken.`}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    data-testid="elevation-confirm"
                    className={`px-3 py-1 text-sm font-semibold ${CONFIRM_FILL[targetTier]}`}
                    aria-label={`Confirm elevation to ${targetTier}. The action will dispatch and be logged.`}
                >
                    Confirm
                </button>
            </div>
        </dialog>
    );
}
