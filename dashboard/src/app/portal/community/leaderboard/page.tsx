/**
 * Leaderboard — standalone page at /portal/community/leaderboard.
 * Phase 29 COM-03.
 */
'use client';

import { useState, useEffect } from 'react';
import { LeaderboardRow } from '../../../../components/portal/LeaderboardRow';

interface LeaderboardEntry {
    did: string;
    eth_address: string | null;
    ousia: number;
    created_at: string;
    nous_name: string | null;
    nous_did: string | null;
    nous_score: number;
}

export default function LeaderboardPage() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/v1/portal/community/leaderboard', { credentials: 'include' })
            .then(r => r.json())
            .then(d => { setEntries(d.entries ?? []); setLoading(false); })
            .catch(() => { setError('Failed to load leaderboard'); setLoading(false); });
    }, []);

    return (
        <div style={{ padding: '36px 40px', maxWidth: 640 }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 30,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    letterSpacing: '0.01em',
                    lineHeight: 1.15,
                    marginBottom: 6,
                }}>
                    Leaderboard
                </h1>
                <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                    Ranked by Cyber Coin holdings (ousia).
                </p>
            </div>

            {loading && (
                <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)' }}>Loading…</p>
            )}
            {error && (
                <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)' }}>{error}</p>
            )}
            {!loading && !error && (
                <div style={{ border: '1px solid var(--rule)', borderRadius: 6, overflow: 'hidden', background: 'var(--parchment)' }}>
                    {entries.length === 0 && (
                        <p style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--sans-portal)', fontSize: 13 }}>
                            No entries yet.
                        </p>
                    )}
                    {entries.map((entry, i) => (
                        <LeaderboardRow key={entry.did} rank={i + 1} {...entry} />
                    ))}
                </div>
            )}
        </div>
    );
}
