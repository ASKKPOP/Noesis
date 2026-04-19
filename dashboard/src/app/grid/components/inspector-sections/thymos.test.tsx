/**
 * ThymosSection tests — mood Chip + emotion MeterRows.
 *
 * Contract (Plan 04-05 Task 2):
 *   - Mood rendered as `<Chip label={mood} testId="chip-mood" />`
 *   - Every emotion key renders a MeterRow (no top-6 cap at this layer; the
 *     UI-SPEC's top-6 ordering is a future concern — keep sections trivial)
 *   - Section test-id is `section-thymos`
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThymosSection } from './thymos';

describe('ThymosSection', () => {
    it('renders the section container with test-id section-thymos', () => {
        render(<ThymosSection thymos={{ mood: 'calm', emotions: {} }} />);
        expect(screen.getByTestId('section-thymos')).not.toBeNull();
    });

    it('renders the current mood as a Chip with test-id chip-mood', () => {
        render(<ThymosSection thymos={{ mood: 'curious', emotions: {} }} />);
        const chip = screen.getByTestId('chip-mood');
        expect(chip).not.toBeNull();
        expect(chip.textContent).toBe('curious');
    });

    it('renders every emotion as a MeterRow with its numeric value', () => {
        render(
            <ThymosSection
                thymos={{ mood: 'calm', emotions: { joy: 0.43, fear: 0.07, awe: 0.91 } }}
            />,
        );
        expect(screen.getByText('joy').textContent).toBe('joy');
        expect(screen.getByText('fear').textContent).toBe('fear');
        expect(screen.getByText('awe').textContent).toBe('awe');
        expect(screen.getByText('0.43').textContent).toBe('0.43');
        expect(screen.getByText('0.07').textContent).toBe('0.07');
        expect(screen.getByText('0.91').textContent).toBe('0.91');
    });
});
