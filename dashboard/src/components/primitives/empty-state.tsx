'use client';
/**
 * EmptyState — dashed bordered box with a bold title and optional description
 * subtext. Shared across every empty / loading / error surface in the
 * Inspector and Economy panels so copy drift is impossible.
 *
 * Per UI-SPEC §Component Inventory C11 — voice is Honeycomb, not Slack; do
 * NOT add exclamation marks, emoji, or CTA copy to this component.
 */

export interface EmptyStateProps {
    readonly title: string;
    readonly description?: string;
    readonly testId?: string;
}

export function EmptyState({
    title,
    description,
    testId,
}: EmptyStateProps): React.ReactElement {
    return (
        <div
            data-testid={testId}
            className="rounded border border-dashed border-neutral-700 p-4 text-center text-sm text-neutral-400"
        >
            <div className="font-medium text-neutral-200">{title}</div>
            {description ? <div className="mt-1 text-xs">{description}</div> : null}
        </div>
    );
}
