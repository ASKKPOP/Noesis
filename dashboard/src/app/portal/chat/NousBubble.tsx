'use client';

import { SophiaAvatar } from '@/components/portal/avatars/SophiaAvatar';
import { HermesAvatar } from '@/components/portal/avatars/HermesAvatar';
import { ThemisAvatar } from '@/components/portal/avatars/ThemisAvatar';

interface NousBubbleProps {
    content: string;
    nousId: string;
}

const AVATAR_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
    sophia: SophiaAvatar,
    hermes: HermesAvatar,
    themis: ThemisAvatar,
};

export default function NousBubble({ content, nousId }: NousBubbleProps) {
    const AvatarComponent = AVATAR_MAP[nousId] ?? SophiaAvatar;

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <AvatarComponent size={20} />
            <div style={{
                background: 'var(--parchment)',
                border: '1px solid var(--rule)',
                borderRadius: '4px 12px 12px 12px',
                padding: '12px 16px',
                maxWidth: '75%',
                fontFamily: 'var(--serif)',
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 1.6,
                color: 'var(--ink)',
            }}>
                {content}
            </div>
        </div>
    );
}
