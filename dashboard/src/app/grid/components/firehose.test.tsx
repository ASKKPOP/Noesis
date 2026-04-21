/**
 * Firehose panel tests — the top-level panel that subscribes to FirehoseStore
 * and renders a 100-row DOM-capped list.
 *
 * Coverage:
 *   F-1: empty state copy
 *   F-2: DOM cap — 200 ingested → 100 rendered (newest first)
 *   F-3: filter chip interaction filters the visible rows
 *   F-4: filter-active empty state copy ("No events match")
 *
 * Phase 7 (Plan 07-04 Task 3):
 *   F-5: dialogue_id filter active + mixed rows → matching row opacity-100,
 *        non-matching rows opacity-40 (dim-not-hide; AC-4-3-3)
 *   F-6: dialogue_id filter active + zero matches → empty-match heading
 *        "No matching events for dialogue_id <value>. Press × to clear."
 *   F-7: dialogue_id filter null → rows render unmodified (AC-4-3-4,
 *        zero-diff regression guard)
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { StoresProvider, useStores } from '../use-stores';
import { Firehose } from './firehose';
import {
    makeAuditEntry,
    resetFixtureIds,
} from '@/test/fixtures/ws-frames';
import type { FirehoseStore } from '@/lib/stores/firehose-store';

// Phase 7 mocks — mutable per-case.
let mockDialogueFilter: { key: 'dialogue_id'; value: string } | null = null;

vi.mock('@/lib/hooks/use-firehose-filter', () => ({
    useFirehoseFilter: () => ({
        filter: mockDialogueFilter,
        setFilter: vi.fn(),
        clear: vi.fn(),
    }),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(''),
}));

function Wrapper({ children }: { children: ReactNode }) {
    return <StoresProvider>{children}</StoresProvider>;
}

/**
 * Harness that captures the store triple into a ref so the test body can
 * ingest after render without having to render a separate probe.
 */
function Capture({ capture }: { capture: { firehose?: FirehoseStore } }) {
    const s = useStores();
    capture.firehose = s.firehose;
    return <Firehose />;
}

describe('Firehose', () => {
    beforeEach(() => {
        resetFixtureIds();
        mockDialogueFilter = null;
    });

    it('F-1: renders the empty state when no events have been ingested', () => {
        render(<Firehose />, { wrapper: Wrapper });
        expect(screen.getByText(/Waiting for events/i)).not.toBeNull();
        // No list should be rendered in the empty case.
        expect(screen.queryByTestId('firehose-list')).toBeNull();
    });

    it('F-2: caps DOM at 100 rows with newest first when 200 entries ingested', () => {
        const capture: { firehose?: FirehoseStore } = {};
        render(<Capture capture={capture} />, { wrapper: Wrapper });

        act(() => {
            const entries = Array.from({ length: 200 }, (_, i) =>
                makeAuditEntry({
                    id: i + 1,
                    eventType: 'tick',
                    actorDid: 'system',
                    payload: { tick: i + 1, tickRateMs: 30_000 },
                }),
            );
            capture.firehose!.ingest(entries);
        });

        const list = screen.getByTestId('firehose-list');
        expect(list.getAttribute('data-rendered-count')).toBe('100');
        const rows = screen.getAllByTestId('firehose-row');
        expect(rows).toHaveLength(100);
        // Newest first → first row is id=200.
        expect(rows[0].getAttribute('data-event-id')).toBe('200');
        // Last visible row is id=101 (the 100 newest are 101..200).
        expect(rows[99].getAttribute('data-event-id')).toBe('101');
    });

    it('F-3: clicking a category chip filters visible rows', async () => {
        const user = userEvent.setup();
        const capture: { firehose?: FirehoseStore } = {};
        render(<Capture capture={capture} />, { wrapper: Wrapper });

        act(() => {
            const tradeEntries = Array.from({ length: 5 }, (_, i) =>
                makeAuditEntry({
                    id: 100 + i,
                    eventType: 'trade.proposed',
                    actorDid: `did:nous:t${i}`,
                    payload: {},
                }),
            );
            const moveEntries = Array.from({ length: 5 }, (_, i) =>
                makeAuditEntry({
                    id: 200 + i,
                    eventType: 'nous.moved',
                    actorDid: `did:nous:m${i}`,
                    payload: { name: 'x', toRegion: 'agora' },
                }),
            );
            capture.firehose!.ingest([...tradeEntries, ...moveEntries]);
        });

        // All 10 visible initially.
        expect(screen.getAllByTestId('firehose-row')).toHaveLength(10);

        // Click the 'trade' chip.
        const tradeChip = screen.getByRole('button', { name: /trade/i });
        await user.click(tradeChip);

        const filtered = screen.getAllByTestId('firehose-row');
        expect(filtered).toHaveLength(5);
        for (const row of filtered) {
            expect(
                row.querySelector('[data-testid="event-type-badge"]')?.getAttribute('data-category'),
            ).toBe('trade');
        }

        // Click 'All' to restore.
        const allChip = screen.getByRole('button', { name: /^All$/ });
        await user.click(allChip);
        expect(screen.getAllByTestId('firehose-row')).toHaveLength(10);
    });

    it('F-4: renders filter-active empty state when filter matches nothing', async () => {
        const user = userEvent.setup();
        const capture: { firehose?: FirehoseStore } = {};
        render(<Capture capture={capture} />, { wrapper: Wrapper });

        act(() => {
            // Only movement entries in the store.
            capture.firehose!.ingest([
                makeAuditEntry({
                    id: 1,
                    eventType: 'nous.moved',
                    actorDid: 'did:nous:a',
                    payload: { name: 'A', toRegion: 'agora' },
                }),
            ]);
        });

        // Activate the 'trade' filter → no matches.
        const tradeChip = screen.getByRole('button', { name: /trade/i });
        await user.click(tradeChip);

        expect(screen.getByText(/No events match/i)).not.toBeNull();
        expect(screen.queryByTestId('firehose-list')).toBeNull();
    });

    // ---- Phase 7: dialogue_id filter (dim-not-hide) -------------------------

    it('F-5: dialogue_id filter active dims non-matching rows; matching row full-opacity (AC-4-3-3)', () => {
        mockDialogueFilter = { key: 'dialogue_id', value: 'a1b2c3d4e5f6a7b8' };
        const capture: { firehose?: FirehoseStore } = {};
        render(<Capture capture={capture} />, { wrapper: Wrapper });

        act(() => {
            capture.firehose!.ingest([
                // matching: telos.refined with triggered_by_dialogue_id === filter.value
                makeAuditEntry({
                    id: 10,
                    eventType: 'telos.refined',
                    actorDid: 'did:noesis:alice',
                    payload: {
                        did: 'did:noesis:alice',
                        before_goal_hash: 'a'.repeat(64),
                        after_goal_hash: 'b'.repeat(64),
                        triggered_by_dialogue_id: 'a1b2c3d4e5f6a7b8',
                    },
                }),
                // non-matching: different event, no matching dialogue_id
                makeAuditEntry({
                    id: 11,
                    eventType: 'nous.moved',
                    actorDid: 'did:noesis:bob',
                    payload: { name: 'Bob', toRegion: 'agora' },
                }),
            ]);
        });

        const rows = screen.getAllByTestId('firehose-row');
        expect(rows).toHaveLength(2);

        // Locate the matching vs non-matching rows by data-event-id.
        const matchRow = rows.find((r) => r.getAttribute('data-event-id') === '10')!;
        const nonMatchRow = rows.find((r) => r.getAttribute('data-event-id') === '11')!;
        expect(matchRow).toBeDefined();
        expect(nonMatchRow).toBeDefined();

        // Matching row: must NOT contain opacity-40 class.
        expect(matchRow.className).not.toMatch(/opacity-40/);
        // Non-matching row: MUST contain opacity-40 + pointer-events-none.
        expect(nonMatchRow.className).toMatch(/opacity-40/);
        expect(nonMatchRow.className).toMatch(/pointer-events-none/);
    });

    it('F-6: dialogue_id filter active + zero matches → empty-match heading', () => {
        mockDialogueFilter = { key: 'dialogue_id', value: 'cccccccccccccccc' };
        const capture: { firehose?: FirehoseStore } = {};
        render(<Capture capture={capture} />, { wrapper: Wrapper });

        act(() => {
            capture.firehose!.ingest([
                makeAuditEntry({
                    id: 20,
                    eventType: 'nous.moved',
                    actorDid: 'did:noesis:bob',
                    payload: { name: 'Bob', toRegion: 'agora' },
                }),
            ]);
        });

        // Empty-match heading copy per 07-UI-SPEC §Copywriting Contract.
        expect(
            screen.getByText(
                /No matching events for dialogue_id cccccccccccccccc\. Press × to clear\./,
            ),
        ).not.toBeNull();
    });

    it('F-7: dialogue_id filter null → rows render unmodified (AC-4-3-4 zero-diff)', () => {
        mockDialogueFilter = null;
        const capture: { firehose?: FirehoseStore } = {};
        render(<Capture capture={capture} />, { wrapper: Wrapper });

        act(() => {
            capture.firehose!.ingest([
                makeAuditEntry({
                    id: 30,
                    eventType: 'telos.refined',
                    actorDid: 'did:noesis:alice',
                    payload: {
                        did: 'did:noesis:alice',
                        before_goal_hash: 'a'.repeat(64),
                        after_goal_hash: 'b'.repeat(64),
                        triggered_by_dialogue_id: 'a1b2c3d4e5f6a7b8',
                    },
                }),
                makeAuditEntry({
                    id: 31,
                    eventType: 'nous.moved',
                    actorDid: 'did:noesis:bob',
                    payload: { name: 'Bob', toRegion: 'agora' },
                }),
            ]);
        });

        // No row may have opacity-40 when filter is null — zero-diff invariant.
        const rows = screen.getAllByTestId('firehose-row');
        for (const row of rows) {
            expect(row.className).not.toMatch(/opacity-40/);
        }
        // FirehoseFilterChip must NOT be mounted when filter is null.
        expect(screen.queryByTestId('firehose-filter-chip')).toBeNull();
    });
});
