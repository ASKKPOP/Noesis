'use client';

/**
 * PortalSidebar — full navigation for all current + future portal sections.
 *
 * Sections:
 *   GRID       World Map
 *   IDENTITY   Sign In · Profile · Wallet
 *   NOUS       Chat · My Nous
 *   COMMUNITY  Community · Leaderboard
 *   RESOURCES  Documents · Glossary · Help
 *   SYSTEM     Activity · Settings
 *
 * Auth state (wallet address / sign-in status) shown at the bottom.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount, useDisconnect } from 'wagmi';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';

// ── Icon components ─────────────────────────────────────────────────────────

function Ico({ d, ...props }: { d: string; className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d={d} />
        </svg>
    );
}

const ICONS = {
    map:         'M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z',
    signin:      'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H9',
    signout:     'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9',
    profile:     'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
    wallet:      'M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3',
    chat:        'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z',
    nous:        'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z',
    community:   'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z',
    leaderboard: 'M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m4.992 0-.002 3.375m-9-4.5V9m0 0 3-3m-3 3 3 3M18 9l-3-3m3 3-3 3',
    docs:        'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
    glossary:    'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25',
    help:        'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z',
    activity:    'M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605',
    settings:    'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
};

// ── Nav structure ────────────────────────────────────────────────────────────

interface NavItem {
    href: string;
    label: string;
    icon: keyof typeof ICONS;
    exact?: boolean;
    phase?: string;    // e.g. "23" → shows a "23" badge
    authOnly?: boolean; // only show when signed in
    guestOnly?: boolean;// only show when NOT signed in
}

interface NavSection {
    label: string;
    items: NavItem[];
}

const NAV: NavSection[] = [
    {
        label: 'GRID',
        items: [
            { href: '/portal',         label: 'World Map',    icon: 'map',         exact: true },
        ],
    },
    {
        label: 'IDENTITY',
        items: [
            { href: '/portal/auth',    label: 'Sign In',      icon: 'signin',      exact: true, guestOnly: true },
            { href: '/portal/profile', label: 'Profile',      icon: 'profile' },
            { href: '/portal/wallet',  label: 'Wallet',       icon: 'wallet',      phase: '23' },
        ],
    },
    {
        label: 'NOUS',
        items: [
            { href: '/portal/chat',    label: 'Chat',         icon: 'chat',        phase: '26' },
            { href: '/portal/my-nous', label: 'My Nous',      icon: 'nous',        phase: '27' },
        ],
    },
    {
        label: 'COMMUNITY',
        items: [
            { href: '/portal/community',   label: 'Community',    icon: 'community',   phase: '28' },
            { href: '/portal/leaderboard', label: 'Leaderboard',  icon: 'leaderboard', phase: '28' },
        ],
    },
    {
        label: 'RESOURCES',
        items: [
            { href: '/portal/docs',     label: 'Documents',   icon: 'docs',        phase: '30' },
            { href: '/portal/glossary', label: 'Glossary',    icon: 'glossary' },
            { href: '/portal/help',     label: 'Help & FAQ',  icon: 'help' },
        ],
    },
    {
        label: 'SYSTEM',
        items: [
            { href: '/portal/activity', label: 'Activity',    icon: 'activity',    phase: '30' },
            { href: '/portal/settings', label: 'Settings',    icon: 'settings',    phase: '31' },
        ],
    },
];

// ── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({ item }: { item: NavItem }) {
    const pathname = usePathname();
    const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    const isSoon   = !!item.phase;

    return (
        <Link
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={[
                'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                isActive
                    ? 'bg-violet-600/20 text-violet-300'
                    : isSoon
                        ? 'text-neutral-600 hover:bg-neutral-800/50 hover:text-neutral-500 cursor-default pointer-events-none'
                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100',
            ].join(' ')}
            tabIndex={isSoon ? -1 : undefined}
        >
            <Ico d={ICONS[item.icon]} className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.phase && (
                <span className="rounded px-1 py-0.5 text-[9px] font-semibold bg-neutral-800 text-neutral-600 tracking-wide">
                    P{item.phase}
                </span>
            )}
        </Link>
    );
}

// ── PortalSidebar ────────────────────────────────────────────────────────────

export function PortalSidebar() {
    const { address, isConnected } = useAccount();
    const { currentUser, clearUser } = useHumanAuthStore();
    const { disconnect } = useDisconnect();

    function handleSignOut() {
        clearUser();
        disconnect();
        document.cookie = 'noesis_portal_token=; Max-Age=0; path=/';
        window.location.href = '/portal/auth';
    }

    return (
        <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900">

            {/* ── Logo ── */}
            <div className="flex h-14 items-center gap-2 border-b border-neutral-800 px-4">
                <span className="text-base font-bold tracking-tight text-neutral-100">Noēsis</span>
                <span className="rounded bg-violet-600/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-violet-300">
                    Portal
                </span>
            </div>

            {/* ── Nav sections ── */}
            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
                {NAV.map((section) => {
                    // Filter auth-aware items
                    const items = section.items.filter(item => {
                        if (item.guestOnly && currentUser) return false;
                        if (item.authOnly && !currentUser) return false;
                        return true;
                    });
                    if (items.length === 0) return null;

                    return (
                        <div key={section.label}>
                            <p className="mb-1 px-2.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-neutral-600">
                                {section.label}
                            </p>
                            <ul className="space-y-0.5">
                                {items.map(item => (
                                    <li key={item.href}>
                                        <NavLink item={item} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </nav>

            {/* ── Auth footer ── */}
            <div className="border-t border-neutral-800 p-3 space-y-2">
                {/* Connected wallet pill */}
                {isConnected && address && (
                    <div className="flex items-center gap-2 rounded-lg bg-neutral-800/60 px-3 py-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                        <span className="flex-1 truncate font-mono text-[11px] text-neutral-400">
                            {address.slice(0, 6)}…{address.slice(-4)}
                        </span>
                    </div>
                )}

                {/* Sign In button (not connected) */}
                {!isConnected && (
                    <Link
                        href="/portal/auth"
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-500"
                    >
                        <Ico d={ICONS.signin} className="h-3.5 w-3.5" />
                        Connect &amp; Sign In
                    </Link>
                )}

                {/* Sign Out button (signed in) */}
                {currentUser && (
                    <button
                        onClick={handleSignOut}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-400 transition-colors hover:border-red-800/60 hover:text-red-400"
                    >
                        <Ico d={ICONS.signout} className="h-3.5 w-3.5" />
                        Sign Out
                    </button>
                )}

                {/* Version */}
                <p className="px-1 text-[10px] text-neutral-700">v2.5 · Phase 22 · Genesis Grid</p>
            </div>
        </aside>
    );
}
