'use client';

/**
 * WalletPanel — Phase 23 Cyber Coin Wallet.
 *
 * Displays on-chain ETH and USDT balances for the connected wallet,
 * provides a send form, and tracks the session's transaction history.
 *
 * Architecture:
 *  - useBalance / useReadContract   → balances (no custody)
 *  - useSendTransaction             → ETH transfer
 *  - useWriteContract               → USDT ERC-20 transfer
 *  - useWaitForTransactionReceipt   → confirmation status
 *  - notifyGrid()                   → best-effort human.transferred event
 */

import { useState, useEffect, useRef } from 'react';
import {
    useAccount, useBalance, useReadContract,
    useSendTransaction, useWriteContract, useWaitForTransactionReceipt,
} from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { parseEther, parseUnits, formatEther, formatUnits, isAddress } from 'viem';

// ── Constants ─────────────────────────────────────────────────────────────────

/** USDT ERC-20 contract address per chain. */
const USDT_ADDR: Record<number, `0x${string}`> = {
    [mainnet.id]: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
};

/** Minimal ERC-20 ABI — balanceOf + transfer only. */
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

// ── Types ─────────────────────────────────────────────────────────────────────

type Asset = 'ETH' | 'USDT';

interface TxRecord {
    hash:   string;
    to:     string;
    amount: string;
    asset:  Asset;
    ts:     number;
    status: 'pending' | 'confirmed' | 'failed';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEth(v: bigint | undefined): string {
    if (v === undefined) return '—';
    const n = parseFloat(formatEther(v));
    return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function fmtUsdt(v: bigint | undefined): string {
    if (v === undefined) return '—';
    const n = parseFloat(formatUnits(v, 6));
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncAddr(addr: string): string {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtTs(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/** Best-effort Grid notification — fires human.transferred on backend. */
async function notifyGrid(to: string, amount: string, asset: string): Promise<void> {
    const gridBase = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
    try {
        await fetch(`${gridBase}/api/v1/portal/wallet/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ to, amount, asset }),
        });
    } catch {
        // Non-blocking — on-chain transfer already happened
    }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BalanceCard({ label, value, unit, loading, sub }: {
    label:   string;
    value:   string;
    unit:    string;
    loading: boolean;
    sub?:    string;
}) {
    return (
        <div style={{
            flex: 1,
            background: 'var(--parchment)',
            border: '1px solid var(--rule)',
            borderRadius: 6,
            padding: '20px 20px 18px',
        }}>
            <div style={{
                fontFamily: 'var(--mono-portal)',
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--bronze)',
                marginBottom: 10,
            }}>
                {label}
            </div>
            {loading ? (
                <div style={{
                    height: 28,
                    width: 100,
                    borderRadius: 4,
                    background: 'var(--parchment-2)',
                    animation: 'portal-pulse 1.4s ease-in-out infinite',
                }} />
            ) : (
                <div style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 26,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    lineHeight: 1.1,
                    letterSpacing: '0.01em',
                }}>
                    {value}
                    <span style={{ fontSize: 14, fontFamily: 'var(--sans-portal)', fontWeight: 500, marginLeft: 6, color: 'var(--muted)' }}>
                        {unit}
                    </span>
                </div>
            )}
            {sub && (
                <div style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 11,
                    color: 'var(--muted)',
                    marginTop: 4,
                }}>
                    {sub}
                </div>
            )}
        </div>
    );
}

function TxRow({ tx }: { tx: TxRecord }) {
    const statusColor = tx.status === 'confirmed' ? '#4ade80' : tx.status === 'failed' ? '#f87171' : 'var(--bronze)';
    const statusLabel = tx.status === 'confirmed' ? '✓' : tx.status === 'failed' ? '✗' : '↑';

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 0',
            borderBottom: '1px solid var(--rule)',
        }}>
            <span style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: `${statusColor}18`,
                border: `1px solid ${statusColor}55`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: statusColor,
                flexShrink: 0,
                fontFamily: 'var(--mono-portal)',
            }}>
                {statusLabel}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--ink)',
                    fontWeight: 500,
                    marginBottom: 1,
                }}>
                    {tx.amount} {tx.asset}
                    <span style={{ fontWeight: 400, color: 'var(--muted)' }}>{' → '}{truncAddr(tx.to)}</span>
                </div>
                <div style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 10,
                    color: 'var(--muted)',
                }}>
                    {fmtTs(tx.ts)} · {truncAddr(tx.hash)}
                </div>
            </div>
            <span style={{
                fontFamily: 'var(--mono-portal)',
                fontSize: 9,
                letterSpacing: '0.10em',
                color: statusColor,
                textTransform: 'uppercase',
                flexShrink: 0,
            }}>
                {tx.status}
            </span>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--vellum)',
    border: '1px solid var(--rule)',
    borderRadius: 4,
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'var(--sans-portal)',
    color: 'var(--ink)',
    outline: 'none',
    boxSizing: 'border-box',
};

export function WalletPanel() {
    const { address, chain, isConnected } = useAccount();

    // ── Balances ──────────────────────────────────────────────────────────────

    const { data: ethBal, isLoading: ethLoading } = useBalance({ address });

    const usdtAddr = chain?.id ? USDT_ADDR[chain.id] : undefined;
    const { data: usdtRaw } = useReadContract({
        address: usdtAddr,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        query: { enabled: !!usdtAddr && !!address },
    });

    // ── Send state ────────────────────────────────────────────────────────────

    const [asset, setAsset] = useState<Asset>('ETH');
    const [toAddr, setToAddr] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [sendErr, setSendErr] = useState<string | null>(null);
    const [txRecords, setTxRecords] = useState<TxRecord[]>([]);

    // Track pending send params (to correlate hash → record)
    const pendingSend = useRef<{ to: string; amount: string; asset: Asset } | null>(null);

    // ETH path
    const {
        sendTransaction,
        data:      ethTxHash,
        isPending: sendingEth,
        error:     ethSendErr,
        reset:     resetEth,
    } = useSendTransaction();

    const { isLoading: waitingEth, isSuccess: ethSuccess, isError: ethFailed } =
        useWaitForTransactionReceipt({ hash: ethTxHash });

    // USDT path
    const {
        writeContract,
        data:      usdtTxHash,
        isPending: sendingUsdt,
        error:     usdtSendErr,
        reset:     resetUsdt,
    } = useWriteContract();

    const { isLoading: waitingUsdt, isSuccess: usdtSuccess, isError: usdtFailed } =
        useWaitForTransactionReceipt({ hash: usdtTxHash });

    // Add ETH tx to history when hash appears
    useEffect(() => {
        if (!ethTxHash || !pendingSend.current) return;
        const s = pendingSend.current;
        setTxRecords(prev => [
            { hash: ethTxHash, to: s.to, amount: s.amount, asset: 'ETH', ts: Date.now(), status: 'pending' },
            ...prev,
        ]);
    }, [ethTxHash]);

    // Add USDT tx to history when hash appears
    useEffect(() => {
        if (!usdtTxHash || !pendingSend.current) return;
        const s = pendingSend.current;
        setTxRecords(prev => [
            { hash: usdtTxHash, to: s.to, amount: s.amount, asset: 'USDT', ts: Date.now(), status: 'pending' },
            ...prev,
        ]);
    }, [usdtTxHash]);

    // ETH confirmation/failure
    useEffect(() => {
        if (!ethTxHash) return;
        if (ethSuccess) {
            setTxRecords(prev => prev.map(r => r.hash === ethTxHash ? { ...r, status: 'confirmed' } : r));
            const s = pendingSend.current;
            if (s) void notifyGrid(s.to, s.amount, 'ETH');
            pendingSend.current = null;
        }
        if (ethFailed) {
            setTxRecords(prev => prev.map(r => r.hash === ethTxHash ? { ...r, status: 'failed' } : r));
            pendingSend.current = null;
        }
    }, [ethSuccess, ethFailed, ethTxHash]);

    // USDT confirmation/failure
    useEffect(() => {
        if (!usdtTxHash) return;
        if (usdtSuccess) {
            setTxRecords(prev => prev.map(r => r.hash === usdtTxHash ? { ...r, status: 'confirmed' } : r));
            const s = pendingSend.current;
            if (s) void notifyGrid(s.to, s.amount, 'USDT');
            pendingSend.current = null;
        }
        if (usdtFailed) {
            setTxRecords(prev => prev.map(r => r.hash === usdtTxHash ? { ...r, status: 'failed' } : r));
            pendingSend.current = null;
        }
    }, [usdtSuccess, usdtFailed, usdtTxHash]);

    // Surface wagmi errors
    useEffect(() => {
        const err = ethSendErr ?? usdtSendErr;
        if (!err) return;
        // Trim long viem error messages to the first line
        setSendErr(err.message.split('\n')[0].slice(0, 120));
    }, [ethSendErr, usdtSendErr]);

    // ── Send handler ──────────────────────────────────────────────────────────

    function handleSend() {
        setSendErr(null);

        if (!isAddress(toAddr)) {
            setSendErr('Invalid Ethereum address');
            return;
        }
        const amt = parseFloat(amountStr);
        if (!amountStr || isNaN(amt) || amt <= 0) {
            setSendErr('Enter a valid amount greater than 0');
            return;
        }

        resetEth();
        resetUsdt();
        pendingSend.current = { to: toAddr, amount: amountStr, asset };

        if (asset === 'ETH') {
            try {
                sendTransaction({ to: toAddr as `0x${string}`, value: parseEther(amountStr) });
            } catch {
                setSendErr('Transaction rejected');
                pendingSend.current = null;
            }
        } else {
            if (!usdtAddr) {
                setSendErr('USDT not supported on this network');
                pendingSend.current = null;
                return;
            }
            try {
                writeContract({
                    address: usdtAddr,
                    abi: ERC20_ABI,
                    functionName: 'transfer',
                    args: [toAddr as `0x${string}`, parseUnits(amountStr, 6)],
                });
            } catch {
                setSendErr('Transaction rejected');
                pendingSend.current = null;
            }
        }
    }

    const isSending = sendingEth || sendingUsdt || waitingEth || waitingUsdt;

    // ── Not connected ─────────────────────────────────────────────────────────

    if (!isConnected || !address) {
        return (
            <div style={{ padding: '36px 40px', maxWidth: 580 }}>
                <h1 style={{ fontFamily: 'var(--serif)', fontSize: 30, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                    Wallet
                </h1>
                <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)', marginBottom: 32 }}>
                    On-chain balances, Cyber Coin, and transaction history.
                </p>
                <div style={{
                    background: 'var(--parchment)',
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    padding: '40px 32px',
                    textAlign: 'center',
                }}>
                    <p style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                        No wallet connected
                    </p>
                    <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                        Connect your Ethereum wallet via the Sign In page to view your Cyber Coin balances.
                    </p>
                    <a href="/portal/auth" style={{
                        display: 'inline-block',
                        marginTop: 20,
                        background: 'var(--terracotta)',
                        color: '#faf6ec',
                        borderRadius: 4,
                        padding: '9px 22px',
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'var(--sans-portal)',
                        textDecoration: 'none',
                    }}>
                        Sign In
                    </a>
                </div>
            </div>
        );
    }

    // ── Connected ─────────────────────────────────────────────────────────────

    return (
        <div style={{ padding: '36px 40px', maxWidth: 640 }}>

            {/* ── Header ── */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 30,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    letterSpacing: '0.01em',
                    lineHeight: 1.15,
                    marginBottom: 6,
                }}>
                    Wallet
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                        fontFamily: 'var(--mono-portal)',
                        fontSize: 11,
                        color: 'var(--muted)',
                    }}>
                        {address}
                    </span>
                    {chain && (
                        <span style={{
                            fontFamily: 'var(--mono-portal)',
                            fontSize: 9,
                            fontWeight: 600,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            color: 'var(--bronze)',
                            background: 'var(--parchment)',
                            border: '1px solid var(--rule)',
                            borderRadius: 3,
                            padding: '2px 7px',
                        }}>
                            {chain.name}
                        </span>
                    )}
                </div>
            </div>

            {/* ── Balance cards ── */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
                <BalanceCard
                    label="Ethereum"
                    value={fmtEth(ethBal?.value)}
                    unit="ETH"
                    loading={ethLoading}
                />
                <BalanceCard
                    label="Tether USD"
                    value={usdtAddr ? fmtUsdt(usdtRaw as bigint | undefined) : 'N/A'}
                    unit="USDT"
                    loading={false}
                    sub={!usdtAddr ? `Not on ${chain?.name ?? 'this network'}` : undefined}
                />
            </div>

            {/* ── Send ── */}
            <div style={{
                background: 'var(--parchment)',
                border: '1px solid var(--rule)',
                borderRadius: 6,
                padding: '24px 24px 20px',
                marginBottom: 24,
            }}>
                <div style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--bronze)',
                    marginBottom: 16,
                }}>
                    Send Cyber Coin
                </div>

                {/* Asset tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                    {(['ETH', 'USDT'] as Asset[]).map(a => (
                        <button
                            key={a}
                            onClick={() => { setAsset(a); setSendErr(null); }}
                            style={{
                                padding: '6px 16px',
                                borderRadius: 4,
                                border: '1px solid',
                                borderColor: asset === a ? 'var(--terracotta)' : 'var(--rule)',
                                background: asset === a ? 'var(--terracotta)' : 'transparent',
                                color: asset === a ? '#faf6ec' : 'var(--muted)',
                                fontFamily: 'var(--mono-portal)',
                                fontSize: 11,
                                fontWeight: 600,
                                letterSpacing: '0.10em',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                        >
                            {a}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Recipient */}
                    <input
                        type="text"
                        placeholder="Recipient address (0x…)"
                        value={toAddr}
                        onChange={e => { setToAddr(e.target.value); setSendErr(null); }}
                        disabled={isSending}
                        style={{ ...inputStyle, opacity: isSending ? 0.6 : 1, fontFamily: 'var(--mono-portal)', fontSize: 12 }}
                    />

                    {/* Amount row */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            type="number"
                            placeholder={`Amount (${asset})`}
                            value={amountStr}
                            onChange={e => { setAmountStr(e.target.value); setSendErr(null); }}
                            min="0"
                            step="any"
                            disabled={isSending}
                            style={{ ...inputStyle, flex: 1, opacity: isSending ? 0.6 : 1 }}
                        />
                        {/* MAX button for ETH */}
                        {asset === 'ETH' && ethBal && (
                            <button
                                onClick={() => setAmountStr(formatEther(ethBal.value))}
                                disabled={isSending}
                                style={{
                                    padding: '0 14px',
                                    borderRadius: 4,
                                    border: '1px solid var(--rule)',
                                    background: 'transparent',
                                    color: 'var(--muted)',
                                    fontFamily: 'var(--mono-portal)',
                                    fontSize: 10,
                                    fontWeight: 600,
                                    letterSpacing: '0.10em',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                MAX
                            </button>
                        )}
                    </div>

                    {/* Error */}
                    {sendErr && (
                        <div style={{
                            padding: '8px 12px',
                            background: 'rgba(184,50,50,0.08)',
                            border: '1px solid rgba(184,50,50,0.22)',
                            borderRadius: 4,
                            fontFamily: 'var(--mono-portal)',
                            fontSize: 11,
                            color: '#b83232',
                        }}>
                            {sendErr}
                        </div>
                    )}

                    {/* Send button */}
                    <button
                        onClick={handleSend}
                        disabled={isSending}
                        style={{
                            background: isSending ? 'rgba(184,84,47,0.60)' : 'var(--terracotta)',
                            color: '#faf6ec',
                            border: 'none',
                            borderRadius: 4,
                            padding: '11px 20px',
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: 'var(--sans-portal)',
                            cursor: isSending ? 'not-allowed' : 'pointer',
                            transition: 'background 0.15s',
                            alignSelf: 'flex-start',
                        }}
                    >
                        {sendingEth || sendingUsdt
                            ? 'Confirm in wallet…'
                            : waitingEth || waitingUsdt
                                ? 'Confirming on-chain…'
                                : `Send ${asset}`}
                    </button>
                </div>
            </div>

            {/* ── Transaction history ── */}
            {txRecords.length > 0 && (
                <div style={{
                    background: 'var(--parchment)',
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    padding: '20px 24px',
                }}>
                    <div style={{
                        fontFamily: 'var(--mono-portal)',
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'var(--bronze)',
                        marginBottom: 12,
                    }}>
                        Recent Transactions
                    </div>
                    {txRecords.map(tx => <TxRow key={tx.hash} tx={tx} />)}
                </div>
            )}
        </div>
    );
}
