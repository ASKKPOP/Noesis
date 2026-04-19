'use client';
/**
 * MeterRow — label + horizontal bar + right-aligned 2-decimal numeric.
 * Consumers: Inspector Psyche (Big Five dimensions) and Inspector Thymos
 * (emotion intensities). Accepts any float; clamps to [0, 1] for bar width.
 *
 * Per UI-SPEC §Component Inventory P2 — the label sits to the left, the bar
 * takes the remaining row, and the numeric is fixed-width tabular.
 */

export interface MeterRowProps {
    readonly label: string;
    readonly value: number;
    readonly testId?: string;
}

export function MeterRow({ label, value, testId }: MeterRowProps): React.ReactElement {
    const clamped = Math.max(0, Math.min(1, value));
    const pct = clamped * 100;
    return (
        <div data-testid={testId} className="flex items-center gap-2 py-0.5">
            <span className="w-36 text-xs text-neutral-300">{label}</span>
            <div className="h-2 flex-1 rounded bg-neutral-800">
                <div
                    data-role="meter-fill"
                    className="h-2 rounded bg-sky-400"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="w-10 text-right text-[11px] tabular-nums text-neutral-200">
                {value.toFixed(2)}
            </span>
        </div>
    );
}
