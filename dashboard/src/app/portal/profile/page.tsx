'use client';

/**
 * Portal profile page — editorial theme.
 * Loaded client-only (ssr:false) because it uses wagmi hooks.
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';
import { useAccount, useDisconnect, useBalance, useReadContract } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { formatEther, formatUnits } from 'viem';

// ── Constants ──────────────────────────────────────────────────────────────────

const USDT_ADDR: Record<number, `0x${string}`> = {
    [mainnet.id]: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};

const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function' as const,
        stateMutability: 'view' as const,
        inputs:  [{ name: 'account', type: 'address' as const }],
        outputs: [{ type: 'uint256' as const }],
    },
] as const;

// ── Component ──────────────────────────────────────────────────────────────────

function ProfilePage() {
    const { currentUser, clearUser } = useHumanAuthStore();
    const { address, chain } = useAccount();
    const { disconnect } = useDisconnect();

    const usdtAddr = chain?.id ? USDT_ADDR[chain.id] : undefined;
    const { data: ethBal } = useBalance({ address });
    const { data: usdtRaw } = useReadContract({
        address: usdtAddr,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!usdtAddr && !!address },
    });

    async function handleSignOut() {
        clearUser();
        disconnect();
        await fetch('/api/v1/portal/auth/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/portal/auth';
    }

    const rows: { label: string; value: string; mono?: boolean }[] = [
        { label: 'DID',              value: currentUser?.did ?? '—',                          mono: true },
        { label: 'Ethereum Address', value: currentUser?.eth_address ?? address ?? '—',       mono: true },
        { label: 'Network',          value: chain?.name ?? '—' },
        { label: 'Agency Tier',      value: 'H1 — Observe only' },
    ];

    // Derived values for new rows
    const regionValue = currentUser?.region
        ? (currentUser.region.charAt(0).toUpperCase() + currentUser.region.slice(1))
        : '—';

    const memberSinceValue = currentUser?.created_at
        ? new Date(currentUser.created_at).toLocaleString('en-US', { month: 'long', year: 'numeric' })
        : '—';

    const ethBalValue = ethBal
        ? parseFloat(formatEther(ethBal.value)).toFixed(4)
        : '—';

    const usdtValue = usdtRaw !== undefined
        ? parseFloat(formatUnits(usdtRaw as bigint, 6)).toFixed(2)
        : '—';

    // Shared style for new hardcoded dt labels (fontWeight: 600 per UI-SPEC)
    const newDtStyle: React.CSSProperties = {
        width: 148,
        flexShrink: 0,
        fontFamily: 'var(--mono-portal)',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        paddingTop: 2,
    };

    const newRowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        padding: '12px 20px',
        borderBottom: '1px solid var(--rule)',
    };

    const newDdStyle: React.CSSProperties = {
        margin: 0,
        fontFamily: 'var(--sans-portal)',
        fontSize: 13,
        color: 'var(--ink)',
        lineHeight: 1.5,
    };

    return (
        <div style={{ padding: '36px 40px', maxWidth: 680 }}>
            {/* Page heading */}
            <div style={{ marginBottom: 32 }}>
                <h1 style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 30,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    letterSpacing: '0.01em',
                    lineHeight: 1.15,
                    marginBottom: 6,
                }}>
                    Profile
                </h1>
                <p style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                }}>
                    Your on-chain identity in the Noēsis Portal.
                </p>
            </div>

            {/* Identity card */}
            <div style={{
                background: 'var(--parchment)',
                border: '1px solid var(--rule)',
                borderRadius: 6,
                overflow: 'hidden',
                marginBottom: 24,
            }}>
                {/* Card header */}
                <div style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--rule)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                }}>
                    <span style={{
                        fontFamily: 'var(--mono-portal)',
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--muted)',
                    }}>
                        Identity
                    </span>
                    {currentUser && (
                        <span style={{
                            fontFamily: 'var(--mono-portal)',
                            fontSize: 9,
                            color: '#4ade80',
                            background: 'rgba(74,222,128,0.08)',
                            border: '1px solid rgba(74,222,128,0.20)',
                            borderRadius: 2,
                            padding: '1px 6px',
                            letterSpacing: '0.06em',
                        }}>
                            ACTIVE
                        </span>
                    )}
                </div>

                {/* Rows */}
                <dl>
                    {rows.map(({ label, value, mono }, i) => (
                        <div
                            key={label}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 16,
                                padding: '12px 20px',
                                borderBottom: i < rows.length - 1 ? '1px solid var(--rule)' : 'none',
                            }}
                        >
                            <dt style={{
                                width: 148,
                                flexShrink: 0,
                                fontFamily: 'var(--mono-portal)',
                                fontSize: 10,
                                fontWeight: 500,
                                letterSpacing: '0.10em',
                                textTransform: 'uppercase',
                                color: 'var(--muted)',
                                paddingTop: 2,
                            }}>
                                {label}
                            </dt>
                            <dd style={{
                                fontFamily: mono ? 'var(--mono-portal)' : 'var(--sans-portal)',
                                fontSize: mono ? 12 : 13,
                                color: 'var(--ink)',
                                wordBreak: 'break-all',
                                lineHeight: 1.5,
                            }}>
                                {value}
                            </dd>
                        </div>
                    ))}

                    {/* Current Region row — hardcoded to use fontWeight: 600 */}
                    <div style={newRowStyle}>
                        <dt style={newDtStyle}>Current Region</dt>
                        <dd style={newDdStyle}>{regionValue}</dd>
                    </div>

                    {/* Cyber Coin balance row — inline Link requires separate row */}
                    <div style={newRowStyle}>
                        <dt style={newDtStyle}>Cyber Coin</dt>
                        <dd style={{
                            ...newDdStyle,
                            display: 'flex',
                            gap: 6,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                        }}>
                            <span>
                                {ethBalValue} ETH
                                {' · '}
                                {usdtValue} USDT
                            </span>
                            <Link href="/portal/wallet" style={{
                                fontFamily: 'var(--sans-portal)',
                                fontSize: 12,
                                fontWeight: 400,
                                color: 'var(--terracotta)',
                                textDecoration: 'none',
                            }}>
                                → Wallet
                            </Link>
                        </dd>
                    </div>

                    {/* Member Since row — hardcoded to use fontWeight: 600 */}
                    <div style={{ ...newRowStyle, borderBottom: 'none' }}>
                        <dt style={newDtStyle}>Member Since</dt>
                        <dd style={newDdStyle}>{memberSinceValue}</dd>
                    </div>
                </dl>
            </div>

            {/* Sign Out */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                    onClick={handleSignOut}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'transparent',
                        border: '1px solid var(--rule)',
                        borderRadius: 4,
                        padding: '7px 16px',
                        fontSize: 12,
                        fontFamily: 'var(--sans-portal)',
                        fontWeight: 500,
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        transition: 'color 0.15s, border-color 0.15s',
                    }}
                >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                    Sign Out
                </button>
                <span style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    color: 'var(--muted)',
                    opacity: 0.5,
                }}>
                    Clears session and disconnects wallet
                </span>
            </div>
        </div>
    );
}

export default dynamic(() => Promise.resolve({ default: ProfilePage }), { ssr: false });
