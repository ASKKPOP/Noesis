/**
 * PostCard — displays a single community post with expand/collapse for replies.
 * Phase 29 COM-02.
 */
'use client';

import { useState } from 'react';
import { ReplyThread } from './ReplyThread';

interface PostCardProps {
    id: number;
    author_did: string;
    content: string;
    created_at: string;
    reply_count: number;
}

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

export function PostCard({ id, author_did, content, created_at, reply_count }: PostCardProps) {
    const [showReplies, setShowReplies] = useState(false);

    return (
        <div style={{
            borderBottom: '1px solid var(--rule)',
            padding: '16px 0',
        }}>
            {/* Post header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--bronze)',
                }}>
                    {truncateDid(author_did)}
                </span>
                <span style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 11,
                    color: 'var(--muted)',
                }}>
                    {relativeTime(created_at)}
                </span>
            </div>

            {/* Post content */}
            <p style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 14,
                color: 'var(--ink)',
                lineHeight: 1.6,
                marginBottom: 10,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
            }}>
                {content}
            </p>

            {/* Reply toggle */}
            <button
                onClick={() => setShowReplies(s => !s)}
                style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 11,
                    color: 'var(--muted)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                }}
            >
                {showReplies
                    ? 'Hide replies'
                    : reply_count > 0
                        ? `${reply_count} ${reply_count === 1 ? 'reply' : 'replies'}`
                        : 'Reply'}
            </button>

            {showReplies && <ReplyThread postId={id} />}
        </div>
    );
}
