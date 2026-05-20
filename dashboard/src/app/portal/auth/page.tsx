'use client';

/**
 * Portal auth page — Sign In / Join.
 *
 * Three paths:
 *   1. Google OAuth  → next-auth signIn('google')
 *   2. Apple OAuth   → next-auth signIn('apple')
 *   3. Wallet + SIWE → wagmi connect → auto SIWE → Grid JWT
 *
 * Loaded client-only (ssr:false) because it uses wagmi hooks.
 */

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useSignMessage } from 'wagmi';
import { signIn } from 'next-auth/react';
import { ConnectWalletButton } from '@/components/portal/ConnectWalletButton';
import { signInWithEthereum } from '@/lib/web3/siwe-auth';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';

// ── Google SVG logo ──────────────────────────────────────────────────────────
function GoogleLogo() {
    return (
        <svg width={18} height={18} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
        </svg>
    );
}

// ── Apple SVG logo ───────────────────────────────────────────────────────────
function AppleLogo() {
    return (
        <svg width={16} height={18} viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.8 134.4-318.4 265.7-318.4 99.9 0 162.5 53.9 218.9 53.9 54.2 0 124.2-57.1 235.7-57.1 34.4 0 129.3 3.2 193.9 93.6zm-175.3-239c37.6-46.4 64.2-110.7 64.2-175 0-9-1.3-18.1-2.6-26.5-60.3 2.3-130.9 40.2-173.5 87.6-34.5 38.1-66.4 102.3-66.4 167.9 0 9.7 1.3 19.4 2 22.5 4 .6 10.3 1.3 16.6 1.3 56.1-.3 120-36.5 159.7-77.8z"/>
        </svg>
    );
}

// ── Main component ───────────────────────────────────────────────────────────

type Tab = 'signin' | 'join';

function PortalAuthPage() {
    const router = useRouter();
    const { address, isConnected, chain } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { currentUser, setUser } = useHumanAuthStore();
    const [tab, setTab] = useState<Tab>('signin');
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [socialPending, setSocialPending] = useState<'google' | 'apple' | null>(null);

    // Already signed in — redirect.
    useEffect(() => {
        if (currentUser) router.push('/portal');
    }, [currentUser, router]);

    // Auto-SIWE when wallet connects.
    useEffect(() => {
        if (isConnected && address && chain && !currentUser && !isPending) {
            handleWalletSignIn();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, address, chain?.id]);

    async function handleWalletSignIn() {
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

    async function handleSocial(provider: 'google' | 'apple') {
        setSocialPending(provider);
        setError(null);
        try {
            await signIn(provider, { callbackUrl: '/portal' });
        } catch {
            setError('social_sign_in_failed');
            setSocialPending(null);
        }
    }

    const isSignIn = tab === 'signin';

    return (
        <div style={{
            display: 'flex',
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
                maxWidth: 400,
                background: 'var(--parchment)',
                border: '1px solid var(--rule)',
                borderRadius: 8,
                overflow: 'hidden',
            }}>
                {/* Tab bar */}
                <div style={{
                    display: 'flex',
                    borderBottom: '1px solid var(--rule)',
                }}>
                    {(['signin', 'join'] as Tab[]).map(t => (
                        <button
                            key={t}
                            onClick={() => { setTab(t); setError(null); }}
                            style={{
                                flex: 1,
                                padding: '14px 0',
                                fontFamily: 'var(--sans-portal)',
                                fontSize: 12,
                                fontWeight: tab === t ? 600 : 400,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: tab === t ? 'var(--ink)' : 'var(--muted)',
                                background: tab === t ? 'var(--parchment)' : 'var(--parchment-2)',
                                border: 'none',
                                borderBottom: tab === t ? '2px solid var(--terracotta)' : '2px solid transparent',
                                cursor: 'pointer',
                                transition: 'color 0.15s',
                            }}
                        >
                            {t === 'signin' ? 'Sign In' : 'Join'}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div style={{ padding: '32px 32px 28px' }}>
                    {/* Heading */}
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            border: '1px solid var(--rule)',
                            background: 'var(--parchment-2)',
                            marginBottom: 14,
                        }}>
                            <span style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, color: 'var(--bronze)', lineHeight: 1 }}>Ν</span>
                        </div>
                        <h1 style={{
                            fontFamily: 'var(--serif)',
                            fontSize: 24,
                            fontWeight: 600,
                            color: 'var(--ink)',
                            letterSpacing: '0.01em',
                            lineHeight: 1.2,
                            marginBottom: 6,
                        }}>
                            {isSignIn ? 'Welcome back' : 'Join Noēsis'}
                        </h1>
                        <p style={{
                            fontFamily: 'var(--sans-portal)',
                            fontSize: 12,
                            color: 'var(--muted)',
                            lineHeight: 1.5,
                        }}>
                            {isSignIn
                                ? 'Sign in to your portal account'
                                : 'Create your account and enter the Genesis Grid'}
                        </p>
                    </div>

                    {/* ── Social buttons ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                        {/* Google */}
                        <button
                            onClick={() => handleSocial('google')}
                            disabled={!!socialPending}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                width: '100%',
                                background: socialPending === 'google' ? '#e8e8e8' : '#ffffff',
                                border: '1px solid rgba(0,0,0,0.18)',
                                borderRadius: 4,
                                padding: '10px 16px',
                                fontSize: 13,
                                fontWeight: 500,
                                fontFamily: 'var(--sans-portal)',
                                color: '#3c4043',
                                cursor: socialPending ? 'not-allowed' : 'pointer',
                                transition: 'background 0.15s',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                            }}
                        >
                            <GoogleLogo />
                            {socialPending === 'google'
                                ? 'Redirecting…'
                                : (isSignIn ? 'Sign in with Google' : 'Join with Google')}
                        </button>

                        {/* Apple */}
                        <button
                            onClick={() => handleSocial('apple')}
                            disabled={!!socialPending}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                width: '100%',
                                background: socialPending === 'apple' ? '#333' : '#000000',
                                border: '1px solid #000',
                                borderRadius: 4,
                                padding: '10px 16px',
                                fontSize: 13,
                                fontWeight: 500,
                                fontFamily: 'var(--sans-portal)',
                                color: '#ffffff',
                                cursor: socialPending ? 'not-allowed' : 'pointer',
                                transition: 'background 0.15s',
                            }}
                        >
                            <AppleLogo />
                            {socialPending === 'apple'
                                ? 'Redirecting…'
                                : (isSignIn ? 'Sign in with Apple' : 'Join with Apple')}
                        </button>
                    </div>

                    {/* ── Divider ── */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 20,
                    }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
                        <span style={{
                            fontFamily: 'var(--mono-portal)',
                            fontSize: 10,
                            letterSpacing: '0.10em',
                            color: 'var(--muted)',
                            textTransform: 'uppercase',
                        }}>
                            or wallet
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
                    </div>

                    {/* ── Wallet section ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {!isConnected && <ConnectWalletButton />}

                        {isConnected && !currentUser && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                padding: '10px 0',
                                fontFamily: 'var(--mono-portal)',
                                fontSize: 11,
                                color: 'var(--muted)',
                                letterSpacing: '0.06em',
                            }}>
                                <span style={{
                                    display: 'inline-block',
                                    width: 7, height: 7,
                                    borderRadius: '50%',
                                    background: isPending ? 'var(--terracotta)' : '#4ade80',
                                    boxShadow: isPending
                                        ? '0 0 6px var(--terracotta)'
                                        : '0 0 6px #4ade80',
                                    animation: isPending ? 'portal-pulse 1.2s ease-in-out infinite' : 'none',
                                }} />
                                {isPending ? 'Awaiting signature…' : 'Wallet connected'}
                            </div>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            marginTop: 16,
                            fontFamily: 'var(--mono-portal)',
                            fontSize: 11,
                            color: '#b83232',
                            background: 'rgba(184,50,50,0.06)',
                            border: '1px solid rgba(184,50,50,0.20)',
                            borderRadius: 3,
                            padding: '7px 12px',
                            textAlign: 'center',
                        }}>
                            {error === 'user_rejected_signature' ? 'Signature rejected — reconnect to try again' : error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    borderTop: '1px solid var(--rule)',
                    padding: '12px 32px',
                    textAlign: 'center',
                }}>
                    <p style={{
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 11,
                        color: 'var(--muted)',
                        lineHeight: 1.5,
                    }}>
                        {isSignIn ? "Don't have an account? " : 'Already have an account? '}
                        <button
                            onClick={() => setTab(isSignIn ? 'join' : 'signin')}
                            style={{
                                background: 'none', border: 'none', padding: 0,
                                fontFamily: 'var(--sans-portal)',
                                fontSize: 11, fontWeight: 600,
                                color: 'var(--bronze)',
                                cursor: 'pointer', textDecoration: 'underline',
                            }}
                        >
                            {isSignIn ? 'Join Noēsis' : 'Sign in'}
                        </button>
                    </p>
                </div>
            </div>

            {/* Phase stamp */}
            <p style={{
                marginTop: 20,
                fontFamily: 'var(--mono-portal)',
                fontSize: 10,
                letterSpacing: '0.08em',
                color: 'var(--muted)',
                opacity: 0.5,
            }}>
                PHASE 22 · GENESIS GRID
            </p>
        </div>
    );
}

export default dynamic(() => Promise.resolve({ default: PortalAuthPage }), { ssr: false });
