'use client';
/**
 * ShopsList — Economy panel's third sub-table. Renders each launcher-
 * registered shop as a card with owner name + a nested listings table
 * (SKU / Label / Price in Ousia).
 *
 * Owner lookup: `shop.ownerDid → roster name`, falling back to the
 * `…<last 8 chars>` convention shared with TradesTable when the owner is
 * not in the current roster (e.g. despawned between snapshots).
 *
 * Primitives: `@/components/primitives` (Plan 04-04).
 */

import { useMemo } from 'react';
import { EmptyState } from '@/components/primitives';
import type { NousRosterEntry, Shop } from '@/lib/api/economy';

export interface ShopsListProps {
    readonly shops: readonly Shop[];
    readonly roster: readonly NousRosterEntry[];
}

export function ShopsList({
    shops,
    roster,
}: ShopsListProps): React.ReactElement {
    const nameByDid = useMemo(() => {
        const m = new Map<string, string>();
        for (const n of roster) m.set(n.did, n.name);
        return m;
    }, [roster]);

    const labelFor = (did: string): string =>
        nameByDid.get(did) ?? `…${did.slice(-8)}`;

    if (shops.length === 0) {
        return (
            <EmptyState
                title="No active shops."
                description="The launcher has not registered any shops."
                testId="shops-empty"
            />
        );
    }

    return (
        <ul
            data-testid="shops-list"
            className="flex flex-col gap-2"
        >
            {shops.map((shop) => (
                <li
                    key={`${shop.ownerDid}-${shop.name}`}
                    data-testid={`shop-${shop.ownerDid}`}
                    className="rounded border border-neutral-800 bg-neutral-900 p-2"
                >
                    <header className="mb-1 flex items-baseline gap-2">
                        <h3 className="text-sm font-semibold text-neutral-100">
                            {shop.name}
                        </h3>
                        <span className="text-xs text-neutral-400">
                            owned by {labelFor(shop.ownerDid)}
                        </span>
                    </header>
                    {shop.listings.length === 0 ? (
                        <p className="text-xs text-neutral-500">No listings.</p>
                    ) : (
                        <table className="w-full text-xs text-neutral-300">
                            <thead>
                                <tr className="text-left text-[11px] font-semibold text-neutral-500">
                                    <th scope="col" className="py-0.5 pr-2">
                                        SKU
                                    </th>
                                    <th scope="col" className="py-0.5 px-2">
                                        Label
                                    </th>
                                    <th scope="col" className="py-0.5 pl-2 text-right">
                                        Price
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {shop.listings.map((l) => (
                                    <tr
                                        key={l.sku}
                                        className="border-t border-neutral-800"
                                    >
                                        <td className="py-0.5 pr-2 font-mono text-neutral-400">
                                            {l.sku}
                                        </td>
                                        <td className="py-0.5 px-2">
                                            {l.label}
                                        </td>
                                        <td className="py-0.5 pl-2 text-right tabular-nums">
                                            {l.priceOusia}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </li>
            ))}
        </ul>
    );
}
