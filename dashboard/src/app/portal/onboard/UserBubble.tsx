interface Props { content: string; }

export default function UserBubble({ content }: Props) {
    return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <div style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '12px 4px 12px 12px',
                padding: '12px 16px',
                maxWidth: '80%',
                fontFamily: 'var(--sans-portal)',
                fontSize: 16,
                lineHeight: 1.6,
                color: '#f5f0ea',
            }}>
                {content}
            </div>
        </div>
    );
}
