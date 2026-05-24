/**
 * Community — tabbed hub: Board | Users | Leaderboard
 * Phase 29 COM-01/COM-02/COM-03.
 * Client component (needs state for tab switching + data fetching).
 */
'use client';

import { useState, useEffect } from 'react';
import { UserDirectoryRow } from '../../../components/portal/UserDirectoryRow';
import { LeaderboardRow } from '../../../components/portal/LeaderboardRow';

type Tab = 'board' | 'users' | 'leaderboard';

interface UserEntry {
    did: string;
    eth_address: string | null;
    ousia: number;
    created_at: string;
    nous_name: string | null;
}

interface LeaderboardEntry {
    did: string;
    eth_address: string | null;
    ousia: number;
    created_at: string;
    nous_name: string | null;
    nous_did: string | null;
    nous_score: number;
}

export default function CommunityPage() {
    const [activeTab, setActiveTab] = useState<Tab>('board');
    const [users, setUsers] = useState<UserEntry[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab === 'users' && users.length === 0) {
            setLoading(true);
            fetch('/api/v1/portal/community/users', { credentials: 'include' })
                .then(r => r.json())
                .then(d => { setUsers(d.users ?? []); setLoading(false); })
                .catch(() => { setError('Failed to load users'); setLoading(false); });
        }
        if (activeTab === 'leaderboard' && leaderboard.length === 0) {
            setLoading(true);
            fetch('/api/v1/portal/community/leaderboard', { credentials: 'include' })
                .then(r => r.json())
                .then(d => { setLeaderboard(d.entries ?? []); setLoading(false); })
                .catch(() => { setError('Failed to load leaderboard'); setLoading(false); });
        }
    }, [activeTab]);

    const tabs: { id: Tab; label: string }[] = [
        { id: 'board', label: 'Board' },
        { id: 'users', label: 'Users' },
        { id: 'leaderboard', label: 'Leaderboard' },
    ];

    return (
        <div style={{ padding: '36px 40px', maxWidth: 680 }}>
            {/* Header */}
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
                    Community
                </h1>
                <p style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                }}>
                    Community board, user directory, and leaderboard.
                </p>
            </div>

            {/* Tab bar */}
            <div style={{
                display: 'flex',
                gap: 0,
                borderBottom: '1px solid var(--rule)',
                marginBottom: 24,
            }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setError(null); }}
                        style={{
                            fontFamily: 'var(--sans-portal)',
                            fontSize: 13,
                            fontWeight: activeTab === tab.id ? 600 : 400,
                            color: activeTab === tab.id ? 'var(--ink)' : 'var(--muted)',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid var(--bronze)' : '2px solid transparent',
                            padding: '8px 20px',
                            cursor: 'pointer',
                            marginBottom: -1,
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Error state */}
            {error && (
                <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 40 }}>
                    {error}
                </p>
            )}

            {/* Board tab — placeholder for Plan 29-03 */}
            {!error && activeTab === 'board' && (
                <div data-testid="community-board-placeholder" style={{
                    background: 'var(--parchment)',
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    padding: '48px 32px',
                    textAlign: 'center',
                }}>
                    <p style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink)' }}>
                        Community Board
                    </p>
                    <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
                        Post and reply features load in Phase 29 Plan 03.
                    </p>
                </div>
            )}

            {/* Users tab */}
            {!error && activeTab === 'users' && (
                <div>
                    <div style={{ fontFamily: 'var(--sans-portal)', fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                        {loading ? 'Loading…' : `${users.length} members`}
                    </div>
                    <div style={{
                        border: '1px solid var(--rule)',
                        borderRadius: 6,
                        overflow: 'hidden',
                        background: 'var(--parchment)',
                    }}>
                        {!loading && users.length === 0 && (
                            <p style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--sans-portal)', fontSize: 13 }}>
                                No users yet.
                            </p>
                        )}
                        {users.map(u => (
                            <UserDirectoryRow key={u.did} {...u} />
                        ))}
                    </div>
                </div>
            )}

            {/* Leaderboard tab */}
            {!error && activeTab === 'leaderboard' && (
                <div>
                    <div style={{ fontFamily: 'var(--sans-portal)', fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                        {loading ? 'Loading…' : 'Ranked by Cyber Coin (ousia)'}
                    </div>
                    <div style={{
                        border: '1px solid var(--rule)',
                        borderRadius: 6,
                        overflow: 'hidden',
                        background: 'var(--parchment)',
                    }}>
                        {!loading && leaderboard.length === 0 && (
                            <p style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--sans-portal)', fontSize: 13 }}>
                                No entries yet.
                            </p>
                        )}
                        {leaderboard.map((entry, i) => (
                            <LeaderboardRow key={entry.did} rank={i + 1} {...entry} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
