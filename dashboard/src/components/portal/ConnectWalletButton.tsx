/**
 * ConnectWalletButton — wallet connect/disconnect UI.
 *
 * Phase 22 WEB3-01: MetaMask and WalletConnect via wagmi v2 hooks.
 * Shows truncated address when connected, connect button when not.
 */

'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

function truncateAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ConnectWalletButton() {
    const { address, isConnected } = useAccount();
    const { connect, isPending: isConnecting } = useConnect();
    const { disconnect } = useDisconnect();

    if (isConnected && address) {
        return (
            <div className="flex items-center gap-3">
                <span className="rounded-full bg-neutral-800 px-4 py-2 text-sm font-mono text-neutral-300">
                    {truncateAddress(address)}
                </span>
                <button
                    onClick={() => disconnect()}
                    className="rounded-lg bg-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-600 transition-colors"
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => connect({ connector: injected() })}
            disabled={isConnecting}
            className="rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
        >
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
    );
}
