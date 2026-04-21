/**
 * TelosSection tests — active-goals list with empty-state fallback.
 *
 * Contract (Plan 04-05 Task 2):
 *   - Empty goals → EmptyState with UI-SPEC copy "No active goals. Telos is quiescent."
 *   - Non-empty → `<ul>` of `<li>` rows with description + priority Chip.
 *   - Section test-id is `section-telos`.
 *
 * Phase 7 (Plan 07-04 Task 3) extends:
 *   - Takes `did: string | null` prop; threads through to TelosRefinedBadge.
 *   - Badge rendered at panel level (heading-row right), NEVER inside any
 *     `[data-testid^='goal-']`.
 *   - Empty-goals-but-refined coexist: refinement history is independent of
 *     current goal set.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Phase 7 mocks — inject hook + router so the nested badge doesn't explode.
let mockRefined = {
    refinedCount: 0,
    lastRefinedDialogueId: null as string | null,
    refinedAfterHashes: new Set<string>(),
};

vi.mock('@/lib/hooks/use-refined-telos-history', () => ({
    useRefinedTelosHistory: () => mockRefined,
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(''),
}));

import { TelosSection } from './telos';

beforeEach(() => {
    mockRefined = {
        refinedCount: 0,
        lastRefinedDialogueId: null,
        refinedAfterHashes: new Set<string>(),
    };
});

describe('TelosSection', () => {
    it('renders the section container with test-id section-telos', () => {
        render(<TelosSection telos={{ active_goals: [] }} did={null} />);
        expect(screen.getByTestId('section-telos')).not.toBeNull();
    });

    it('renders EmptyState with UI-SPEC copy when no active goals', () => {
        render(<TelosSection telos={{ active_goals: [] }} did={null} />);
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
                did={null}
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
                did={null}
            />,
        );
        // Priority is rendered as a Chip label — should be discoverable as text
        expect(screen.getByText(/0\.87/).textContent).toMatch(/0\.87/);
    });
});

describe('TelosSection — Phase 7 refinement badge placement', () => {
    it('renders TelosRefinedBadge at panel level when refinedCount >= 1 (NOT inside any goal li)', () => {
        mockRefined = {
            refinedCount: 2,
            lastRefinedDialogueId: 'a1b2c3d4e5f6a7b8',
            refinedAfterHashes: new Set<string>(['a'.repeat(64), 'b'.repeat(64)]),
        };
        render(
            <TelosSection
                telos={{
                    active_goals: [
                        { id: 'g1', description: 'Explore', priority: 0.8 },
                    ],
                }}
                did="did:noesis:alice"
            />,
        );
        const badge = screen.getByTestId('telos-refined-badge');
        // Badge is inside the section
        expect(screen.getByTestId('section-telos').contains(badge)).toBe(true);
        // Badge is NOT inside any goal-... li (panel-level, per D-27/D-30)
        const goalItems = screen.getAllByTestId(/^goal-/);
        for (const g of goalItems) {
            expect(g.contains(badge)).toBe(false);
        }
    });

    it('does not render badge when did is null', () => {
        mockRefined = {
            refinedCount: 0,
            lastRefinedDialogueId: null,
            refinedAfterHashes: new Set<string>(),
        };
        render(<TelosSection telos={{ active_goals: [] }} did={null} />);
        expect(screen.queryByTestId('telos-refined-badge')).toBeNull();
    });

    it('renders empty-goals EmptyState AND badge together (refinement history independent of goals)', () => {
        mockRefined = {
            refinedCount: 1,
            lastRefinedDialogueId: 'a1b2c3d4e5f6a7b8',
            refinedAfterHashes: new Set<string>(['a'.repeat(64)]),
        };
        render(
            <TelosSection telos={{ active_goals: [] }} did="did:noesis:alice" />,
        );
        // Both coexist — AC-4-3-2
        expect(screen.getByText(/No active goals\. Telos is quiescent\./i)).not.toBeNull();
        expect(screen.getByTestId('telos-refined-badge')).not.toBeNull();
    });
});
