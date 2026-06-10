/**
 * Step 4 — Next step chooser (final wizard screen).
 * Each enabled action completes onboarding with a goal string (the PATCH /me
 * onboarding_goal contract, D-12) and routes to its destination.
 * Civic-DID registration is disabled until the application flow ships (Phase 56).
 */

interface Props {
    /** Complete the wizard: store the goal, then navigate to dest. */
    onChoose: (goal: string, dest: string) => void;
    busy: boolean;
}

export default function StepNextActions({ onChoose, busy }: Props) {
    return (
        <div style={{
            background: 'rgba(2,6,16,0.72)', border: '1px solid rgba(0,212,255,0.15)',
            borderRadius: 16, padding: '32px 32px 24px', backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,212,255,0.03)',
        }}>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: '#f5f0ea', lineHeight: 1.2, margin: '0 0 8px 0' }}>
                Where to next?
            </h1>
            <p style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.55, color: 'rgba(245,240,234,0.70)', margin: '0 0 22px 0' }}>
                You&apos;re ready. Pick a first step — you can always find the rest from the Portal.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                    onClick={() => onChoose('Exploring Noēsis', '/portal')}
                    disabled={busy}
                    style={{
                        width: '100%', background: '#da7a4e', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '15px 24px', fontSize: 15, fontWeight: 600,
                        fontFamily: 'var(--sans-portal)', cursor: busy ? 'wait' : 'pointer',
                        opacity: busy ? 0.7 : 1,
                    }}
                >
                    Enter the Portal →
                </button>

                <button
                    onClick={() => onChoose('Meeting the Nous', '/portal/chat')}
                    disabled={busy}
                    style={{
                        width: '100%', background: 'rgba(255,255,255,0.05)', color: '#f5f0ea',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8, padding: '15px 24px', fontSize: 15, fontWeight: 600,
                        fontFamily: 'var(--sans-portal)', cursor: busy ? 'wait' : 'pointer',
                        opacity: busy ? 0.7 : 1,
                    }}
                >
                    Talk to a Nous →
                </button>

                <div style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.03)', color: 'rgba(245,240,234,0.40)',
                    border: '1px dashed rgba(255,255,255,0.12)',
                    borderRadius: 8, padding: '13px 24px', textAlign: 'center',
                }}>
                    <div style={{ fontFamily: 'var(--sans-portal)', fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
                        Civic-DID registration
                    </div>
                    <div style={{ fontFamily: 'var(--mono-portal)', fontSize: 10, letterSpacing: '0.10em', color: '#da7a4e' }}>
                        OPENS SOON — UNLOCKS GRID PARTICIPATION
                    </div>
                </div>
            </div>
        </div>
    );
}
