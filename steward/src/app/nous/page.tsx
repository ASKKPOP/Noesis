export default function NousRosterPage() {
    return (
        <div style={{ padding: '36px 40px' }}>
            <div
                style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    marginBottom: 6,
                }}
            >
                Steward · Nous Roster
            </div>
            <h1
                style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 32,
                    fontWeight: 400,
                    color: 'var(--ink)',
                    marginBottom: 24,
                }}
            >
                Nous Roster
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                Full Nous roster — coming in Phase 25.
            </p>
        </div>
    );
}
