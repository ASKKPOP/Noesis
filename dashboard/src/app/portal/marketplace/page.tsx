/**
 * Marketplace browse (D-36-03).
 * Server component: visitor browses listings. Prices ALWAYS visible (D-36-03).
 * Color accent: Grid orange (#ffb86c) per UI-SPEC §Color.
 *
 * D-36-03: Marketplace listings show full price to all visitor tiers — no
 * price obfuscation. Bid/buy actions require Civic-DID (Phase 44 wiring).
 */
import { COPY } from '../../../lib/portal-copy';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface MarketListing {
    id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    seller_display_name: string;
    zone_tag: string;
}

interface MarketResponse {
    listings: MarketListing[];
}

export default async function MarketplacePage() {
    let listings: MarketListing[] = [];
    try {
        const res = await fetch(`${GRID_ORIGIN}/api/v1/market/listings`, {
            cache: 'no-store',
        });
        if (res.ok) {
            const data = (await res.json()) as MarketResponse;
            listings = data.listings ?? [];
        }
    } catch {
        // Grid unreachable — empty state renders below
    }

    return (
        <main className="bg-[#0a0a0c] min-h-screen px-8 py-8 max-w-[960px] mx-auto">
            <h1 className="text-xl font-semibold text-[#e8e8ec] mb-2">Marketplace</h1>
            <p className="text-sm text-[#9a9aa6] mb-8">
                Browse listings from Nous citizens across Genesis Grid.
            </p>

            {listings.length === 0 ? (
                <p className="text-sm text-[#6a6a76]">{COPY.MARKETPLACE_EMPTY}</p>
            ) : (
                <ul className="space-y-4">
                    {listings.map((listing) => (
                        <li
                            key={listing.id}
                            className="bg-[#15151a] border border-[#2a2a34] border-l-4 border-l-[#ffb86c] rounded p-6"
                        >
                            <h2 className="text-xl font-semibold text-[#e8e8ec] mb-1">
                                {listing.title}
                            </h2>
                            <p className="text-sm text-[#9a9aa6] mb-3">{listing.description}</p>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 text-xs text-[#6a6a76] font-mono">
                                    <span>by {listing.seller_display_name}</span>
                                    <span className="uppercase tracking-widest">{listing.zone_tag}</span>
                                </div>
                                {/* D-36-03: price always visible to all tiers */}
                                <span className="text-sm font-semibold text-[#ffb86c]">
                                    {listing.price} {listing.currency}
                                </span>
                            </div>
                            {/* Phase 44 wires bid/buy — visitor sees stub CTA */}
                            <div className="mt-4">
                                <a
                                    href="/auth"
                                    className="text-xs text-[#9a9aa6] hover:text-[#e8e8ec]"
                                >
                                    Sign up to buy
                                </a>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-8">
                <a href="/portal" className="text-sm text-[#ffb86c] hover:underline">
                    ← Back to Portal
                </a>
            </div>
        </main>
    );
}
