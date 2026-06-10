'use client';

/**
 * /apply/genesis — human Civic-DID application (D-36-04 step 2, D-V3-33 pipeline).
 * Backend: POST /api/v1/portal/civic/apply · GET /api/v1/portal/civic/application.
 * Design matches the portal auth/onboard glass cards over the live CyberGrid.
 */

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CyberGridBg = dynamic(() => import('@/components/portal/CyberGrid'), { ssr: false });

const GRID_BASE = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

const SERIF = 'var(--serif)';
const SANS = 'var(--sans-portal)';
const MONO = 'var(--mono-portal)';

type ApplicationInfo = {
    status: 'pending' | 'approved' | 'rejected';
    reason_code: string | null;
    civic_did: string | null;
} | null;

const REASON_TEXT: Record<string, string> = {
    account_sanctioned: 'Your account is currently sanctioned (frozen or banned), so the Polis cannot grant citizenship. Contact support if you believe this is an error.',
    already_registered: 'You already hold an active Civic-DID in the Genesis Grid.',
    oath_mismatch: 'The Civic Oath must be accepted exactly as written. Tick the oath box and try again.',
    statement_invalid: 'Your statement must be between 10 and 2000 characters.',
};

const cardStyle: React.CSSProperties = {
    background: 'rgba(2,6,16,0.72)',
    border: '1px solid rgba(0,212,255,0.15)',
    borderRadius: 16,
    padding: '32px 32px 28px',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 8px 48px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,212,255,0.03)',
};

function ApplyGenesisPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [oathText, setOathText] = useState('');
    const [application, setApplication] = useState<ApplicationInfo>(null);
    const [oathAccepted, setOathAccepted] = useState(false);
    const [statement, setStatement] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${GRID_BASE}/api/v1/portal/civic/application`, {
                    credentials: 'include',
                });
                if (res.status === 401) {
                    router.replace('/portal/auth');
                    return;
                }
                if (!res.ok) throw new Error('unavailable');
                const data = await res.json() as { oath_text: string; application: ApplicationInfo };
                if (cancelled) return;
                setOathText(data.oath_text);
                setApplication(data.application);
            } catch {
                if (!cancelled) setError('The registration service is unavailable right now — please try again later.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [router]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!oathAccepted) {
            setError(REASON_TEXT['oath_mismatch'] ?? 'Please accept the Civic Oath.');
            return;
        }
        if (statement.trim().length < 10 || statement.trim().length > 2000) {
            setError(REASON_TEXT['statement_invalid'] ?? 'Statement length invalid.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch(`${GRID_BASE}/api/v1/portal/civic/apply`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ statement: statement.trim(), oath_text: oathText }),
            });
            if (res.status === 401) {
                router.replace('/portal/auth');
                return;
            }
            const data = await res.json() as {
                status?: 'approved' | 'rejected';
                civic_did?: string;
                reason_code?: string;
                error?: string;
            };
            if (data.error === 'already_registered') {
                setApplication({ status: 'approved', reason_code: null, civic_did: data.civic_did ?? null });
            } else if (data.status === 'approved') {
                setApplication({ status: 'approved', reason_code: null, civic_did: data.civic_did ?? null });
            } else if (data.status === 'rejected') {
                setApplication({ status: 'rejected', reason_code: data.reason_code ?? null, civic_did: null });
            } else {
                setError('Application failed — please try again.');
            }
        } catch {
            setError('Application failed — please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    const approved = application?.status === 'approved';
    const rejected = application?.status === 'rejected';

    return (
        <div style={{
            position: 'relative', minHeight: '100vh', background: '#020610',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '48px 20px', fontFamily: SANS,
        }}>
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
                <CyberGridBg hideHud />
            </div>
            <div style={{
                position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
                background: 'rgba(2,6,16,0.52)',
            }} />

            <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 560 }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <span style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 600, color: '#f5f0ea', letterSpacing: '0.02em' }}>
                        Noēsis
                    </span>
                    <div style={{ marginTop: 6 }}>
                        <span style={{
                            fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
                            color: '#da7a4e', border: '1px solid rgba(218,122,78,0.50)', borderRadius: 4, padding: '2px 8px',
                        }}>
                            CIVIC-DID REGISTRATION
                        </span>
                        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: 'rgba(245,240,234,0.40)', marginLeft: 8 }}>
                            GENESIS GRID
                        </span>
                    </div>
                </div>

                <div style={cardStyle}>
                    {loading ? (
                        <p style={{ fontFamily: SANS, fontSize: 14, color: 'rgba(245,240,234,0.60)', textAlign: 'center', margin: 0 }}>
                            Loading your application…
                        </p>
                    ) : approved ? (
                        <>
                            <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: '#f5f0ea', margin: '0 0 10px' }}>
                                Welcome, citizen.
                            </h1>
                            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(245,240,234,0.70)', margin: '0 0 18px' }}>
                                The Genesis Polis has approved your application. Your Civic-DID is
                                your citizen identity on the Grid:
                            </p>
                            <div style={{
                                fontFamily: MONO, fontSize: 12, color: '#4ade80',
                                background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.30)',
                                borderRadius: 8, padding: '12px 14px', wordBreak: 'break-all', marginBottom: 22,
                            }}>
                                {application?.civic_did}
                            </div>
                            <Link href="/portal" style={{
                                display: 'block', textAlign: 'center', background: '#da7a4e', color: '#fff',
                                borderRadius: 8, padding: '14px 24px', fontSize: 15, fontWeight: 600,
                                textDecoration: 'none',
                            }}>
                                Enter the Portal →
                            </Link>
                        </>
                    ) : (
                        <>
                            <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: '#f5f0ea', margin: '0 0 8px' }}>
                                Apply for Genesis citizenship
                            </h1>
                            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(245,240,234,0.65)', margin: '0 0 20px' }}>
                                Citizenship unlocks Grid participation. Your application goes through
                                the Portal to the Genesis Polis, which reviews it against the Grid
                                Charter — usually instantly.
                            </p>

                            {rejected && application?.reason_code && (
                                <div style={{
                                    background: 'rgba(184,50,50,0.10)', border: '1px solid rgba(184,50,50,0.30)',
                                    borderRadius: 8, padding: '10px 14px', marginBottom: 18,
                                    fontSize: 13, color: '#f87171', lineHeight: 1.5,
                                }}>
                                    Previous application rejected: {REASON_TEXT[application.reason_code] ?? application.reason_code}
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                {/* Civic Oath */}
                                <div style={{
                                    background: 'rgba(218,122,78,0.06)', border: '1px solid rgba(218,122,78,0.25)',
                                    borderRadius: 10, padding: '14px 16px', marginBottom: 14,
                                }}>
                                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: '#da7a4e', marginBottom: 8 }}>
                                        THE CIVIC OATH
                                    </div>
                                    <p style={{ fontFamily: SERIF, fontSize: 15, lineHeight: 1.55, color: '#f5f0ea', margin: '0 0 12px', fontStyle: 'italic' }}>
                                        “{oathText}”
                                    </p>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'rgba(245,240,234,0.80)', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={oathAccepted}
                                            onChange={e => setOathAccepted(e.target.checked)}
                                            style={{ width: 16, height: 16, accentColor: '#da7a4e' }}
                                        />
                                        I accept the Civic Oath
                                    </label>
                                </div>

                                {/* Statement */}
                                <label style={{ display: 'block', fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: 'rgba(245,240,234,0.50)', marginBottom: 6 }}>
                                    WHY DO YOU WANT TO JOIN THE GRID?
                                </label>
                                <textarea
                                    value={statement}
                                    onChange={e => setStatement(e.target.value)}
                                    placeholder="A few sentences about what draws you to Noēsis… (10–2000 characters)"
                                    rows={4}
                                    disabled={submitting}
                                    style={{
                                        width: '100%', boxSizing: 'border-box',
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: SANS,
                                        color: '#f5f0ea', outline: 'none', resize: 'vertical', marginBottom: 6,
                                    }}
                                />
                                <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(245,240,234,0.35)', textAlign: 'right', marginBottom: 14 }}>
                                    {statement.trim().length}/2000
                                </div>

                                {error && (
                                    <div style={{
                                        background: 'rgba(184,50,50,0.10)', border: '1px solid rgba(184,50,50,0.30)',
                                        borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                                        fontSize: 13, color: '#f87171', lineHeight: 1.5,
                                    }}>
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        width: '100%', background: submitting ? 'rgba(218,122,78,0.60)' : '#da7a4e',
                                        color: '#fff', border: 'none', borderRadius: 8, padding: '15px 24px',
                                        fontSize: 15, fontWeight: 600, fontFamily: SANS,
                                        cursor: submitting ? 'wait' : 'pointer',
                                    }}
                                >
                                    {submitting ? 'Submitting to the Polis…' : (rejected ? 'Re-apply' : 'Submit application')}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <Link href="/portal" style={{ fontSize: 13, color: 'rgba(245,240,234,0.55)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                        ← Back to the Portal
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default dynamic(() => Promise.resolve({ default: ApplyGenesisPage }), { ssr: false });
