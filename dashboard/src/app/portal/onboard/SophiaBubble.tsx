interface Props { content: string; }

export default function SophiaBubble({ content }: Props) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
            <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: '#da7a4e', opacity: 0.85,
                boxShadow: '0 0 6px rgba(218,122,78,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--mono-portal)', fontSize: 11, color: '#020610', fontWeight: 600,
            }}>
                Σ
            </div>
            <div style={{
                background: 'rgba(218,122,78,0.08)',
                border: '1px solid rgba(218,122,78,0.18)',
                borderRadius: '4px 12px 12px 12px',
                padding: '12px 16px',
                maxWidth: '85%',
                fontFamily: 'var(--serif)',
                fontSize: 16,
                lineHeight: 1.6,
                color: '#f5f0ea',
            }}>
                {content}
            </div>
        </div>
    );
}
