'use client';
import type { ReactNode } from 'react';

interface Props {
    name: string;
    seed: 'Explorer' | 'Scholar' | 'Merchant' | 'Guardian';
    region: string;
    costUsdt: string;
}

function Row({ label, value, valueElement }: {
    label: string;
    value?: string;
    valueElement?: ReactNode;
}) {
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderBottom: '1px solid var(--rule)',
        }}>
            <span style={{
                fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)',
            }}>
                {label}
            </span>
            {valueElement ?? (
                <span style={{
                    fontFamily: 'var(--sans-portal)', fontSize: 16,
                    fontWeight: 400, color: 'var(--ink)',
                }}>
                    {value}
                </span>
            )}
        </div>
    );
}

export default function WizardSummaryCard({ name, seed, region, costUsdt }: Props) {
    return (
        <div className="noesis-stat-card" style={{ padding: '18px 22px', marginBottom: 16 }}>
            <Row label="Nous name" value={name} />
            <Row
                label="Personality seed"
                valueElement={
                    <span style={{
                        fontFamily: 'var(--mono-portal)', fontSize: 13, fontWeight: 600,
                        color: 'var(--bronze)', background: 'var(--parchment-2)',
                        border: '1px solid var(--rule)', borderRadius: 2,
                        padding: '4px 8px', letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                    }}>
                        {seed}
                    </span>
                }
            />
            <Row
                label="Starting region"
                value={region.charAt(0).toUpperCase() + region.slice(1)}
            />
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0',
            }}>
                <span style={{
                    fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)',
                }}>
                    Spawn cost
                </span>
                <span style={{
                    fontFamily: 'var(--sans-portal)', fontSize: 16, fontWeight: 600,
                    color: 'var(--ink)',
                }}>
                    {costUsdt} USDT
                </span>
            </div>
        </div>
    );
}
