'use client';

import { useEffect, useState } from 'react';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface AuditEntry {
    id: number;
    eventType: string;
    actorDid: string;
    payload: Record<string, unknown>;
    createdAt: number;
    eventHash: string;
}

interface OperatorExportedPayload {
    operator_id: string;
    start_tick: number;
    end_tick: number;
    tarball_hash: string;
    requested_at: number;
}

interface ReplayModalProps {
    entry: { payload: OperatorExportedPayload; eventHash: string };
    onClose: () => void;
    operatorTier?: string;
}

const SENSITIVE_KEYS = new Set([
    'telos_text', 'creed_text', 'skill_body', 'rule_text', 'lore_body',
    'message', 'text', 'content', 'ciphertext', 'belief_content', 'violation_text',
]);

function redactValue(key: string, value: unknown, tierNum: number): string {
    if (tierNum < 4 && SENSITIVE_KEYS.has(key)) return '— Requires H4';
    return String(value).slice(0, 40);
}

const EVENT_FAMILY_COLORS: Record<string, string> = {
    operator: '#b8542f',
    nous: '#3a7a5a',
    trade: '#6a4a7a',
    law: '#5a5a6a',
    tick: '#8a8479',
    bios: '#5a8a4a',
    iris: '#4a6a8a',
    skill: '#7a6a2e',
    norm: '#5a5a6a',
    lore: '#6a4a7a',
    proposal: '#8a6a2e',
    ballot: '#8a6a2e',
    ananke: '#8a4a2e',
};

function familyColor(eventType: string): string {
    const family = eventType.split('.')[0] ?? 'tick';
    return EVENT_FAMILY_COLORS[family] ?? '#8a8479';
}

function getEntryTick(e: AuditEntry): number {
    if (typeof e.payload['tick'] === 'number') return e.payload['tick'] as number;
    return e.id ?? 0;
}

export function ReplayModal({ entry, onClose, operatorTier }: ReplayModalProps) {
    const { operator_id, start_tick, end_tick } = entry.payload;
    const rawTier = (operatorTier ?? 'H1').replace(/^H/i, '');
    const tierNum = Number.isInteger(Number(rawTier)) ? Number(rawTier) : 1;

    const [selectedTick, setSelectedTick] = useState(start_tick);
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Escape key handler
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Scroll lock
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // Fetch audit entries when tier >= H3
    useEffect(() => {
        if (tierNum < 3) return;
        async function fetchEntries() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/audit/trail?limit=1000`);
                if (res.ok) {
                    const data = await res.json();
                    const all: AuditEntry[] = Array.isArray(data) ? data : data.entries ?? [];
                    // Filter to tick range using payload.tick (fallback: id)
                    const inRange = all.filter(e => {
                        const t = getEntryTick(e);
                        return t >= start_tick && t <= end_tick;
                    });
                    setEntries(inRange);
                } else {
                    setError('Could not load audit entries.');
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not reach Grid.');
            } finally {
                setLoading(false);
            }
        }
        fetchEntries();
    }, [entry, tierNum, start_tick, end_tick]);

    const visibleEntries = entries
        .filter(e => getEntryTick(e) <= selectedTick)
        .sort((a, b) => getEntryTick(b) - getEntryTick(a))
        .slice(0, 100);

    return (
        <>
            {/* Overlay */}
            <div
                style={{ position: 'fixed', inset: 0, background: 'rgba(26,23,20,0.55)', zIndex: 50 }}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="replay-modal-title"
                style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    maxWidth: 960,
                    width: '90vw',
                    maxHeight: '80vh',
                    background: 'var(--vellum)',
                    borderRadius: 12,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                    overflow: 'hidden',
                    zIndex: 51,
                    display: 'flex',
                    flexDirection: 'column',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
                            Export
                        </div>
                        <h2
                            id="replay-modal-title"
                            style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)', margin: 0 }}
                        >
                            {operator_id} · ticks {start_tick.toLocaleString()} → {end_tick.toLocaleString()}
                        </h2>
                    </div>
                    <button
                        aria-label="Close scrubber"
                        onClick={onClose}
                        style={{
                            width: 24,
                            height: 24,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'var(--mono)',
                            fontSize: 20,
                            color: 'var(--muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 4,
                            flexShrink: 0,
                        }}
                        onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--terracotta)'; }}
                        onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div style={{ overflowY: 'auto', padding: 24, flex: 1 }}>
                    {tierNum < 3 ? (
                        <p style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink)', textAlign: 'center', paddingBlock: 48, margin: 0 }}>
                            H3+ operator tier required to replay exports.
                        </p>
                    ) : (
                        <>
                            {/* Scrubber control */}
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                                        Tick {selectedTick.toLocaleString()}
                                    </span>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                                        {visibleEntries.length} events
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={start_tick}
                                    max={end_tick}
                                    value={selectedTick}
                                    step={1}
                                    onChange={(e) => setSelectedTick(parseInt(e.target.value, 10))}
                                    aria-label="Replay tick scrubber"
                                    aria-valuemin={start_tick}
                                    aria-valuemax={end_tick}
                                    aria-valuenow={selectedTick}
                                    style={{ width: '100%', height: 6, background: 'var(--rule)', borderRadius: 3, accentColor: 'var(--terracotta)', display: 'block' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                                        {start_tick.toLocaleString()}
                                    </span>
                                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                                        {end_tick.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Event list */}
                            <div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
                                    Events at tick {selectedTick.toLocaleString()}
                                </div>

                                {error ? (
                                    <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, padding: 24, textAlign: 'center' }}>
                                        {error}
                                    </div>
                                ) : loading ? (
                                    <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, padding: 24, textAlign: 'center' }}>
                                        Loading…
                                    </div>
                                ) : (
                                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                                        {visibleEntries.length === 0 ? (
                                            <div style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12, padding: 24, textAlign: 'center' }}>
                                                No events at or before this tick.
                                            </div>
                                        ) : (
                                            visibleEntries.map((e, i) => {
                                                const color = familyColor(e.eventType);
                                                const payloadEntries = Object.entries(e.payload ?? {}).slice(0, 2);
                                                return (
                                                    <div
                                                        key={i}
                                                        style={{ height: 24, display: 'flex', alignItems: 'center', gap: 8, paddingBlock: 4 }}
                                                    >
                                                        {/* Family dot */}
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                                                        {/* Tick */}
                                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', minWidth: 60, textAlign: 'right', flexShrink: 0 }}>
                                                            {e.id}
                                                        </span>
                                                        {/* Event type badge */}
                                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, background: color + '22', color, borderRadius: 2, padding: '1px 4px', flexShrink: 0 }}>
                                                            {e.eventType}
                                                        </span>
                                                        {/* Actor DID */}
                                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                                                            {e.actorDid ? e.actorDid.slice(0, 8) + '…' + e.actorDid.slice(-6) : '—'}
                                                        </span>
                                                        {/* Payload preview with H4 redaction */}
                                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {payloadEntries.map(([k, v]) => `${k}=${redactValue(k, v, tierNum)}`).join(' ')}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 24px', borderTop: '1px solid var(--rule)' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                        Showing tick {selectedTick.toLocaleString()} · Observer-only — no Grid mutations.
                    </span>
                </div>
            </div>
        </>
    );
}
