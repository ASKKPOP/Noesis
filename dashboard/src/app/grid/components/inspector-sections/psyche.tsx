'use client';
/**
 * PsycheSection — Big Five personality meter rows.
 *
 * Owns the fixed dimension order: Openness, Conscientiousness, Extraversion,
 * Agreeableness, Neuroticism (UI-SPEC §174). Reads its slice of the
 * `NousStateResponse` only — no knowledge of fetch lifecycle, no hooks, no
 * local primitive copies (Chip/MeterRow/EmptyState live in @/components/primitives,
 * shipped by Plan 04-04).
 */

import { MeterRow } from '@/components/primitives';
import type { NousStateResponse } from '@/lib/api/introspect';

type PsycheKey = keyof NousStateResponse['psyche'];

const LABELS: ReadonlyArray<readonly [PsycheKey, string]> = [
    ['openness',          'Openness'],
    ['conscientiousness', 'Conscientiousness'],
    ['extraversion',      'Extraversion'],
    ['agreeableness',     'Agreeableness'],
    ['neuroticism',       'Neuroticism'],
];

export interface PsycheSectionProps {
    readonly psyche: NousStateResponse['psyche'];
}

export function PsycheSection({ psyche }: PsycheSectionProps): React.ReactElement {
    return (
        <section
            data-testid="section-psyche"
            aria-labelledby="section-psyche-title"
            className="mb-4"
        >
            <h3
                id="section-psyche-title"
                className="mb-2 text-sm font-semibold text-neutral-100"
            >
                Psyche
            </h3>
            {LABELS.map(([key, label]) => (
                <MeterRow
                    key={key}
                    label={label}
                    value={psyche[key]}
                    testId={`meter-${key}`}
                />
            ))}
        </section>
    );
}
