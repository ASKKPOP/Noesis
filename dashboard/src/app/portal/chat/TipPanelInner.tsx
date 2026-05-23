'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { mainnet } from 'wagmi/chains';

// ── Constants (copied verbatim from WalletPanel.tsx) ──────────────────────────

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
    {
        name: 'transfer',
        type: 'function' as const,
        stateMutability: 'nonpayable' as const,
        inputs:  [{ name: 'to', type: 'address' as const }, { name: 'amount', type: 'uint256' as const }],
        outputs: [{ type: 'bool' as const }],
    },
] as const;

// ── Props ─────────────────────────────────────────────────────────────────────

interface TipPanelInnerProps {
    nousId: string;
    onClose: () => void;
    onTipConfirmed: (amount: number) => void;
}

const PRESETS = [1, 5, 10] as const;

const NOUS_NAMES: Record<string, string> = {
    sophia: 'Sophia',
    hermes: 'Hermes',
    themis: 'Themis',
};

// ── Treasury address ──────────────────────────────────────────────────────────

// T-27-12: MetaMask shows destination + amount to user before confirmation.
const TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_NOUS_TREASURY_ADDRESS ?? '0x0000000000000000000000000000000000000001') as `0x${string}`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function TipPanelInner({ nousId, onClose, onTipConfirmed }: TipPanelInnerProps) {
    const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
    const [customAmount, setCustomAmount] = useState('');
    const [tipError, setTipError] = useState<string | null>(null);

    const { writeContract, data: usdtTxHash, isPending } = useWriteContract();
    const { isSuccess, isError } = useWaitForTransactionReceipt({ hash: usdtTxHash });

    const selectedAmount = selectedPreset ?? (customAmount ? parseFloat(customAmount) : null);

    // T-27-14: isPending disables Confirm after first click (DoS mitigation)
    useEffect(() => {
        if (isSuccess && selectedAmount !== null) {
            onTipConfirmed(selectedAmount);
            onClose();
        }
    }, [isSuccess, selectedAmount, onTipConfirmed, onClose]);

    useEffect(() => {
        if (isError) {
            setTipError('Transaction failed — please try again.');
        }
    }, [isError]);

    function handleConfirm() {
        if (!selectedAmount || selectedAmount <= 0) {
            setTipError('Select an amount to tip.');
            return;
        }
        setTipError(null);
        writeContract({
            address: USDT_ADDR[mainnet.id],
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [TREASURY_ADDRESS, parseUnits(String(selectedAmount), 6)],
        });
    }

    const nousName = NOUS_NAMES[nousId] ?? nousId;

    return (
        <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            background: 'var(--parchment)',
            borderTop: '1px solid var(--rule)',
            padding: '24px 16px 16px',
            boxShadow: '0 -4px 20px rgba(11,18,32,0.08)',
            zIndex: 10,
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
            }}>
                <div style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 18,
                    fontWeight: 600,
                    color: 'var(--ink)',
                }}>
                    Send Tip to {nousName}
                </div>
                <button
                    onClick={onClose}
                    aria-label="Close tip panel"
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--muted)',
                        fontSize: 20,
                        padding: '0 4px',
                        lineHeight: 1,
                    }}
                >
                    ×
                </button>
            </div>

            {/* Preset amounts */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {PRESETS.map(preset => (
                    <button
                        key={preset}
                        onClick={() => { setSelectedPreset(preset); setCustomAmount(''); setTipError(null); }}
                        style={{
                            flex: 1,
                            padding: '10px 0',
                            borderRadius: 6,
                            border: '1px solid',
                            borderColor: selectedPreset === preset ? 'var(--terracotta)' : 'var(--rule)',
                            background: selectedPreset === preset ? 'var(--terracotta)' : 'transparent',
                            color: selectedPreset === preset ? '#faf6ec' : 'var(--ink)',
                            fontFamily: 'var(--sans-portal)',
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.12s',
                        }}
                    >
                        {preset} USDT
                    </button>
                ))}
            </div>

            {/* Custom amount */}
            <input
                type="number"
                min="0"
                step="any"
                placeholder="Custom amount (USDT)"
                value={customAmount}
                onChange={e => { setCustomAmount(e.target.value); setSelectedPreset(null); setTipError(null); }}
                style={{
                    width: '100%',
                    background: 'var(--vellum)',
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 15,
                    color: 'var(--ink)',
                    outline: 'none',
                    boxSizing: 'border-box',
                    marginBottom: 12,
                }}
            />

            {/* Error */}
            {tipError && (
                <div style={{
                    padding: '8px 12px',
                    background: 'rgba(184,50,50,0.08)',
                    border: '1px solid rgba(184,50,50,0.22)',
                    borderRadius: 4,
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: '#b83232',
                    marginBottom: 12,
                }}>
                    {tipError}
                </div>
            )}

            {/* Confirm button */}
            <button
                onClick={handleConfirm}
                disabled={isPending}
                style={{
                    width: '100%',
                    background: isPending ? 'rgba(184,84,47,0.60)' : 'var(--terracotta)',
                    color: '#faf6ec',
                    border: 'none',
                    borderRadius: 6,
                    padding: '12px 0',
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: isPending ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                }}
            >
                {isPending ? 'Confirm in wallet…' : 'Confirm Tip'}
            </button>
        </div>
    );
}
