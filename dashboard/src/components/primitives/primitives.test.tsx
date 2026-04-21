import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Chip, MeterRow, EmptyState } from './index';

/**
 * Plan 04-04 Task 3 — Shared primitives tests.
 *
 * Single co-located file covers all three components so both downstream plans
 * (Inspector, Economy) can import from '@/components/primitives' with
 * confidence that shape + clamping + empty-state semantics are enforced.
 */

describe('Chip', () => {
    it('renders its label as text', () => {
        render(<Chip label="dialectic-session" />);
        expect(screen.getByText('dialectic-session').textContent).toBe('dialectic-session');
    });

    it('forwards testId to the rendered element', () => {
        render(<Chip label="movement" testId="chip-movement" />);
        const el = screen.getByTestId('chip-movement');
        expect(el.textContent).toBe('movement');
    });

    it("renders the 'dialogue' color variant with indigo-400 border + text classes", () => {
        // Phase 7: Nous-initiated telos.refined badge uses indigo-400 #818CF8 on
        // #17181C secondary surface (07-UI-SPEC §Color). This case also guards
        // that no future executor silently removes the 'dialogue' slot.
        render(<Chip label="x" color="dialogue" testId="chip-dialogue" />);
        const el = screen.getByTestId('chip-dialogue');
        expect(el.className).toContain('border-[#818CF8]');
        expect(el.className).toContain('text-[#818CF8]');
    });
});

describe('MeterRow', () => {
    it('renders value to two decimals', () => {
        render(<MeterRow label="openness" value={0.5} testId="meter-openness" />);
        expect(screen.getByText('0.50').textContent).toBe('0.50');
    });

    it('clamps values below 0 to 0% bar width', () => {
        render(<MeterRow label="neg" value={-0.5} testId="meter-neg" />);
        const row = screen.getByTestId('meter-neg');
        const bar = row.querySelector<HTMLDivElement>('[data-role="meter-fill"]');
        expect(bar).not.toBeNull();
        expect(bar!.style.width).toBe('0%');
    });

    it('clamps values above 1 to 100% bar width', () => {
        render(<MeterRow label="over" value={1.5} testId="meter-over" />);
        const row = screen.getByTestId('meter-over');
        const bar = row.querySelector<HTMLDivElement>('[data-role="meter-fill"]');
        expect(bar).not.toBeNull();
        expect(bar!.style.width).toBe('100%');
    });

    it('renders the label text', () => {
        render(<MeterRow label="Conscientiousness" value={0.42} />);
        expect(screen.getByText('Conscientiousness').textContent).toBe('Conscientiousness');
    });
});

describe('EmptyState', () => {
    it('renders the title text', () => {
        render(<EmptyState title="No active goals. Telos is quiescent." testId="telos-empty" />);
        expect(
            screen.getByText('No active goals. Telos is quiescent.').textContent,
        ).toBe('No active goals. Telos is quiescent.');
    });

    it('renders the description when provided', () => {
        render(
            <EmptyState
                title="Brain unreachable"
                description="Is the noesis-nous-sophia container up?"
                testId="inspector-error"
            />,
        );
        expect(
            screen.getByText('Is the noesis-nous-sophia container up?').textContent,
        ).toBe('Is the noesis-nous-sophia container up?');
    });

    it('omits the description when undefined', () => {
        render(<EmptyState title="Roster empty." testId="balances-empty" />);
        const root = screen.getByTestId('balances-empty');
        // The only text node inside should be the title
        expect(root.textContent).toBe('Roster empty.');
    });
});
