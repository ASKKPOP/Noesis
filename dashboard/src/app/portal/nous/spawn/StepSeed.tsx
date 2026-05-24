'use client';
import { useState } from 'react';
import SeedCard from './SeedCard';
import type { Seed } from './SpawnWizardClient';

interface Props {
    initial: Seed;
    onBack: () => void;
    onNext: (seed: Seed) => void;
}

const SEEDS: Seed[] = ['Explorer', 'Scholar', 'Merchant', 'Guardian'];

export default function StepSeed({ initial, onBack, onNext }: Props) {
    const [selected, setSelected] = useState<Seed | null>(initial ?? null);

    return (
        <div className="noesis-card" style={{ padding: 24 }}>
            <h2 style={{
                fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600,
                color: 'var(--ink)', marginBottom: 4,
            }}>
                Choose a Personality Seed
            </h2>
            <p style={{
                fontFamily: 'var(--sans-portal)', fontSize: 13,
                color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5,
            }}>
                This shapes your Nous&apos;s drives, reasoning style, and chat personality.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SEEDS.map(seed => (
                    <SeedCard
                        key={seed}
                        seed={seed}
                        selected={selected === seed}
                        onClick={() => setSelected(seed)}
                    />
                ))}
            </div>

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
                    onClick={() => selected && onNext(selected)}
                    disabled={selected === null}
                    style={{
                        padding: '8px 24px', borderRadius: 8, border: 'none',
                        background: 'var(--terracotta-2)', color: '#fff',
                        fontFamily: 'var(--sans-portal)', fontSize: 16, fontWeight: 600,
                        cursor: selected ? 'pointer' : 'not-allowed',
                        minHeight: 44,
                        opacity: selected ? 1 : 0.4,
                    }}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
