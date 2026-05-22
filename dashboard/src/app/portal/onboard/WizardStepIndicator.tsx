interface Props { currentStep: 1 | 2 | 3; }

export default function WizardStepIndicator({ currentStep }: Props) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 16 }}>
            {[1, 2, 3].map((n, i) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
                    {i > 0 && (
                        <div style={{ width: 24, height: 1, background: 'rgba(218,122,78,0.25)' }} />
                    )}
                    <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: currentStep === n ? '#da7a4e' : 'rgba(218,122,78,0.25)',
                        boxShadow: currentStep === n ? '0 0 8px #da7a4e' : 'none',
                    }} />
                </div>
            ))}
        </div>
    );
}
