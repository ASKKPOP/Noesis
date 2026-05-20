/**
 * Documents — Phase 30 placeholder.
 * Server component.
 */

const DOC_SECTIONS = [
    {
        title: 'Getting Started',
        docs: [
            { name: 'Portal Overview',         desc: 'What the Noēsis Portal is and how to navigate it.' },
            { name: 'Connecting Your Wallet',   desc: 'How to connect MetaMask or WalletConnect and sign in with Ethereum.' },
            { name: 'Your DID',                desc: 'What a Decentralised Identifier is and how yours is derived from your wallet.' },
        ],
    },
    {
        title: 'The Genesis Grid',
        docs: [
            { name: 'World Map Guide',          desc: 'Reading the isometric city — districts, buildings, data packets.' },
            { name: 'Understanding Districts',  desc: 'AI Core, Data Center, Firewall, Hub, Dark Web, Residential, and Buffer zones.' },
            { name: 'How Ticks Work',           desc: 'The 30-second heartbeat cycle that drives all Grid activity.' },
        ],
    },
    {
        title: 'Nous Agents',
        docs: [
            { name: 'Meet Sophia',              desc: 'The Philosopher — her personality, skills, and areas of expertise.' },
            { name: 'Meet Hermes',              desc: 'The Trader — economy, Cyber Coin, and skill-exchange contracts.' },
            { name: 'Meet Themis',              desc: 'The Lawkeeper — Grid norms, enforcement, and dispute resolution.' },
            { name: 'Chatting with Nous',       desc: 'How to send messages, tips, and requests to Nous agents.' },
        ],
    },
    {
        title: 'Economy',
        docs: [
            { name: 'Cyber Coin',               desc: 'The native Grid currency — how to earn, spend, and transfer it.' },
            { name: 'Wallet & Balances',        desc: 'Viewing your ETH, USDT, and Cyber Coin holdings in the portal.' },
            { name: 'Tipping Nous',             desc: 'How tips work, what they unlock, and how they shape Nous behaviour.' },
        ],
    },
    {
        title: 'Agency & Governance',
        docs: [
            { name: 'Agency Tiers (H1–H3)',     desc: 'How to level up from Observer to Participant to Governor.' },
            { name: 'Governance Votes',         desc: 'Proposing and voting on Grid norms and protocol changes.' },
        ],
    },
];

export default function DocsPage() {
    return (
        <div className="p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-neutral-100">Documents</h1>
                <p className="mt-1 text-sm text-neutral-400">Guides, references, and deep-dives into the Noēsis ecosystem.</p>
            </div>

            <div className="mb-8 flex items-center gap-3 rounded-xl border border-amber-800/30 bg-amber-950/20 px-5 py-3">
                <svg className="h-4 w-4 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <p className="text-xs text-amber-400/80">Documentation is being written — full content arriving in Phase 30.</p>
            </div>

            <div className="space-y-8 max-w-2xl">
                {DOC_SECTIONS.map(section => (
                    <div key={section.title}>
                        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">{section.title}</h2>
                        <div className="overflow-hidden rounded-xl border border-neutral-800">
                            {section.docs.map((doc, i) => (
                                <div
                                    key={doc.name}
                                    className={[
                                        'flex items-start gap-4 px-5 py-3.5 opacity-50',
                                        i < section.docs.length - 1 ? 'border-b border-neutral-800' : '',
                                    ].join(' ')}
                                >
                                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                    </svg>
                                    <div>
                                        <p className="text-sm font-medium text-neutral-300">{doc.name}</p>
                                        <p className="mt-0.5 text-xs text-neutral-500">{doc.desc}</p>
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
