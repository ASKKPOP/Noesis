'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import OwnerHub from './OwnerHub';

const GRID_BASE = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

interface NousRecord {
    did: string;
    name: string;
    region: string;
    personality_seed: string | null;
    spawned_at_tick: number;
    ousia: string;
    status?: string;
    spawn_cost_usdt?: string;
}

export default function MyNousPage() {
    const router = useRouter();
    const [nousData, setNousData] = useState<NousRecord | null | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        fetch(`${GRID_BASE}/api/v1/portal/human/me/nous`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { nous: null })
            .then((data: { nous: NousRecord | null }) => {
                if (!cancelled) setNousData(data.nous);
            })
            .catch(() => { if (!cancelled) setNousData(null); });
        return () => { cancelled = true; };
    }, []);

    if (nousData === undefined) {
        return (
            <div style={{ padding: '32px 24px', maxWidth: 800, margin: '0 auto' }}>
                <div style={{
                    background: 'var(--parchment-2)', borderRadius: 10, height: 112,
                    animation: 'portal-pulse 1.2s ease-in-out infinite',
                }} />
                <style>{`
                    @keyframes portal-pulse {
                        0%, 100% { opacity: 0.5; }
                        50% { opacity: 0.8; }
                    }
                `}</style>
            </div>
        );
    }

    if (nousData === null) {
        return (
            <div style={{ padding: '32px 24px', maxWidth: 800, margin: '0 auto' }}>
                <h1 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600,
                    color: 'var(--ink)', marginBottom: 8 }}>My Nous</h1>
                <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)',
                    lineHeight: 1.5, marginBottom: 24 }}>
                    Spawn and manage your own Nous agent in the Genesis Grid.
                </p>
                <div className="noesis-card" style={{
                    padding: '48px 32px', textAlign: 'center',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                }}>
                    {/* 40px sparkle SVG, bronze */}
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
                        <path d="M20 4 L22 18 L36 20 L22 22 L20 36 L18 22 L4 20 L18 18 Z" fill="var(--bronze)" />
                    </svg>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600,
                        color: 'var(--ink)' }}>You don&apos;t have a Nous yet.</h2>
                    <p style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)',
                        lineHeight: 1.6, maxWidth: 360 }}>
                        Bring a Nous to life in the Genesis Grid. Choose a name, a personality seed, and a home region.
                    </p>
                    <button type="button" onClick={() => router.push('/portal/nous/spawn')} style={{
                        padding: '8px 24px', borderRadius: 8, border: 'none',
                        background: 'var(--terracotta-2)', color: '#fff',
                        fontFamily: 'var(--sans-portal)', fontSize: 16, fontWeight: 600,
                        cursor: 'pointer', marginTop: 8, minHeight: 44,
                    }}>Spawn Your Nous</button>
                </div>
            </div>
        );
    }

    return <OwnerHub nous={nousData} />;
}
