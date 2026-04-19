'use client';
/**
 * TradesTable — Economy panel's second sub-table. Renders the last-20
 * settled trades newest-first, resolving counterparty DIDs to roster names.
 *
 * W2 TIMESTAMP CONTRACT (Plan 04-03 owns, this component consumes):
 *   `TradeRecord.timestamp` is an Unix timestamp in **INTEGER SECONDS**.
 *   We MUST multiply by 1000 before passing to `new Date(...)` — otherwise
 *   all times render as 1970-01-20 and the planner's 4-month wait shipped
 *   a broken feature. The assertion in trades-table.test.tsx guards this.
 *
 * DID-to-name resolution: if the roster does not contain a DID (e.g. a
 * freshly despawned Nous whose trade is still in the ring buffer), we fall
 * back to `…<last 8 chars>` so the cell is never blank. This is intentional
 * per T-04-29 (DIDs are public identifiers; exposing the tail is safe).
 *
 * Interaction (NOUS-03 linkback): buyer/seller cells are buttons that call
 * `useSelection().select(did)`, opening the Inspector for that Nous.
 *
 * Primitives: `@/components/primitives` (Plan 04-04), NOT the retired
 * `@/app/grid/inspector/primitives` path.
 */

import { useMemo } from 'react';
import { useSelection } from '@/lib/hooks/use-selection';
import { EmptyState } from '@/components/primitives';
import type { NousRosterEntry, TradeRecord } from '@/lib/api/economy';

export interface TradesTableProps {
    readonly trades: readonly TradeRecord[];
    readonly roster: readonly NousRosterEntry[];
}

export function TradesTable({
    trades,
    roster,
}: TradesTableProps): React.ReactElement {
    const { select } = useSelection();

    const nameByDid = useMemo(() => {
        const m = new Map<string, string>();
        for (const n of roster) m.set(n.did, n.name);
        return m;
    }, [roster]);

    const labelFor = (did: string): string =>
        nameByDid.get(did) ?? `…${did.slice(-8)}`;

    const sorted = useMemo(
        () => [...trades].sort((a, b) => b.timestamp - a.timestamp),
        [trades],
    );

    if (sorted.length === 0) {
        return (
            <EmptyState
                title="No settled trades."
                description="The Grid has not settled any trades yet."
                testId="trades-empty"
            />
        );
    }

    return (
        <table
            data-testid="trades-table"
            className="w-full text-sm text-neutral-200"
        >
            <thead>
                <tr className="text-left text-xs font-semibold text-neutral-400">
                    <th scope="col" className="py-1 pr-2">
                        Time
                    </th>
                    <th scope="col" className="py-1 px-2">
                        Buyer
                    </th>
                    <th scope="col" className="py-1 px-2">
                        Seller
                    </th>
                    <th scope="col" className="py-1 px-2 text-right">
                        Amount
                    </th>
                    <th scope="col" className="py-1 pl-2">
                        Nonce
                    </th>
                </tr>
            </thead>
            <tbody>
                {sorted.map((t) => {
                    // W2 contract: timestamp is seconds → multiply by 1000 for Date.
                    const timeLabel = new Date(
                        t.timestamp * 1000,
                    ).toLocaleTimeString();
                    const buyerLabel = labelFor(t.actorDid);
                    const sellerLabel = labelFor(t.counterparty);
                    return (
                        <tr
                            key={t.nonce}
                            data-testid={`trades-row-${t.nonce}`}
                            className="border-t border-neutral-800"
                        >
                            <td className="py-1 pr-2 font-mono text-xs text-neutral-400 tabular-nums">
                                {timeLabel}
                            </td>
                            <td className="py-1 px-2">
                                <button
                                    type="button"
                                    onClick={() => select(t.actorDid)}
                                    aria-label={`Open inspector for ${buyerLabel}`}
                                    className="text-left text-neutral-100 hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                                >
                                    {buyerLabel}
                                </button>
                            </td>
                            <td className="py-1 px-2">
                                <button
                                    type="button"
                                    onClick={() => select(t.counterparty)}
                                    aria-label={`Open inspector for ${sellerLabel}`}
                                    className="text-left text-neutral-100 hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
                                >
                                    {sellerLabel}
                                </button>
                            </td>
                            <td className="py-1 px-2 text-right tabular-nums">
                                {t.amount}
                            </td>
                            <td className="py-1 pl-2 font-mono text-xs text-neutral-500">
                                {t.nonce}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
