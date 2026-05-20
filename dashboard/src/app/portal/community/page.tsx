/**
 * Community — Phase 28 placeholder · editorial theme.
 * Server component.
 */

export default function CommunityPage() {
    return (
        <div style={{ padding: '36px 40px', maxWidth: 580 }}>
            <div style={{ marginBottom: 32 }}>
                <h1 style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 30,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    letterSpacing: '0.01em',
                    lineHeight: 1.15,
                    marginBottom: 6,
                }}>
                    Community
                </h1>
                <p style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                }}>
                    User directory, community board, and live activity feed.
                </p>
            </div>

            <div style={{
                background: 'var(--parchment)',
                border: '1px solid var(--rule)',
                borderRadius: 6,
                padding: '48px 32px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
            }}>
                <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    border: '1px solid var(--rule)', background: 'var(--parchment-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--bronze)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                    </svg>
                </div>
                <div>
                    <p style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                        Coming in Phase 28
                    </p>
                    <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 380 }}>
                        User directory, community board, live activity feed, follow others,
                        and leaderboard by Cyber Coin holdings and Nous contributions.
                    </p>
                </div>
                <span style={{
                    fontFamily: 'var(--mono-portal)', fontSize: 9, fontWeight: 600,
                    letterSpacing: '0.12em', textTransform: 'uppercase' as const,
                    color: 'var(--bronze)', background: 'var(--parchment-2)',
                    border: '1px solid var(--rule)', borderRadius: 2, padding: '3px 8px',
                }}>
                    Phase 28 · Community
                </span>
            </div>
        </div>
    );
}
