/**
 * wagmi v2 configuration — Portal wallet connectivity.
 *
 * Phase 22 WEB3-01: MetaMask (injected) + WalletConnect v2 connectors.
 * WalletConnect project ID must be set in NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.
 */

import { createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
    chains: [mainnet, sepolia],
    ssr: true,          // Defers browser API access until client hydration
    connectors: [
        injected(),
        walletConnect({
            projectId: process.env['NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID'] ?? '',
        }),
    ],
    transports: {
        [mainnet.id]: http(),
        [sepolia.id]: http(),
    },
});
