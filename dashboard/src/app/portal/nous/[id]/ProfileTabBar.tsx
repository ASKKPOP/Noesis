'use client';

import { type ProfileTab } from './page';

interface ProfileTabBarProps {
    activeTab: ProfileTab;
    onTabChange: (tab: ProfileTab) => void;
}

const TABS: Array<{ key: ProfileTab; label: string }> = [
    { key: 'skills', label: 'Skills' },
    { key: 'lore',   label: 'Lore' },
    { key: 'norms',  label: 'Norms' },
];

export default function ProfileTabBar({ activeTab, onTabChange }: ProfileTabBarProps) {
    return (
        <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--rule)',
            marginBottom: 0,
        }}>
            {TABS.map(({ key, label }) => {
                const isActive = activeTab === key;
                return (
                    <button
                        key={key}
                        onClick={() => onTabChange(key)}
                        style={{
                            padding: '12px 20px',
                            fontFamily: 'var(--sans-portal)',
                            fontSize: 13,
                            fontWeight: 600,
                            color: isActive ? 'var(--ink)' : 'var(--muted)',
                            cursor: 'pointer',
                            border: 'none',
                            background: 'transparent',
                            borderBottom: isActive
                                ? '2px solid var(--terracotta-2)'
                                : '2px solid transparent',
                            transition: 'color 0.12s, border-color 0.12s',
                        }}
                        onMouseEnter={e => {
                            if (!isActive) {
                                (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (!isActive) {
                                (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)';
                            }
                        }}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}
