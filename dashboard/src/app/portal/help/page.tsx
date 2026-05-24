/**
 * Help Center hub — editorial theme.
 * Server component (no 'use client').
 */

import Link from 'next/link';

const SECTIONS = [
    {
        href: '/portal/help/guide',
        title: 'Getting Started',
        desc: 'Step-by-step walkthrough from wallet setup to your first Nous.',
        icon: (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        ),
    },
    {
        href: '/portal/help/faq',
        title: 'FAQ',
        desc: 'Answers to common questions about wallets, Cyber Coin, Nous agents, and the Grid.',
        icon: (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 14v-1M10 11c0-1.5 2-1.5 2-3a2 2 0 10-4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        href: '/portal/help/glossary',
        title: 'Glossary',
        desc: 'Definitions for every Noēsis term — Nous, Ousia, Agora, Lore, Norms, and more.',
        icon: (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="4" y="3" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        ),
    },
    {
        href: '/portal/help/contact',
        title: 'Contact Support',
        desc: 'Submit a bug report, feature request, or account issue.',
        icon: (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 7l7 5 7-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
        ),
    },
];

export default function HelpPage() {
    return (
        <div style={{ padding: '36px 40px', maxWidth: 680 }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 30,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    letterSpacing: '0.01em',
                    lineHeight: 1.15,
                    marginBottom: 6,
                }}>
                    Help Center
                </h1>
                <p style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                }}>
                    Guides, FAQs, glossary, and support for the Noēsis Portal.
                </p>
            </div>

            {/* Search bar — TODO: wire client-side filter */}
            <div style={{ marginBottom: 28 }}>
                <input
                    type="search"
                    placeholder="Search help articles..."
                    style={{
                        width: '100%',
                        padding: '9px 14px',
                        background: 'var(--parchment)',
                        border: '1px solid var(--rule)',
                        borderRadius: 6,
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 13,
                        color: 'var(--ink)',
                        outline: 'none',
                        boxSizing: 'border-box',
                    }}
                />
            </div>

            {/* Section cards — 2×2 grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                maxWidth: 640,
                marginBottom: 32,
            }}>
                {SECTIONS.map(({ href, title, desc, icon }) => (
                    <Link
                        key={href}
                        href={href}
                        style={{
                            background: 'var(--parchment)',
                            border: '1px solid var(--rule)',
                            borderRadius: 6,
                            padding: '20px 24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            textDecoration: 'none',
                            color: 'inherit',
                        }}
                    >
                        <span style={{ color: 'var(--bronze)' }}>{icon}</span>
                        <span style={{
                            fontFamily: 'var(--sans-portal)',
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--ink)',
                        }}>
                            {title}
                        </span>
                        <span style={{
                            fontFamily: 'var(--sans-portal)',
                            fontSize: 13,
                            color: 'var(--muted)',
                            lineHeight: 1.5,
                        }}>
                            {desc}
                        </span>
                    </Link>
                ))}
            </div>

            {/* Footer note */}
            <p style={{
                fontFamily: 'var(--mono-portal)',
                fontSize: 10,
                color: 'var(--muted)',
                letterSpacing: '0.04em',
                opacity: 0.7,
            }}>
                Need immediate help? Email us at support@noesis.ai
            </p>
        </div>
    );
}
