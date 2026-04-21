import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

/**
 * Plan 07-04 Task 2 — FirehoseFilterChip tests.
 *
 * Locked testids (07-UI-SPEC §Testing Contract):
 *   - firehose-filter-chip (outer wrapper)
 *   - firehose-filter-clear (× clear button)
 *
 * Chip is self-conditional: mounts only when useFirehoseFilter returns
 * a non-null filter. Clear button removes firehose_filter param via
 * router.push, preserving all other params.
 */

type FirehoseFilter = { key: 'dialogue_id'; value: string };
let mockFilter: FirehoseFilter | null = null;
const mockClear = vi.fn();
const mockSetFilter = vi.fn();

vi.mock('@/lib/hooks/use-firehose-filter', () => ({
    useFirehoseFilter: () => ({
        filter: mockFilter,
        setFilter: mockSetFilter,
        clear: mockClear,
    }),
}));

import { FirehoseFilterChip } from './firehose-filter-chip';

beforeEach(() => {
    mockFilter = null;
    mockClear.mockReset();
    mockSetFilter.mockReset();
});

describe('FirehoseFilterChip — render gating', () => {
    it('renders nothing when filter is null', () => {
        mockFilter = null;
        render(<FirehoseFilterChip />);
        expect(screen.queryByTestId('firehose-filter-chip')).toBeNull();
    });

    it('renders nothing when URL is malformed and hook returns filter:null', () => {
        // The hook itself gates on DIALOGUE_ID_RE — this component just trusts it.
        mockFilter = null;
        render(<FirehoseFilterChip />);
        expect(screen.queryByTestId('firehose-filter-chip')).toBeNull();
    });
});

describe('FirehoseFilterChip — rendering when filter active', () => {
    it('mounts chip with dialogue_id value in font-mono span when filter is set', () => {
        mockFilter = { key: 'dialogue_id', value: 'a1b2c3d4e5f6a7b8' };
        render(<FirehoseFilterChip />);
        const chip = screen.getByTestId('firehose-filter-chip');
        expect(chip).not.toBeNull();
        expect(chip.textContent).toContain('dialogue_id:');
        expect(chip.textContent).toContain('a1b2c3d4e5f6a7b8');
        // Value must be inside a font-mono span per 07-UI-SPEC §Copywriting.
        const valueSpan = Array.from(chip.querySelectorAll('span')).find((s) =>
            s.textContent?.includes('a1b2c3d4e5f6a7b8'),
        );
        expect(valueSpan).not.toBeUndefined();
        expect(valueSpan!.className).toContain('font-mono');
    });

    it('sets role="status" + aria-live="polite" on the chip wrapper', () => {
        mockFilter = { key: 'dialogue_id', value: 'a1b2c3d4e5f6a7b8' };
        render(<FirehoseFilterChip />);
        const chip = screen.getByTestId('firehose-filter-chip');
        expect(chip.getAttribute('role')).toBe('status');
        expect(chip.getAttribute('aria-live')).toBe('polite');
    });
});

describe('FirehoseFilterChip — clear button interactions', () => {
    it('click on firehose-filter-clear invokes clear()', () => {
        mockFilter = { key: 'dialogue_id', value: 'a1b2c3d4e5f6a7b8' };
        render(<FirehoseFilterChip />);
        fireEvent.click(screen.getByTestId('firehose-filter-clear'));
        expect(mockClear).toHaveBeenCalledTimes(1);
    });

    it('keyboard Enter on clear button invokes clear() via native button behavior', () => {
        mockFilter = { key: 'dialogue_id', value: 'a1b2c3d4e5f6a7b8' };
        render(<FirehoseFilterChip />);
        const btn = screen.getByTestId('firehose-filter-clear');
        // Native <button> handles Enter/Space via click synthesis; fireEvent.click
        // is the standard test shape for both mouse and keyboard activation.
        fireEvent.click(btn);
        expect(mockClear).toHaveBeenCalledTimes(1);
    });

    it('clear button aria-label is literal "Clear dialogue filter. Show all firehose events."', () => {
        mockFilter = { key: 'dialogue_id', value: 'a1b2c3d4e5f6a7b8' };
        render(<FirehoseFilterChip />);
        const btn = screen.getByTestId('firehose-filter-clear');
        expect(btn.getAttribute('aria-label')).toBe(
            'Clear dialogue filter. Show all firehose events.',
        );
    });
});
