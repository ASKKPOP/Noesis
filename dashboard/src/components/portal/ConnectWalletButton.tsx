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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    color: 'var(--bronze)',
                    background: 'var(--parchment-2)',
                    border: '1px solid var(--rule)',
                    borderRadius: 3,
                    padding: '4px 10px',
                }}>
                    {truncateAddress(address)}
                </span>
                <button
                    onClick={() => disconnect()}
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--rule)',
                        borderRadius: 3,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontFamily: 'var(--sans-portal)',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                    }}
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
            style={{
                width: '100%',
                background: isConnecting ? 'rgba(184,84,47,0.55)' : 'var(--terracotta)',
                color: '#faf6ec',
                border: 'none',
                borderRadius: 4,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'var(--sans-portal)',
                letterSpacing: '0.03em',
                cursor: isConnecting ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
            }}
        >
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
    );
}
