'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount, useDisconnect } from 'wagmi';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';

function truncateAddress(address: string): string {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function truncateDid(did: string): string {
    const parts = did.split(':');
    const addr = parts[parts.length - 1] ?? did;
    return `did:…${addr.slice(-8)}`;
}

/** Map pathname → readable breadcrumb label */
function usePageLabel(): string {
    const pathname = usePathname();
    const labels: Record<string, string> = {
        '/portal':              'World Map',
        '/portal/auth':         'Sign In',
        '/portal/profile':      'Profile',
        '/portal/wallet':       'Wallet',
        '/portal/chat':         'Chat with Nous',
        '/portal/my-nous':      'My Nous',
        '/portal/community':    'Community',
        '/portal/leaderboard':  'Leaderboard',
        '/portal/docs':         'Documents',
        '/portal/glossary':     'Glossary',
        '/portal/help':         'Help & FAQ',
        '/portal/activity':     'Activity',
        '/portal/settings':     'Settings',
    };
    return labels[pathname] ?? 'Portal';
}

export function PortalHeader() {
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
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-900 px-6">
            {/* Left: breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-neutral-400">
                <span className="text-neutral-600">/</span>
                <span className="text-neutral-200 font-medium">{pageLabel}</span>
            </div>

            {/* Right: identity + actions */}
            <div className="flex items-center gap-3">
                {/* DID chip — only when signed in */}
                {currentUser && (
                    <span
                        title={currentUser.did}
                        className="hidden rounded-full bg-neutral-800 px-3 py-1 font-mono text-xs text-neutral-400 sm:block"
                    >
                        {truncateDid(currentUser.did)}
                    </span>
                )}

                {/* Wallet address chip */}
                {isConnected && address && (
                    <span className="rounded-full bg-violet-600/20 px-3 py-1 font-mono text-xs text-violet-300">
                        {truncateAddress(address)}
                    </span>
                )}

                {/* Signed in → Sign out button */}
                {currentUser && (
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
                    >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                        </svg>
                        Sign out
                    </button>
                )}

                {/* Not signed in → Sign In link */}
                {!currentUser && (
                    <Link
                        href="/portal/auth"
                        className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500"
                    >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H9" />
                        </svg>
                        Sign In
                    </Link>
                )}
            </div>
        </header>
    );
}
