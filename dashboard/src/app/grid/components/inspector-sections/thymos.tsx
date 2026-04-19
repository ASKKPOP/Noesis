'use client';
/**
 * ThymosSection — current mood Chip + per-emotion MeterRow grid.
 *
 * Contract: mood rendered as `<Chip label={mood} testId="chip-mood" />`, every
 * emotion key in `thymos.emotions` as its own MeterRow. No top-N capping here —
 * the drawer displays whatever the brain ships; filtering/ordering is a
 * future concern per UI-SPEC §196 ("top 6 shown; remainder collapsed").
 */

import { Chip, MeterRow } from '@/components/primitives';
import type { NousStateResponse } from '@/lib/api/introspect';

export interface ThymosSectionProps {
    readonly thymos: NousStateResponse['thymos'];
}

export function ThymosSection({ thymos }: ThymosSectionProps): React.ReactElement {
    const emotions = Object.entries(thymos.emotions);

    return (
        <section
            data-testid="section-thymos"
            aria-labelledby="section-thymos-title"
            className="mb-4"
        >
            <h3
                id="section-thymos-title"
                className="mb-2 text-sm font-semibold text-neutral-100"
            >
                Thymos
            </h3>
            <div className="mb-2">
                <Chip label={thymos.mood} testId="chip-mood" />
            </div>
            {emotions.map(([name, value]) => (
                <MeterRow
                    key={name}
                    label={name}
                    value={value}
                    testId={`emotion-${name}`}
                />
            ))}
        </section>
    );
}
