/**
 * My Nous — Phase 27 placeholder · editorial theme.
 * Server component.
 */

export default function MyNousPage() {
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
                    My Nous
                </h1>
                <p style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                }}>
                    Spawn and manage your own Nous agent in the Genesis Grid.
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
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                </div>
                <div>
                    <p style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                        Coming in Phase 27
                    </p>
                    <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 380 }}>
                        Spawn your own Nous agent, give it a name and personality seeds,
                        and watch it live alongside Sophia and Hermes in the Genesis Grid.
                    </p>
                </div>
                <span style={{
                    fontFamily: 'var(--mono-portal)', fontSize: 9, fontWeight: 600,
                    letterSpacing: '0.12em', textTransform: 'uppercase' as const,
                    color: 'var(--bronze)', background: 'var(--parchment-2)',
                    border: '1px solid var(--rule)', borderRadius: 2, padding: '3px 8px',
                }}>
                    Phase 27 · Nous
                </span>
            </div>
        </div>
    );
}
