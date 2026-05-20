/**
 * Documents — Phase 30 placeholder · editorial theme.
 * Server component.
 */

const DOC_SECTIONS = [
    {
        title: 'Getting Started',
        docs: [
            { name: 'Portal Overview',        desc: 'What the Noēsis Portal is and how to navigate it.' },
            { name: 'Connecting Your Wallet', desc: 'How to connect MetaMask or WalletConnect and sign in with Ethereum.' },
            { name: 'Your DID',               desc: 'What a Decentralised Identifier is and how yours is derived from your wallet.' },
        ],
    },
    {
        title: 'The Genesis Grid',
        docs: [
            { name: 'World Map Guide',         desc: 'Reading the isometric city — districts, buildings, data packets.' },
            { name: 'Understanding Districts', desc: 'AI Core, Data Center, Firewall, Hub, Dark Web, Residential, and Buffer zones.' },
            { name: 'How Ticks Work',          desc: 'The 30-second heartbeat cycle that drives all Grid activity.' },
        ],
    },
    {
        title: 'Nous Agents',
        docs: [
            { name: 'Meet Sophia',       desc: 'The Philosopher — her personality, skills, and areas of expertise.' },
            { name: 'Meet Hermes',       desc: 'The Trader — economy, Cyber Coin, and skill-exchange contracts.' },
            { name: 'Meet Themis',       desc: 'The Lawkeeper — Grid norms, enforcement, and dispute resolution.' },
            { name: 'Chatting with Nous',desc: 'How to send messages, tips, and requests to Nous agents.' },
        ],
    },
    {
        title: 'Economy',
        docs: [
            { name: 'Cyber Coin',      desc: 'The native Grid currency — how to earn, spend, and transfer it.' },
            { name: 'Wallet & Balances',desc: 'Viewing your ETH, USDT, and Cyber Coin holdings in the portal.' },
            { name: 'Tipping Nous',    desc: 'How tips work, what they unlock, and how they shape Nous behaviour.' },
        ],
    },
    {
        title: 'Agency & Governance',
        docs: [
            { name: 'Agency Tiers (H1–H3)', desc: 'How to level up from Observer to Participant to Governor.' },
            { name: 'Governance Votes',     desc: 'Proposing and voting on Grid norms and protocol changes.' },
        ],
    },
];

export default function DocsPage() {
    return (
        <div style={{ padding: '36px 40px', maxWidth: 720 }}>
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
                    Documents
                </h1>
                <p style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                }}>
                    Guides, references, and deep-dives into the Noēsis ecosystem.
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
                    Phase 30
                </span>
                <span style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 12,
                    color: 'var(--muted)',
                }}>
                    Documentation is being written — full content arriving in Phase 30.
                </span>
            </div>

            {/* Doc sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {DOC_SECTIONS.map(section => (
                    <div key={section.title}>
                        <div style={{
                            fontFamily: 'var(--mono-portal)',
                            fontSize: 9,
                            fontWeight: 600,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'var(--muted)',
                            marginBottom: 10,
                        }}>
                            {section.title}
                        </div>

                        <div style={{
                            background: 'var(--parchment)',
                            border: '1px solid var(--rule)',
                            borderRadius: 6,
                            overflow: 'hidden',
                        }}>
                            {section.docs.map((doc, i) => (
                                <div
                                    key={doc.name}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 14,
                                        padding: '12px 20px',
                                        borderBottom: i < section.docs.length - 1 ? '1px solid var(--rule)' : 'none',
                                        opacity: 0.5,
                                    }}
                                >
                                    <svg style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2, color: 'var(--muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                    </svg>
                                    <div>
                                        <p style={{
                                            fontFamily: 'var(--sans-portal)',
                                            fontSize: 13,
                                            fontWeight: 500,
                                            color: 'var(--ink)',
                                            marginBottom: 2,
                                        }}>
                                            {doc.name}
                                        </p>
                                        <p style={{
                                            fontFamily: 'var(--sans-portal)',
                                            fontSize: 12,
                                            color: 'var(--muted)',
                                            lineHeight: 1.5,
                                        }}>
                                            {doc.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
