'use client';

type Seed = 'Explorer' | 'Scholar' | 'Merchant' | 'Guardian';

interface Props {
    seed: Seed;
    selected: boolean;
    onClick: () => void;
}

const SEED_DESCRIPTIONS: Record<Seed, string> = {
    Explorer: 'High curiosity, restless spirit. Drawn to the unknown, open to surprise, low routine.',
    Scholar:  'Deep focus, methodical. Driven by knowledge, deliberate, low impulsivity.',
    Merchant: 'Social energy, goal-oriented. Connects quickly, drives outcomes, structured.',
    Guardian: 'Steady presence, reliable. Protective instinct, agreeable, high resilience.',
};

const SEED_ACCENTS: Record<Seed, string> = {
    Explorer: 'var(--terracotta-2)',
    Scholar:  'var(--bronze)',
    Merchant: 'var(--terracotta)',
    Guardian: 'var(--navy)',
};

// Simple 4-pointed star sparkle path
function SparkleIcon({ color }: { color: string }) {
    return (
        <svg
            width={24}
            height={24}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ flexShrink: 0 }}
        >
            <path
                d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z"
                fill={color}
            />
        </svg>
    );
}

export default function SeedCard({ seed, selected, onClick }: Props) {
    const accent = SEED_ACCENTS[seed];
    const description = SEED_DESCRIPTIONS[seed];

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
            style={{
                padding: 16, borderRadius: 8,
                border: '1px solid var(--rule)',
                background: selected ? 'var(--parchment-2)' : 'var(--parchment)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 8,
                borderLeft: `3px solid ${selected ? accent : 'transparent'}`,
                transition: 'border-color 0.12s, background 0.12s',
                outline: 'none',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <SparkleIcon color={selected ? 'var(--terracotta-2)' : 'var(--muted)'} />
                <div style={{ flex: 1 }}>
                    <div style={{
                        fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600,
                        color: 'var(--ink)', lineHeight: 1.1, marginBottom: 4,
                    }}>
                        {seed}
                    </div>
                    <div style={{
                        fontFamily: 'var(--sans-portal)', fontSize: 13,
                        color: 'var(--muted)', lineHeight: 1.5,
                    }}>
                        {description}
                    </div>
                </div>
            </div>
            {selected && (
                <span style={{
                    fontFamily: 'var(--mono-portal)', fontSize: 13, fontWeight: 600,
                    color: 'var(--bronze)', background: 'var(--parchment-2)',
                    border: '1px solid var(--rule)', borderRadius: 2,
                    padding: '4px 8px', letterSpacing: '0.08em',
                    textTransform: 'uppercase', display: 'inline-block',
                }}>
                    {seed.toUpperCase()}
                </span>
            )}
        </div>
    );
}
