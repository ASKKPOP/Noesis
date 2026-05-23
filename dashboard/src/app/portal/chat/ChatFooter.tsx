'use client';

import { useState } from 'react';
import ChatInput from './ChatInput';
import TipPanel from './TipPanel';

interface ChatFooterProps {
    selectedNousId: string | null;
    onSend: (text: string) => void;
    onTipConfirmed: (amount: number) => void;
    isLoading: boolean;
}

export default function ChatFooter({ selectedNousId, onSend, onTipConfirmed, isLoading }: ChatFooterProps) {
    const [inputText, setInputText] = useState('');
    const [showTipPanel, setShowTipPanel] = useState(false);

    function handleSubmit() {
        const text = inputText.trim();
        if (!text || isLoading || !selectedNousId) return;
        setInputText('');
        onSend(text);
    }

    function handleTipConfirmed(amount: number) {
        setShowTipPanel(false);
        onTipConfirmed(amount);
    }

    const disabled = isLoading || !selectedNousId;

    return (
        <div style={{
            padding: '12px 16px',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            background: 'var(--parchment)',
            borderTop: '1px solid var(--rule)',
            flexShrink: 0,
            position: 'relative',
        }}>
            {/* Slide-up TipPanel */}
            {showTipPanel && selectedNousId && (
                <TipPanel
                    nousId={selectedNousId}
                    onClose={() => setShowTipPanel(false)}
                    onTipConfirmed={handleTipConfirmed}
                />
            )}

            {/* Chat input */}
            <ChatInput
                value={inputText}
                onChange={setInputText}
                onSubmit={handleSubmit}
                disabled={disabled}
                placeholder={selectedNousId ? 'Write a message…' : 'Select a Nous to begin…'}
            />

            {/* Tip button */}
            <button
                onClick={() => setShowTipPanel(v => !v)}
                disabled={!selectedNousId}
                aria-label="Send tip"
                title="Send tip"
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    border: '1px solid var(--rule)',
                    background: 'var(--parchment-2)',
                    color: 'var(--bronze)',
                    cursor: selectedNousId ? 'pointer' : 'not-allowed',
                    opacity: selectedNousId ? 1 : 0.4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 18,
                    transition: 'background 0.12s',
                }}
            >
                ₮
            </button>

            {/* Send button */}
            <button
                onClick={handleSubmit}
                disabled={disabled || !inputText.trim()}
                aria-label="Send message"
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    border: 'none',
                    background: disabled || !inputText.trim() ? 'rgba(184,84,47,0.35)' : 'var(--terracotta-2)',
                    color: '#faf6ec',
                    cursor: disabled || !inputText.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'background 0.12s',
                }}
            >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
            </button>
        </div>
    );
}
