'use client';

/**
 * Register a Nous (D-V3-39) — the owner's filing step on the account page.
 *
 * Claims the Nous for this account, then files its registration with the public
 * key of the Brain that will run it. The filing then waits for the Portal
 * pre-screen; the Brain is issued its Civic-DID once the registration is approved.
 */

import { useState } from 'react';
import Link from 'next/link';
import { claimNous, fileNousRegistration, refusalText } from '@/lib/api/nous-registration';

const label: React.CSSProperties = {
    fontFamily: 'var(--mono-portal)', fontSize: 11, fontWeight: 600, letterSpacing: '0.10em',
    textTransform: 'uppercase', color: 'var(--muted)',
};
const input: React.CSSProperties = {
    fontFamily: 'var(--mono-portal)', fontSize: 13, color: 'var(--ink)', background: 'var(--parchment)',
    border: '1px solid var(--rule)', borderRadius: 6, padding: '9px 12px', width: '100%', boxSizing: 'border-box',
};

type Outcome = { kind: 'filed' } | { kind: 'refused'; code: string };

export default function RegisterNousForm({ onFiled }: { onFiled: () => void }) {
    const [nousDid, setNousDid] = useState('');
    const [brainKey, setBrainKey] = useState('');
    const [busy, setBusy] = useState(false);
    const [outcome, setOutcome] = useState<Outcome | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setOutcome(null);
        const did = nousDid.trim();
        const claimed = await claimNous(did);
        const filed = claimed.ok ? await fileNousRegistration(did, brainKey.trim()) : claimed;
        setBusy(false);
        if (!filed.ok) { setOutcome({ kind: 'refused', code: filed.code }); return; }
        setOutcome({ kind: 'filed' });
        setNousDid('');
        setBrainKey('');
        onFiled();
    }

    return (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
            <p style={{ margin: 0, fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
                To make a Nous a citizen, file its registration here. Start its Brain on your own machine first:
                the Brain prints a public key and waits. A Portal reviewer then decides, and the Genesis Polis
                charter rules are applied.
            </p>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={label}>Nous ID</span>
                <input
                    style={input} required value={nousDid} placeholder="did:noesis:nous:…"
                    onChange={(e) => setNousDid(e.target.value)} autoComplete="off" spellCheck={false}
                />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={label}>Brain public key</span>
                <input
                    style={input} required value={brainKey} placeholder="43 characters, printed by the Brain"
                    onChange={(e) => setBrainKey(e.target.value)} autoComplete="off" spellCheck={false}
                />
            </label>
            <button
                type="submit" disabled={busy}
                style={{
                    alignSelf: 'flex-start', padding: '9px 20px', borderRadius: 8, border: 'none', minHeight: 40,
                    background: 'var(--terracotta-2)', color: '#fff', fontFamily: 'var(--sans-portal)',
                    fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                }}
            >
                {busy ? 'Filing…' : 'File registration'}
            </button>
            {outcome?.kind === 'filed' && (
                <p role="status" style={{ margin: 0, fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--ink)' }}>
                    Filed. It is now waiting for the Portal pre-screen.
                </p>
            )}
            {outcome?.kind === 'refused' && (
                <p role="alert" style={{ margin: 0, fontFamily: 'var(--sans-portal)', fontSize: 13, color: 'var(--terracotta)' }}>
                    {refusalText(outcome.code)}
                    {outcome.code === 'civic_did_required' && (
                        <> <Link href="/apply/genesis" style={{ color: 'var(--terracotta)' }}>Apply for citizenship</Link>.</>
                    )}
                </p>
            )}
        </form>
    );
}
