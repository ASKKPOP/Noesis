'use client';
import { useState, useEffect } from 'react';

interface Props {
    initial: string;
    onNext: (name: string) => void;
}

const GRID_BASE = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
const NAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

export default function StepName({ initial, onNext }: Props) {
    const [name, setName] = useState(initial);
    const [checking, setChecking] = useState(false);
    const [checkResult, setCheckResult] = useState<boolean | null>(null); // true=available, false=taken
    const [touched, setTouched] = useState(false);

    const isValidFormat = NAME_RE.test(name);
    const isNameEmpty = name.trim().length === 0;
    const showFormatError = touched && !isNameEmpty && !isValidFormat;
    const showTakenError = checkResult === false;
    const canProceed = isValidFormat && checkResult === true && !checking;

    // Debounced async check-name
    useEffect(() => {
        if (!isValidFormat) {
            setCheckResult(null);
            return;
        }
        setChecking(true);
        const handle = setTimeout(async () => {
            try {
                const res = await fetch(
                    `${GRID_BASE}/api/v1/portal/nous/spawn/check-name?name=${encodeURIComponent(name)}`,
                    { credentials: 'include' },
                );
                const data = await res.json() as { available: boolean };
                setCheckResult(data.available);
            } catch {
                setCheckResult(null);
            } finally {
                setChecking(false);
            }
        }, 350);
        return () => clearTimeout(handle);
    }, [name, isValidFormat]);

    const didPreview = name
        ? `did:noesis:human-nous:0x????-${name}`
        : 'did:noesis:human-nous:…-';

    return (
        <div className="noesis-card" style={{ padding: 24 }}>
            <h2 style={{
                fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600,
                color: 'var(--ink)', marginBottom: 16,
            }}>
                Name Your Nous
            </h2>

            <label style={{
                display: 'block',
                fontFamily: 'var(--sans-portal)', fontSize: 16, fontWeight: 400,
                color: 'var(--ink)', marginBottom: 8,
            }}>
                Name
            </label>

            <input
                type="text"
                placeholder="e.g. Eidolon"
                value={name}
                onChange={e => { setName(e.target.value); setTouched(true); }}
                style={{
                    width: '100%', padding: '8px 16px', borderRadius: 8,
                    border: `1px solid ${showFormatError || showTakenError ? 'var(--terracotta)' : 'var(--rule)'}`,
                    background: 'var(--vellum)',
                    fontFamily: 'var(--sans-portal)', fontSize: 16, color: 'var(--ink)',
                    outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = showFormatError || showTakenError ? 'var(--terracotta)' : 'var(--terracotta-2)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = showFormatError || showTakenError ? 'var(--terracotta)' : 'var(--rule)'; setTouched(true); }}
            />

            <p style={{
                fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)',
                marginTop: 8, lineHeight: 1.5,
            }}>
                3–32 characters. Letters, numbers, and underscores only.
            </p>

            {showFormatError && (
                <p style={{
                    fontFamily: 'var(--sans-portal)', fontSize: 13,
                    color: 'var(--terracotta)', marginTop: 8,
                }}>
                    Name must be 3–32 characters: letters, numbers, underscores only.
                </p>
            )}

            {showTakenError && (
                <p style={{
                    fontFamily: 'var(--sans-portal)', fontSize: 13,
                    color: 'var(--terracotta)', marginTop: 8,
                }}>
                    This name is already taken. Please choose another.
                </p>
            )}

            {/* DID preview */}
            <div style={{
                marginTop: 16, padding: 16,
                background: 'var(--parchment)', borderRadius: 6,
                border: '1px solid var(--rule)',
            }}>
                <p style={{
                    fontFamily: 'var(--sans-portal)', fontSize: 13,
                    color: 'var(--muted)', marginBottom: 4,
                }}>
                    Your Nous DID
                </p>
                <p style={{
                    fontFamily: 'var(--mono-portal)', fontSize: 13,
                    color: 'var(--muted)', wordBreak: 'break-all',
                }}>
                    {didPreview}
                </p>
            </div>

            {/* Navigation */}
            <div style={{
                display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--rule)',
            }}>
                <button
                    type="button"
                    onClick={() => onNext(name)}
                    disabled={!canProceed}
                    style={{
                        padding: '8px 24px', borderRadius: 8, border: 'none',
                        background: 'var(--terracotta-2)', color: '#fff',
                        fontFamily: 'var(--sans-portal)', fontSize: 16, fontWeight: 600,
                        cursor: canProceed ? 'pointer' : 'not-allowed',
                        minHeight: 44,
                        opacity: canProceed ? 1 : 0.4,
                    }}
                >
                    {checking ? 'Checking…' : 'Next'}
                </button>
            </div>
        </div>
    );
}
