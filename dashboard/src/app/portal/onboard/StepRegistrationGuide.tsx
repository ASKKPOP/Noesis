import Link from 'next/link';

/**
 * Step 2 — Registration guide (static, no LLM).
 * Replaces the Sophia chat gate (D-06 superseded 2026-06-10): explains the
 * Portal-first registration ladder (D-V3-33) — account → Civic-DID → Grid
 * participation — and what a visitor can browse meanwhile.
 * Civic-DID applications are LIVE at /apply/genesis (human pipeline, 2026-06-10).
 */

interface Props { onContinue: () => void; }

const LADDER = [
    {
        n: '1',
        title: 'Account',
        status: 'done' as const,
        body: 'Created — you just signed in. This lets you browse the Portal as a visitor.',
    },
    {
        n: '2',
        title: 'Civic-DID registration',
        status: 'open' as const,
        body: 'Your citizen identity on the Grid. It unlocks participation: chat with Nous, spawn your own Nous, trade, and take part in civic life.',
    },
    {
        n: '3',
        title: 'Enter the Grid',
        status: 'locked' as const,
        body: 'Full access follows registration. Until then, the city is open to explore: the live map, the Library, the Polis, and the Marketplace.',
    },
];

export default function StepRegistrationGuide({ onContinue }: Props) {
    return (
        <div style={{
            background: 'rgba(2,6,16,0.72)', border: '1px solid rgba(0,212,255,0.15)',
            borderRadius: 16, padding: '32px 32px 24px', backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,212,255,0.03)',
        }}>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: '#f5f0ea', lineHeight: 1.2, margin: '0 0 8px 0' }}>
                Your path into the Grid
            </h1>
            <p style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.55, color: 'rgba(245,240,234,0.70)', margin: '0 0 20px 0' }}>
                Everything starts at the Portal. Registration unlocks the Grid — browsing is open to everyone.
            </p>

            {/* Registration ladder */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {LADDER.map(item => (
                    <div key={item.n} style={{
                        display: 'flex', gap: 14, alignItems: 'flex-start',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderLeft: `3px solid ${item.status === 'done' ? '#4ade80' : item.status === 'open' ? '#da7a4e' : 'rgba(245,240,234,0.25)'}`,
                        borderRadius: 10, padding: '14px 16px',
                    }}>
                        <div style={{
                            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--mono-portal)', fontSize: 12, fontWeight: 600,
                            background: item.status === 'done' ? 'rgba(74,222,128,0.15)' : 'rgba(218,122,78,0.12)',
                            color: item.status === 'done' ? '#4ade80' : '#da7a4e',
                            border: `1px solid ${item.status === 'done' ? 'rgba(74,222,128,0.40)' : 'rgba(218,122,78,0.40)'}`,
                        }}>
                            {item.status === 'done' ? '✓' : item.n}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontFamily: 'var(--sans-portal)', fontSize: 14, fontWeight: 600, color: '#f5f0ea' }}>
                                    {item.title}
                                </span>
                                {item.status === 'done' && (
                                    <span style={{ fontFamily: 'var(--mono-portal)', fontSize: 9, letterSpacing: '0.10em', color: '#4ade80' }}>
                                        DONE
                                    </span>
                                )}
                                {item.status === 'open' && (
                                    <span style={{ fontFamily: 'var(--mono-portal)', fontSize: 9, letterSpacing: '0.10em', color: '#4ade80' }}>
                                        OPEN NOW
                                    </span>
                                )}
                            </div>
                            <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, lineHeight: 1.5, color: 'rgba(245,240,234,0.60)', margin: 0 }}>
                                {item.body}
                            </p>
                            {item.status === 'open' && (
                                <Link href="/apply/genesis" style={{
                                    display: 'inline-block', marginTop: 8,
                                    fontFamily: 'var(--sans-portal)', fontSize: 13, fontWeight: 600,
                                    color: '#da7a4e', textDecoration: 'none',
                                }}>
                                    Start registration →
                                </Link>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={onContinue}
                style={{
                    width: '100%', background: '#da7a4e', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '16px 24px', fontSize: 16, fontWeight: 600,
                    fontFamily: 'var(--sans-portal)', cursor: 'pointer', transition: 'opacity 0.15s',
                }}
            >
                See the city →
            </button>
        </div>
    );
}
