'use client';
import { useState } from 'react';
import HeroCard from '../nous/[id]/HeroCard';
import ProfileTabBar from '../nous/[id]/ProfileTabBar';
import SkillsTab from '../nous/[id]/SkillsTab';
import LoreTab from '../nous/[id]/LoreTab';
import NormsTab from '../nous/[id]/NormsTab';
import OwnerInfoSection from './OwnerInfoSection';

type Tab = 'skills' | 'lore' | 'norms';

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

interface Props { nous: NousRecord; }

export default function OwnerHub({ nous }: Props) {
    const [activeTab, setActiveTab] = useState<Tab>('skills');
    return (
        <div style={{ padding: '32px 24px', maxWidth: 800, margin: '0 auto' }}>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600,
                color: 'var(--ink)', marginBottom: 16 }}>My Nous</h1>

            <HeroCard
                nousId={nous.did}
                region={nous.region}
                ousia={nous.ousia}
                status={nous.status ?? 'active'}
            />

            <div style={{ marginTop: 20 }}>
                <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />
                <div style={{ paddingTop: 20 }}>
                    {activeTab === 'skills' && <SkillsTab nousId={nous.did} />}
                    {activeTab === 'lore'   && <LoreTab   nousId={nous.did} />}
                    {activeTab === 'norms'  && <NormsTab  nousId={nous.did} />}
                </div>
            </div>

            <OwnerInfoSection
                seed={nous.personality_seed}
                spawnedAtTick={nous.spawned_at_tick}
                spawnCostUsdt={nous.spawn_cost_usdt ?? '50'}
                nousCoinBalance={nous.ousia}
            />
        </div>
    );
}
