'use client';

/**
 * Portal auth page — full-screen dark design matching nexus.eklotho.com/login.
 *
 * Background: dark #1d1c1b with canvas particle dots.
 * Auth paths: Google OAuth · Apple OAuth · Wallet + SIWE.
 *
 * Loaded client-only (ssr:false) — uses wagmi hooks.
 */

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// ── CyberGrid background (the live isometric city) ───────────────────────────
const CyberGridBg = dynamic(() => import('@/components/portal/CyberGrid'), { ssr: false });
import { useRouter } from 'next/navigation';
import { useAccount, useSignMessage, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { signIn } from 'next-auth/react';
import { signInWithEthereum } from '@/lib/web3/siwe-auth';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';

// ParticleCanvas removed — replaced by live CyberGrid background.

// ── SVG logos ────────────────────────────────────────────────────────────────

function GoogleLogo() {
    return (
        <svg width={17} height={17} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
    );
}

function AppleLogo() {
    return (
        <svg width={15} height={17} viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.8 134.4-318.4 265.7-318.4 99.9 0 162.5 53.9 218.9 53.9 54.2 0 124.2-57.1 235.7-57.1 34.4 0 129.3 3.2 193.9 93.6zm-175.3-239c37.6-46.4 64.2-110.7 64.2-175 0-9-1.3-18.1-2.6-26.5-60.3 2.3-130.9 40.2-173.5 87.6-34.5 38.1-66.4 102.3-66.4 167.9 0 9.7 1.3 19.4 2 22.5 4 .6 10.3 1.3 16.6 1.3 56.1-.3 120-36.5 159.7-77.8z"/>
        </svg>
    );
}

function WalletIcon() {
    return (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
        </svg>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

type Tab = 'signin' | 'join';

// Shared input style
const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '13px 16px',
    fontSize: 14,
    fontFamily: '"DM Sans", "Inter Tight", sans-serif',
    color: '#f5f0ea',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
};

function PortalAuthPage() {
    const router = useRouter();
    const { address, isConnected, chain } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { connect, isPending: isConnecting } = useConnect();
    const { disconnect } = useDisconnect();
    const { currentUser, setUser } = useHumanAuthStore();

    const [tab, setTab] = useState<Tab>('signin');
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [socialPending, setSocialPending] = useState<'google' | 'apple' | null>(null);

    // Already signed in — redirect.
    useEffect(() => {
        if (currentUser) router.push('/portal');
    }, [currentUser, router]);

    // Auto SIWE once wallet connects.
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

    function handleWalletClick() {
        if (isConnected) {
            disconnect();
        } else {
            connect({ connector: injected() });
        }
    }

    const isJoin = tab === 'join';

    // ── Shared button base ───────────────────────────────────────────────────
    const socialBtn: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
        borderRadius: 10,
        padding: '13px 16px',
        fontSize: 14,
        fontFamily: '"DM Sans", "Inter Tight", sans-serif',
        fontWeight: 500,
        cursor: socialPending ? 'not-allowed' : 'pointer',
        transition: 'opacity 0.15s, background 0.15s',
        opacity: socialPending ? 0.6 : 1,
        border: 'none',
    };

    return (
        <div style={{
            position: 'relative',
            minHeight: '100vh',
            background: '#020610',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            fontFamily: '"DM Sans", "Inter Tight", sans-serif',
        }}>
            {/* Live isometric city — full-screen non-interactive background */}
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 0,
                pointerEvents: 'none',
            }}>
                <CyberGridBg />
            </div>

            {/* Dark veil so login card reads clearly over the busy city */}
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1,
                background: 'rgba(2,6,16,0.52)',
                pointerEvents: 'none',
            }} />

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 440 }}>

                {/* ── Logo ── */}
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{
                        fontFamily: '"Cormorant Garamond", Georgia, serif',
                        fontSize: 42,
                        fontWeight: 600,
                        color: '#f5f0ea',
                        letterSpacing: '0.02em',
                        lineHeight: 1,
                        marginBottom: 10,
                    }}>
                        Noēsis
                    </div>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        <span style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: '0.14em',
                            color: '#da7a4e',
                            border: '1px solid rgba(218,122,78,0.50)',
                            borderRadius: 4,
                            padding: '2px 8px',
                        }}>
                            PORTAL
                        </span>
                        <span style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: 10,
                            letterSpacing: '0.14em',
                            color: 'rgba(245,240,234,0.40)',
                        }}>
                            GENESIS GRID
                        </span>
                    </div>
                </div>

                {/* ── Card ── */}
                <div style={{
                    background: 'rgba(2,6,16,0.72)',
                    border: '1px solid rgba(0,212,255,0.15)',
                    borderRadius: 16,
                    padding: '36px 36px 28px',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 48px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,212,255,0.03)',
                }}>

                    {/* Heading */}
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                        <h1 style={{
                            fontFamily: '"DM Sans", "Inter Tight", sans-serif',
                            fontSize: 26,
                            fontWeight: 700,
                            color: '#ffffff',
                            marginBottom: 6,
                            letterSpacing: '-0.01em',
                        }}>
                            {isJoin ? 'Create your account' : 'Welcome back'}
                        </h1>
                        <p style={{
                            fontSize: 14,
                            color: '#da7a4e',
                            fontWeight: 500,
                        }}>
                            {isJoin
                                ? 'Join the Genesis Grid and enter Noēsis'
                                : 'Sign in to your account to continue'}
                        </p>
                    </div>

                    {/* Tab switcher */}
                    <div style={{
                        display: 'flex',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: 8,
                        padding: 3,
                        marginBottom: 24,
                        gap: 3,
                    }}>
                        {(['signin', 'join'] as Tab[]).map(t => (
                            <button
                                key={t}
                                onClick={() => { setTab(t); setError(null); }}
                                style={{
                                    flex: 1,
                                    padding: '8px 0',
                                    borderRadius: 6,
                                    border: 'none',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    fontFamily: '"DM Sans", "Inter Tight", sans-serif',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s, color 0.15s',
                                    background: tab === t ? '#da7a4e' : 'transparent',
                                    color: tab === t ? '#ffffff' : 'rgba(245,240,234,0.45)',
                                }}
                            >
                                {t === 'signin' ? 'Sign In' : 'Join'}
                            </button>
                        ))}
                    </div>

                    {/* ── Social buttons ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                        {/* Google */}
                        <button
                            onClick={() => handleSocial('google')}
                            disabled={!!socialPending}
                            style={{
                                ...socialBtn,
                                background: '#ffffff',
                                color: '#3c4043',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            }}
                        >
                            <GoogleLogo />
                            {socialPending === 'google' ? 'Redirecting…' : (isJoin ? 'Join with Google' : 'Continue with Google')}
                        </button>

                        {/* Apple */}
                        <button
                            onClick={() => handleSocial('apple')}
                            disabled={!!socialPending}
                            style={{
                                ...socialBtn,
                                background: '#000000',
                                color: '#ffffff',
                            }}
                        >
                            <AppleLogo />
                            {socialPending === 'apple' ? 'Redirecting…' : (isJoin ? 'Join with Apple' : 'Continue with Apple')}
                        </button>
                    </div>

                    {/* ── Divider ── */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 20,
                    }}>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
                        <span style={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: 10,
                            letterSpacing: '0.10em',
                            color: 'rgba(245,240,234,0.35)',
                            textTransform: 'uppercase',
                        }}>
                            or continue with wallet
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
                    </div>

                    {/* ── Wallet button ── */}
                    {!isConnected ? (
                        <button
                            onClick={handleWalletClick}
                            disabled={isConnecting}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                width: '100%',
                                background: isConnecting ? 'rgba(218,122,78,0.70)' : '#da7a4e',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 10,
                                padding: '13px 16px',
                                fontSize: 14,
                                fontWeight: 600,
                                fontFamily: '"DM Sans", "Inter Tight", sans-serif',
                                cursor: isConnecting ? 'not-allowed' : 'pointer',
                                transition: 'background 0.15s',
                            }}
                        >
                            <WalletIcon />
                            {isConnecting ? 'Connecting…' : (isJoin ? 'Join with Wallet' : 'Sign In with Wallet')}
                        </button>
                    ) : (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            padding: '13px 16px',
                            background: 'rgba(218,122,78,0.08)',
                            border: '1px solid rgba(218,122,78,0.25)',
                            borderRadius: 10,
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: 12,
                            color: isPending ? '#da7a4e' : '#4ade80',
                            letterSpacing: '0.04em',
                        }}>
                            <span style={{
                                width: 8, height: 8,
                                borderRadius: '50%',
                                background: isPending ? '#da7a4e' : '#4ade80',
                                boxShadow: isPending ? '0 0 8px #da7a4e' : '0 0 8px #4ade80',
                                flexShrink: 0,
                                animation: isPending ? 'portal-pulse 1.2s ease-in-out infinite' : 'none',
                            }} />
                            {isPending
                                ? 'Check wallet — sign the message…'
                                : `${address?.slice(0,6)}…${address?.slice(-4)}`}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div style={{
                            marginTop: 14,
                            padding: '10px 14px',
                            background: 'rgba(184,50,50,0.10)',
                            border: '1px solid rgba(184,50,50,0.30)',
                            borderRadius: 8,
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: 11,
                            color: '#f87171',
                            textAlign: 'center',
                        }}>
                            {error === 'user_rejected_signature'
                                ? 'Signature rejected — reconnect to retry'
                                : error}
                        </div>
                    )}

                    {/* Notice */}
                    <div style={{
                        marginTop: 20,
                        padding: '10px 14px',
                        background: 'rgba(218,122,78,0.06)',
                        border: '1px solid rgba(218,122,78,0.15)',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#da7a4e" strokeWidth={2} style={{ flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10"/>
                            <path strokeLinecap="round" d="M12 8v4M12 16h.01"/>
                        </svg>
                        <span style={{
                            fontFamily: '"DM Sans", "Inter Tight", sans-serif',
                            fontSize: 12,
                            color: 'rgba(245,240,234,0.55)',
                            lineHeight: 1.4,
                        }}>
                            By entering the Genesis Grid, you agree to the Grid Charter and the Laws of Themis.
                        </span>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <p style={{
                        fontSize: 13,
                        color: 'rgba(245,240,234,0.35)',
                        marginBottom: 10,
                    }}>
                        {isJoin ? 'Already have an account? ' : "Don't have an account? "}
                        <button
                            onClick={() => setTab(isJoin ? 'signin' : 'join')}
                            style={{
                                background: 'none', border: 'none', padding: 0,
                                fontSize: 13, fontWeight: 600,
                                color: '#da7a4e',
                                cursor: 'pointer',
                            }}
                        >
                            {isJoin ? 'Sign In' : 'Join Noēsis'}
                        </button>
                    </p>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 12,
                        flexWrap: 'wrap' as const,
                    }}>
                        {[
                            { label: 'Privacy Policy',   href: '/portal/privacy' },
                            { label: 'Terms of Service', href: '/portal/terms' },
                            { label: 'Project Status',   href: '/portal/status' },
                        ].map(({ label, href }) => (
                            <a
                                key={label}
                                href={href}
                                style={{
                                    fontSize: 11,
                                    color: '#da7a4e',
                                    textDecoration: 'none',
                                    opacity: 0.7,
                                }}
                            >
                                {label}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default dynamic(() => Promise.resolve({ default: PortalAuthPage }), { ssr: false });
