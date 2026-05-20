'use client';

/**
 * Portal sign-in page — SIWE authentication.
 * Loaded client-only (ssr:false) because it uses wagmi hooks.
 *
 * Phase 22 WEB3-01: wallet connect + SIWE sign flow.
 *
 * Flow:
 *   1. Not connected → show ConnectWalletButton
 *   2. Connected, not signed in → show "Sign In" button
 *   3. Signed in (currentUser set) → redirect to /portal
 */

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectWalletButton } from '@/components/portal/ConnectWalletButton';
import { signInWithEthereum } from '@/lib/web3/siwe-auth';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';

function PortalAuthPage() {
    const router = useRouter();
    const { address, isConnected, chain } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { currentUser, setUser } = useHumanAuthStore();
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Already signed in — redirect to portal.
    useEffect(() => {
        if (currentUser) {
            router.push('/portal');
        }
    }, [currentUser, router]);

    async function handleSignIn() {
        if (!address || !chain) return;
        setIsPending(true);
        setError(null);
        try {
            const user = await signInWithEthereum({
                address,
                chainId: chain.id,
                signMessage: (msg) => signMessageAsync({ message: msg }),
            });
            setUser(user);
            router.push('/portal');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'sign_in_failed');
        } finally {
            setIsPending(false);
        }
    }

    return (
        <div style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(100vh - 52px)',
            padding: '40px 24px',
            background: 'var(--vellum)',
        }}>
            {/* Card */}
            <div style={{
                width: '100%',
                maxWidth: 380,
                background: 'var(--parchment)',
                border: '1px solid var(--rule)',
                borderRadius: 8,
                padding: '40px 36px',
                textAlign: 'center',
            }}>
                {/* Monogram */}
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    border: '1px solid var(--rule)',
                    background: 'var(--parchment-2)',
                    marginBottom: 20,
                }}>
                    <span style={{
                        fontFamily: 'var(--serif)',
                        fontSize: 22,
                        fontWeight: 600,
                        color: 'var(--bronze)',
                        lineHeight: 1,
                    }}>Ν</span>
                </div>

                {/* Heading */}
                <h1 style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 26,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    letterSpacing: '0.01em',
                    lineHeight: 1.2,
                    marginBottom: 8,
                }}>
                    Sign In to Noēsis
                </h1>

                <p style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                    marginBottom: 28,
                }}>
                    {isConnected
                        ? 'Sign a message to verify wallet ownership'
                        : 'Connect your wallet to continue'}
                </p>

                {/* Divider */}
                <div style={{
                    borderTop: '1px solid var(--rule)',
                    marginBottom: 24,
                }} />

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {!isConnected && <ConnectWalletButton />}

                    {isConnected && !currentUser && (
                        <button
                            onClick={handleSignIn}
                            disabled={isPending}
                            style={{
                                width: '100%',
                                background: isPending ? 'rgba(184,84,47,0.55)' : 'var(--terracotta)',
                                color: '#faf6ec',
                                border: 'none',
                                borderRadius: 4,
                                padding: '10px 20px',
                                fontSize: 13,
                                fontWeight: 600,
                                fontFamily: 'var(--sans-portal)',
                                letterSpacing: '0.03em',
                                cursor: isPending ? 'not-allowed' : 'pointer',
                                transition: 'background 0.15s',
                            }}
                        >
                            {isPending ? 'Signing…' : 'Sign In'}
                        </button>
                    )}
                </div>

                {error && (
                    <p style={{
                        marginTop: 16,
                        fontFamily: 'var(--mono-portal)',
                        fontSize: 11,
                        color: '#b83232',
                        background: 'rgba(184,50,50,0.06)',
                        border: '1px solid rgba(184,50,50,0.20)',
                        borderRadius: 3,
                        padding: '6px 10px',
                    }} role="alert">
                        {error}
                    </p>
                )}
            </div>

            {/* Footer note */}
            <p style={{
                marginTop: 20,
                fontFamily: 'var(--mono-portal)',
                fontSize: 10,
                letterSpacing: '0.08em',
                color: 'var(--muted)',
                opacity: 0.6,
            }}>
                PHASE 22 · GENESIS GRID · SIWE
            </p>
        </div>
    );
}

export default dynamic(() => Promise.resolve({ default: PortalAuthPage }), { ssr: false });
