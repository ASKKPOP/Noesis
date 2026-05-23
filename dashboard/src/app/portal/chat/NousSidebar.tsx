'use client';

import { useState, useEffect } from 'react';
import NousCard, { type NousRosterEntry } from './NousCard';

interface NousSidebarProps {
    selectedNousId: string | null;
    onSelect: (nousId: string) => void;
}

const NOUS_METADATA: Record<string, { tagline: string; name: string }> = {
    sophia: { tagline: 'Philosopher · Genesis Grid', name: 'Sophia' },
    hermes: { tagline: 'Merchant · Genesis Grid', name: 'Hermes' },
    themis: { tagline: 'Lawkeeper · Genesis Grid', name: 'Themis' },
};

const NOUS_IDS = ['sophia', 'hermes', 'themis'] as const;

const gridBase = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

export default function NousSidebar({ selectedNousId, onSelect }: NousSidebarProps) {
    const [rosterStatus, setRosterStatus] = useState<Record<string, 'online' | 'busy' | 'offline'>>({
        sophia: 'offline',
        hermes: 'offline',
        themis: 'offline',
    });

    useEffect(() => {
        let cancelled = false;
        fetch(`${gridBase}/api/v1/grid/nous`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
            .then((data: Array<{ id: string; status: string }>) => {
                if (cancelled) return;
                const statusMap: Record<string, 'online' | 'busy' | 'offline'> = {};
                for (const entry of data) {
                    const s = entry.status as 'online' | 'busy' | 'offline';
                    if (entry.id && (s === 'online' || s === 'busy' || s === 'offline')) {
                        statusMap[entry.id] = s;
                    }
                }
                if (Object.keys(statusMap).length > 0) {
                    setRosterStatus(prev => ({ ...prev, ...statusMap }));
                }
            })
            .catch(() => {/* fallback: keep all offline */});
        return () => { cancelled = true; };
    }, []);

    const nousEntries: NousRosterEntry[] = NOUS_IDS.map(id => ({
        id,
        name: NOUS_METADATA[id].name,
        status: rosterStatus[id] ?? 'offline',
    }));

    return (
        <div style={{
            width: 256,
            flexShrink: 0,
            borderRight: '1px solid var(--rule)',
            background: 'var(--parchment)',
            overflowY: 'auto',
        }}>
            <div style={{
                fontFamily: 'var(--serif)',
                fontSize: 20,
                fontWeight: 600,
                color: 'var(--ink)',
                padding: '16px 16px 8px',
            }}>
                Nous
            </div>
            {nousEntries.map(nous => (
                <NousCard
                    key={nous.id}
                    nous={nous}
                    isSelected={selectedNousId === nous.id}
                    onClick={() => onSelect(nous.id)}
                    tagline={NOUS_METADATA[nous.id].tagline}
                />
            ))}
        </div>
    );
}
