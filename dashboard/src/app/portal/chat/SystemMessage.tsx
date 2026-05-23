'use client';

interface SystemMessageProps {
    content: string;
}

export default function SystemMessage({ content }: SystemMessageProps) {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <span style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 13,
                fontWeight: 400,
                fontStyle: 'italic',
                color: 'var(--muted)',
            }}>
                {content}
            </span>
        </div>
    );
}
