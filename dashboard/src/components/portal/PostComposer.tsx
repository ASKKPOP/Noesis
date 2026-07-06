/**
 * PostComposer — textarea + submit button for creating a new community post.
 * Phase 29 COM-02.
 */
'use client';

import { useState } from 'react';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface PostComposerProps {
    onPosted: () => void;  // called after successful post creation
}

const MAX_CHARS = 500;

export function PostComposer({ onPosted }: PostComposerProps) {
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const remaining = MAX_CHARS - content.length;
    const overLimit = remaining < 0;

    async function handleSubmit() {
        if (!content.trim() || overLimit || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/portal/community/posts`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content.trim() }),
            });
            if (!res.ok) {
                const body = await res.json() as { error?: string };
                setError(body.error ?? 'Failed to post');
                return;
            }
            setContent('');
            onPosted();
        } catch {
            setError('Network error — try again');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div style={{
            border: '1px solid var(--rule)',
            borderRadius: 6,
            background: 'var(--parchment)',
            padding: '16px',
            marginBottom: 20,
        }}>
            <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Share something with the community…"
                rows={3}
                style={{
                    width: '100%',
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--ink)',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'vertical',
                    lineHeight: 1.5,
                    boxSizing: 'border-box',
                }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <span style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 11,
                    color: overLimit ? '#c0392b' : 'var(--muted)',
                }}>
                    {remaining} chars remaining
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {error && (
                        <span style={{ fontFamily: 'var(--sans-portal)', fontSize: 11, color: '#c0392b' }}>
                            {error}
                        </span>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={!content.trim() || overLimit || submitting}
                        style={{
                            fontFamily: 'var(--sans-portal)',
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--parchment)',
                            background: submitting || !content.trim() || overLimit ? 'var(--muted)' : 'var(--navy)',
                            border: 'none',
                            borderRadius: 4,
                            padding: '6px 16px',
                            cursor: submitting || !content.trim() || overLimit ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {submitting ? 'Posting…' : 'Post'}
                    </button>
                </div>
            </div>
        </div>
    );
}
