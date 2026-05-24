'use client';

interface Props { currentStep: 1 | 2 | 3 | 4; }

const STEP_LABELS = ['Name', 'Seed', 'Region', 'Pay'] as const;

export default function StepIndicator({ currentStep }: Props) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {[1, 2, 3, 4].map((n, idx) => {
                    const isActive = n === currentStep;
                    const isCompleted = n < currentStep;
                    return (
                        <div
                            key={n}
                            style={{
                                display: 'flex', alignItems: 'center',
                                flex: idx < 3 ? 1 : 'unset',
                            }}
                        >
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                border: `2px solid ${isActive ? 'var(--terracotta-2)' : 'var(--rule)'}`,
                                background: (isActive || isCompleted) ? 'var(--parchment-2)' : 'var(--parchment)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontFamily: 'var(--mono-portal)', fontSize: 13,
                                fontWeight: isActive ? 600 : 400,
                                color: isActive ? 'var(--ink)' : 'var(--muted)',
                                flexShrink: 0,
                            }}>
                                {isCompleted ? '✓' : n}
                            </div>
                            {idx < 3 && (
                                <div style={{
                                    flex: 1, height: 1,
                                    background: n < currentStep ? 'var(--terracotta-2)' : 'var(--rule)',
                                }} />
                            )}
                        </div>
                    );
                })}
            </div>
            <div style={{ display: 'flex', gap: 0 }}>
                {STEP_LABELS.map((label) => (
                    <div key={label} style={{
                        flex: 1, textAlign: 'center',
                        fontFamily: 'var(--sans-portal)', fontSize: 13,
                        color: 'var(--muted)', marginTop: 4,
                    }}>
                        {label}
                    </div>
                ))}
            </div>
        </div>
    );
}
