'use client';

import { useState } from 'react';

interface ChatInputProps {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    disabled: boolean;
    placeholder: string;
}

export default function ChatInput({ value, onChange, onSubmit, disabled, placeholder }: ChatInputProps) {
    const [focused, setFocused] = useState(false);

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!disabled && value.trim()) {
                onSubmit();
            }
        }
    }

    return (
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            style={{
                flex: 1,
                background: 'var(--vellum)',
                border: `1px solid ${focused ? 'var(--terracotta-2)' : 'var(--rule)'}`,
                borderRadius: 8,
                padding: '12px 16px',
                fontFamily: 'var(--sans-portal)',
                fontSize: 16,
                color: 'var(--ink)',
                resize: 'none',
                minHeight: 44,
                maxHeight: 120,
                overflowY: 'auto',
                outline: 'none',
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'text',
                lineHeight: 1.4,
                boxSizing: 'border-box',
            }}
        />
    );
}
