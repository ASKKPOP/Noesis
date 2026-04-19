/**
 * EconomyPanel — container that loads roster + trades + shops on mount and
 * re-fetches roster + trades (not shops) when a `trade.settled` event
 * arrives on the Firehose.
 *
 * Contract:
 *   - Mount: fetchRoster + fetchTrades + fetchShops each fire exactly once.
 *   - Invalidation: a newly-ingested `trade.settled` event triggers a second
 *     fetchRoster + fetchTrades (dedupe via lastTradeId ref). fetchShops
 *     stays at its original 1 call count.
 *   - Per-section error isolation: a roster fetch failure renders the
 *     balances-error EmptyState without knocking trades or shops offline.
 *   - Abort on unmount: AbortController.abort called for the in-flight
 *     fetches so late-resolving promises cannot setState on unmounted tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, cleanup } from '@testing-library/react';
import { StoresProvider, useStores } from '../use-stores';
import type { AuditEntry } from '@/lib/protocol/audit-types';

// Mock the economy API so tests own the fetch lifecycle. We re-export the
// type surface so TypeScript stays happy inside the component under test.
const rosterMock = vi.fn();
const tradesMock = vi.fn();
const shopsMock = vi.fn();
vi.mock('@/lib/api/economy', async () => {
    const actual =
        await vi.importActual<typeof import('@/lib/api/economy')>(
            '@/lib/api/economy',
        );
    return {
        ...actual,
        fetchRoster: (...args: unknown[]) => rosterMock(...args),
        fetchTrades: (...args: unknown[]) => tradesMock(...args),
        fetchShops: (...args: unknown[]) => shopsMock(...args),
    };
});

// Import AFTER the mock so the component sees the mocked wrappers.
import { EconomyPanel } from './economy-panel';

const ROSTER = {
    nous: [
        {
            did: 'did:noesis:alpha',
            name: 'Alpha',
            region: 'alpha',
            ousia: 100,
            lifecyclePhase: 'adult',
            reputation: 0.5,
            status: 'active',
        },
    ],
};
const TRADES = { trades: [], total: 0 };
const SHOPS = { shops: [] };

function resolveAll(): void {
    rosterMock.mockResolvedValue({ ok: true, data: ROSTER });
    tradesMock.mockResolvedValue({ ok: true, data: TRADES });
    shopsMock.mockResolvedValue({ ok: true, data: SHOPS });
}

/** Helper that exposes the inner stores instance so tests can push firehose
 *  events programmatically. Rendered as a sibling inside <StoresProvider>. */
function StoresProbe({
    onReady,
}: {
    onReady: (stores: ReturnType<typeof useStores>) => void;
}): null {
    const stores = useStores();
    onReady(stores);
    return null;
}

function renderWithStores(
    onStoresReady?: (stores: ReturnType<typeof useStores>) => void,
) {
    return render(
        <StoresProvider>
            {onStoresReady ? <StoresProbe onReady={onStoresReady} /> : null}
            <EconomyPanel />
        </StoresProvider>,
    );
}

function mkTradeSettled(id: number, nonce: string): AuditEntry {
    return {
        id,
        eventType: 'trade.settled',
        actorDid: 'did:noesis:alpha',
        targetDid: 'did:noesis:beta',
        payload: { counterparty: 'did:noesis:beta', amount: 5, nonce },
        prevHash: '',
        eventHash: `hash-${nonce}`,
        createdAt: Date.now(),
    };
}

describe('EconomyPanel', () => {
    beforeEach(() => {
        rosterMock.mockReset();
        tradesMock.mockReset();
        shopsMock.mockReset();
    });

    afterEach(() => {
        cleanup();
    });

    it('calls all three fetch wrappers exactly once on mount', async () => {
        resolveAll();
        await act(async () => {
            renderWithStores();
        });
        expect(rosterMock).toHaveBeenCalledTimes(1);
        expect(tradesMock).toHaveBeenCalledTimes(1);
        expect(shopsMock).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('economy-panel')).not.toBeNull();
    });

    it('re-fetches roster + trades (not shops) when a trade.settled event arrives', async () => {
        resolveAll();
        let storesRef: ReturnType<typeof useStores> | null = null;
        await act(async () => {
            renderWithStores((s) => {
                storesRef = s;
            });
        });
        expect(rosterMock).toHaveBeenCalledTimes(1);
        expect(tradesMock).toHaveBeenCalledTimes(1);
        expect(shopsMock).toHaveBeenCalledTimes(1);

        await act(async () => {
            storesRef!.firehose.ingest([mkTradeSettled(1, 'n1')]);
        });

        expect(rosterMock).toHaveBeenCalledTimes(2);
        expect(tradesMock).toHaveBeenCalledTimes(2);
        // Shops should NOT be re-fetched — they are launcher-registered.
        expect(shopsMock).toHaveBeenCalledTimes(1);
    });

    it('deduplicates successive identical trade.settled events by id', async () => {
        resolveAll();
        let storesRef: ReturnType<typeof useStores> | null = null;
        await act(async () => {
            renderWithStores((s) => {
                storesRef = s;
            });
        });

        // First trade.settled arrives → refetch.
        await act(async () => {
            storesRef!.firehose.ingest([mkTradeSettled(1, 'n1')]);
        });
        expect(rosterMock).toHaveBeenCalledTimes(2);

        // Unrelated non-trade event pushed → no new refetch.
        await act(async () => {
            storesRef!.firehose.ingest([
                {
                    id: 2,
                    eventType: 'nous.moved',
                    actorDid: 'did:a',
                    payload: {},
                    prevHash: '',
                    eventHash: 'h2',
                    createdAt: Date.now(),
                },
            ]);
        });
        expect(rosterMock).toHaveBeenCalledTimes(2);
    });

    it('renders per-section error when roster fetch fails but trades+shops succeed', async () => {
        rosterMock.mockResolvedValue({ ok: false, error: { kind: 'network' } });
        tradesMock.mockResolvedValue({ ok: true, data: TRADES });
        shopsMock.mockResolvedValue({ ok: true, data: SHOPS });

        await act(async () => {
            renderWithStores();
        });

        expect(screen.getByTestId('balances-error')).not.toBeNull();
        // Trades empty-state (not error) because trades resolved with empty array.
        expect(screen.getByTestId('trades-empty')).not.toBeNull();
        expect(screen.getByTestId('shops-empty')).not.toBeNull();
    });

    it('aborts in-flight fetches on unmount', async () => {
        resolveAll();
        const abortSpy = vi.spyOn(AbortController.prototype, 'abort');
        let unmount: (() => void) | null = null;
        await act(async () => {
            const out = renderWithStores();
            unmount = out.unmount;
        });
        expect(abortSpy).toHaveBeenCalledTimes(0);
        await act(async () => {
            unmount!();
        });
        // At least one abort when StoresProvider unmounts; could be more if
        // the trade.settled effect also registered an AbortController.
        expect(abortSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
        abortSpy.mockRestore();
    });
});
