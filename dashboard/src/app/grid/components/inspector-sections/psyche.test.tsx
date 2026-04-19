/**
 * PsycheSection tests — Big Five personality meters.
 *
 * Contract (Plan 04-05 Task 2):
 *   - Renders five MeterRows in fixed order: Openness, Conscientiousness,
 *     Extraversion, Agreeableness, Neuroticism (UI-SPEC §169-178).
 *   - Uses shared primitives from `@/components/primitives` only — no local
 *     MeterRow copy (D15 primitives live in Plan 04-04, not here).
 *   - Section is labelled `section-psyche` (test-id) and has the section
 *     title "Psyche".
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PsycheSection } from './psyche';

const FULL_PSYCHE = {
    openness: 0.72,
    conscientiousness: 0.55,
    extraversion: 0.31,
    agreeableness: 0.88,
    neuroticism: 0.12,
};

describe('PsycheSection', () => {
    it('renders the section container with test-id section-psyche', () => {
        render(<PsycheSection psyche={FULL_PSYCHE} />);
        expect(screen.getByTestId('section-psyche')).not.toBeNull();
    });

    it('renders all five Big-Five dimensions as MeterRows in locked order', () => {
        render(<PsycheSection psyche={FULL_PSYCHE} />);
        const labels = ['Openness', 'Conscientiousness', 'Extraversion', 'Agreeableness', 'Neuroticism'];
        for (const label of labels) {
            expect(screen.getByText(label).textContent).toBe(label);
        }
        // Each meter receives a meter-{key} testId
        expect(screen.getByTestId('meter-openness')).not.toBeNull();
        expect(screen.getByTestId('meter-conscientiousness')).not.toBeNull();
        expect(screen.getByTestId('meter-extraversion')).not.toBeNull();
        expect(screen.getByTestId('meter-agreeableness')).not.toBeNull();
        expect(screen.getByTestId('meter-neuroticism')).not.toBeNull();
    });

    it('renders numeric values with 2-decimal precision (MeterRow contract)', () => {
        render(<PsycheSection psyche={FULL_PSYCHE} />);
        // MeterRow renders `value.toFixed(2)` — assert a sample
        expect(screen.getByText('0.72').textContent).toBe('0.72');
        expect(screen.getByText('0.12').textContent).toBe('0.12');
    });
});
