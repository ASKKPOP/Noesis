/**
 * BalancesTable — presentational; sorts by Ousia desc, renders one row per
 * Nous with a name-cell that opens the Inspector via SelectionStore.
 *
 * Primitives come from `@/components/primitives` (Plan 04-04). Do NOT import
 * from `@/app/grid/inspector/primitives` — that path is retired.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BalancesTable } from './balances-table';
import { selectionStore } from '@/lib/stores/selection-store';
import type { NousRosterEntry } from '@/lib/api/economy';

function mk(
    did: string,
    name: string,
    ousia: number,
    status = 'active',
): NousRosterEntry {
    return {
        did,
        name,
        ousia,
        region: 'alpha',
        lifecyclePhase: 'adult',
        reputation: 0.5,
        status,
    };
}

describe('BalancesTable', () => {
    afterEach(() => {
        cleanup();
        selectionStore.clear();
        vi.restoreAllMocks();
    });

    it('renders an empty-state when roster is empty', () => {
        render(<BalancesTable roster={[]} />);
        expect(screen.getByTestId('balances-empty')).not.toBeNull();
        expect(screen.queryByTestId('balances-table')).toBeNull();
    });

    it('sorts entries by ousia descending', () => {
        render(
            <BalancesTable
                roster={[
                    mk('did:noesis:low', 'Low', 10),
                    mk('did:noesis:high', 'High', 100),
                    mk('did:noesis:mid', 'Mid', 50),
                ]}
            />,
        );
        const table = screen.getByTestId('balances-table');
        const rows = within(table).getAllByRole('row').slice(1); // drop thead
        const firstCells = rows.map((r) => r.querySelector('td')?.textContent ?? '');
        expect(firstCells).toEqual(['High', 'Mid', 'Low']);
    });

    it('renders ousia with tabular-nums class for alignment', () => {
        render(<BalancesTable roster={[mk('did:noesis:a', 'Alpha', 1234)]} />);
        // toLocaleString() output varies by locale but digits should be present.
        const ousiaCell = screen.getByText((content) =>
            content.replace(/[^0-9]/g, '') === '1234',
        );
        expect(ousiaCell.className).toMatch(/tabular-nums/);
    });

    it('clicking the name button calls selection.select(did)', async () => {
        const user = userEvent.setup();
        const entry = mk('did:noesis:alpha', 'Alpha', 50);
        render(<BalancesTable roster={[entry]} />);
        const btn = screen.getByRole('button', {
            name: /open inspector for alpha/i,
        });
        await user.click(btn);
        expect(selectionStore.getSnapshot()).toBe('did:noesis:alpha');
    });
});
