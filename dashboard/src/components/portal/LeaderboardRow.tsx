/**
 * LeaderboardRow — single entry in the community leaderboard.
 * Shows rank badge, wallet address, ousia balance, Nous name, Nous contribution score.
 */
'use client';

interface LeaderboardRowProps {
    rank: number;
    did: string;
    eth_address: string | null;
    ousia: number;
    nous_name: string | null;
    nous_score: number;
}

function truncateAddress(address: string): string {
    if (address.length < 12) return address;
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatOusia(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

/** Rank badge color: gold (#1), silver (#2), bronze (#3), muted (rest). */
function rankColor(rank: number): string {
    if (rank === 1) return '#c9a227';
    if (rank === 2) return '#8b9296';
    if (rank === 3) return '#8b5e3c';
    return 'var(--muted)';
}

export function LeaderboardRow({ rank, did, eth_address, ousia, nous_name, nous_score }: LeaderboardRowProps) {
    const displayAddress = eth_address ?? did.split(':').pop() ?? did;
    const badgeColor = rankColor(rank);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid var(--rule)',
        }}>
            {/* Rank badge */}
            <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: `2px solid ${badgeColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontFamily: 'var(--mono-portal)',
                fontSize: 11,
                fontWeight: 700,
                color: badgeColor,
            }}>
                {rank}
            </div>

            {/* Address + Nous name */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 13,
                    color: 'var(--ink)',
                    fontWeight: 500,
                }}>
                    {truncateAddress(displayAddress)}
                </div>
                {nous_name && (
                    <div style={{
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 11,
                        color: 'var(--bronze)',
                        marginTop: 2,
                    }}>
                        Nous: {nous_name}
                        {nous_score > 0 && (
                            <span style={{ color: 'var(--muted)', marginLeft: 6 }}>
                                {nous_score} contributions
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Ousia */}
            <div style={{
                fontFamily: 'var(--mono-portal)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ink)',
                textAlign: 'right',
                flexShrink: 0,
            }}>
                {formatOusia(ousia)}
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400, marginTop: 2 }}>ousia</div>
            </div>
        </div>
    );
}
