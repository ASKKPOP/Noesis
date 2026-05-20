/**
 * Settings — Phase 31 placeholder · editorial theme.
 * Server component.
 */

const SETTING_GROUPS = [
    {
        title: 'Appearance',
        items: ['Theme (Dark / Light / Cyber)', 'Language', 'Timezone display'],
    },
    {
        title: 'Notifications',
        items: ['Nous activity alerts', 'Wallet transaction notifications', 'Community mentions', 'Governance vote reminders'],
    },
    {
        title: 'Privacy',
        items: ['Profile visibility', 'Activity log retention', 'Data export (GDPR)'],
    },
    {
        title: 'Security',
        items: ['Active sessions', 'Revoke portal access', 'Trusted wallets'],
    },
    {
        title: 'Developer',
        items: ['API key management', 'Webhook endpoints', 'Rate limit dashboard'],
    },
];

export default function SettingsPage() {
    return (
        <div style={{ padding: '36px 40px', maxWidth: 580 }}>
            {/* Heading */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 30,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    letterSpacing: '0.01em',
                    lineHeight: 1.15,
                    marginBottom: 6,
                }}>
                    Settings
                </h1>
                <p style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                }}>
                    Portal preferences, privacy controls, and developer options.
                </p>
            </div>

            {/* Phase notice */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'var(--parchment)',
                border: '1px solid var(--rule)',
                borderRadius: 4,
                padding: '10px 16px',
                marginBottom: 32,
            }}>
                <span style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    color: 'var(--bronze)',
                    background: 'var(--parchment-2)',
                    border: '1px solid var(--rule)',
                    borderRadius: 2,
                    padding: '2px 6px',
                    flexShrink: 0,
                }}>
                    Phase 31
                </span>
                <span style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 12,
                    color: 'var(--muted)',
                }}>
                    Full settings panel coming in a future release.
                </span>
            </div>

            {/* Setting groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {SETTING_GROUPS.map(group => (
                    <div key={group.title}>
                        <div style={{
                            fontFamily: 'var(--mono-portal)',
                            fontSize: 9,
                            fontWeight: 600,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'var(--muted)',
                            marginBottom: 8,
                        }}>
                            {group.title}
                        </div>

                        <div style={{
                            background: 'var(--parchment)',
                            border: '1px solid var(--rule)',
                            borderRadius: 6,
                            overflow: 'hidden',
                        }}>
                            {group.items.map((item, i) => (
                                <div
                                    key={item}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '11px 20px',
                                        borderBottom: i < group.items.length - 1 ? '1px solid var(--rule)' : 'none',
                                        opacity: 0.45,
                                    }}
                                >
                                    <span style={{
                                        fontFamily: 'var(--sans-portal)',
                                        fontSize: 13,
                                        color: 'var(--ink)',
                                    }}>
                                        {item}
                                    </span>
                                    <div style={{
                                        width: 52,
                                        height: 14,
                                        borderRadius: 3,
                                        background: 'var(--parchment-2)',
                                        border: '1px solid var(--rule)',
                                    }} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
