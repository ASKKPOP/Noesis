'use client';

import { SophiaAvatar } from '@/components/portal/avatars/SophiaAvatar';
import { HermesAvatar } from '@/components/portal/avatars/HermesAvatar';
import { ThemisAvatar } from '@/components/portal/avatars/ThemisAvatar';

interface LoadingBubbleProps {
    nousId: string;
}

const AVATAR_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
    sophia: SophiaAvatar,
    hermes: HermesAvatar,
    themis: ThemisAvatar,
};

const NOUS_NAMES: Record<string, string> = {
    sophia: 'Sophia',
    hermes: 'Hermes',
    themis: 'Themis',
};

export default function LoadingBubble({ nousId }: LoadingBubbleProps) {
    const AvatarComponent = AVATAR_MAP[nousId] ?? SophiaAvatar;
    const name = NOUS_NAMES[nousId] ?? nousId;

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <AvatarComponent size={20} />
            <div style={{
                background: 'var(--parchment)',
                border: '1px solid var(--rule)',
                borderRadius: '4px 12px 12px 12px',
                padding: '12px 16px',
            }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    {[0, 1, 2].map(i => (
                        <span
                            key={i}
                            style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                background: 'var(--muted)',
                                display: 'inline-block',
                                animation: 'portal-pulse 1.4s ease-in-out infinite',
                                animationDelay: `${i * 0.15}s`,
                            }}
                        />
                    ))}
                </div>
                <div style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    fontWeight: 400,
                    fontStyle: 'italic',
                    color: 'var(--muted)',
                }}>
                    {name} is thinking…
                </div>
            </div>
        </div>
    );
}
