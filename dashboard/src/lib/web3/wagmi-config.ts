/**
 * wagmi v2 configuration — Portal wallet connectivity.
 *
 * Phase 22 WEB3-01: MetaMask (injected) + WalletConnect v2 connectors.
 * WalletConnect project ID must be set in NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.
 */

import { createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// WalletConnect needs a project id (cloud.reown.com). With an empty id the
// connector still mounts but fails Reown's remote-config fetch, spamming
// "Project ID Not Configured" 400/403 errors on every portal page. Only wire
// the connector when the id is present; MetaMask/injected sign-in is unaffected.
const wcProjectId = process.env['NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID'] ?? '';
if (!wcProjectId && typeof window !== 'undefined') {
    console.warn('[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set — WalletConnect disabled (MetaMask still works)');
}

export const wagmiConfig = createConfig({
    chains: [mainnet, sepolia],
    ssr: true,          // Defers browser API access until client hydration
    connectors: [
        injected(),
        ...(wcProjectId ? [walletConnect({ projectId: wcProjectId })] : []),
    ],
    transports: {
        [mainnet.id]: http(),
        [sepolia.id]: http(),
    },
});
