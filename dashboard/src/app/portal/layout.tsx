/**
 * Portal layout — client component so that next/dynamic with ssr:false is allowed.
 *
 * PortalWagmiShell (WagmiProvider + QueryClientProvider + PortalShell) is loaded
 * via dynamic({ ssr: false }) so wagmi connectors (MetaMask SDK, WalletConnect)
 * never execute on the server, eliminating the localStorage SSR crash.
 *
 * The skeleton is shown immediately while the shell hydrates on the client.
 */

'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';

/** Skeleton shown while wagmi shell hydrates on the client. */
function PortalSkeleton() {
    return (
        <div className="flex h-screen bg-neutral-950 text-neutral-100">
            {/* Sidebar skeleton */}
            <div className="flex w-56 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900">
                <div className="flex h-14 items-center border-b border-neutral-800 px-4">
                    <div className="h-5 w-24 animate-pulse rounded bg-neutral-800" />
                </div>
                <div className="flex-1 space-y-2 px-3 py-4">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-9 animate-pulse rounded-lg bg-neutral-800/50" />
                    ))}
                </div>
            </div>
            {/* Main area skeleton */}
            <div className="flex flex-1 flex-col overflow-hidden">
                <div className="h-14 shrink-0 border-b border-neutral-800 bg-neutral-900" />
                <div className="flex-1" />
            </div>
        </div>
    );
}

const PortalWagmiShell = dynamic(
    () => import('@/components/portal/PortalWagmiShell'),
    { ssr: false, loading: () => <PortalSkeleton /> },
);

export default function PortalLayout({ children }: { children: ReactNode }) {
    return <PortalWagmiShell>{children}</PortalWagmiShell>;
}
