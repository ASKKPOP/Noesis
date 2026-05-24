'use client';
import { useState, useEffect, useCallback } from 'react';
import { useWriteContract, useChainId } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { parseUnits } from 'viem';
import WizardSummaryCard from './WizardSummaryCard';
import PaymentPolling from './PaymentPolling';

const GRID_BASE = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

const USDT_ADDR: Record<number, `0x${string}`> = {
    [mainnet.id]: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};

const ERC20_ABI = [
    {
        name: 'transfer',
        type: 'function' as const,
        stateMutability: 'nonpayable' as const,
        inputs: [
            { name: 'to', type: 'address' as const },
            { name: 'amount', type: 'uint256' as const },
        ],
        outputs: [{ type: 'bool' as const }],
    },
] as const;

type Seed = 'Explorer' | 'Scholar' | 'Merchant' | 'Guardian';
type UiState =
    | 'idle'
    | 'paying'
    | 'confirming'
    | 'spawning'
    | 'spawn_not_enabled'
    | 'error_timeout'
    | 'error_payment_failed'
    | 'error_already_owns';

interface Props {
    name: string;
    seed: Seed;
    region: string;
    onBack: () => void;
    onSuccess: () => void;
    onAlreadyOwns: () => void;
}

export default function StepPay({
    name, seed, region, onBack, onSuccess, onAlreadyOwns,
}: Props) {
    const [costUsdt, setCostUsdt] = useState('50');
    const [treasury, setTreasury] = useState<`0x${string}` | null>(null);
    const [uiState, setUiState] = useState<UiState>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const chainId = useChainId();
    const {
        writeContract,
        data: txHash,
        isPending: walletPending,
        error: walletError,
    } = useWriteContract();

    // Load /spawn/config on mount
    useEffect(() => {
        let cancelled = false;
        fetch(`${GRID_BASE}/api/v1/portal/nous/spawn/config`, { credentials: 'include' })
            .then(r => {
                if (r.status === 503) {
                    setUiState('spawn_not_enabled');
                    throw new Error('disabled');
                }
                return r.json();
            })
            .then((data: { cost_usdt: string; treasury_address: string }) => {
                if (cancelled) return;
                setCostUsdt(data.cost_usdt);
                if (data.treasury_address?.startsWith('0x')) {
                    setTreasury(data.treasury_address as `0x${string}`);
                }
            })
            .catch(() => null);
        return () => { cancelled = true; };
    }, []);

    const handlePay = useCallback(() => {
        if (!treasury) return;
        setUiState('paying');
        writeContract({
            address: USDT_ADDR[chainId] ?? USDT_ADDR[mainnet.id]!,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [treasury, parseUnits(costUsdt, 6)],
        });
    }, [treasury, costUsdt, chainId, writeContract]);

    // Wallet error before tx broadcast → revert to idle with error
    useEffect(() => {
        if (walletError) {
            setUiState('error_payment_failed');
            setErrorMsg('Payment failed. Please try again.');
        }
    }, [walletError]);

    // Polling: once txHash exists, poll /spawn/status until confirmed or 2-minute timeout
    useEffect(() => {
        if (!txHash) return;
        setUiState('confirming');
        let cancelled = false;
        const startMs = Date.now();
        const POLL_MS = 3000;
        const TIMEOUT_MS = 120_000;

        const tick = async () => {
            if (cancelled) return;
            try {
                const r = await fetch(
                    `${GRID_BASE}/api/v1/portal/nous/spawn/status/${txHash}`,
                    { credentials: 'include' },
                );
                const data = await r.json() as { confirmed: boolean };
                if (data.confirmed) {
                    if (cancelled) return;
                    setUiState('spawning');
                    // POST spawn
                    const spawnRes = await fetch(`${GRID_BASE}/api/v1/portal/nous/spawn`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, seed, region, tx_hash: txHash }),
                    });
                    if (spawnRes.status === 200) {
                        onSuccess();
                    } else if (spawnRes.status === 503) {
                        setUiState('spawn_not_enabled');
                    } else if (spawnRes.status === 409) {
                        const body = await spawnRes.json() as { error: string };
                        if (body.error === 'already_owns_nous') {
                            setUiState('error_already_owns');
                            setTimeout(onAlreadyOwns, 2000);
                        } else {
                            setUiState('error_payment_failed');
                            setErrorMsg('Spawn failed. ' + body.error);
                        }
                    } else {
                        setUiState('error_payment_failed');
                        setErrorMsg('Spawn failed. Please try again.');
                    }
                    return;
                }
            } catch { /* swallow and retry */ }

            if (Date.now() - startMs >= TIMEOUT_MS) {
                if (!cancelled) {
                    setUiState('error_timeout');
                    setErrorMsg('Payment confirmation timed out. Please try again.');
                }
                return;
            }
            setTimeout(tick, POLL_MS);
        };

        setTimeout(tick, POLL_MS);
        return () => { cancelled = true; };
    }, [txHash, name, seed, region, onSuccess, onAlreadyOwns]);

    if (uiState === 'spawn_not_enabled') {
        return (
            <div className="noesis-card" style={{ padding: 32, textAlign: 'center' }}>
                <h2 style={{
                    fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600,
                    color: 'var(--ink)', marginBottom: 8,
                }}>
                    Coming Soon
                </h2>
                <p style={{
                    fontFamily: 'var(--sans-portal)', fontSize: 13,
                    color: 'var(--muted)', lineHeight: 1.6,
                }}>
                    Personal Nous spawning is not yet enabled on this Grid. Check back soon.
                </p>
            </div>
        );
    }

    const isConfirming = uiState === 'confirming' || uiState === 'spawning';
    const canPay = treasury !== null && uiState !== 'paying' && !walletPending;
    const showButtons = uiState === 'idle' || uiState === 'paying'
        || uiState === 'error_timeout' || uiState === 'error_payment_failed';

    return (
        <div className="noesis-card" style={{ padding: 24 }}>
            <h2 style={{
                fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600,
                color: 'var(--ink)', marginBottom: 16,
            }}>
                Confirm &amp; Pay
            </h2>

            <WizardSummaryCard
                name={name}
                seed={seed}
                region={region}
                costUsdt={costUsdt}
            />

            <p style={{
                fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)',
                lineHeight: 1.6, marginBottom: 24,
            }}>
                Payment is sent on-chain to the Noēsis treasury. Spawning begins after confirmation (≤ 2 minutes).
            </p>

            {isConfirming && (
                <PaymentPolling
                    status={uiState === 'spawning' ? 'Spawning your Nous…' : 'Confirming payment…'}
                />
            )}

            {(uiState === 'error_timeout' || uiState === 'error_payment_failed') && errorMsg && (
                <div style={{
                    padding: 16, background: 'var(--parchment-2)',
                    border: '1px solid var(--rule)', borderRadius: 8, marginBottom: 16,
                    color: 'var(--terracotta)',
                    fontFamily: 'var(--sans-portal)', fontSize: 13,
                }}>
                    {errorMsg}
                </div>
            )}

            {uiState === 'error_already_owns' && (
                <div style={{
                    padding: 16, background: 'var(--parchment-2)',
                    border: '1px solid var(--rule)', borderRadius: 8, marginBottom: 16,
                    color: 'var(--terracotta)',
                    fontFamily: 'var(--sans-portal)', fontSize: 13,
                }}>
                    You already have a Nous. Taking you there now.
                </div>
            )}

            {showButtons && (
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--rule)',
                }}>
                    <button
                        type="button"
                        onClick={onBack}
                        disabled={uiState === 'paying'}
                        style={{
                            padding: '8px 20px', borderRadius: 8,
                            border: '1px solid var(--rule)',
                            background: 'transparent',
                            fontFamily: 'var(--sans-portal)', fontSize: 16,
                            fontWeight: 600, color: 'var(--muted)',
                            cursor: uiState === 'paying' ? 'not-allowed' : 'pointer',
                            minHeight: 44,
                        }}
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        onClick={handlePay}
                        disabled={!canPay}
                        style={{
                            padding: '8px 24px', borderRadius: 8, border: 'none',
                            background: 'var(--terracotta-2)', color: '#fff',
                            fontFamily: 'var(--sans-portal)', fontSize: 16, fontWeight: 600,
                            cursor: canPay ? 'pointer' : 'not-allowed',
                            minHeight: 44,
                            opacity: canPay ? 1 : 0.4,
                        }}
                    >
                        Spawn Nous
                    </button>
                </div>
            )}
        </div>
    );
}
