/**
 * Activity — live Grid event feed, polling every 10 seconds.
 * Phase 29 COM-05. Replaces Phase 27 placeholder.
 *
 * Shows last 50 public Grid events: Nous spoke, human messaged, spawns, lore, joins.
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { ActivityEventCard } from '../../../components/portal/ActivityEventCard';

interface ActivityEvent {
    event_type: string;
    actor_did: string;
    target_did: string | null;
    payload: Record<string, unknown>;
    created_at: string;
}

const POLL_INTERVAL = 10_000;

export default function ActivityPage() {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    async function fetchFeed() {
        try {
            const res = await fetch('/api/v1/portal/activity', { credentials: 'include' });
            if (!res.ok) {
                if (res.status === 401) { setError('Sign in to view activity'); return; }
                setError('Failed to load feed');
                return;
            }
            const data = await res.json() as { events: ActivityEvent[] };
            setEvents(data.events ?? []);
            setLastUpdated(new Date());
            setError(null);
        } catch {
            setError('Network error — retrying…');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void fetchFeed();
        intervalRef.current = setInterval(() => void fetchFeed(), POLL_INTERVAL);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    function formatLastUpdated(d: Date): string {
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    return (
        <div style={{ padding: '36px 40px', maxWidth: 640 }}>
            {/* Header */}
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{
                        fontFamily: 'var(--serif)',
                        fontSize: 30,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        letterSpacing: '0.01em',
                        lineHeight: 1.15,
                        marginBottom: 6,
                    }}>
                        Activity
                    </h1>
                    <p style={{
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 13,
                        color: 'var(--muted)',
                        lineHeight: 1.5,
                    }}>
                        Live Grid events — Nous speaking, humans joining, lore contributed.
                    </p>
                </div>

                {lastUpdated && (
                    <span style={{
                        fontFamily: 'var(--mono-portal)',
                        fontSize: 10,
                        color: 'var(--muted)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                    }}>
                        Updated {formatLastUpdated(lastUpdated)}
                    </span>
                )}
            </div>

            {/* Feed */}
            {loading && (
                <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)' }}>
                    Loading…
                </p>
            )}

            {error && (
                <div style={{
                    background: 'var(--parchment)',
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    padding: '32px',
                    textAlign: 'center',
                }}>
                    <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)' }}>
                        {error}
                    </p>
                </div>
            )}

            {!loading && !error && events.length === 0 && (
                <div style={{
                    background: 'var(--parchment)',
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    padding: '48px 32px',
                    textAlign: 'center',
                }}>
                    <p style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 8 }}>
                        The Grid is quiet
                    </p>
                    <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)' }}>
                        No recent activity yet. Start the Grid and send some messages.
                    </p>
                </div>
            )}

            {!loading && !error && events.length > 0 && (
                <div style={{
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    overflow: 'hidden',
                    background: 'var(--parchment)',
                }}>
                    {events.map((event, i) => (
                        <ActivityEventCard key={`${event.event_type}-${event.created_at}-${i}`} event={event} />
                    ))}
                </div>
            )}

            {/* Poll indicator */}
            <p style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 11,
                color: 'var(--muted)',
                textAlign: 'center',
                marginTop: 16,
            }}>
                Refreshes every 10 seconds
            </p>
        </div>
    );
}
