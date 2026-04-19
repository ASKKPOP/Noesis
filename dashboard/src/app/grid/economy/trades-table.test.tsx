/**
 * TradesTable — presentational; renders last-20 newest-first with clickable
 * buyer/seller cells that open the Inspector via SelectionStore.
 *
 * W2 TIMESTAMP CONTRACT ASSERTION (Plan 04-03 / Plan 04-06):
 *   Timestamps are Unix SECONDS. A fixture of `1700000000` (2023-11-14 UTC)
 *   MUST render with a year in the 2020s — NEVER '1970'. This anchors the
 *   `* 1000` multiplication at the render boundary.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TradesTable } from './trades-table';
import { selectionStore } from '@/lib/stores/selection-store';
import type { NousRosterEntry, TradeRecord } from '@/lib/api/economy';

function mkNous(did: string, name: string): NousRosterEntry {
    return {
        did,
        name,
        region: 'alpha',
        ousia: 0,
        lifecyclePhase: 'adult',
        reputation: 0.5,
        status: 'active',
    };
}

function mkTrade(
    actorDid: string,
    counterparty: string,
    amount: number,
    nonce: string,
    timestamp: number,
): TradeRecord {
    return { actorDid, counterparty, amount, nonce, timestamp };
}

describe('TradesTable', () => {
    afterEach(() => {
        cleanup();
        selectionStore.clear();
    });

    it('renders an empty-state when trades are empty', () => {
        render(<TradesTable trades={[]} roster={[]} />);
        expect(screen.getByTestId('trades-empty')).not.toBeNull();
        expect(screen.queryByTestId('trades-table')).toBeNull();
    });

    it('renders trades newest-first (sort by timestamp desc)', () => {
        const older = mkTrade('did:a', 'did:b', 5, 'old', 1700000000);
        const newer = mkTrade('did:b', 'did:a', 3, 'new', 1700000050);
        render(
            <TradesTable
                trades={[older, newer]}
                roster={[mkNous('did:a', 'Alpha'), mkNous('did:b', 'Beta')]}
            />,
        );
        const table = screen.getByTestId('trades-table');
        const rows = within(table).getAllByRole('row').slice(1);
        // First data row = newest → nonce 'new'
        expect(rows[0]?.textContent).toContain('new');
        expect(rows[1]?.textContent).toContain('old');
    });

    it('resolves counterparty DIDs to roster names', () => {
        const t = mkTrade(
            'did:noesis:alpha',
            'did:noesis:beta',
            10,
            'n1',
            1700000000,
        );
        render(
            <TradesTable
                trades={[t]}
                roster={[
                    mkNous('did:noesis:alpha', 'Alpha'),
                    mkNous('did:noesis:beta', 'Beta'),
                ]}
            />,
        );
        expect(
            screen.getByRole('button', { name: /open inspector for alpha/i }),
        ).not.toBeNull();
        expect(
            screen.getByRole('button', { name: /open inspector for beta/i }),
        ).not.toBeNull();
    });

    it('falls back to "…<last 8 chars>" when counterparty is not in the roster', () => {
        const t = mkTrade(
            'did:noesis:alpha',
            'did:noesis:unknownxyz12345678',
            10,
            'n1',
            1700000000,
        );
        render(
            <TradesTable trades={[t]} roster={[mkNous('did:noesis:alpha', 'Alpha')]} />,
        );
        // Last 8 chars of 'did:noesis:unknownxyz12345678' → '12345678'
        expect(screen.getByText(/…12345678/)).not.toBeNull();
    });

    it('honors the W2 Unix-seconds timestamp contract (no 1970 fallback)', () => {
        // 1700000000 → 2023-11-14 22:13:20 UTC. If we forget to `* 1000`,
        // this renders somewhere in 1970-01-20, which this assertion rules out.
        const t = mkTrade('did:a', 'did:b', 5, 'nonce-x', 1700000000);
        const { container } = render(
            <TradesTable
                trades={[t]}
                roster={[mkNous('did:a', 'Alpha'), mkNous('did:b', 'Beta')]}
            />,
        );
        const text = container.textContent ?? '';
        expect(text).not.toContain('1970');
    });

    it('clicking buyer/seller cells selects the DID', async () => {
        const user = userEvent.setup();
        const t = mkTrade('did:noesis:alpha', 'did:noesis:beta', 5, 'n1', 1700000000);
        render(
            <TradesTable
                trades={[t]}
                roster={[
                    mkNous('did:noesis:alpha', 'Alpha'),
                    mkNous('did:noesis:beta', 'Beta'),
                ]}
            />,
        );
        await user.click(
            screen.getByRole('button', { name: /open inspector for beta/i }),
        );
        expect(selectionStore.getSnapshot()).toBe('did:noesis:beta');
    });

    it('renders amount with tabular-nums class', () => {
        const t = mkTrade('did:a', 'did:b', 42, 'n1', 1700000000);
        render(
            <TradesTable
                trades={[t]}
                roster={[mkNous('did:a', 'Alpha'), mkNous('did:b', 'Beta')]}
            />,
        );
        const amountCell = screen.getByText('42');
        expect(amountCell.className).toMatch(/tabular-nums/);
    });
});
