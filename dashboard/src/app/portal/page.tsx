'use client';

/**
 * Portal home — Genesis Grid dashboard.
 * Overview of the Grid's current state, quick navigation, and status.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NousRosterEntry {
    did: string;
    name: string;
    region: string;
    status: string;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const SECTIONS = [
    {
        href: '/worldmap',
        label: 'Cyber World Map',
        desc: '22×22 isometric city — districts, data packets, pan & zoom.',
        icon: '◈',
        phase: null,
    },
    {
        href: '/nous',
        label: 'Nous Monitor',
        desc: 'Live agent activity stream with real-time event log.',
        icon: '◉',
        phase: null,
    },
    {
        href: '/portal/profile',
        label: 'Profile',
        desc: 'Your identity in the Genesis Grid.',
        icon: '◈',
        phase: null,
    },
    {
        href: '/portal/wallet',
        label: 'Wallet',
        desc: 'Cyber Coin balance and transactions.',
        icon: '◎',
        phase: null,
    },
    {
        href: '/portal/chat',
        label: 'Chat with Nous',
        desc: 'Speak directly with the Grid agents.',
        icon: '◇',
        phase: 'P26',
    },
    {
        href: '/portal/my-nous',
        label: 'My Nous',
        desc: 'Spawn and manage your own agent.',
        icon: '◆',
        phase: 'P27',
    },
    {
        href: '/portal/community',
        label: 'Community',
        desc: 'The Agora — public Grid discourse.',
        icon: '○',
        phase: 'P28',
    },
    {
        href: '/portal/leaderboard',
        label: 'Leaderboard',
        desc: 'Rankings by participation and reputation.',
        icon: '△',
        phase: 'P28',
    },
    {
        href: '/portal/glossary',
        label: 'Glossary',
        desc: 'Terms and concepts of the Genesis Grid.',
        icon: '▽',
        phase: null,
    },
    {
        href: '/portal/help',
        label: 'Help & FAQ',
        desc: 'Guides, support, and onboarding.',
        icon: '□',
        phase: null,
    },
];

const KNOWN_AGENTS = [
    { name: 'Sophia', role: 'Philosopher', color: '#bf00ff' },
    { name: 'Hermes', role: 'Trader',      color: '#ffd700' },
    { name: 'Themis', role: 'Lawkeeper',   color: '#ff4400' },
];

const UPDATES = [
    { date: 'May 2026', text: 'Phase 22 live — Human Portal & SIWE authentication launched.' },
    { date: 'May 2026', text: 'Phase 23 live — Cyber Coin Wallet and human.transferred event.' },
    { date: 'Coming',   text: 'Phase 24 — Portal Shell: region presence, mobile layout, live Grid stats.' },
    { date: 'Coming',   text: 'Phase 26 — Direct dialogue with Nous agents planned.' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PortalDashboard() {
    const { address, isConnected } = useAccount();
    const { currentUser } = useHumanAuthStore();

    const [liveNous, setLiveNous] = useState<NousRosterEntry[]>([]);
    const [currentTick, setCurrentTick] = useState<number | null>(null);

    useEffect(() => {
        async function fetchStats() {
            const [nousRes, statusRes] = await Promise.allSettled([
                fetch('/api/v1/grid/nous', { credentials: 'include' }),
                fetch('/api/v1/grid/status', { credentials: 'include' }),
            ]);
            if (nousRes.status === 'fulfilled' && nousRes.value.ok) {
                const data = await nousRes.value.json() as { nous: NousRosterEntry[] };
                setLiveNous(data.nous);
            }
            if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
                const data = await statusRes.value.json() as { tick: number };
                setCurrentTick(data.tick);
            }
        }
        void fetchStats();
        const id = setInterval(() => void fetchStats(), 15_000);
        return () => clearInterval(id);
    }, []);

    const greeting = currentUser
        ? 'Welcome back.'
        : 'Welcome to the Genesis Grid.';

    return (
        <div style={{ padding: '36px 40px', maxWidth: 960 }}>

            {/* ── Header ── */}
            <div style={{ marginBottom: 8 }}>
                <span style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                }}>
                    Grid · v2.5
                </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
                <h1 style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 36,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    letterSpacing: '0.01em',
                    lineHeight: 1.1,
                }}>
                    Genesis Grid
                </h1>

                {/* Live indicator */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(74,222,128,0.06)',
                    border: '1px solid rgba(74,222,128,0.20)',
                    borderRadius: 4,
                    padding: '5px 12px',
                    marginBottom: 4,
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
                        fontSize: 10,
                        letterSpacing: '0.10em',
                        color: '#4ade80',
                    }}>
                        ALL SYSTEMS LIVE
                    </span>
                </div>
            </div>

            <p style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 14,
                color: 'var(--muted)',
                marginBottom: 32,
            }}>
                {greeting}
                {isConnected && address && (
                    <span style={{
                        marginLeft: 8,
                        fontFamily: 'var(--mono-portal)',
                        fontSize: 12,
                        color: 'var(--bronze)',
                    }}>
                        {address.slice(0, 6)}…{address.slice(-4)}
                    </span>
                )}
            </p>

            {/* ── Stats row ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginBottom: 36,
            }}>
                {/* Active Nous */}
                <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 6, padding: '16px 20px' }}>
                    <div style={{ fontFamily: 'var(--mono-portal)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                        Active Nous
                    </div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>
                        {liveNous.length > 0 ? liveNous.length : (currentTick !== null ? '0' : '—')}
                    </div>
                    <div style={{ fontFamily: 'var(--sans-portal)', fontSize: 12, color: 'var(--muted)', opacity: 0.8 }}>
                        {liveNous.length > 0
                            ? liveNous.map(n => n.name).join(' · ')
                            : (currentTick !== null ? 'Grid online' : 'Grid offline')}
                    </div>
                </div>

                {/* Current Tick */}
                <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 6, padding: '16px 20px' }}>
                    <div style={{ fontFamily: 'var(--mono-portal)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                        Current Tick
                    </div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>
                        {currentTick !== null ? currentTick.toLocaleString() : '—'}
                    </div>
                    <div style={{ fontFamily: 'var(--sans-portal)', fontSize: 12, color: 'var(--muted)', opacity: 0.8 }}>
                        {currentTick !== null ? 'Grid live' : 'Grid offline'}
                    </div>
                </div>

                {/* Version */}
                <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 6, padding: '16px 20px' }}>
                    <div style={{ fontFamily: 'var(--mono-portal)', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                        Version
                    </div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, color: 'var(--ink)', lineHeight: 1, marginBottom: 4 }}>
                        v2.5
                    </div>
                    <div style={{ fontFamily: 'var(--sans-portal)', fontSize: 12, color: 'var(--muted)', opacity: 0.8 }}>
                        Portal Shell
                    </div>
                </div>
            </div>

            {/* ── Main grid: sections + sidebar ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 32, alignItems: 'start' }}>

                {/* Left — section cards */}
                <div>
                    <div style={{
                        fontFamily: 'var(--mono-portal)',
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--muted)',
                        marginBottom: 12,
                    }}>
                        Portal Sections
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                        gap: 10,
                    }}>
                        {SECTIONS.map(s => {
                            const soon = !!s.phase;
                            return (
                                <Link
                                    key={s.href}
                                    href={s.href}
                                    aria-disabled={soon ? true : undefined}
                                    tabIndex={soon ? -1 : undefined}
                                    style={{
                                        display: 'block',
                                        background: 'var(--parchment)',
                                        border: '1px solid var(--rule)',
                                        borderRadius: 6,
                                        padding: '14px 16px',
                                        textDecoration: 'none',
                                        opacity: soon ? 0.55 : 1,
                                        pointerEvents: soon ? 'none' : 'auto',
                                        transition: 'border-color 0.15s, box-shadow 0.15s',
                                    }}
                                    className={soon ? '' : 'portal-section-card'}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{
                                            fontFamily: 'var(--serif)',
                                            fontSize: 16,
                                            fontWeight: 600,
                                            color: 'var(--ink)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                        }}>
                                            <span style={{ color: 'var(--terracotta)', fontSize: 12 }}>{s.icon}</span>
                                            {s.label}
                                        </span>
                                        {s.phase && (
                                            <span style={{
                                                fontFamily: 'var(--mono-portal)',
                                                fontSize: 9,
                                                letterSpacing: '0.10em',
                                                color: 'rgba(11,18,32,0.30)',
                                                background: 'rgba(11,18,32,0.05)',
                                                padding: '1px 6px',
                                                borderRadius: 2,
                                            }}>
                                                {s.phase}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{
                                        fontFamily: 'var(--sans-portal)',
                                        fontSize: 12,
                                        color: 'var(--muted)',
                                        lineHeight: 1.4,
                                    }}>
                                        {s.desc}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Right — sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Nous agents */}
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
                            Nous Agents
                        </div>
                        <div style={{
                            background: 'var(--parchment)',
                            border: '1px solid var(--rule)',
                            borderRadius: 6,
                            overflow: 'hidden',
                        }}>
                            {KNOWN_AGENTS.map((agent, i) => {
                                const isLive = liveNous.some(n => n.name === agent.name && n.status === 'active');
                                return (
                                    <div key={agent.name} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: '11px 16px',
                                        borderBottom: i < KNOWN_AGENTS.length - 1 ? '1px solid var(--rule)' : 'none',
                                    }}>
                                        <span style={{
                                            width: 8, height: 8,
                                            borderRadius: '50%',
                                            background: isLive ? agent.color : 'rgba(200,192,184,0.28)',
                                            boxShadow: isLive ? `0 0 6px ${agent.color}88` : 'none',
                                            flexShrink: 0,
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontFamily: 'var(--serif)',
                                                fontSize: 14,
                                                fontWeight: 600,
                                                color: 'var(--ink)',
                                            }}>
                                                {agent.name}
                                            </div>
                                            <div style={{
                                                fontFamily: 'var(--sans-portal)',
                                                fontSize: 11,
                                                color: 'var(--muted)',
                                            }}>
                                                {agent.role}
                                            </div>
                                        </div>
                                        <span style={{
                                            fontFamily: 'var(--mono-portal)',
                                            fontSize: 8,
                                            letterSpacing: '0.12em',
                                            color: isLive ? '#4ade80' : 'rgba(200,192,184,0.55)',
                                            textTransform: 'uppercase',
                                        }}>
                                            {isLive ? 'live' : 'offline'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Grid updates */}
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
                            Grid Updates
                        </div>
                        <div style={{
                            background: 'var(--parchment)',
                            border: '1px solid var(--rule)',
                            borderRadius: 6,
                            overflow: 'hidden',
                        }}>
                            {UPDATES.map((u, i) => (
                                <div key={i} style={{
                                    padding: '12px 16px',
                                    borderBottom: i < UPDATES.length - 1 ? '1px solid var(--rule)' : 'none',
                                }}>
                                    <div style={{
                                        fontFamily: 'var(--mono-portal)',
                                        fontSize: 9,
                                        letterSpacing: '0.10em',
                                        color: 'var(--bronze)',
                                        marginBottom: 4,
                                        textTransform: 'uppercase',
                                    }}>
                                        {u.date}
                                    </div>
                                    <div style={{
                                        fontFamily: 'var(--sans-portal)',
                                        fontSize: 12,
                                        color: 'var(--ink)',
                                        lineHeight: 1.5,
                                        opacity: 0.85,
                                    }}>
                                        {u.text}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* World map CTA */}
                    <Link href="/grid" style={{
                        display: 'block',
                        background: 'var(--navy)',
                        borderRadius: 6,
                        padding: '18px 20px',
                        textDecoration: 'none',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            fontFamily: 'var(--mono-portal)',
                            fontSize: 9,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'rgba(0,212,255,0.55)',
                            marginBottom: 6,
                        }}>
                            Live View
                        </div>
                        <div style={{
                            fontFamily: 'var(--serif)',
                            fontSize: 18,
                            fontWeight: 600,
                            color: '#f5f0e8',
                            marginBottom: 4,
                        }}>
                            World Map
                        </div>
                        <div style={{
                            fontFamily: 'var(--sans-portal)',
                            fontSize: 12,
                            color: 'rgba(200,192,184,0.55)',
                            lineHeight: 1.4,
                        }}>
                            Live isometric view of the Genesis Grid with real-time Nous positions and events.
                        </div>
                        <div style={{
                            marginTop: 12,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontFamily: 'var(--mono-portal)',
                            fontSize: 10,
                            letterSpacing: '0.10em',
                            color: '#00d4ff',
                        }}>
                            <span style={{
                                width: 5, height: 5,
                                borderRadius: '50%',
                                background: '#00d4ff',
                                boxShadow: '0 0 6px #00d4ff',
                            }} />
                            ENTER GRID →
                        </div>
                    </Link>

                    {/* Status link */}
                    <Link href="/portal/status" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'var(--parchment)',
                        border: '1px solid var(--rule)',
                        borderRadius: 6,
                        textDecoration: 'none',
                    }}>
                        <span style={{
                            fontFamily: 'var(--sans-portal)',
                            fontSize: 13,
                            color: 'var(--ink)',
                            fontWeight: 400,
                        }}>
                            Project Status
                        </span>
                        <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontFamily: 'var(--mono-portal)',
                            fontSize: 9,
                            letterSpacing: '0.10em',
                            color: '#4ade80',
                        }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 4px #4ade80' }} />
                            OPERATIONAL
                        </span>
                    </Link>
                </div>
            </div>

        </div>
    );
}
