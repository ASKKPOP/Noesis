/**
 * TelosSection tests — active-goals list with empty-state fallback.
 *
 * Contract (Plan 04-05 Task 2):
 *   - Empty goals → EmptyState with UI-SPEC copy "No active goals. Telos is quiescent."
 *   - Non-empty → `<ul>` of `<li>` rows with description + priority Chip.
 *   - Section test-id is `section-telos`.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TelosSection } from './telos';

describe('TelosSection', () => {
    it('renders the section container with test-id section-telos', () => {
        render(<TelosSection telos={{ active_goals: [] }} />);
        expect(screen.getByTestId('section-telos')).not.toBeNull();
    });

    it('renders EmptyState with UI-SPEC copy when no active goals', () => {
        render(<TelosSection telos={{ active_goals: [] }} />);
        const el = screen.getByText(/No active goals\. Telos is quiescent\./i);
        expect(el).not.toBeNull();
    });

    it('renders each goal as a list item with description and priority Chip', () => {
        render(
            <TelosSection
                telos={{
                    active_goals: [
                        { id: 'g1', description: 'Explore alpha sector', priority: 0.8 },
                        { id: 'g2', description: 'Trade bread for gold',  priority: 0.3 },
                    ],
                }}
            />,
        );
        expect(screen.getByText('Explore alpha sector').textContent).toBe('Explore alpha sector');
        expect(screen.getByText('Trade bread for gold').textContent).toBe('Trade bread for gold');

        // List semantics
        const list = screen.getByRole('list');
        expect(list).not.toBeNull();
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(2);
    });

    it('surfaces the priority value for each goal', () => {
        render(
            <TelosSection
                telos={{
                    active_goals: [{ id: 'g1', description: 'Explore', priority: 0.87 }],
                }}
            />,
        );
        // Priority is rendered as a Chip label — should be discoverable as text
        expect(screen.getByText(/0\.87/).textContent).toMatch(/0\.87/);
    });
});
