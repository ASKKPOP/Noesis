'use client';

import { useRouter } from 'next/navigation';
import { formatUnits } from 'viem';
import { SophiaAvatar } from '@/components/portal/avatars/SophiaAvatar';
import { HermesAvatar } from '@/components/portal/avatars/HermesAvatar';
import { ThemisAvatar } from '@/components/portal/avatars/ThemisAvatar';
import { PersonalNousAvatar } from '@/components/portal/avatars/PersonalNousAvatar';

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

const AVATAR_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
    sophia: SophiaAvatar,
    hermes: HermesAvatar,
    themis: ThemisAvatar,
};

function isPersonalNousDid(nousId: string): boolean {
    return nousId.startsWith('did:noesis:human-nous:');
}

function extractPersonalNousName(nousId: string): string {
    // did:noesis:human-nous:<prefix>-<name> — name may contain underscores; prefix is hex (no underscores)
    const tail = nousId.replace('did:noesis:human-nous:', '');
    const dashIdx = tail.indexOf('-');
    if (dashIdx === -1) return tail;
    return tail.slice(dashIdx + 1);
}

function resolveNousMeta(nousId: string): { name: string; tagline: string } {
    if (NOUS_METADATA[nousId]) return NOUS_METADATA[nousId]; // genesis Nous
    if (isPersonalNousDid(nousId)) {
        const rawName = extractPersonalNousName(nousId);
        const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        return { name: displayName, tagline: `${displayName} · Personal Nous` };
    }
    return { name: nousId, tagline: 'Unknown Nous' }; // fallback
}

function resolveAvatar(nousId: string): React.ComponentType<{ size?: number; style?: React.CSSProperties }> {
    if (AVATAR_MAP[nousId]) return AVATAR_MAP[nousId];
    if (isPersonalNousDid(nousId)) return PersonalNousAvatar;
    return PersonalNousAvatar; // safe fallback
}

function titleCase(str: string): string {
    if (!str || str === '—') return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export default function HeroCard({ nousId, region, ousia, status: _status }: HeroCardProps) {
    const router = useRouter();
    const meta = resolveNousMeta(nousId);
    const AvatarComponent = resolveAvatar(nousId);
    const chatHref = `/portal/chat?nous=${encodeURIComponent(nousId)}`;

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
                    onClick={() => router.push(chatHref)}
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
