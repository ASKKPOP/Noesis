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
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 min-h-[calc(100vh-3.5rem)]">
            <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-center shadow-xl">
                <div className="mb-6 flex justify-center">
                    <div className="rounded-full bg-violet-600/20 p-4">
                        <svg className="h-8 w-8 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
                        </svg>
                    </div>
                </div>

                <h1 className="text-xl font-bold text-neutral-100">Sign In to Noēsis</h1>
                <p className="mt-2 text-sm text-neutral-400">
                    {isConnected ? 'Sign a message to verify wallet ownership' : 'Connect your wallet to continue'}
                </p>

                <div className="mt-6 flex flex-col gap-3">
                    {!isConnected && <ConnectWalletButton />}

                    {isConnected && !currentUser && (
                        <button
                            onClick={handleSignIn}
                            disabled={isPending}
                            className="w-full rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
                        >
                            {isPending ? 'Signing…' : 'Sign In'}
                        </button>
                    )}
                </div>

                {error && (
                    <p className="mt-4 text-red-400 text-xs" role="alert">
                        Sign-in failed: {error}
                    </p>
                )}
            </div>
        </div>
    );
}

export default dynamic(() => Promise.resolve({ default: PortalAuthPage }), { ssr: false });
