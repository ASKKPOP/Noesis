'use client';
import { useState } from 'react';

interface Props {
    initial: string;
    onBack: () => void;
    onNext: (region: string) => void;
}

const REGIONS = [
    { value: 'agora',    label: 'Agora' },
    { value: 'nexus',    label: 'Nexus' },
    { value: 'archive',  label: 'Archive' },
    { value: 'frontier', label: 'Frontier' },
];

// Inline chevron SVG as data URL for custom select arrow
const CHEVRON_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%230b1220' stroke-opacity='0.5' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

export default function StepRegion({ initial, onBack, onNext }: Props) {
    const [region, setRegion] = useState(initial);

    return (
        <div className="noesis-card" style={{ padding: 24 }}>
            <h2 style={{
                fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600,
                color: 'var(--ink)', marginBottom: 4,
            }}>
                Pick a Starting Region
            </h2>
            <p style={{
                fontFamily: 'var(--sans-portal)', fontSize: 13,
                color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5,
            }}>
                Where your Nous will begin its journey in the Genesis Grid.
            </p>

            <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                style={{
                    width: '100%', padding: '8px 16px', borderRadius: 8,
                    border: '1px solid var(--rule)',
                    background: 'var(--vellum)',
                    fontFamily: 'var(--sans-portal)', fontSize: 16, color: 'var(--ink)',
                    cursor: 'pointer', appearance: 'none',
                    backgroundImage: CHEVRON_SVG,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 16px center',
                    paddingRight: 40,
                    outline: 'none',
                    boxSizing: 'border-box',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--terracotta-2)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--rule)'; }}
            >
                <option value="" style={{ color: 'var(--muted)' }}>Choose a region…</option>
                {REGIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                ))}
            </select>

            {/* Navigation */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--rule)',
            }}>
                <button
                    type="button"
                    onClick={onBack}
                    style={{
                        padding: '8px 20px', borderRadius: 8,
                        border: '1px solid var(--rule)',
                        background: 'transparent',
                        fontFamily: 'var(--sans-portal)', fontSize: 16,
                        fontWeight: 600, color: 'var(--muted)',
                        cursor: 'pointer', minHeight: 44,
                    }}
                >
                    Back
                </button>
                <button
                    type="button"
                    onClick={() => region && onNext(region)}
                    disabled={!region}
                    style={{
                        padding: '8px 24px', borderRadius: 8, border: 'none',
                        background: 'var(--terracotta-2)', color: '#fff',
                        fontFamily: 'var(--sans-portal)', fontSize: 16, fontWeight: 600,
                        cursor: region ? 'pointer' : 'not-allowed',
                        minHeight: 44,
                        opacity: region ? 1 : 0.4,
                    }}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
