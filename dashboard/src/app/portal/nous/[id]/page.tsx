'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import HeroCard from './HeroCard';
import ProfileTabBar from './ProfileTabBar';
import SkillsTab from './SkillsTab';
import LoreTab from './LoreTab';
import NormsTab from './NormsTab';

export type ProfileTab = 'skills' | 'lore' | 'norms';

const KNOWN_NOUS = ['sophia', 'hermes', 'themis'];

export default function NousProfilePage() {
    const params = useParams<{ id: string }>();
    const nousId = Array.isArray(params?.id) ? params.id[0] : params?.id;
    const [activeTab, setActiveTab] = useState<ProfileTab>('skills');

    const [nousData, setNousData] = useState<{
        status: string; region: string; ousia: string;
    } | null>(null);

    const gridBase = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

    useEffect(() => {
        if (!nousId || !KNOWN_NOUS.includes(nousId)) return;
        fetch(`${gridBase}/api/v1/grid/nous`, { credentials: 'include' })
            .then(r => r.json())
            .then((roster: Array<{ did: string; status: string; region: string; ousia: string }>) => {
                const entry = roster.find(n => n.did === `did:noesis:${nousId}`);
                if (entry) setNousData({ status: entry.status, region: entry.region, ousia: entry.ousia });
            })
            .catch(() => null);
    }, [nousId, gridBase]);

    if (!nousId || !KNOWN_NOUS.includes(nousId)) {
        return (
            <div style={{ padding: '32px 24px', maxWidth: 800, margin: '0 auto' }}>
                <h2 style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 20,
                    fontWeight: 600,
                    color: 'var(--ink)',
                }}>
                    Nous not found.
                </h2>
                <a
                    href="/portal/chat"
                    style={{
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 16,
                        color: 'var(--terracotta-2)',
                    }}
                >
                    Return to chat
                </a>
            </div>
        );
    }

    return (
        <div style={{ padding: '32px 24px', maxWidth: 800, margin: '0 auto' }}>
            <HeroCard
                nousId={nousId}
                region={nousData?.region ?? '—'}
                ousia={nousData?.ousia ?? '0'}
                status={nousData?.status ?? 'offline'}
            />
            <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />
            <div style={{ paddingTop: 20 }}>
                {activeTab === 'skills' && <SkillsTab nousId={nousId} />}
                {activeTab === 'lore'   && <LoreTab nousId={nousId} />}
                {activeTab === 'norms'  && <NormsTab nousId={nousId} />}
            </div>
        </div>
    );
}
