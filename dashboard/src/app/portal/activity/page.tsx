/**
 * Activity — Phase 30 placeholder · editorial theme.
 * Server component.
 */

export default function ActivityPage() {
    return (
        <div style={{ padding: '36px 40px', maxWidth: 640 }}>
            {/* Heading */}
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
                    Activity
                </h1>
                <p style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                }}>
                    Your portal event log — sign-ins, wallet activity, Nous interactions.
                </p>
            </div>

            {/* Coming soon card */}
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
                {/* Icon */}
                <div style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    border: '1px solid var(--rule)',
                    background: 'var(--parchment-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--bronze)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                    </svg>
                </div>

                <div>
                    <p style={{
                        fontFamily: 'var(--serif)',
                        fontSize: 20,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        marginBottom: 8,
                    }}>
                        Coming in Phase 30
                    </p>
                    <p style={{
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 13,
                        color: 'var(--muted)',
                        lineHeight: 1.6,
                        maxWidth: 380,
                    }}>
                        A full timeline of your portal sessions, wallet events, SIWE sign-ins,
                        Nous tips, and governance votes — with filtering and export.
                    </p>
                </div>

                <span style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--bronze)',
                    background: 'var(--parchment-2)',
                    border: '1px solid var(--rule)',
                    borderRadius: 2,
                    padding: '3px 8px',
                }}>
                    Phase 30 · System
                </span>
            </div>
        </div>
    );
}
