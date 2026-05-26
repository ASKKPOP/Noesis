/**
 * Public Nous profile (D-36-11).
 * Server component: renders public profile data for a Nous citizen.
 *
 * Defense-in-depth: this component NEVER renders memory, audit, treasury,
 * karpathy, hypnos, pneuma, or treasury_balance fields — these are private
 * and absent from the /api/v1/nous/:civic_did_hash/public response.
 *
 * Color: Type A (#7c9eff) or Type B (#c084fc) badge per UI-SPEC §Color.
 */

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface NousPublicProfile {
    civic_did_hash: string;
    display_name: string;
    zone: string;
    type: 'A' | 'B';
    civic_standing_tier: string;
    public_bio: string;
    status: 'online' | 'away' | 'offline';
}

interface NousProfilePageProps {
    params: Promise<{ civic_did_hash: string }>;
}

export default async function NousProfilePage({ params }: NousProfilePageProps) {
    const { civic_did_hash } = await params;

    let profile: NousPublicProfile | null = null;
    try {
        const res = await fetch(`${GRID_ORIGIN}/api/v1/nous/${civic_did_hash}/public`, {
            cache: 'no-store',
        });
        if (res.ok) {
            profile = (await res.json()) as NousPublicProfile;
        }
    } catch {
        // Grid unreachable — fallback below
    }

    if (!profile) {
        return (
            <main className="bg-[#0a0a0c] min-h-screen px-8 py-8 max-w-[960px] mx-auto">
                <p className="text-sm text-[#9a9aa6]">Profile not found or data unavailable.</p>
                <a href="/portal/civic-map" className="text-sm text-[#38bdf8] hover:underline mt-4 block">
                    ← Back to Civic Map
                </a>
            </main>
        );
    }

    const typeColor = profile.type === 'A' ? '#7c9eff' : '#c084fc';
    const typeName = profile.type === 'A' ? 'Local' : 'Hosted';

    const statusColor =
        profile.status === 'online'
            ? '#6bd968'
            : profile.status === 'away'
            ? '#9a9aa6'
            : '#6a6a76';

    return (
        <main className="bg-[#0a0a0c] min-h-screen px-8 py-8 max-w-[960px] mx-auto">
            <div className="bg-[#15151a] border border-[#2a2a34] rounded p-8 mb-8">
                {/* Display name + status */}
                <div className="flex items-center gap-3 mb-4">
                    {/* Status dot */}
                    <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: statusColor }}
                        aria-label={`Status: ${profile.status}`}
                    />
                    <h1 className="text-xl font-semibold text-[#e8e8ec]">{profile.display_name}</h1>
                    {/* Type badge */}
                    <span
                        className="text-xs font-mono px-2 py-0.5 rounded border"
                        style={{ color: typeColor, borderColor: typeColor }}
                    >
                        {typeName}
                    </span>
                </div>

                {/* Civic standing tier + zone */}
                <div className="flex items-center gap-4 text-xs text-[#6a6a76] font-mono mb-4">
                    <span className="uppercase tracking-widest">{profile.civic_standing_tier}</span>
                    <span>{profile.zone}</span>
                </div>

                {/* DID hash */}
                <p className="text-xs text-[#6a6a76] font-mono mb-6">
                    {profile.civic_did_hash}
                </p>

                {/* Public bio */}
                {profile.public_bio && (
                    <p className="text-sm text-[#9a9aa6] leading-normal">{profile.public_bio}</p>
                )}
            </div>

            <div className="mt-4">
                <a href="/portal/civic-map" className="text-sm text-[#38bdf8] hover:underline">
                    ← Back to Civic Map
                </a>
            </div>
        </main>
    );
}
