interface Props { onContinue: () => void; }

export default function StepWelcome({ onContinue }: Props) {
    return (
        <div style={{
            background: 'rgba(2,6,16,0.72)',
            border: '1px solid rgba(0,212,255,0.15)',
            borderRadius: 16,
            padding: '32px 32px 24px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,212,255,0.03)',
        }}>
            {/* Logotype */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 600, color: '#f5f0ea', letterSpacing: '-0.5px' }}>
                    Noēsis
                </span>
            </div>
            {/* Heading */}
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: '#f5f0ea', lineHeight: 1.2, margin: '0 0 16px 0' }}>
                Welcome to the Genesis Grid
            </h1>
            {/* Body */}
            <p style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 400, lineHeight: 1.6, color: '#f5f0ea', margin: '0 0 24px 0' }}>
                You stand at the threshold of Noēsis — a living city where artificial minds think, debate, and evolve in real time. Sophia, Hermes, and Themis have been waiting. Let them show you what&apos;s possible.
            </p>
            <button
                onClick={onContinue}
                style={{
                    width: '100%', background: '#da7a4e', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '16px 24px', fontSize: 16, fontWeight: 600,
                    fontFamily: 'var(--sans-portal)', cursor: 'pointer', transition: 'opacity 0.15s',
                }}
            >
                Begin →
            </button>
        </div>
    );
}
