'use client';
/**
 * Chip — pill-shaped label used by the Inspector (memory kind badge), the
 * Economy panel (shop listing), and the Phase-6 Agency Indicator (tier pill).
 *
 * Palette tokens follow the Phase-3 convention (`neutral-*`, not `slate-*`
 * or `zinc-*`) — do NOT introduce a second palette.
 *
 * Phase 6 added the optional `color` prop mapping to the Human Agency Scale
 * tier palette (UI-SPEC §Color tier-to-color map). The default `undefined`
 * resolves to the existing neutral styling so Inspector + Economy callers
 * remain zero-diff.
 *
 * Per UI-SPEC §Component Inventory P1 — presentational, no hooks, text-only.
 */

export type ChipColor = 'neutral' | 'blue' | 'amber' | 'red' | 'muted';

export interface ChipProps {
    readonly label: string;
    readonly testId?: string;
    readonly color?: ChipColor;
    readonly 'aria-label'?: string;
}

// UI-SPEC §Color (tier-to-color map) — hex values locked to Tailwind tokens.
// The neutral variant preserves the pre-Phase-6 class list exactly so existing
// callers (Inspector memory kind badges, Economy listings) stay visually
// identical (primitives.test.tsx Chip tests remain green).
const COLOR_CLASSES: Record<ChipColor, string> = {
    neutral: 'bg-neutral-800 text-neutral-200',
    blue: 'bg-neutral-900 border-2 border-blue-400 text-neutral-200',
    amber: 'bg-neutral-900 border-2 border-amber-300 text-neutral-200',
    red: 'bg-neutral-900 border-2 border-red-400 text-red-400',
    muted: 'bg-neutral-900 border border-dashed border-neutral-600 text-neutral-500 line-through',
};

export function Chip({ label, testId, color, 'aria-label': ariaLabel }: ChipProps): React.ReactElement {
    const variant = color ?? 'neutral';
    return (
        <span
            data-testid={testId}
            aria-label={ariaLabel}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${COLOR_CLASSES[variant]}`}
        >
            {label}
        </span>
    );
}
