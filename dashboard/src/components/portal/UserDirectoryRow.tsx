/**
 * UserDirectoryRow — single row in the community user directory.
 * Shows blockie avatar (gradient from address), truncated address,
 * Nous name (if any), ousia balance, and join date.
 */
'use client';

interface UserDirectoryRowProps {
    did: string;
    eth_address: string | null;
    ousia: number;
    created_at: string;
    nous_name: string | null;
}

/** Generate a simple blockie-style color from an address string. */
function addressToColor(address: string): string {
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
        hash = address.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 50%)`;
}

/** Truncate an address: 0x1234…5678 */
function truncateAddress(address: string): string {
    if (address.length < 12) return address;
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Format ousia as a readable number. */
function formatOusia(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

/** Format join date as "May 2026". */
function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function UserDirectoryRow({ did, eth_address, ousia, created_at, nous_name }: UserDirectoryRowProps) {
    const displayAddress = eth_address ?? did.split(':').pop() ?? did;
    const color1 = addressToColor(displayAddress);
    const color2 = addressToColor(displayAddress + '1');
    const color3 = addressToColor(displayAddress + '2');

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid var(--rule)',
        }}>
            {/* Blockie avatar — 3-color gradient square */}
            <div style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                flexShrink: 0,
                background: `linear-gradient(135deg, ${color1} 0%, ${color2} 50%, ${color3} 100%)`,
                border: '1px solid var(--rule)',
            }} />

            {/* Address + Nous name */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontFamily: 'var(--mono-portal)',
                    fontSize: 13,
                    color: 'var(--ink)',
                    fontWeight: 500,
                }}>
                    {truncateAddress(displayAddress)}
                </div>
                {nous_name && (
                    <div style={{
                        fontFamily: 'var(--sans-portal)',
                        fontSize: 11,
                        color: 'var(--bronze)',
                        marginTop: 2,
                    }}>
                        Nous: {nous_name}
                    </div>
                )}
            </div>

            {/* Ousia */}
            <div style={{
                fontFamily: 'var(--mono-portal)',
                fontSize: 13,
                color: 'var(--ink)',
                textAlign: 'right',
                flexShrink: 0,
            }}>
                {formatOusia(ousia)}
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>ousia</div>
            </div>

            {/* Join date */}
            <div style={{
                fontFamily: 'var(--sans-portal)',
                fontSize: 11,
                color: 'var(--muted)',
                flexShrink: 0,
                minWidth: 60,
                textAlign: 'right',
            }}>
                {formatDate(created_at)}
            </div>
        </div>
    );
}
