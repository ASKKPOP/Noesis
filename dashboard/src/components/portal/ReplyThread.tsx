/**
 * ReplyThread — displays replies for a post + inline reply composer.
 * Phase 29 COM-02.
 */
'use client';

import { useState, useEffect } from 'react';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface Reply {
    id: number;
    author_did: string;
    content: string;
    created_at: string;
}

interface ReplyThreadProps {
    postId: number;
}

const MAX_REPLY_CHARS = 280;

function truncateDid(did: string): string {
    const addr = did.split(':').pop() ?? did;
    return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export function ReplyThread({ postId }: ReplyThreadProps) {
    const [replies, setReplies] = useState<Reply[]>([]);
    const [loading, setLoading] = useState(true);
    const [replyContent, setReplyContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${GRID_ORIGIN}/api/v1/portal/community/posts/${postId}/replies`, { credentials: 'include' })
            .then(r => r.json())
            .then((d: { replies?: Reply[] }) => { setReplies(d.replies ?? []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [postId]);

    const remaining = MAX_REPLY_CHARS - replyContent.length;
    const overLimit = remaining < 0;

    async function handleReply() {
        if (!replyContent.trim() || overLimit || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/portal/community/posts/${postId}/replies`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: replyContent.trim() }),
            });
            if (!res.ok) {
                const body = await res.json() as { error?: string };
                setError(body.error ?? 'Failed to reply');
                return;
            }
            // Refresh replies after successful post
            const fresh = await fetch(`${GRID_ORIGIN}/api/v1/portal/community/posts/${postId}/replies`, { credentials: 'include' });
            const freshData = await fresh.json() as { replies?: Reply[] };
            setReplies(freshData.replies ?? []);
            setReplyContent('');
        } catch {
            setError('Network error — try again');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div style={{
            marginTop: 8,
            paddingLeft: 16,
            borderLeft: '2px solid var(--rule)',
        }}>
            {loading && (
                <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
                    Loading replies…
                </p>
            )}

            {!loading && replies.map(reply => (
                <div key={reply.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--rule)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <span style={{ fontFamily: 'var(--mono-portal)', fontSize: 11, color: 'var(--bronze)', fontWeight: 600 }}>
                            {truncateDid(reply.author_did)}
                        </span>
                        <span style={{ fontFamily: 'var(--sans-portal)', fontSize: 11, color: 'var(--muted)' }}>
                            {relativeTime(reply.created_at)}
                        </span>
                    </div>
                    <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--ink)', marginTop: 4, lineHeight: 1.5 }}>
                        {reply.content}
                    </p>
                </div>
            ))}

            {/* Reply composer */}
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <textarea
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    placeholder="Write a reply…"
                    rows={2}
                    style={{
                        flex: 1,
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 12,
                        color: 'var(--ink)',
                        background: 'var(--parchment)',
                        border: '1px solid var(--rule)',
                        borderRadius: 4,
                        padding: '6px 10px',
                        resize: 'none',
                        outline: 'none',
                        boxSizing: 'border-box',
                    }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <button
                        onClick={handleReply}
                        disabled={!replyContent.trim() || overLimit || submitting}
                        style={{
                            fontFamily: 'var(--sans-portal)',
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--parchment)',
                            background: submitting || !replyContent.trim() || overLimit ? 'var(--muted)' : 'var(--navy)',
                            border: 'none',
                            borderRadius: 4,
                            padding: '5px 12px',
                            cursor: submitting || !replyContent.trim() || overLimit ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {submitting ? '…' : 'Reply'}
                    </button>
                    <span style={{
                        fontFamily: 'var(--mono-portal)',
                        fontSize: 10,
                        color: overLimit ? '#c0392b' : 'var(--muted)',
                    }}>
                        {remaining}
                    </span>
                    {error && (
                        <span style={{ fontFamily: 'var(--sans-portal)', fontSize: 11, color: '#c0392b' }}>
                            {error}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
