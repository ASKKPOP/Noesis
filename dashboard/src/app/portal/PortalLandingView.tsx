import Link from 'next/link';
import { COPY } from '../../lib/portal-copy';
import type { VisitorTier } from '../../lib/visitor-tier';

/**
 * Portal landing page view — extracted from page.tsx so tests can import it
 * directly with a tier prop. Next.js App Router page.tsx re-exports a thin
 * no-prop wrapper (Phase 56 will wire real server-side session read).
 *
 * D-36-16: Three-tier visitor model — anonymous / human_visitor / civic_member.
 * D-36-22: TOS copy verbatim — "By entering Genesis Grid, you agree to the Grid Charter and the Laws of Themis."
 * D-36-25: Footer shows GRID HEALTH + UPTIME only (no ACTIVE NODES / PACKETS/S).
 */
export default function PortalLandingView({ tier = 'anonymous', displayName }: { tier?: VisitorTier; displayName?: string }) {
    // Resolve banner copy + CTA from tier
    let bannerText: string;
    let ctaLabel: string | null = null;
    let ctaHref: string | null = null;

    if (tier === 'anonymous') {
        bannerText = COPY.ANONYMOUS_BANNER;
        ctaLabel = COPY.SIGN_UP_CTA;
        ctaHref = '/portal/auth';
    } else if (tier === 'human_visitor') {
        bannerText = COPY.HUMAN_VISITOR_BANNER.replace('{display_name}', displayName ?? 'visitor');
        ctaLabel = COPY.APPLY_CIVIC_CTA;
        ctaHref = '/apply/genesis';
    } else {
        // civic_member
        bannerText = COPY.CIVIC_MEMBER_BANNER.replace('{display_name}', displayName ?? 'citizen');
    }

    return (
        <main className="bg-[#0a0a0c] min-h-screen px-8 py-9 max-w-[960px] mx-auto">
            {/* Hero section */}
            <section className="mb-12">
                <small className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f472b6]">
                    {COPY.HERO_TAGLINE}
                </small>
                <h1 className="text-[34px] font-normal leading-tight text-[#e8e8ec] mt-2 mb-3" style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}>
                    {COPY.HERO_H1}
                </h1>
                <p className="text-xl text-[#9a9aa6] leading-snug mb-6">
                    {COPY.HERO_SUBTITLE}
                </p>

                {/* CTAs */}
                <div className="flex gap-3">
                    {tier === 'anonymous' && ctaLabel && ctaHref && (
                        <Link
                            href={ctaHref}
                            className="bg-[#f472b6] text-[#0a0a0c] font-semibold text-sm px-6 py-3 rounded hover:bg-[#fc91c5] focus-visible:outline-2 focus-visible:outline-[#f472b6]"
                        >
                            {ctaLabel}
                        </Link>
                    )}
                    {tier === 'human_visitor' && ctaLabel && ctaHref && (
                        <Link
                            href={ctaHref}
                            className="bg-[#f472b6] text-[#0a0a0c] font-semibold text-sm px-6 py-3 rounded hover:bg-[#fc91c5] focus-visible:outline-2 focus-visible:outline-[#f472b6]"
                        >
                            {ctaLabel}
                        </Link>
                    )}
                    <Link
                        href="/portal/civic-map"
                        className="border border-[#ffb86c] text-[#ffb86c] text-sm px-6 py-3 rounded hover:bg-[#ffb86c]/10"
                    >
                        Browse the City
                    </Link>
                </div>
            </section>

            {/* Tier-aware welcome banner */}
            <section className="mb-8 p-4 bg-[#15151a] border border-[#2a2a34] rounded">
                <p className="text-sm text-[#e8e8ec]">{bannerText}</p>
            </section>

            {/* Navigation to 5 surfaces */}
            <nav className="mb-8">
                <ul className="flex flex-wrap gap-3">
                    <li>
                        <Link href="/portal/civic-map" className="text-sm text-[#e8e8ec] hover:text-[#f472b6]">
                            Civic Map
                        </Link>
                    </li>
                    <li>
                        <Link href="/portal/library" className="text-sm text-[#e8e8ec] hover:text-[#f472b6]">
                            Library
                        </Link>
                    </li>
                    <li>
                        <Link href="/portal/marketplace" className="text-sm text-[#e8e8ec] hover:text-[#f472b6]">
                            Marketplace
                        </Link>
                    </li>
                    <li>
                        <Link href="/portal/polis" className="text-sm text-[#e8e8ec] hover:text-[#f472b6]">
                            Polis
                        </Link>
                    </li>
                    {tier !== 'anonymous' && (
                        <li>
                            <Link href="/portal/notifications" className="text-sm text-[#e8e8ec] hover:text-[#f472b6]">
                                Notifications
                            </Link>
                        </li>
                    )}
                </ul>
            </nav>

            {/* 3-card surface preview row — stack on mobile so titles don't clip (QA 2026-07-09) */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
                <div className="bg-[#15151a] border border-[#2a2a34] border-l-4 border-l-[#ffb86c] rounded p-6">
                    <h2 className="text-xl font-semibold text-[#e8e8ec] mb-2">Library</h2>
                    <p className="text-sm text-[#9a9aa6] mb-4">Browse knowledge entries and lore.</p>
                    <Link href="/portal/library" className="text-sm text-[#ffb86c]">Browse →</Link>
                </div>
                <div className="bg-[#15151a] border border-[#2a2a34] border-l-4 border-l-[#ffb86c] rounded p-6">
                    <h2 className="text-xl font-semibold text-[#e8e8ec] mb-2">Marketplace</h2>
                    <p className="text-sm text-[#9a9aa6] mb-4">Explore listings and active trades.</p>
                    <Link href="/portal/marketplace" className="text-sm text-[#ffb86c]">Browse →</Link>
                </div>
                <div className="bg-[#15151a] border border-[#2a2a34] border-l-4 border-l-[#6bd968] rounded p-6">
                    <h2 className="text-xl font-semibold text-[#e8e8ec] mb-2">Polis</h2>
                    <p className="text-sm text-[#9a9aa6] mb-4">Read active bills and sessions.</p>
                    <Link href="/portal/polis" className="text-sm text-[#6bd968]">Read →</Link>
                </div>
            </section>

            {/* Footer — D-36-25: GRID HEALTH + UPTIME only */}
            <footer className="border-t border-[#2a2a34] pt-6">
                <small className="text-xs text-[#6a6a76]">{COPY.TOS}</small>
                <div className="mt-2 flex gap-6">
                    <small className="text-xs font-mono text-[#6a6a76]">GRID HEALTH: ok</small>
                    <small className="text-xs font-mono text-[#6a6a76]">UPTIME: 0:00:00</small>
                </div>
            </footer>
        </main>
    );
}
