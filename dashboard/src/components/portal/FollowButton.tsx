/**
 * FollowButton — follow/unfollow toggle for a user DID.
 * Phase 29 COM-04.
 */
'use client';

import { useState } from 'react';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface FollowButtonProps {
    targetDid: string;
    initialFollowing: boolean;
    onFollowChange?: (following: boolean) => void;
}

export function FollowButton({ targetDid, initialFollowing, onFollowChange }: FollowButtonProps) {
    const [following, setFollowing] = useState(initialFollowing);
    const [loading, setLoading] = useState(false);

    async function handleClick() {
        if (loading) return;
        setLoading(true);
        try {
            const method = following ? 'DELETE' : 'POST';
            const res = await fetch(`${GRID_ORIGIN}/api/v1/portal/community/follow/${encodeURIComponent(targetDid)}`, {
                method,
                credentials: 'include',
            });
            if (res.ok) {
                const newFollowing = !following;
                setFollowing(newFollowing);
                onFollowChange?.(newFollowing);
            }
            // On error: silently stay in current state (idempotent retry is fine)
        } catch {
            // Network error: no state change
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 11,
                fontWeight: 600,
                color: following ? 'var(--muted)' : 'var(--navy)',
                background: 'none',
                border: `1px solid ${following ? 'var(--rule)' : 'var(--navy)'}`,
                borderRadius: 4,
                padding: '4px 10px',
                cursor: loading ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
            }}
        >
            {loading ? '…' : following ? 'Following' : 'Follow'}
        </button>
    );
}
