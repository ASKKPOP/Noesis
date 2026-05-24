'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface Trade {
    actorDid: string;
    counterparty: string;
    amount: number;
    nonce: number;
    timestamp: string;
}

interface Listing {
    sku: string;
    label: string;
    priceOusia: number;
}

interface Shop {
    ownerDid: string;
    name: string;
    listings: Listing[];
}

function truncateDid(did: string): string {
    if (did.length <= 20) return did;
    return did.slice(0, 10) + '…' + did.slice(-8);
}

function formatDate(ts: string): string {
    try {
        return new Date(ts).toLocaleString();
    } catch {
        return ts;
    }
}

const LIMIT = 20;

export default function EconomyPage() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [tradesTotal, setTradesTotal] = useState(0);
    const [tradesOffset, setTradesOffset] = useState(0);
    const [tradesLoading, setTradesLoading] = useState(true);
    const [tradesError, setTradesError] = useState<string | null>(null);

    const [shops, setShops] = useState<Shop[]>([]);
    const [shopsLoading, setShopsLoading] = useState(true);
    const [shopsError, setShopsError] = useState<string | null>(null);

    async function fetchTrades(offset: number) {
        setTradesLoading(true);
        setTradesError(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/economy/trades?limit=${LIMIT}&offset=${offset}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setTrades(Array.isArray(data) ? data : data.trades ?? []);
            setTradesTotal(data.total ?? 0);
        } catch (e) {
            setTradesError(e instanceof Error ? e.message : 'Failed to fetch trades');
        } finally {
            setTradesLoading(false);
        }
    }

    async function fetchShops() {
        setShopsLoading(true);
        setShopsError(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/economy/shops`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setShops(Array.isArray(data) ? data : data.shops ?? []);
        } catch (e) {
            setShopsError(e instanceof Error ? e.message : 'Failed to fetch shops');
        } finally {
            setShopsLoading(false);
        }
    }

    useEffect(() => {
        fetchTrades(0);
        fetchShops();
    }, []);

    function goToPage(newOffset: number) {
        setTradesOffset(newOffset);
        fetchTrades(newOffset);
    }

    return (
        <StewardShell title="Economy" breadcrumb="Steward · Economy">
            {/* Trades section */}
            <div className="steward-card" style={{ marginBottom: 32 }}>
                <div
                    style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid var(--rule)',
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: 12,
                    }}
                >
                    <h2
                        style={{
                            fontFamily: 'var(--serif)',
                            fontSize: 20,
                            fontWeight: 400,
                            color: 'var(--ink)',
                        }}
                    >
                        Trades
                    </h2>
                    {!tradesLoading && !tradesError && (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                            {tradesOffset + 1}–{Math.min(tradesOffset + LIMIT, tradesTotal)} of {tradesTotal}
                        </span>
                    )}
                </div>

                {tradesError ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Could not load trades: {tradesError}
                    </div>
                ) : tradesLoading ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Loading trades…
                    </div>
                ) : trades.length === 0 ? (
                    <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                        No trades recorded yet.
                    </div>
                ) : (
                    <>
                        <table>
                            <thead>
                                <tr>
                                    <th>Actor DID</th>
                                    <th>Counterparty</th>
                                    <th>Amount</th>
                                    <th>Nonce</th>
                                    <th>Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trades.map((t, i) => (
                                    <tr key={i}>
                                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }} title={t.actorDid}>
                                            {truncateDid(t.actorDid)}
                                        </td>
                                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }} title={t.counterparty}>
                                            {truncateDid(t.counterparty)}
                                        </td>
                                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                                            {t.amount.toLocaleString()}
                                        </td>
                                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                                            {t.nonce}
                                        </td>
                                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                                            {formatDate(t.timestamp)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        <div
                            style={{
                                padding: '12px 20px',
                                borderTop: '1px solid var(--rule)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                            }}
                        >
                            <button
                                onClick={() => goToPage(Math.max(0, tradesOffset - LIMIT))}
                                disabled={tradesOffset === 0}
                                style={{
                                    background: 'none',
                                    border: '1px solid var(--rule)',
                                    borderRadius: 4,
                                    padding: '4px 12px',
                                    fontFamily: 'var(--sans)',
                                    fontSize: 12,
                                    color: tradesOffset === 0 ? 'var(--rule)' : 'var(--muted)',
                                    cursor: tradesOffset === 0 ? 'not-allowed' : 'pointer',
                                }}
                            >
                                ← Prev
                            </button>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                                {tradesOffset + 1}–{Math.min(tradesOffset + LIMIT, tradesTotal)} of {tradesTotal}
                            </span>
                            <button
                                onClick={() => goToPage(tradesOffset + LIMIT)}
                                disabled={tradesOffset + LIMIT >= tradesTotal}
                                style={{
                                    background: 'none',
                                    border: '1px solid var(--rule)',
                                    borderRadius: 4,
                                    padding: '4px 12px',
                                    fontFamily: 'var(--sans)',
                                    fontSize: 12,
                                    color: tradesOffset + LIMIT >= tradesTotal ? 'var(--rule)' : 'var(--muted)',
                                    cursor: tradesOffset + LIMIT >= tradesTotal ? 'not-allowed' : 'pointer',
                                }}
                            >
                                Next →
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Shops section */}
            <div
                style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 24,
                    fontWeight: 400,
                    color: 'var(--ink)',
                    marginBottom: 16,
                }}
            >
                Shops
            </div>

            {shopsError ? (
                <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    Could not load shops: {shopsError}
                </div>
            ) : shopsLoading ? (
                <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    Loading shops…
                </div>
            ) : shops.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'center', padding: '32px 0' }}>
                    No shops registered yet.
                </div>
            ) : (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 16,
                    }}
                >
                    {shops.map((shop, i) => (
                        <div key={i} className="steward-card">
                            <div
                                style={{
                                    padding: '14px 18px',
                                    borderBottom: '1px solid var(--rule)',
                                }}
                            >
                                <div
                                    style={{
                                        fontFamily: 'var(--serif)',
                                        fontSize: 17,
                                        fontWeight: 400,
                                        color: 'var(--ink)',
                                        marginBottom: 4,
                                    }}
                                >
                                    {shop.name}
                                </div>
                                <div
                                    style={{
                                        fontFamily: 'var(--mono)',
                                        fontSize: 10,
                                        color: 'var(--muted)',
                                    }}
                                    title={shop.ownerDid}
                                >
                                    {truncateDid(shop.ownerDid)}
                                </div>
                            </div>
                            {shop.listings && shop.listings.length > 0 ? (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>SKU</th>
                                            <th>Label</th>
                                            <th>Price (ousia)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shop.listings.map((l, j) => (
                                            <tr key={j}>
                                                <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                                                    {l.sku}
                                                </td>
                                                <td style={{ fontSize: 13 }}>{l.label}</td>
                                                <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                                                    {l.priceOusia.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ padding: '16px 18px', color: 'var(--muted)', fontSize: 12, fontFamily: 'var(--mono)' }}>
                                    No listings.
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </StewardShell>
    );
}
