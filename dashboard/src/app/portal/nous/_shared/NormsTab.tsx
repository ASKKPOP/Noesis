'use client';
import { useState, useEffect } from 'react';

interface NormEntry {
    fingerprint: string;
    convergence_type: string;
    status: 'crystallized' | 'candidate';
    participating_count: number;
    tick_start: number;
    tick_end: number;
}

interface NormsTabProps {
    nousId: string;
}

// D-09: truncate fingerprint to first 4 + '…' + last 4 chars
function truncFingerprint(fp: string): string {
    return fp.slice(0, 4) + '…' + fp.slice(-4);
}

const badgeBase: React.CSSProperties = {
    fontFamily: 'var(--mono-portal)',
    fontSize: 13,
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid var(--rule)',
    background: 'var(--parchment)',
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
};

function NormRow({ norm, isLast }: { norm: NormEntry; isLast: boolean }) {
    const statusStyle: React.CSSProperties = norm.status === 'crystallized'
        ? { ...badgeBase, color: 'var(--terracotta-2)', borderColor: 'var(--terracotta-2)' }
        : { ...badgeBase, color: 'var(--muted)' };

    const tickRange = norm.tick_start === norm.tick_end
        ? `T${norm.tick_start}`
        : `T${norm.tick_start}–T${norm.tick_end}`;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '13px 0',
            borderBottom: isLast ? 'none' : '1px solid var(--rule)',
            flexWrap: 'wrap',
        }}>
            {/* 1. Fingerprint */}
            <span style={{
                fontFamily: 'var(--mono-portal)',
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--muted)',
            }}>
                {truncFingerprint(norm.fingerprint)}
            </span>

            {/* 2. Convergence badge */}
            <span style={badgeBase}>
                {norm.convergence_type.toUpperCase()}
            </span>

            {/* 3. Status badge */}
            <span style={statusStyle}>
                {norm.status === 'crystallized' ? 'CRYSTALLIZED' : 'CANDIDATE'}
            </span>

            {/* 4. Participating count */}
            <span style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--muted)',
            }}>
                {norm.participating_count} Nous
            </span>

            {/* 5. Tick range */}
            <span style={{
                fontFamily: 'var(--mono-portal)',
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--muted)',
            }}>
                {tickRange}
            </span>
        </div>
    );
}

export default function NormsTab({ nousId }: NormsTabProps) {
    const [norms, setNorms] = useState<NormEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const gridBase = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

    useEffect(() => {
        setLoading(true);
        fetch(`${gridBase}/api/v1/portal/nous/${nousId}/norms`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { norms: [] })
            .then((data: { norms: NormEntry[] }) => {
                setNorms(data.norms ?? []);
            })
            .catch(() => setNorms([]))
            .finally(() => setLoading(false));
    }, [nousId, gridBase]);

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

    if (norms.length === 0) {
        return (
            <div style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 16,
                fontWeight: 400,
                color: 'var(--muted)',
                textAlign: 'center',
                padding: '32px 0',
            }}>
                No norm participation recorded.
            </div>
        );
    }

    return (
        <div>
            {norms.map((norm, idx) => (
                <NormRow
                    key={norm.fingerprint}
                    norm={norm}
                    isLast={idx === norms.length - 1}
                />
            ))}
        </div>
    );
}
