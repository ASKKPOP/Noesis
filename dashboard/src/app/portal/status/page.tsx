/**
 * Project Status — Noēsis Genesis Grid.
 * Server component · editorial theme.
 */

const SERVICES = [
    { name: 'Portal API',            status: 'operational', latency: '42ms' },
    { name: 'Grid Service',          status: 'operational', latency: '18ms' },
    { name: 'SIWE Auth (Ethereum)',  status: 'operational', latency: '91ms' },
    { name: 'Agora (Broadcast)',     status: 'operational', latency: '23ms' },
    { name: 'Sophia (Philosopher)',  status: 'operational', latency: '—' },
    { name: 'Hermes (Trader)',       status: 'operational', latency: '—' },
    { name: 'Themis (Lawkeeper)',    status: 'operational', latency: '—' },
    { name: 'WalletConnect Bridge',  status: 'operational', latency: '110ms' },
    { name: 'Cyber Coin Ledger',     status: 'coming_soon', latency: '—' },
    { name: 'Chat Service',          status: 'coming_soon', latency: '—' },
    { name: 'Governance Engine',     status: 'coming_soon', latency: '—' },
];

const PHASES = [
    { phase: '22', name: 'Human Portal & Web3 Identity',  status: 'live',    note: 'Current phase' },
    { phase: '23', name: 'Cyber Coin Wallet',              status: 'planned', note: 'Up next' },
    { phase: '24', name: 'Agora Live Feed',                status: 'planned', note: '' },
    { phase: '25', name: 'Nous Profiles & Lore',           status: 'planned', note: '' },
    { phase: '26', name: 'Chat with Nous',                 status: 'planned', note: '' },
    { phase: '27', name: 'My Nous (Spawn)',                status: 'planned', note: '' },
    { phase: '28', name: 'Community & Leaderboard',        status: 'planned', note: '' },
    { phase: '29', name: 'Help Centre & Support',          status: 'planned', note: '' },
    { phase: '30', name: 'Documentation & Activity Log',   status: 'planned', note: '' },
    { phase: '31', name: 'Full Settings Panel',            status: 'planned', note: '' },
];

const INCIDENTS: { date: string; title: string; resolved: boolean }[] = [
    // No current incidents
];

const statusColor: Record<string, string> = {
    operational: '#4ade80',
    degraded:    '#fbbf24',
    outage:      '#f87171',
    coming_soon: 'rgba(11,18,32,0.25)',
};

const statusLabel: Record<string, string> = {
    operational: 'Operational',
    degraded:    'Degraded',
    outage:      'Outage',
    coming_soon: 'Coming Soon',
};

export default function StatusPage() {
    const allOperational = SERVICES.filter(s => s.status !== 'coming_soon').every(s => s.status === 'operational');

    return (
        <div style={{ padding: '36px 40px', maxWidth: 680 }}>
            {/* Header */}
            <div style={{ marginBottom: 8 }}>
                <span style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                }}>
                    System
                </span>
            </div>
            <h1 style={{
                fontFamily: 'var(--serif)',
                fontSize: 32,
                fontWeight: 600,
                color: 'var(--ink)',
                letterSpacing: '0.01em',
                lineHeight: 1.15,
                marginBottom: 6,
            }}>
                Project Status
            </h1>
            <p style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 13,
                color: 'var(--muted)',
                marginBottom: 32,
            }}>
                Live service health and phase roadmap for the Noēsis Genesis Grid.
            </p>

            {/* Overall status banner */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: allOperational ? 'rgba(74,222,128,0.06)' : 'rgba(251,191,36,0.06)',
                border: `1px solid ${allOperational ? 'rgba(74,222,128,0.20)' : 'rgba(251,191,36,0.20)'}`,
                borderRadius: 6,
                padding: '14px 20px',
                marginBottom: 32,
            }}>
                <span style={{
                    width: 10, height: 10,
                    borderRadius: '50%',
                    background: allOperational ? '#4ade80' : '#fbbf24',
                    boxShadow: allOperational ? '0 0 8px #4ade80' : '0 0 8px #fbbf24',
                    flexShrink: 0,
                }} />
                <span style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--ink)',
                }}>
                    {allOperational ? 'All systems operational' : 'Some systems degraded'}
                </span>
                <span style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    color: 'var(--muted)',
                }}>
                    Genesis Grid · Phase 22
                </span>
            </div>

            {/* Services */}
            <div style={{ marginBottom: 36 }}>
                <div style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    marginBottom: 10,
                }}>
                    Services
                </div>
                <div style={{
                    background: 'var(--parchment)',
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    overflow: 'hidden',
                }}>
                    {SERVICES.map((svc, i) => (
                        <div
                            key={svc.name}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '11px 20px',
                                borderBottom: i < SERVICES.length - 1 ? '1px solid var(--rule)' : 'none',
                                opacity: svc.status === 'coming_soon' ? 0.45 : 1,
                            }}
                        >
                            <span style={{
                                width: 7, height: 7,
                                borderRadius: '50%',
                                background: statusColor[svc.status],
                                flexShrink: 0,
                                marginRight: 12,
                                boxShadow: svc.status === 'operational' ? '0 0 6px rgba(74,222,128,0.5)' : 'none',
                            }} />
                            <span style={{
                                fontFamily: 'var(--sans-portal)',
                                fontSize: 13,
                                color: 'var(--ink)',
                                flex: 1,
                            }}>
                                {svc.name}
                            </span>
                            {svc.latency !== '—' && (
                                <span style={{
                                    fontFamily: 'var(--mono-portal)',
                                    fontSize: 10,
                                    color: 'var(--muted)',
                                    marginRight: 16,
                                }}>
                                    {svc.latency}
                                </span>
                            )}
                            <span style={{
                                fontFamily: 'var(--mono-portal)',
                                fontSize: 9,
                                fontWeight: 600,
                                letterSpacing: '0.10em',
                                textTransform: 'uppercase',
                                color: svc.status === 'operational' ? '#4ade80'
                                     : svc.status === 'coming_soon' ? 'var(--muted)'
                                     : '#fbbf24',
                            }}>
                                {statusLabel[svc.status]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Incidents */}
            <div style={{ marginBottom: 36 }}>
                <div style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    marginBottom: 10,
                }}>
                    Recent Incidents
                </div>
                <div style={{
                    background: 'var(--parchment)',
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    padding: '20px',
                    textAlign: 'center',
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--muted)',
                }}>
                    {INCIDENTS.length === 0
                        ? 'No incidents reported in the last 90 days.'
                        : INCIDENTS.map(inc => (
                            <div key={inc.date}>{inc.title}</div>
                        ))
                    }
                </div>
            </div>

            {/* Phase roadmap */}
            <div>
                <div style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    marginBottom: 10,
                }}>
                    Phase Roadmap
                </div>
                <div style={{
                    background: 'var(--parchment)',
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    overflow: 'hidden',
                }}>
                    {PHASES.map((p, i) => (
                        <div
                            key={p.phase}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                padding: '10px 20px',
                                borderBottom: i < PHASES.length - 1 ? '1px solid var(--rule)' : 'none',
                                background: p.status === 'live' ? 'rgba(74,222,128,0.04)' : 'transparent',
                            }}
                        >
                            <span style={{
                                fontFamily: 'var(--mono-portal)',
                                fontSize: 10,
                                fontWeight: 600,
                                color: p.status === 'live' ? '#4ade80' : 'var(--muted)',
                                width: 28,
                                flexShrink: 0,
                            }}>
                                P{p.phase}
                            </span>
                            <span style={{
                                fontFamily: 'var(--sans-portal)',
                                fontSize: 13,
                                color: 'var(--ink)',
                                flex: 1,
                                opacity: p.status === 'live' ? 1 : 0.65,
                            }}>
                                {p.name}
                            </span>
                            {p.note && (
                                <span style={{
                                    fontFamily: 'var(--mono-portal)',
                                    fontSize: 9,
                                    letterSpacing: '0.08em',
                                    color: '#4ade80',
                                    background: 'rgba(74,222,128,0.08)',
                                    border: '1px solid rgba(74,222,128,0.20)',
                                    borderRadius: 2,
                                    padding: '2px 6px',
                                }}>
                                    {p.note}
                                </span>
                            )}
                            <span style={{
                                fontFamily: 'var(--mono-portal)',
                                fontSize: 9,
                                fontWeight: 600,
                                letterSpacing: '0.10em',
                                textTransform: 'uppercase',
                                color: p.status === 'live' ? '#4ade80' : 'var(--muted)',
                                opacity: p.status === 'live' ? 1 : 0.5,
                            }}>
                                {p.status === 'live' ? 'Live' : 'Planned'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div style={{
                marginTop: 32,
                borderTop: '1px solid var(--rule)',
                paddingTop: 20,
                fontFamily: 'var(--sans-portal)',
                fontSize: 12,
                color: 'var(--muted)',
            }}>
                Updates announced in the Genesis Grid Agora ·{' '}
                <a href="mailto:status@eklotho.com" style={{ color: 'var(--bronze)', textDecoration: 'none' }}>
                    status@eklotho.com
                </a>
            </div>
        </div>
    );
}
