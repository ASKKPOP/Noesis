'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const DID_REGEX = /^did:noesis:[a-z0-9_\-]+$/i;

export function NousFilterBar() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentFilter = searchParams.get('nous') ?? '';
    const [inputValue, setInputValue] = useState(currentFilter);

    // Debounced URL update (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            const isValid = DID_REGEX.test(inputValue);
            if (inputValue === '' || isValid) {
                const url = inputValue ? `/culture?nous=${encodeURIComponent(inputValue)}` : '/culture';
                router.replace(url);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [inputValue, router]);

    const clearFilter = useCallback(() => {
        setInputValue('');
        router.replace('/culture');
    }, [router]);

    const isActive = DID_REGEX.test(currentFilter);

    return (
        <div
            style={{
                background: 'var(--vellum)',
                borderBottom: '1px solid var(--rule)',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                position: 'sticky',
                top: 0,
                zIndex: 10,
                marginBottom: 24,
            }}
        >
            <span
                style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                }}
            >
                Filter by Nous
            </span>
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="did:noesis:..."
                aria-label="Filter by Nous DID"
                aria-describedby="nous-filter-help"
                style={{
                    width: 320,
                    height: 32,
                    padding: '8px 12px',
                    background: 'var(--parchment)',
                    border: '1px solid var(--rule)',
                    borderRadius: 4,
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--ink)',
                    outline: 'none',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--terracotta)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--rule)'; }}
            />
            <span id="nous-filter-help" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                Enter a Nous DID to filter the culture views. Leave blank to show all.
            </span>
            {isActive && (
                <div
                    style={{
                        background: 'rgba(184,84,47,0.10)',
                        border: '1px solid rgba(184,84,47,0.3)',
                        borderRadius: 12,
                        padding: '4px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <span
                        style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 11,
                            color: 'var(--terracotta)',
                        }}
                    >
                        {currentFilter.length > 14
                            ? `${currentFilter.slice(0, 8)}…${currentFilter.slice(-6)}`
                            : currentFilter}
                    </span>
                    <button
                        role="button"
                        aria-label="Clear filter"
                        onClick={clearFilter}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--terracotta)',
                            fontFamily: 'var(--mono)',
                            fontSize: 14,
                            padding: 0,
                            lineHeight: 1,
                        }}
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
}
