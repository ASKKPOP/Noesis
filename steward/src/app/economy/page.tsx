'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface Listing {
    listing_id: string;
    seller_civic_did: string;
    seller_business_did: string;
    title: string;
    description: string;
    price_bios: string;
    category: string;
    created_at_tick: number;
    expires_at_tick: number;
    reputation_score: number;
}

const CATEGORIES = ['tools', 'data', 'services', 'goods', 'media', 'other'];

export default function EconomyPage() {
    // Listings state
    const [listings, setListings] = useState<Listing[]>([]);
    const [listingsLoading, setListingsLoading] = useState(true);
    const [listingsError, setListingsError] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [maxPrice, setMaxPrice] = useState<string>('');
    const [offset, setOffset] = useState(0);
    const LIMIT = 20;

    // Business-DID gate
    const [businessDid, setBusinessDid] = useState<string | null>(null);
    const [businessDidLoading, setBusinessDidLoading] = useState(true);

    // Create form state
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const [formCategory, setFormCategory] = useState('tools');
    const [formExpiresDays, setFormExpiresDays] = useState('30');
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [formMessage, setFormMessage] = useState<string | null>(null);

    async function fetchListings(nextOffset = 0) {
        setListingsLoading(true);
        setListingsError(null);
        try {
            const params = new URLSearchParams({ limit: String(LIMIT), offset: String(nextOffset) });
            if (categoryFilter) params.set('category', categoryFilter);
            if (maxPrice) params.set('max_price', maxPrice);
            const res = await fetch(`${GRID_ORIGIN}/api/v1/market/listings?${params}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setListings(data.listings ?? []);
            setOffset(nextOffset);
        } catch (e) {
            setListingsError(e instanceof Error ? e.message : 'Failed to fetch listings');
        } finally {
            setListingsLoading(false);
        }
    }

    async function fetchBusinessDid() {
        setBusinessDidLoading(true);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/operator/me/nous`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setBusinessDid(typeof data.business_did === 'string' ? data.business_did : null);
            } else {
                setBusinessDid(null);
            }
        } catch {
            setBusinessDid(null);
        } finally {
            setBusinessDidLoading(false);
        }
    }

    useEffect(() => {
        void fetchListings(0);
        void fetchBusinessDid();
    }, []);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setFormSubmitting(true);
        setFormMessage(null);
        try {
            const TICKS_PER_SECOND = 2;
            const expiresInTicks = Number.parseInt(formExpiresDays, 10) * 86400 * TICKS_PER_SECOND;
            const res = await fetch(`${GRID_ORIGIN}/api/v1/market/listing/create`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formTitle,
                    description: formDescription,
                    price_bios: formPrice,
                    category: formCategory,
                    expires_in_ticks: expiresInTicks,
                }),
            });
            if (res.status === 201) {
                const data = await res.json();
                setFormMessage(`Listing posted: ${data.listing_id}`);
                setFormTitle('');
                setFormDescription('');
                setFormPrice('');
                void fetchListings(0);
            } else if (res.status === 403) {
                setFormMessage('Business-DID required');
            } else if (res.status === 401) {
                setFormMessage('Authentication required — please sign in');
            } else {
                const body = await res.json().catch(() => ({}));
                setFormMessage(`Error: ${body.error ?? `HTTP ${res.status}`}`);
            }
        } catch (e) {
            setFormMessage(`Network error: ${e instanceof Error ? e.message : 'unknown'}`);
        } finally {
            setFormSubmitting(false);
        }
    }

    function reputationCellColor(score: number): string {
        if (score >= 0.8) return '#1d6a3e';
        if (score >= 0.5) return '#a4690a';
        return '#9b1d1d';
    }

    return (
        <StewardShell title="Economy" breadcrumb="Steward · Economy">
            {/* ───── Listings section ───── */}
            <div className="steward-card" style={{ marginBottom: 32 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)', margin: 0 }}>
                        Civic Marketplace · Listings
                    </h2>
                    <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
                        Browse active listings. Bios prices reflect a 2% IRS fee at settlement.
                    </p>
                </div>
                {/* Filters */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--rule)', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <label style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Category{' '}
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                            <option value="">(any)</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </label>
                    <label style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Max price (Bios){' '}
                        <input type="number" min="1" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} style={{ width: 100 }} />
                    </label>
                    <button onClick={() => void fetchListings(0)} style={{ marginLeft: 'auto' }}>Apply</button>
                </div>
                {/* Table */}
                {listingsLoading ? (
                    <div style={{ padding: '32px 20px', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>Loading listings…</div>
                ) : listingsError ? (
                    <div style={{ padding: '32px 20px', color: '#9b1d1d', fontFamily: 'var(--mono)' }}>Error: {listingsError}</div>
                ) : listings.length === 0 ? (
                    <div style={{ padding: '32px 20px', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>No active listings.</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                                <th style={{ textAlign: 'left', padding: '8px 20px', fontFamily: 'var(--mono)', fontSize: 11 }}>TITLE</th>
                                <th style={{ textAlign: 'left', padding: '8px 20px', fontFamily: 'var(--mono)', fontSize: 11 }}>CATEGORY</th>
                                <th style={{ textAlign: 'right', padding: '8px 20px', fontFamily: 'var(--mono)', fontSize: 11 }}>PRICE (BIOS)</th>
                                <th style={{ textAlign: 'right', padding: '8px 20px', fontFamily: 'var(--mono)', fontSize: 11 }}>SELLER REPUTATION</th>
                                <th style={{ textAlign: 'right', padding: '8px 20px', fontFamily: 'var(--mono)', fontSize: 11 }}>EXPIRES (TICK)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {listings.map(l => (
                                <tr key={l.listing_id} style={{ borderBottom: '1px solid var(--rule)' }}>
                                    <td style={{ padding: '8px 20px', fontFamily: 'var(--sans)' }}>{l.title}</td>
                                    <td style={{ padding: '8px 20px', fontFamily: 'var(--mono)', fontSize: 12 }}>{l.category}</td>
                                    <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{l.price_bios}</td>
                                    <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--mono)', color: reputationCellColor(l.reputation_score) }}>
                                        {(l.reputation_score * 100).toFixed(1)}%
                                    </td>
                                    <td style={{ padding: '8px 20px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{l.expires_at_tick}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {/* Pagination */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--rule)', display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                        Showing {listings.length} listing{listings.length === 1 ? '' : 's'} (offset {offset})
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => void fetchListings(Math.max(0, offset - LIMIT))} disabled={offset === 0 || listingsLoading}>Prev</button>
                        <button onClick={() => void fetchListings(offset + LIMIT)} disabled={listings.length < LIMIT || listingsLoading}>Next</button>
                    </div>
                </div>
            </div>

            {/* ───── Create listing section ───── */}
            <div className="steward-card">
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)', margin: 0 }}>
                        Post a Listing
                    </h2>
                    <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
                        Sellers require an active Business-DID. Listings expire after the selected window.
                    </p>
                </div>
                {businessDidLoading ? (
                    <div style={{ padding: '32px 20px', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>Checking Business-DID status…</div>
                ) : !businessDid ? (
                    <div style={{ padding: '32px 20px', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                        <strong>Business-DID required to create listings.</strong>{' '}
                        Register a Business-DID via the DID Registry to start selling.
                    </div>
                ) : (
                    <form onSubmit={handleCreate} style={{ padding: '20px', display: 'grid', gap: 12, maxWidth: 640 }}>
                        <label>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 4 }}>TITLE</div>
                            <input type="text" required maxLength={255} value={formTitle} onChange={e => setFormTitle(e.target.value)} style={{ width: '100%' }} />
                        </label>
                        <label>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 4 }}>DESCRIPTION</div>
                            <textarea required maxLength={8192} rows={4} value={formDescription} onChange={e => setFormDescription(e.target.value)} style={{ width: '100%' }} />
                        </label>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <label style={{ flex: 1 }}>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 4 }}>PRICE (BIOS)</div>
                                <input type="number" required min="1" value={formPrice} onChange={e => setFormPrice(e.target.value)} style={{ width: '100%' }} />
                            </label>
                            <label style={{ flex: 1 }}>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 4 }}>CATEGORY</div>
                                <select value={formCategory} onChange={e => setFormCategory(e.target.value)} style={{ width: '100%' }}>
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </label>
                            <label style={{ flex: 1 }}>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 4 }}>EXPIRES (DAYS, max 90)</div>
                                <input type="number" required min="1" max="90" value={formExpiresDays} onChange={e => setFormExpiresDays(e.target.value)} style={{ width: '100%' }} />
                            </label>
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <button type="submit" disabled={formSubmitting}>{formSubmitting ? 'Posting…' : 'Post Listing'}</button>
                            {formMessage && <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>{formMessage}</span>}
                        </div>
                    </form>
                )}
            </div>
        </StewardShell>
    );
}
