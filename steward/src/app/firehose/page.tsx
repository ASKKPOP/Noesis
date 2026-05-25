'use client';

import { useEffect, useRef, useState } from 'react';
import StewardShell from '@/components/StewardShell';
import { useHealthDetailed } from '@/lib/use-health-detailed';
import { EVENT_FAMILY_COLORS, getFamilyColors, getFamilyName } from '@/lib/event-family-colors';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

const MAX_EVENTS = 500;
const MAX_BUFFER = 200;

function truncateFirehoseDid(did: string): string {
    if (!did || did.length <= 16) return did ?? '';
    return did.slice(0, 8) + '…' + did.slice(-6);
}

function formatTimestamp(ts: string): string {
    try {
        const d = new Date(ts);
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        const ms = String(d.getMilliseconds()).padStart(3, '0');
        return `${hh}:${mm}:${ss}.${ms}`;
    } catch {
        return ts;
    }
}

interface FirehoseEvent {
    id: string;
    eventType: string;
    actorDid: string;
    createdAt: string;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export default function FirehosePage() {
    const [events, setEvents] = useState<FirehoseEvent[]>([]);
    const [connected, setConnected] = useState<ConnectionState>('connecting');
    const [retryCountdown, setRetryCountdown] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [eventCount, setEventCount] = useState(0);

    const viewportRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const pauseBufferRef = useRef<FirehoseEvent[]>([]);
    const retryDelayRef = useRef(1);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isPausedRef = useRef(false);

    isPausedRef.current = isPaused;

    const { data: health } = useHealthDetailed();
    const lastWatchdogCloseAtRef = useRef<number | null>(null);

    function connect() {
        const wsUrl = GRID_ORIGIN.replace(/^http/, 'ws') + '/api/v1/audit/firehose';
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        setConnected('connecting');

        ws.onopen = () => {
            setConnected('connected');
            retryDelayRef.current = 1;
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;
            }
            setRetryCountdown(0);
        };

        ws.onmessage = (evt) => {
            try {
                const frame = JSON.parse(evt.data);
                if (frame.type === 'event' && frame.entry) {
                    const entry = frame.entry;
                    const newEvent: FirehoseEvent = {
                        id: entry.id ?? String(Date.now() + Math.random()),
                        eventType: entry.eventType ?? entry.event_type ?? '',
                        actorDid: entry.actorDid ?? entry.actor_did ?? '',
                        createdAt: entry.createdAt ?? entry.created_at ?? new Date().toISOString(),
                    };

                    if (isPausedRef.current) {
                        // Buffer while paused (ring buffer, max MAX_BUFFER)
                        pauseBufferRef.current.push(newEvent);
                        if (pauseBufferRef.current.length > MAX_BUFFER) {
                            pauseBufferRef.current = pauseBufferRef.current.slice(-MAX_BUFFER);
                        }
                    } else {
                        setEvents((prev) => {
                            const next = [...prev, newEvent];
                            if (next.length > MAX_EVENTS) return next.slice(-MAX_EVENTS);
                            return next;
                        });
                        setEventCount((c) => c + 1);
                    }
                }
            } catch {
                // ignore malformed frames
            }
        };

        ws.onclose = () => {
            setConnected('disconnected');
            scheduleReconnect();
        };

        ws.onerror = () => {
            ws.close();
        };
    }

    function scheduleReconnect() {
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * 2, 30);
        setRetryCountdown(delay);

        countdownTimerRef.current = setInterval(() => {
            setRetryCountdown((c) => {
                if (c <= 1) {
                    if (countdownTimerRef.current) {
                        clearInterval(countdownTimerRef.current);
                        countdownTimerRef.current = null;
                    }
                    return 0;
                }
                return c - 1;
            });
        }, 1000);

        retryTimerRef.current = setTimeout(() => {
            connect();
        }, delay * 1000);
    }

    useEffect(() => {
        connect();
        return () => {
            if (wsRef.current) wsRef.current.close();
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Phase 34 OBS-14: client-side firehose watchdog.
    // Triggers wsRef.current.close() when the server reports the firehose has not delivered
    // a frame in >60s despite client_count > 0. The existing ws.onclose → scheduleReconnect
    // path handles the actual reconnect with the existing exponential backoff (R-34-03 spec).
    // Suppression window prevents reconnect storm: after each watchdog-triggered close, wait
    // at least 60_000ms before allowing another trigger.
    useEffect(() => {
        if (!health) return;
        const lastFrameAt = health.firehose.last_frame_at;
        const clientCount = health.firehose.client_count;
        if (lastFrameAt === null) return;
        if (clientCount <= 0) return;
        const stalenessMs = Date.now() - lastFrameAt;
        if (stalenessMs <= 60_000) return;

        const lastClose = lastWatchdogCloseAtRef.current;
        if (lastClose !== null && Date.now() - lastClose <= 60_000) {
            // Suppression window active — already triggered a close within the last 60s.
            return;
        }

        // Predicate satisfied. Close the socket; ws.onclose handler will reconnect via
        // the existing scheduleReconnect path (unchanged).
        lastWatchdogCloseAtRef.current = Date.now();
        wsRef.current?.close();
    }, [health]);

    // Auto-scroll effect
    useEffect(() => {
        if (!isPaused && viewportRef.current) {
            viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
        }
    }, [events, isPaused]);

    function handleMouseEnter() {
        setIsPaused(true);
    }

    function handleMouseLeave() {
        setIsPaused(false);
        // Flush buffer
        if (pauseBufferRef.current.length > 0) {
            const buffered = pauseBufferRef.current;
            pauseBufferRef.current = [];
            setEvents((prev) => {
                const next = [...prev, ...buffered];
                if (next.length > MAX_EVENTS) return next.slice(-MAX_EVENTS);
                return next;
            });
            setEventCount((c) => c + buffered.length);
        }
    }

    // Connection status pill
    let statusPillStyle: React.CSSProperties;
    let statusText: string;
    let statusDotColor: string;

    if (connected === 'connected') {
        statusPillStyle = {
            background: 'rgba(45,122,45,0.10)',
            border: '1px solid rgba(45,122,45,0.3)',
            borderRadius: 12,
            padding: '4px 10px',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: '#2d7a2d',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
        };
        statusText = 'Connected';
        statusDotColor = '#2d7a2d';
    } else if (connected === 'disconnected') {
        statusPillStyle = {
            background: 'rgba(184,84,47,0.08)',
            border: '1px solid rgba(184,84,47,0.3)',
            borderRadius: 12,
            padding: '4px 10px',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--terracotta)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
        };
        statusText = retryCountdown > 0 ? `Disconnected — retrying in ${retryCountdown}s` : 'Disconnected — reconnecting…';
        statusDotColor = '#b8542f';
    } else {
        statusPillStyle = {
            background: 'var(--vellum)',
            border: '1px solid var(--rule)',
            borderRadius: 12,
            padding: '4px 10px',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
        };
        statusText = 'Connecting…';
        statusDotColor = '#8a8479';
    }

    const statusBarText =
        events.length === 0 && connected === 'connected'
            ? '0 events · waiting for Grid activity…'
            : `${eventCount} events · ${connected === 'connected' ? 'WebSocket connected' : connected === 'disconnected' ? 'WebSocket disconnected' : 'connecting…'} · auto-scroll ${isPaused ? 'OFF' : 'ON'}`;

    return (
        <StewardShell title="Live Firehose" breadcrumb="Steward · Firehose">
            {/* Connection status pill + status bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: -8 }}>
                <div
                    style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 11,
                        color: 'var(--muted)',
                        letterSpacing: '0.04em',
                    }}
                >
                    {statusBarText}
                </div>
                <span style={statusPillStyle}>
                    <span
                        style={{
                            display: 'inline-block',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: statusDotColor,
                            flexShrink: 0,
                        }}
                    />
                    {statusText}
                </span>
            </div>

            {/* Firehose viewport */}
            <div
                style={{
                    position: 'relative',
                    border: '1px solid var(--rule)',
                    borderRadius: 8,
                    background: 'var(--parchment)',
                    overflow: 'hidden',
                }}
            >
                <div
                    ref={viewportRef}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    style={{
                        height: 'calc(100vh - 220px)',
                        overflowY: 'scroll',
                        overflowX: 'hidden',
                    }}
                >
                    {events.length === 0 ? (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                color: 'var(--muted)',
                                fontFamily: 'var(--mono)',
                                fontSize: 13,
                            }}
                        >
                            {connected === 'disconnected'
                                ? `Connection lost. Reconnecting in ${retryCountdown}s.`
                                : connected === 'connecting'
                                ? 'Could not connect to Grid. Retrying…'
                                : '0 events · waiting for Grid activity…'}
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                            <tbody>
                                {events.map((event) => {
                                    const colors = getFamilyColors(event.eventType);
                                    const family = getFamilyName(event.eventType);
                                    return (
                                        <tr
                                            key={event.id}
                                            role="row"
                                            style={{
                                                borderLeft: `3px solid ${colors.leftBorder}`,
                                                borderBottom: '1px solid rgba(0,0,0,0.04)',
                                                height: 32,
                                            }}
                                            onMouseEnter={(e) => {
                                                (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(0,0,0,0.03)';
                                            }}
                                            onMouseLeave={(e) => {
                                                (e.currentTarget as HTMLTableRowElement).style.background = '';
                                            }}
                                        >
                                            {/* Family dot */}
                                            <td style={{ width: 24, paddingLeft: 8, verticalAlign: 'middle' }}>
                                                <span
                                                    aria-label={`${family} event`}
                                                    style={{
                                                        display: 'inline-block',
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: '50%',
                                                        background: colors.leftBorder,
                                                        flexShrink: 0,
                                                    }}
                                                />
                                            </td>
                                            {/* Timestamp */}
                                            <td
                                                style={{
                                                    width: 88,
                                                    fontFamily: 'var(--mono)',
                                                    fontSize: 10,
                                                    color: 'var(--muted)',
                                                    textAlign: 'right',
                                                    paddingRight: 8,
                                                    verticalAlign: 'middle',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {formatTimestamp(event.createdAt)}
                                            </td>
                                            {/* Event-type badge */}
                                            <td style={{ width: 240, paddingLeft: 8, paddingRight: 8, verticalAlign: 'middle' }}>
                                                <span
                                                    style={{
                                                        fontFamily: 'var(--mono)',
                                                        fontSize: 10,
                                                        background: colors.badgeBg,
                                                        color: colors.badgeText,
                                                        borderRadius: 3,
                                                        padding: '2px 6px',
                                                        whiteSpace: 'nowrap',
                                                        display: 'inline-block',
                                                        maxWidth: 220,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                    title={event.eventType}
                                                >
                                                    {event.eventType}
                                                </span>
                                            </td>
                                            {/* Actor DID */}
                                            <td
                                                style={{
                                                    fontFamily: 'var(--mono)',
                                                    fontSize: 11,
                                                    color: 'var(--muted)',
                                                    verticalAlign: 'middle',
                                                    paddingLeft: 8,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                                title={event.actorDid}
                                            >
                                                {truncateFirehoseDid(event.actorDid)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pause indicator */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 12,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(184,84,47,0.12)',
                        border: '1px solid var(--terracotta)',
                        borderRadius: 12,
                        padding: '4px 12px',
                        fontFamily: 'var(--mono)',
                        fontSize: 10,
                        color: 'var(--terracotta)',
                        opacity: isPaused ? 1 : 0,
                        transition: 'opacity 150ms',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                    }}
                >
                    Paused — hover to resume
                </div>
            </div>
        </StewardShell>
    );
}
