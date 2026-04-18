/**
 * EventTypeFilter tests — chip group that toggles FirehoseStore.filter.
 *
 * Coverage:
 *   ETF-1: renders one chip per ALL_CATEGORIES entry plus 'All'
 *   ETF-2: clicking a chip updates FirehoseStore.filter and firing state
 *   ETF-3: aria-pressed reflects the store's filter state
 *   ETF-4: clicking 'All' clears any active filter
 */

import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { StoresProvider, useStores } from '../use-stores';
import { EventTypeFilter } from './event-type-filter';
import { ALL_CATEGORIES, type EventCategory } from '@/lib/stores/event-type';
import type { FirehoseStore } from '@/lib/stores/firehose-store';

function Wrapper({ children }: { children: ReactNode }) {
    return <StoresProvider>{children}</StoresProvider>;
}

/** Inline probe component — captures FirehoseStore via useStores(). */
function Capture({ capture }: { capture: { firehose?: FirehoseStore } }) {
    const s = useStores();
    capture.firehose = s.firehose;
    return <EventTypeFilter />;
}

describe('EventTypeFilter', () => {
    it('ETF-1: renders an "All" chip plus one chip per ALL_CATEGORIES', () => {
        render(<EventTypeFilter />, { wrapper: Wrapper });
        // 1 "All" + 5 categories = 6 buttons expected.
        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(ALL_CATEGORIES.length + 1);

        for (const cat of ALL_CATEGORIES) {
            expect(screen.getByRole('button', { name: new RegExp(cat, 'i') })).not.toBeNull();
        }
        expect(screen.getByRole('button', { name: /^All$/ })).not.toBeNull();
    });

    it('ETF-2: clicking "trade" sets filter to {trade}; clicking it again clears to null', async () => {
        const user = userEvent.setup();
        const capture: { firehose?: FirehoseStore } = {};
        render(<Capture capture={capture} />, { wrapper: Wrapper });

        const tradeBtn = screen.getByRole('button', { name: /trade/i });
        await user.click(tradeBtn);

        let snap = capture.firehose!.getSnapshot();
        expect(snap.filter).not.toBeNull();
        expect(snap.filter!.size).toBe(1);
        expect(snap.filter!.has('trade')).toBe(true);

        // Click again → toggles off → only trade was selected, so filter becomes null
        // (empty set auto-collapses to null per component contract).
        await user.click(tradeBtn);
        snap = capture.firehose!.getSnapshot();
        expect(snap.filter).toBeNull();
    });

    it('ETF-3: aria-pressed reflects the current filter state', () => {
        const capture: { firehose?: FirehoseStore } = {};
        render(<Capture capture={capture} />, { wrapper: Wrapper });

        // Pre-seed the filter to {trade}.
        act(() => {
            capture.firehose!.setFilter(new Set<EventCategory>(['trade']));
        });

        const tradeBtn = screen.getByRole('button', { name: /trade/i });
        expect(tradeBtn.getAttribute('aria-pressed')).toBe('true');

        for (const cat of ALL_CATEGORIES) {
            if (cat === 'trade') continue;
            const btn = screen.getByRole('button', { name: new RegExp(cat, 'i') });
            expect(btn.getAttribute('aria-pressed')).toBe('false');
        }
        // 'All' is also unpressed when a category is active.
        expect(screen.getByRole('button', { name: /^All$/ }).getAttribute('aria-pressed')).toBe('false');
    });

    it('ETF-4: clicking "All" clears any active filter', async () => {
        const user = userEvent.setup();
        const capture: { firehose?: FirehoseStore } = {};
        render(<Capture capture={capture} />, { wrapper: Wrapper });

        act(() => {
            capture.firehose!.setFilter(new Set<EventCategory>(['trade', 'message']));
        });
        expect(capture.firehose!.getSnapshot().filter).not.toBeNull();

        await user.click(screen.getByRole('button', { name: /^All$/ }));
        expect(capture.firehose!.getSnapshot().filter).toBeNull();
    });
});
