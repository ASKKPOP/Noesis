'use client';

interface Props {
    seed: string | null;
    spawnedAtTick: number;
    spawnCostUsdt: string;
    nousCoinBalance: string;
}

function InfoRow({ label, value, valueElement }: { label: string; value?: string; valueElement?: React.ReactNode }) {
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderBottom: '1px solid var(--rule)',
        }}>
            <span style={{
                fontFamily: 'var(--sans-portal)', fontSize: 13,
                color: 'var(--muted)',
            }}>{label}</span>
            {valueElement ?? (
                <span style={{
                    fontFamily: 'var(--sans-portal)', fontSize: 16, fontWeight: 400,
                    color: 'var(--ink)',
                }}>{value ?? '—'}</span>
            )}
        </div>
    );
}

function SeedBadge({ seed }: { seed: string }) {
    return (
        <span style={{
            fontFamily: 'var(--mono-portal)', fontSize: 13, fontWeight: 600,
            color: 'var(--bronze)', background: 'var(--parchment-2)',
            border: '1px solid var(--rule)', borderRadius: 2,
            padding: '4px 8px', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>{seed}</span>
    );
}

function formatTickAsDate(tick: number): string {
    // Tick → ISO date is grid-specific. Displaying "Tick #N" until a proper formatter is wired.
    return `Tick #${tick}`;
}

export default function OwnerInfoSection({ seed, spawnedAtTick, spawnCostUsdt, nousCoinBalance }: Props) {
    return (
        <section style={{ marginTop: 32 }}>
            <h2 style={{
                fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600,
                color: 'var(--ink)', marginBottom: 12,
            }}>Spawn Info</h2>
            <div className="noesis-stat-card" style={{ padding: '18px 22px' }}>
                <InfoRow label="Personality seed" valueElement={
                    seed ? <SeedBadge seed={seed} /> : <span style={{
                        fontFamily: 'var(--sans-portal)', fontSize: 16, color: 'var(--muted)',
                    }}>—</span>
                } />
                <InfoRow label="Spawned" value={formatTickAsDate(spawnedAtTick)} />
                <InfoRow label="Spawn cost" value={`${spawnCostUsdt} USDT`} />
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0',
                }}>
                    <span style={{ fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)' }}>Nous Coin Balance</span>
                    <span style={{ fontFamily: 'var(--sans-portal)', fontSize: 16, fontWeight: 400, color: 'var(--ink)' }}>{nousCoinBalance} CC</span>
                </div>
            </div>
        </section>
    );
}
