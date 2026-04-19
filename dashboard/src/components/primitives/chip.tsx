'use client';
/**
 * Chip — pill-shaped label used by the Inspector (memory kind badge) and the
 * Economy panel (shop listing). Palette tokens follow the Phase-3 convention
 * (`neutral-*`, not `slate-*` or `zinc-*`) — do NOT introduce a second palette.
 *
 * Per UI-SPEC §Component Inventory P1 — presentational, no hooks, text-only.
 */

export interface ChipProps {
    readonly label: string;
    readonly testId?: string;
}

export function Chip({ label, testId }: ChipProps): React.ReactElement {
    return (
        <span
            data-testid={testId}
            className="inline-flex items-center rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-200"
        >
            {label}
        </span>
    );
}
