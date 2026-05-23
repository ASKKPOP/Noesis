'use client';

import { useRouter } from 'next/navigation';
import { formatUnits } from 'viem';
import { SophiaAvatar } from '@/components/portal/avatars/SophiaAvatar';
import { HermesAvatar } from '@/components/portal/avatars/HermesAvatar';
import { ThemisAvatar } from '@/components/portal/avatars/ThemisAvatar';

interface HeroCardProps {
    nousId: string;
    region: string;
    ousia: string;
    status: string;
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

function titleCase(str: string): string {
    if (!str || str === '—') return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export default function HeroCard({ nousId, region, ousia, status: _status }: HeroCardProps) {
    const router = useRouter();
    const meta = NOUS_METADATA[nousId];
    const AvatarComponent = AVATAR_MAP[nousId];

    if (!meta || !AvatarComponent) return null;

    const ousiaDisplay = formatUnits(BigInt(ousia || '0'), 6);

    return (
        <div style={{
            background: 'var(--parchment)',
            border: '1px solid var(--rule)',
            borderRadius: 10,
            overflow: 'hidden',
            marginBottom: 24,
        }}>
            {/* Top stripe */}
            <div style={{
                height: 2,
                background: 'linear-gradient(90deg, var(--terracotta), var(--terracotta-2))',
            }} />

            {/* Inner */}
            <div style={{
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
                padding: 24,
            }}>
                {/* Avatar slot */}
                <div style={{ flexShrink: 0, width: 80, height: 80 }}>
                    <AvatarComponent size={80} />
                </div>

                {/* Text block */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontFamily: 'var(--serif)',
                        fontSize: 28,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        lineHeight: 1.1,
                    }}>
                        {meta.name}
                    </div>
                    <div style={{
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 13,
                        fontWeight: 400,
                        color: 'var(--muted)',
                        marginTop: 4,
                    }}>
                        {meta.tagline}
                    </div>
                    <div style={{
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 13,
                        fontWeight: 400,
                        color: 'var(--muted)',
                        marginTop: 8,
                    }}>
                        Region: {titleCase(region)}
                    </div>
                    <div style={{
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 13,
                        fontWeight: 400,
                        color: 'var(--muted)',
                        marginTop: 4,
                    }}>
                        Ousia: {ousiaDisplay} USDT
                    </div>
                </div>

                {/* Chat button */}
                <button
                    onClick={() => router.push(`/portal/chat?nous=${nousId}`)}
                    style={{
                        alignSelf: 'flex-start',
                        padding: '8px 20px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'var(--terracotta-2)',
                        color: '#fff',
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 16,
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'opacity 0.12s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                >
                    Chat with {meta.name}
                </button>
            </div>
        </div>
    );
}
