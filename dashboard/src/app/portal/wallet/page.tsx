/**
 * Wallet — Phase 23 placeholder · editorial theme.
 * Server component.
 */

export default function WalletPage() {
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
                    Wallet
                </h1>
                <p style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                }}>
                    On-chain balances, Cyber Coin, and transaction history.
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
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
                    </svg>
                </div>
                <div>
                    <p style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                        Coming in Phase 23
                    </p>
                    <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 360 }}>
                        On-chain ETH and USDT balances, send and receive Cyber Coin,
                        and a full transaction history.
                    </p>
                </div>
                <span style={{
                    fontFamily: 'var(--mono-portal)', fontSize: 9, fontWeight: 600,
                    letterSpacing: '0.12em', textTransform: 'uppercase' as const,
                    color: 'var(--bronze)', background: 'var(--parchment-2)',
                    border: '1px solid var(--rule)', borderRadius: 2, padding: '3px 8px',
                }}>
                    Phase 23 · Identity
                </span>
            </div>
        </div>
    );
}
