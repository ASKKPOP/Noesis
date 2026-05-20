/**
 * Portal sign-in page — SIWE authentication.
 *
 * Phase 22 WEB3-01: wallet connect + SIWE sign flow.
 *
 * Flow:
 *   1. Not connected → show ConnectWalletButton
 *   2. Connected, not signed in → show "Sign In" button
 *   3. Signed in (currentUser set) → redirect to /portal
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useSignMessage } from 'wagmi';
import { ConnectWalletButton } from '@/components/portal/ConnectWalletButton';
import { signInWithEthereum } from '@/lib/web3/siwe-auth';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';

export default function PortalAuthPage() {
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
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-neutral-100">Sign In to Noēsis</h1>
                <p className="mt-1 text-neutral-400 text-sm">
                    {isConnected ? 'Sign a message to verify ownership' : 'Connect your wallet to continue'}
                </p>
            </div>

            {!isConnected && <ConnectWalletButton />}

            {isConnected && !currentUser && (
                <button
                    onClick={handleSignIn}
                    disabled={isPending}
                    className="rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
                >
                    {isPending ? 'Signing…' : 'Sign In'}
                </button>
            )}

            {error && (
                <p className="text-red-400 text-sm" role="alert">
                    Sign-in failed: {error}
                </p>
            )}
        </main>
    );
}
