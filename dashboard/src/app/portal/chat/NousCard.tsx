'use client';

import { SophiaAvatar } from '@/components/portal/avatars/SophiaAvatar';
import { HermesAvatar } from '@/components/portal/avatars/HermesAvatar';
import { ThemisAvatar } from '@/components/portal/avatars/ThemisAvatar';

export interface NousRosterEntry {
    id: string;
    name: string;
    status: 'online' | 'busy' | 'offline';
}

interface NousCardProps {
    nous: NousRosterEntry;
    isSelected: boolean;
    onClick: () => void;
    tagline: string;
}

const AVATAR_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
    sophia: SophiaAvatar,
    hermes: HermesAvatar,
    themis: ThemisAvatar,
};

const ACCENT_MAP: Record<string, string> = {
    sophia: 'var(--bronze)',
    hermes: 'var(--terracotta)',
    themis: 'var(--navy)',
};

const STATUS_COLOR: Record<string, string> = {
    online: '#4ade80',
    busy: '#fcd34d',
    offline: 'rgba(11,18,32,0.25)',
};

export default function NousCard({ nous, isSelected, onClick, tagline }: NousCardProps) {
    const AvatarComponent = AVATAR_MAP[nous.id] ?? SophiaAvatar;
    const accent = ACCENT_MAP[nous.id] ?? 'var(--bronze)';
    const dotColor = STATUS_COLOR[nous.status] ?? STATUS_COLOR.offline;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
            style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: '12px 16px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background 0.12s, border-color 0.12s',
                background: isSelected ? 'var(--parchment-2)' : 'transparent',
                borderTop: isSelected ? '1px solid var(--rule)' : '1px solid transparent',
                borderRight: isSelected ? '1px solid var(--rule)' : '1px solid transparent',
                borderBottom: isSelected ? '1px solid var(--rule)' : '1px solid transparent',
                borderLeft: isSelected ? `3px solid ${accent}` : '3px solid transparent',
            }}
        >
            <AvatarComponent size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    marginBottom: 2,
                }}>
                    {nous.name}
                </div>
                <div style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    fontWeight: 400,
                    color: 'var(--muted)',
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {tagline}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: dotColor,
                        flexShrink: 0,
                        boxShadow: nous.status === 'online' ? `0 0 6px ${dotColor}` : 'none',
                        display: 'inline-block',
                    }} />
                    <span style={{
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 13,
                        fontWeight: 400,
                        color: 'var(--muted)',
                        textTransform: 'capitalize',
                    }}>
                        {nous.status}
                    </span>
                </div>
            </div>
        </div>
    );
}
