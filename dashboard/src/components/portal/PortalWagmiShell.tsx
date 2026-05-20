/**
 * PortalWagmiShell — client-only wagmi + query providers wrapping the shell.
 *
 * Loaded via next/dynamic with ssr:false from portal/layout.tsx so wagmi
 * connectors (MetaMask SDK, WalletConnect) never run on the server.
 * This eliminates the "localStorage.getItem is not a function" SSR crash.
 */

'use client';

import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/web3/wagmi-config';
import { PortalShell } from './PortalShell';

const queryClient = new QueryClient();

export default function PortalWagmiShell({ children }: { children: ReactNode }) {
    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <PortalShell>{children}</PortalShell>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
