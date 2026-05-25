'use client';

import { useEffect, useState } from 'react';
import { EVENT_FAMILY_COLORS, getFamilyName } from '@/lib/event-family-colors';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

/**
 * Phase 34 D-34-A1 + D-34-A2: events-per-minute by family sparkline.
 *
 * Primitive: raw inline SVG (per v2.4 Culture Dashboard invariant — no d3, no recharts,
 * no react-flow, no cytoscape). Multi-family stacked geometry needs SVG paths.
 *
 * Window: 60 buckets × 5s = 5-minute history (D-34-A2).
 *
 * Data source: REST audit trail endpoint (NOT WebSocket — survives firehose failure exactly
 * when the operator opens /system to diagnose, per REQ OBS-13 + R-34-02).
 *
 * PII discipline: consumer reads only event_type + created_at from each entry; never
 * payload contents (mirrors firehose/page.tsx FirehoseEvent shape).
 */

interface AuditTrailEntry {
    id?: number | string;
    event_type?: string;
    eventType?: string;
    actor_did?: string;
    actorDid?: string;
    created_at?: string;
    createdAt?: string;
}

interface AuditTrailResponse {
    entries?: AuditTrailEntry[];
}

const BUCKET_COUNT = 60;
const BUCKET_WINDOW_MS = 5_000;
const TOTAL_WINDOW_MS = BUCKET_COUNT * BUCKET_WINDOW_MS; // 300_000 ms = 5 minutes
const SVG_WIDTH = 600;
const SVG_HEIGHT = 90;
const BAR_WIDTH = SVG_WIDTH / BUCKET_COUNT; // 10 px each

type Bucket = Record<string, number>; // family name → count

function bucketEntries(entries: AuditTrailEntry[], now: number): Bucket[] {
    const buckets: Bucket[] = Array.from({ length: BUCKET_COUNT }, () => ({}));
    for (const entry of entries) {
        const eventType = entry.event_type ?? entry.eventType ?? '';
        const createdAt = entry.created_at ?? entry.createdAt;
        if (!eventType || !createdAt) continue;
        const ts = new Date(createdAt).getTime();
        if (Number.isNaN(ts)) continue;
        const ageMs = now - ts;
        if (ageMs < 0 || ageMs >= TOTAL_WINDOW_MS) continue;
        const bucketIndex = Math.floor(ageMs / BUCKET_WINDOW_MS);
        if (bucketIndex < 0 || bucketIndex >= BUCKET_COUNT) continue;
        const family = getFamilyName(eventType);
        // Bucket 0 = most recent 5s; render newest at right.
        buckets[BUCKET_COUNT - 1 - bucketIndex][family] = (buckets[BUCKET_COUNT - 1 - bucketIndex][family] ?? 0) + 1;
    }
    return buckets;
}

function familyColor(family: string): string {
    const prefix = family === 'unknown' ? 'unknown' : `${family}.`;
    return EVENT_FAMILY_COLORS[prefix]?.leftBorder ?? EVENT_FAMILY_COLORS['unknown'].leftBorder;
}

export function EventsPerMinuteSparkline() {
    const [buckets, setBuckets] = useState<Bucket[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();

        async function fetchTrail() {
            try {
                const res = await fetch(`${GRID_ORIGIN}/api/v1/audit/trail?limit=200`, { signal: controller.signal });
                if (cancelled) return;
                if (!res.ok) {
                    setError(`HTTP ${res.status}`);
                    return;
                }
                const data = (await res.json()) as AuditTrailResponse;
                if (cancelled) return;
                const entries = Array.isArray(data.entries) ? data.entries : [];
                setBuckets(bucketEntries(entries, Date.now()));
                setError(null);
            } catch (err) {
                if (cancelled) return;
                if (err instanceof Error && err.name === 'AbortError') return;
                setError('Trail endpoint unavailable.');
            }
        }

        fetchTrail();
        const interval = setInterval(fetchTrail, 5000);
        return () => {
            cancelled = true;
            controller.abort();
            clearInterval(interval);
        };
    }, []);

    const totalEvents = buckets.reduce((sum, b) => sum + Object.values(b).reduce((s, c) => s + c, 0), 0);
    const maxBucket = Math.max(1, ...buckets.map(b => Object.values(b).reduce((s, c) => s + c, 0)));

    // Family list across all buckets — render legend in stable order.
    const familiesSeen = new Set<string>();
    for (const b of buckets) for (const f of Object.keys(b)) familiesSeen.add(f);
    const familyOrder = Array.from(familiesSeen).sort();

    return (
        <div>
            <svg
                role="img"
                aria-label={`Events per minute by family, last 5 minutes. ${totalEvents} events total.`}
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                width="100%"
                style={{ background: 'var(--parchment)', display: 'block', border: '1px solid var(--rule)', borderRadius: 4 }}
            >
                {buckets.map((bucket, bIdx) => {
                    const families = Object.keys(bucket).sort();
                    let yOffset = SVG_HEIGHT;
                    const x = bIdx * BAR_WIDTH;
                    const bucketTotal = families.reduce((s, f) => s + bucket[f], 0);
                    if (bucketTotal === 0) return null;
                    return (
                        <g key={`bucket-${bIdx}`}>
                            {families.map((family) => {
                                const count = bucket[family];
                                const h = (count / maxBucket) * SVG_HEIGHT;
                                yOffset -= h;
                                return (
                                    <rect
                                        key={`${bIdx}-${family}`}
                                        x={x}
                                        y={yOffset}
                                        width={Math.max(1, BAR_WIDTH - 1)}
                                        height={h}
                                        fill={familyColor(family)}
                                    >
                                        <title>{`${count} ${family} event${count === 1 ? '' : 's'}`}</title>
                                    </rect>
                                );
                            })}
                        </g>
                    );
                })}
            </svg>

            {/* Family legend + total */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                <span aria-live="polite">
                    {totalEvents} events / 5min
                </span>
                {familyOrder.map((family) => (
                    <span key={`legend-${family}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 8, height: 8, background: familyColor(family), display: 'inline-block', borderRadius: 1 }} />
                        {family}
                    </span>
                ))}
            </div>

            {error && (
                <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>
                    {error}
                </div>
            )}
        </div>
    );
}
