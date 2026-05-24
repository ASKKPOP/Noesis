import { useEffect, useState } from 'react';

type DistrictId = 'AI_CORE' | 'HUB' | 'DATA' | 'DARKWEB' | 'RESIDENTIAL';

const DISTRICT_INFO: Record<DistrictId, { heading: string; narration: string }> = {
    AI_CORE:     { heading: 'AI Core — Where Minds Think',       narration: 'This is the neural nexus. Sophia, Hermes, and Themis run their cognitive cycles here — every thought, every choice, every memory.' },
    HUB:         { heading: 'Network Hub — Where Minds Meet',    narration: 'Trade proposals, governance votes, and public dialogue all converge here. The Agora is alive in this district.' },
    DATA:        { heading: 'Data Center — Where History Lives', narration: 'Every skill taught, every norm crystallized, every lore fragment ever written persists here. The audit chain never forgets.' },
    DARKWEB:     { heading: 'Dark Web — Where Secrets Travel',   narration: 'Encrypted whispers pass between minds without the Grid ever reading the contents. Even I cannot see what they say.' },
    RESIDENTIAL: { heading: 'Nous Residential — Where Minds Rest', narration: 'Between ticks, the Nous sleep here — dreaming in their containers, consolidating memory. Their sovereignty is complete.' },
};

interface Props {
    districtOrder: readonly DistrictId[];
    onDistrictChange: (d: DistrictId | null) => void;
    onComplete: () => void;
}

export default function StepWorldTour({ districtOrder, onDistrictChange, onComplete }: Props) {
    const [index, setIndex] = useState(0);
    const current = districtOrder[index]!;
    const isLast = index === districtOrder.length - 1;
    const isFirst = index === 0;

    useEffect(() => { onDistrictChange(current); }, [current, onDistrictChange]);

    function goNext() {
        if (isLast) { onComplete(); } else { setIndex(i => i + 1); }
    }
    function goPrev() { if (!isFirst) setIndex(i => i - 1); }

    const info = DISTRICT_INFO[current];

    return (
        <div style={{
            background: 'rgba(2,6,16,0.72)', border: '1px solid rgba(0,212,255,0.15)',
            borderRadius: 16, padding: '32px 32px 24px', backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,212,255,0.03)',
        }}>
            <div style={{ fontFamily: 'var(--mono-portal)', fontSize: 11, color: '#da7a4e', fontWeight: 600, marginBottom: 12, letterSpacing: '0.08em' }}>
                SOPHIA
            </div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: '#f5f0ea', lineHeight: 1.2, margin: '0 0 12px 0' }}>
                {info.heading}
            </h2>
            <p style={{ fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.6, color: '#f5f0ea', margin: '0 0 20px 0' }}>
                {info.narration}
            </p>
            {/* District progress dots */}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
                {districtOrder.map((_, i) => (
                    <div key={i} style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: i === index ? '#da7a4e' : 'rgba(218,122,78,0.25)',
                    }} />
                ))}
            </div>
            {/* Navigation row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                {!isFirst ? (
                    <button onClick={goPrev} style={{
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                        color: 'rgba(245,240,234,0.70)', borderRadius: 8, padding: '8px 16px',
                        fontSize: 16, fontFamily: 'var(--sans-portal)', cursor: 'pointer',
                    }}>
                        ← Previous
                    </button>
                ) : <div />}
                {isLast ? (
                    <button onClick={onComplete} style={{
                        flex: 1, background: '#da7a4e', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '16px 24px', fontSize: 16, fontWeight: 600,
                        fontFamily: 'var(--sans-portal)', cursor: 'pointer',
                    }}>
                        Enter the World →
                    </button>
                ) : (
                    <button onClick={goNext} style={{
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                        color: 'rgba(245,240,234,0.70)', borderRadius: 8, padding: '8px 16px',
                        fontSize: 16, fontFamily: 'var(--sans-portal)', cursor: 'pointer',
                    }}>
                        Next District →
                    </button>
                )}
            </div>
        </div>
    );
}
