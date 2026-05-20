/**
 * Portal layout — wraps all /portal/* routes with WagmiProvider.
 *
 * Phase 22 WEB3-01: wallet connectivity available to all portal pages.
 * This is a nested segment layout; it does NOT include <html>/<body>.
 */

'use client';

import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/web3/wagmi-config';

const queryClient = new QueryClient();

export default function PortalLayout({ children }: { children: ReactNode }) {
    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <div className="min-h-screen bg-neutral-950 text-neutral-100">
                    {children}
                </div>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
