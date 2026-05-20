/**
 * Chat with Nous — Phase 26 placeholder · editorial theme.
 * Server component.
 */

export default function ChatPage() {
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
                    Chat with Nous
                </h1>
                <p style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                }}>
                    Direct conversation with Sophia, Hermes, and Themis.
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
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                    </svg>
                </div>
                <div>
                    <p style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                        Coming in Phase 26
                    </p>
                    <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 360 }}>
                        Talk to Sophia, Hermes, and Themis. Send tips, browse their activity
                        feed, and explore their skills and lore.
                    </p>
                </div>
                <span style={{
                    fontFamily: 'var(--mono-portal)', fontSize: 9, fontWeight: 600,
                    letterSpacing: '0.12em', textTransform: 'uppercase' as const,
                    color: 'var(--bronze)', background: 'var(--parchment-2)',
                    border: '1px solid var(--rule)', borderRadius: 2, padding: '3px 8px',
                }}>
                    Phase 26 · Nous
                </span>
            </div>
        </div>
    );
}
