/**
 * ActivityEventCard — renders a single Grid audit event as a human-readable card.
 * Phase 29 COM-05.
 */
'use client';

interface ActivityEvent {
    event_type: string;
    actor_did: string;
    target_did: string | null;
    payload: Record<string, unknown>;
    created_at: string;
}

interface ActivityEventCardProps {
    event: ActivityEvent;
}

function truncateDid(did: string): string {
    const parts = did.split(':');
    const addr = parts[parts.length - 1] ?? did;
    return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const secs = Math.floor(diff / 1_000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

/** Map event_type → human-readable label */
function eventLabel(eventType: string, actorDid: string): string {
    const actor = truncateDid(actorDid);
    switch (eventType) {
        case 'nous.spoke':            return `${actor} spoke`;
        case 'human.spoke':           return `${actor} sent a message`;
        case 'nous.spawned_by_human': return `${actor} spawned a Nous`;
        case 'lore.contributed':      return `${actor} contributed lore`;
        case 'human.joined':          return `${actor} joined the Grid`;
        case 'nous.spawned':          return `${actor} was born`;
        default:                      return `${actor}: ${eventType}`;
    }
}

/** Map event_type → accent color */
function eventColor(eventType: string): string {
    switch (eventType) {
        case 'nous.spoke':            return 'var(--navy)';
        case 'human.spoke':           return 'var(--bronze)';
        case 'nous.spawned_by_human': return '#2e7d32';  /* green — spawn is always positive */
        case 'lore.contributed':      return '#6a1b9a';  /* purple — knowledge */
        case 'human.joined':          return '#0277bd';  /* blue — welcome */
        case 'nous.spawned':          return '#00695c';  /* teal — genesis */
        default:                      return 'var(--muted)';
    }
}

/** Simple SVG icon per event type */
function EventIcon({ eventType }: { eventType: string }) {
    const color = eventColor(eventType);
    const size = 16;
    switch (eventType) {
        case 'nous.spoke':
        case 'human.spoke':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
            );
        case 'nous.spawned_by_human':
        case 'nous.spawned':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
            );
        case 'lore.contributed':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
            );
        case 'human.joined':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
            );
        default:
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
                    <circle cx={12} cy={12} r={9} />
                </svg>
            );
    }
}

export function ActivityEventCard({ event }: ActivityEventCardProps) {
    const color = eventColor(event.event_type);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid var(--rule)',
        }}>
            {/* Icon dot */}
            <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--parchment-2)',
                border: `1px solid ${color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2,
            }}>
                <EventIcon eventType={event.event_type} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: 'var(--ink)',
                    lineHeight: 1.4,
                    marginBottom: 2,
                }}>
                    {eventLabel(event.event_type, event.actor_did)}
                </p>
                <span style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 10,
                    color: 'var(--muted)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                }}>
                    {event.event_type}
                </span>
            </div>

            {/* Timestamp */}
            <span style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 11,
                color: 'var(--muted)',
                flexShrink: 0,
                marginTop: 4,
            }}>
                {relativeTime(event.created_at)}
            </span>
        </div>
    );
}
