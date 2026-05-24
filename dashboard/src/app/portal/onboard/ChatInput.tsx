import type { KeyboardEvent } from 'react';

interface Props {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    disabled?: boolean;
    loading?: boolean;
}

export default function ChatInput({ value, onChange, onSend, disabled = false, loading = false }: Props) {
    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey && !disabled && !loading && value.trim()) {
            e.preventDefault();
            onSend();
        }
    }
    const isDisabled = disabled || loading;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isDisabled}
                placeholder="Reply to Sophia…"
                rows={2}
                style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8, padding: '12px 16px',
                    fontSize: 16, fontFamily: 'var(--sans-portal)', color: '#f5f0ea',
                    resize: 'none', outline: 'none',
                    opacity: isDisabled ? 0.5 : 1,
                    transition: 'border-color 0.15s',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(218,122,78,0.50)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            />
            <button
                onClick={onSend}
                disabled={isDisabled || !value.trim()}
                style={{
                    background: 'rgba(218,122,78,0.15)',
                    border: '1px solid rgba(218,122,78,0.30)',
                    borderRadius: 8, padding: '8px 20px',
                    color: '#da7a4e', fontSize: 16, fontWeight: 600,
                    fontFamily: 'var(--sans-portal)',
                    cursor: isDisabled || !value.trim() ? 'not-allowed' : 'pointer',
                    opacity: isDisabled || !value.trim() ? 0.5 : 1,
                    alignSelf: 'flex-end',
                }}
            >
                Send Reply
            </button>
        </div>
    );
}
