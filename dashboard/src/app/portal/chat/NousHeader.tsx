'use client';

import { SophiaAvatar } from '@/components/portal/avatars/SophiaAvatar';
import { HermesAvatar } from '@/components/portal/avatars/HermesAvatar';
import { ThemisAvatar } from '@/components/portal/avatars/ThemisAvatar';

interface NousHeaderProps {
    nousId: string;
}

const NOUS_METADATA: Record<string, { name: string; tagline: string }> = {
    sophia: { name: 'Sophia', tagline: 'Philosopher · Genesis Grid' },
    hermes: { name: 'Hermes', tagline: 'Merchant · Genesis Grid' },
    themis: { name: 'Themis', tagline: 'Lawkeeper · Genesis Grid' },
};

const AVATAR_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
    sophia: SophiaAvatar,
    hermes: HermesAvatar,
    themis: ThemisAvatar,
};

export default function NousHeader({ nousId }: NousHeaderProps) {
    const meta = NOUS_METADATA[nousId] ?? { name: nousId, tagline: '' };
    const AvatarComponent = AVATAR_MAP[nousId] ?? SophiaAvatar;

    return (
        <div style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '0 16px',
            borderBottom: '1px solid var(--rule)',
            background: 'var(--parchment)',
            flexShrink: 0,
        }}>
            <AvatarComponent size={28} />
            <div>
                <div style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--ink)',
                    lineHeight: 1.2,
                }}>
                    {meta.name}
                </div>
                <div style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    fontWeight: 400,
                    color: 'var(--muted)',
                    lineHeight: 1.2,
                }}>
                    {meta.tagline}
                </div>
            </div>
        </div>
    );
}
