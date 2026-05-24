'use client';

interface UserBubbleProps {
    content: string;
}

export default function UserBubble({ content }: UserBubbleProps) {
    return (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{
                background: 'var(--parchment-2)',
                border: '1px solid var(--rule)',
                borderRadius: '12px 4px 12px 12px',
                padding: '12px 16px',
                maxWidth: '75%',
                fontFamily: 'var(--sans-portal)',
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 1.6,
                color: 'var(--ink)',
            }}>
                {content}
            </div>
        </div>
    );
}
