/**
 * Civic Map — Zone deep-dive page (D-36-14).
 * Server component: fetches zone data from Grid API and renders tax rate,
 * recent activity, and top contributors.
 *
 * Color: zone-color accent (#38bdf8) per UI-SPEC §Color layer-semantic table.
 */
import { safeGridFetch } from '@/lib/server-grid-fetch';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface ZoneActivity {
    type: string;
    description: string;
    timestamp: string;
}

interface ZoneContributor {
    display_name: string;
    civic_did_hash: string;
    contributions: number;
}

interface ZoneDetail {
    zone_id: string;
    label: string;
    description: string;
    taxRate: number;
    recentActivity: ZoneActivity[];
    topContributors: ZoneContributor[];
}

interface ZonePageProps {
    params: Promise<{ zone_id: string }>;
}

export default async function ZoneDeepDivePage({ params }: ZonePageProps) {
    const { zone_id } = await params;

    const zone = await safeGridFetch<ZoneDetail>(
        `${GRID_ORIGIN}/api/v1/civic-map/zone/${zone_id}`,
        { cache: 'no-store' },
    );

    return (
        <main className="bg-[#0a0a0c] min-h-screen px-8 py-8 max-w-[960px] mx-auto">
            {/* Zone heading — Cormorant Garamond display size per UI-SPEC §Typography */}
            <h1
                className="text-[34px] font-normal leading-tight text-[#38bdf8]"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
                {zone?.label ?? zone_id}
            </h1>

            {zone ? (
                <>
                    <p className="text-sm text-[#9a9aa6] mt-2 mb-8">{zone.description}</p>

                    {/* Tax rate badge */}
                    <div className="mb-8">
                        <span className="text-xs font-mono text-[#6a6a76] uppercase tracking-widest mr-3">
                            TAX RATE
                        </span>
                        <span className="text-[#ffb86c] text-sm font-semibold">
                            {zone.taxRate}%
                        </span>
                    </div>

                    {/* Recent activity */}
                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-[#e8e8ec] mb-4">
                            Recent Activity
                        </h2>
                        {zone.recentActivity.length === 0 ? (
                            <p className="text-sm text-[#6a6a76]">No recent activity.</p>
                        ) : (
                            <ul className="space-y-3">
                                {zone.recentActivity.map((item, i) => (
                                    <li
                                        key={i}
                                        className="bg-[#15151a] border border-[#2a2a34] rounded p-4"
                                    >
                                        <p className="text-sm text-[#e8e8ec]">{item.description}</p>
                                        <p className="text-xs text-[#6a6a76] mt-1 font-mono">
                                            {item.type} · {item.timestamp}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* Top contributors */}
                    <section>
                        <h2 className="text-xl font-semibold text-[#e8e8ec] mb-4">
                            Top Contributors
                        </h2>
                        {zone.topContributors.length === 0 ? (
                            <p className="text-sm text-[#6a6a76]">No contributors yet.</p>
                        ) : (
                            <ul className="space-y-2">
                                {zone.topContributors.map((c) => (
                                    <li
                                        key={c.civic_did_hash}
                                        className="flex items-center justify-between bg-[#15151a] border border-[#2a2a34] rounded px-4 py-3"
                                    >
                                        <a
                                            href={`/portal/nous/${c.civic_did_hash}`}
                                            className="text-sm text-[#e8e8ec] hover:text-[#38bdf8]"
                                        >
                                            {c.display_name}
                                        </a>
                                        <span className="text-xs text-[#6a6a76] font-mono">
                                            {c.contributions} contributions
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            ) : (
                <p className="text-sm text-[#9a9aa6] mt-4">
                    Zone data unavailable. Reconnecting…
                </p>
            )}

            <div className="mt-8">
                <a href="/portal/civic-map" className="text-sm text-[#38bdf8] hover:underline">
                    ← Back to Civic Map
                </a>
            </div>
        </main>
    );
}
