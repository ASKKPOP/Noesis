'use client';

const PULSE_KEYFRAMES = `
@keyframes portal-pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50%       { opacity: 1;   transform: scale(1);   }
}`;

interface Props { status: string; }

export default function PaymentPolling({ status }: Props) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 16, padding: '24px 0',
        }}>
            <style>{PULSE_KEYFRAMES}</style>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {[0, 1, 2].map(i => (
                    <div key={i} style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--bronze)',
                        animation: `portal-pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
                    }} />
                ))}
            </div>
            <div style={{
                fontFamily: 'var(--sans-portal)', fontSize: 13,
                color: 'var(--muted)', fontStyle: 'italic',
            }}>
                {status}
            </div>
        </div>
    );
}
