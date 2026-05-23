'use client';
import { useState, useEffect } from 'react';

// D-08a (locked override): lore_commons has no prose body column.
// "lore body never crosses wire" (STATE.md invariant).
// LoreTab shows ONLY metadata: category_tag + contributed_tick + citation_count + truncated hash.
// The API response has no prose fields — only the 4 metadata fields in LoreEntry below.

interface LoreEntry {
    content_hash: string;
    category_tag: string;
    contributed_tick: number;
    citation_count: number;
}

interface LoreTabProps {
    nousId: string;
}

const categoryBadgeStyle: React.CSSProperties = {
    fontFamily: 'var(--mono-portal)',
    fontSize: 13,
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid var(--rule)',
    background: 'var(--parchment)',
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
};

function LoreRow({ entry, isLast }: { entry: LoreEntry; isLast: boolean }) {
    return (
        <div style={{
            padding: '14px 0',
            borderBottom: isLast ? 'none' : '1px solid var(--rule)',
        }}>
            {/* Header row — metadata only (D-08a locked override) */}
            <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
                    <span style={categoryBadgeStyle}>{entry.category_tag}</span>
                    <span style={{
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 13,
                        fontWeight: 400,
                        color: 'var(--muted)',
                    }}>
                        T{entry.contributed_tick} · {entry.citation_count} citations · {entry.content_hash.slice(0, 16)}…
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function LoreTab({ nousId }: LoreTabProps) {
    const [entries, setEntries] = useState<LoreEntry[]>([]);
    const [cursor, setCursor] = useState<number | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);

    const gridBase = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

    useEffect(() => {
        setLoading(true);
        fetch(`${gridBase}/api/v1/portal/nous/${nousId}/lore`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { entries: [], cursor: null })
            .then((data: { entries: LoreEntry[]; cursor?: number | null }) => {
                setEntries(data.entries ?? []);
                if (data.cursor != null) {
                    setCursor(data.cursor);
                    setHasMore(true);
                } else {
                    setCursor(null);
                    setHasMore(false);
                }
            })
            .catch(() => setEntries([]))
            .finally(() => setLoading(false));
    }, [nousId, gridBase]);

    function loadMore() {
        if (!cursor) return;
        fetch(`${gridBase}/api/v1/portal/nous/${nousId}/lore?cursor=${cursor}`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { entries: [], cursor: null })
            .then((data: { entries: LoreEntry[]; cursor?: number | null }) => {
                setEntries(prev => [...prev, ...(data.entries ?? [])]);
                if (data.cursor != null) {
                    setCursor(data.cursor);
                    setHasMore(true);
                } else {
                    setCursor(null);
                    setHasMore(false);
                }
            })
            .catch(() => null);
    }

    if (loading) {
        return (
            <div>
                {[0, 1, 2].map(i => (
                    <div
                        key={i}
                        style={{
                            background: 'var(--parchment-2)',
                            borderRadius: 4,
                            height: 20,
                            animation: 'portal-pulse 1.2s infinite',
                            marginBottom: 8,
                        }}
                    />
                ))}
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 16,
                fontWeight: 400,
                color: 'var(--muted)',
                textAlign: 'center',
                padding: '32px 0',
            }}>
                No lore recorded yet.
            </div>
        );
    }

    return (
        <div>
            {entries.map((entry, idx) => (
                <LoreRow
                    key={entry.content_hash}
                    entry={entry}
                    isLast={idx === entries.length - 1 && !hasMore}
                />
            ))}
            {hasMore && (
                <button
                    onClick={loadMore}
                    style={{
                        padding: '10px 20px',
                        borderRadius: 8,
                        border: '1px solid var(--rule)',
                        background: 'transparent',
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        display: 'block',
                        margin: '16px auto 0',
                    }}
                >
                    Load more lore
                </button>
            )}
        </div>
    );
}
