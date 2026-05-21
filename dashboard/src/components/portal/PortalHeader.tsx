'use client';

/**
 * PortalHeader — editorial theme (nexus.eklotho.com design system).
 *
 * Parchment background · Inter Tight labels · terracotta Sign In ·
 * bronze mono wallet chip · thin rule border
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount, useDisconnect } from 'wagmi';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';

function usePageLabel(): string {
    const pathname = usePathname();
    const labels: Record<string, string> = {
        '/portal':             'World Map',
        '/portal/auth':        'Sign In',
        '/portal/profile':     'Profile',
        '/portal/wallet':      'Wallet',
        '/portal/chat':        'Chat with Nous',
        '/portal/my-nous':     'My Nous',
        '/portal/community':   'Community',
        '/portal/leaderboard': 'Leaderboard',
        '/portal/docs':        'Documents',
        '/portal/glossary':    'Glossary',
        '/portal/help':        'Help & FAQ',
        '/portal/activity':    'Activity',
        '/portal/settings':    'Settings',
    };
    return labels[pathname] ?? 'Portal';
}

export function PortalHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const { currentUser, clearUser } = useHumanAuthStore();
    const pageLabel = usePageLabel();

    function handleSignOut() {
        clearUser();
        disconnect();
        document.cookie = 'noesis_portal_token=; Max-Age=0; path=/';
        window.location.href = '/portal/auth';
    }

    return (
        <header style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 52,
            flexShrink: 0,
            background: 'var(--parchment)',
            borderBottom: '1px solid var(--rule)',
            padding: '0 28px',
        }}>
            {/* Left: breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                    onClick={onMenuOpen}
                    className="md:hidden"
                    aria-label="Open navigation"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '8px',
                        cursor: 'pointer',
                        minHeight: 44,
                        minWidth: 44,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: -8,
                    }}
                >
                    <svg width={18} height={18} viewBox="0 0 18 18" fill="none">
                        <line x1="2" y1="5"  x2="16" y2="5"  stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
                        <line x1="2" y1="9"  x2="16" y2="9"  stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
                        <line x1="2" y1="13" x2="16" y2="13" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                </button>
                <span style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                }}>
                    Portal
                </span>
                <span style={{ color: 'var(--rule)', fontSize: 14 }}>/</span>
                <span style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    letterSpacing: '0.01em',
                }}>
                    {pageLabel}
                </span>
            </div>

            {/* Right: identity + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* DID chip */}
                {currentUser && (
                    <span
                        title={currentUser.did}
                        style={{
                            fontFamily: 'var(--mono-portal)',
                            fontSize: 10,
                            letterSpacing: '0.06em',
                            color: 'var(--bronze)',
                            background: 'var(--parchment-2)',
                            border: '1px solid var(--rule)',
                            borderRadius: 3,
                            padding: '3px 8px',
                        }}
                    >
                        {`did:…${currentUser.did.split(':').pop()?.slice(-8)}`}
                    </span>
                )}

                {/* Wallet chip */}
                {isConnected && address && (
                    <span style={{
                        fontFamily: 'var(--mono-portal)',
                        fontSize: 11,
                        letterSpacing: '0.04em',
                        color: 'var(--bronze)',
                        background: 'var(--parchment-2)',
                        border: '1px solid var(--rule)',
                        borderRadius: 3,
                        padding: '3px 10px',
                    }}>
                        {address.slice(0, 6)}…{address.slice(-4)}
                    </span>
                )}

                {/* Sign In */}
                {!currentUser && (
                    <Link
                        href="/portal/auth"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            background: 'var(--terracotta)',
                            color: '#faf6ec',
                            borderRadius: 3,
                            padding: '6px 14px',
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: 'var(--sans-portal)',
                            letterSpacing: '0.02em',
                            textDecoration: 'none',
                            transition: 'background 0.15s',
                        }}
                    >
                        Sign In
                    </Link>
                )}

                {/* Sign Out */}
                {currentUser && (
                    <button
                        onClick={handleSignOut}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            background: 'transparent',
                            border: '1px solid var(--rule)',
                            borderRadius: 3,
                            padding: '5px 12px',
                            fontSize: 12,
                            fontFamily: 'var(--sans-portal)',
                            fontWeight: 500,
                            color: 'var(--muted)',
                            cursor: 'pointer',
                            transition: 'color 0.15s, border-color 0.15s',
                        }}
                    >
                        Sign Out
                    </button>
                )}
            </div>
        </header>
    );
}
