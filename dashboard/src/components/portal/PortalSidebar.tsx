'use client';

/**
 * PortalSidebar — editorial theme (nexus.eklotho.com design system).
 *
 * Navy background · Cormorant Garamond logo · dot-style nav links
 * · terracotta active state · auth-aware footer
 */

import type { ElementType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount, useDisconnect } from 'wagmi';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';

// ── Nav structure ────────────────────────────────────────────────────────────

interface NavItem {
    href: string;
    label: string;
    exact?: boolean;
    phase?: string;
    guestOnly?: boolean;
    authOnly?: boolean;
    /** Static HTML doc served from /public via a next.config rewrite (e.g. /world).
     *  Rendered as a plain anchor (full page load) instead of a client-side Link. */
    html?: boolean;
}

interface NavSection {
    label: string;
    items: NavItem[];
}

const NAV: NavSection[] = [
    {
        label: 'Grid',
        items: [
            { href: '/world', label: 'The World', html: true },
            { href: '/portal', label: 'World Map', exact: true },
        ],
    },
    {
        label: 'Identity',
        items: [
            { href: '/portal/auth',    label: 'Sign In',   exact: true, guestOnly: true },
            { href: '/portal/profile', label: 'Profile' },
            { href: '/portal/wallet',  label: 'Wallet' },
        ],
    },
    {
        label: 'Nous',
        items: [
            { href: '/portal/chat',    label: 'Chat',      phase: '26' },
            { href: '/portal/my-nous', label: 'My Nous',   phase: '27' },
        ],
    },
    {
        label: 'Community',
        items: [
            { href: '/portal/community',   label: 'Community',   phase: '28' },
            { href: '/portal/leaderboard', label: 'Leaderboard', phase: '28' },
        ],
    },
    {
        label: 'Resources',
        items: [
            { href: '/portal/help',          label: 'Help Center',    exact: true },
            { href: '/portal/help/guide',    label: 'Getting Started' },
            { href: '/portal/help/faq',      label: 'FAQ' },
            { href: '/portal/help/glossary', label: 'Glossary' },
            { href: '/portal/help/contact',  label: 'Support' },
            { href: '/portal/privacy',       label: 'Privacy Policy' },
            { href: '/portal/terms',         label: 'Terms of Service' },
            { href: '/portal/status',        label: 'Project Status' },
        ],
    },
    {
        label: 'System',
        items: [
            { href: '/portal/activity', label: 'Activity', phase: '30' },
            { href: '/portal/settings', label: 'Settings', phase: '31' },
        ],
    },
];

// ── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({ item }: { item: NavItem }) {
    const pathname = usePathname();
    const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    const isSoon = !!item.phase;

    // Static HTML docs (served from /public via a rewrite) need a full page load and
    // the basePath prefix — next/link client navigation can't resolve them.
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    const LinkTag: ElementType = item.html ? 'a' : Link;
    const linkProps = item.html
        ? { href: `${basePath}${item.href}` }
        : { href: item.href, 'aria-current': isActive ? ('page' as const) : undefined };

    return (
        <LinkTag
            {...linkProps}
            tabIndex={isSoon ? -1 : undefined}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '13px',
                fontFamily: 'var(--sans-portal)',
                fontWeight: 500,
                letterSpacing: '0.01em',
                textDecoration: 'none',
                transition: 'color 0.15s',
                pointerEvents: isSoon ? 'none' : 'auto',
                color: isActive
                    ? 'var(--terracotta-2)'
                    : isSoon
                        ? 'rgba(200,192,184,0.28)'
                        : 'rgba(200,192,184,0.72)',
            }}
            className={!isActive && !isSoon ? 'portal-nav-link' : ''}
        >
            {/* dot indicator */}
            <span style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                flexShrink: 0,
                background: isActive ? 'var(--terracotta)' : 'rgba(200,192,184,0.25)',
                boxShadow: isActive ? '0 0 6px var(--terracotta)' : 'none',
                transition: 'background 0.15s',
            }} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.phase && (
                <span style={{
                    fontSize: 9,
                    fontFamily: 'var(--mono-portal)',
                    letterSpacing: '0.1em',
                    color: 'rgba(200,192,184,0.28)',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '1px 5px',
                    borderRadius: 2,
                }}>
                    P{item.phase}
                </span>
            )}
        </LinkTag>
    );
}

// ── PortalSidebar ────────────────────────────────────────────────────────────

export function PortalSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { address, isConnected } = useAccount();
    const { currentUser, clearUser } = useHumanAuthStore();
    const { disconnect } = useDisconnect();

    async function handleSignOut() {
        const gridBase = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
        clearUser();
        disconnect();
        await fetch(`${gridBase}/api/v1/portal/auth/logout`, { method: 'POST', credentials: 'include' });
        window.location.href = '/portal/auth';
    }

    return (
        <>
        {isOpen && (
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(11,18,32,0.40)',
                    zIndex: 49,
                }}
                aria-hidden="true"
            />
        )}
        <aside
            className={`portal-sidebar${isOpen ? ' sidebar-open' : ''}`}
            style={{
                width: 220,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--navy)',
                borderRight: '1px solid rgba(255,255,255,0.07)',
                overflow: 'hidden',
            }}
        >
            {/* ── Logo ── */}
            <div style={{
                padding: '20px 16px 18px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                position: 'relative',
            }}>
                <div style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 20,
                    fontWeight: 600,
                    color: '#f5f0e8',
                    letterSpacing: '0.01em',
                    lineHeight: 1.1,
                }}>
                    Noēsis
                </div>
                <div style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 9,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: 'rgba(200,192,184,0.40)',
                    marginTop: 4,
                }}>
                    Portal · Genesis Grid
                </div>
                <button
                    onClick={onClose}
                    className="md:hidden"
                    aria-label="Close navigation"
                    style={{
                        position: 'absolute',
                        top: 18,
                        right: 12,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'rgba(200,192,184,0.72)',
                        fontSize: 18,
                        lineHeight: 1,
                        padding: '4px',
                        fontFamily: 'var(--sans-portal)',
                        fontWeight: 400,
                        minHeight: 24,
                        minWidth: 24,
                    }}
                >
                    ×
                </button>
            </div>

            {/* ── Nav ── */}
            <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 4px' }}>
                {NAV.map((section) => {
                    const items = section.items.filter(item => {
                        if (item.guestOnly && currentUser) return false;
                        if (item.authOnly && !currentUser) return false;
                        return true;
                    });
                    if (items.length === 0) return null;

                    return (
                        <div key={section.label} style={{ marginBottom: 20 }}>
                            <div style={{
                                fontFamily: 'var(--sans-portal)',
                                fontSize: 9,
                                fontWeight: 600,
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                color: 'rgba(200,192,184,0.35)',
                                padding: '0 12px',
                                marginBottom: 4,
                            }}>
                                {section.label}
                            </div>
                            {items.map(item => (
                                <NavLink key={item.href} item={item} />
                            ))}
                        </div>
                    );
                })}
            </nav>

            {/* ── Auth footer ── */}
            <div style={{
                borderTop: '1px solid rgba(255,255,255,0.07)',
                padding: '12px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
            }}>
                {/* Connected wallet pill */}
                {isConnected && address && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: 4,
                        padding: '6px 10px',
                    }}>
                        <span style={{
                            width: 6, height: 6,
                            borderRadius: '50%',
                            background: '#4ade80',
                            boxShadow: '0 0 6px #4ade80',
                            flexShrink: 0,
                        }} />
                        <span style={{
                            fontFamily: 'var(--mono-portal)',
                            fontSize: 11,
                            color: 'rgba(200,192,184,0.55)',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            {address.slice(0, 6)}…{address.slice(-4)}
                        </span>
                    </div>
                )}

                {/* Connect & Sign In CTA */}
                {!isConnected && (
                    <Link
                        href="/portal/auth"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            background: 'var(--terracotta)',
                            color: '#faf6ec',
                            borderRadius: 4,
                            padding: '8px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: 'var(--sans-portal)',
                            letterSpacing: '0.03em',
                            textDecoration: 'none',
                            transition: 'background 0.15s',
                        }}
                    >
                        Connect Wallet
                    </Link>
                )}

                {/* Sign Out */}
                {currentUser && (
                    <button
                        onClick={handleSignOut}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            width: '100%',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 4,
                            padding: '7px 12px',
                            fontSize: 12,
                            fontFamily: 'var(--sans-portal)',
                            color: 'rgba(200,192,184,0.50)',
                            cursor: 'pointer',
                            transition: 'color 0.15s, border-color 0.15s',
                        }}
                    >
                        Sign Out
                    </button>
                )}

                {/* Version */}
                <div style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 9,
                    letterSpacing: '0.1em',
                    color: 'rgba(200,192,184,0.22)',
                    paddingLeft: 2,
                }}>
                    v2.5 · Phase 24 · Genesis Grid
                </div>
            </div>
        </aside>
        </>
    );
}
