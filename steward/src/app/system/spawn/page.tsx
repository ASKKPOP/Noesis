'use client';

/**
 * Steward /system/spawn — Spawn a system-tier Nous (researcher/Sophia/Hermes/Themis-class).
 *
 * Phase 25b D-25b-12: H5 operator wizard. Sends POST /api/v1/operator/spawn-system-nous
 * with header-auth (x-operator-tier: 5). Produces a did:noesis:system:* DID.
 *
 * WIZARD STEPS:
 *   1. Name — human-readable name for the new Nous (max 64 chars)
 *   2. Personality seeds — 1–8 seed strings that bootstrap initial creed (forward-compat in 25b)
 *   3. Confirm + Spawn — review panel + type "SPAWN" + operator reason (≥ 10 chars)
 *
 * AUTH: x-operator-tier: 5, x-operator-id: NEXT_PUBLIC_STEWARD_OPERATOR_ID header.
 *       The Steward Console is a trusted internal surface; headers are injected at fetch time.
 *
 * See: 25b-PLAN-14, D-25b-12, D-25b-NEW-1.
 */

import { useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

const inputStyle: React.CSSProperties = {
    background: 'var(--parchment)',
    border: '1px solid var(--rule)',
    borderRadius: 5,
    padding: '7px 10px',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    color: 'var(--ink)',
    outline: 'none',
    width: '100%',
};

const btnPrimary: React.CSSProperties = {
    background: 'var(--terracotta)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 20px',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
    background: 'none',
    color: 'var(--muted)',
    border: '1px solid var(--rule)',
    borderRadius: 6,
    padding: '8px 20px',
    fontFamily: 'var(--sans)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--mono)',
    fontSize: 10,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    display: 'block',
    marginBottom: 6,
};

export default function SpawnSystemNousPage() {
    // Wizard state
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Step 1: Name
    const [name, setName] = useState('');

    // Step 2: Personality seeds
    const [seeds, setSeeds] = useState<string[]>(['']);

    // Step 3: Confirm
    const [confirmText, setConfirmText] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ ok: true; nous_did: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Seed management
    function updateSeed(index: number, value: string) {
        setSeeds(prev => prev.map((s, i) => (i === index ? value : s)));
    }

    function addSeed() {
        if (seeds.length < 8) setSeeds(prev => [...prev, '']);
    }

    function removeSeed(index: number) {
        if (seeds.length > 1) setSeeds(prev => prev.filter((_, i) => i !== index));
    }

    // Step 1 validation
    const nameValid = name.trim().length > 0 && name.trim().length <= 64;

    // Step 2 validation
    const seedsValid = seeds.length >= 1 &&
        seeds.length <= 8 &&
        seeds.every(s => s.trim().length > 0);

    // Step 3 validation
    const confirmValid = confirmText === 'SPAWN' && reason.trim().length >= 10;

    async function handleSpawn() {
        if (!confirmValid || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`${GRID_ORIGIN}/api/v1/operator/spawn-system-nous`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-operator-tier': '5',
                    'x-operator-id': process.env.NEXT_PUBLIC_STEWARD_OPERATOR_ID ?? 'op:00000000-0000-4000-8000-000000000001',
                },
                body: JSON.stringify({
                    name: name.trim(),
                    personality_seeds: seeds.map(s => s.trim()),
                }),
            });
            if (res.ok) {
                const data = await res.json() as { ok: true; nous_did: string };
                setResult(data);
            } else {
                const data = await res.json() as { error?: string };
                setError(`Error ${res.status}: ${data.error ?? 'unknown'}`);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Network error');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <StewardShell title="Spawn System Nous" breadcrumb="System / Spawn">
            <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
                {/* Page header */}
                <div style={{ marginBottom: 24 }}>
                    <div
                        style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 9,
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            color: 'var(--muted)',
                            marginBottom: 6,
                        }}
                    >
                        System Operations / H5
                    </div>
                    <h1
                        style={{
                            fontFamily: 'var(--serif)',
                            fontSize: 28,
                            fontWeight: 400,
                            color: 'var(--ink)',
                            margin: 0,
                        }}
                    >
                        Spawn System Nous
                    </h1>
                    <p style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
                        Bootstrap a new researcher-class Nous (Sophia / Hermes / Themis). Produces a{' '}
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>did:noesis:system:*</span>{' '}
                        DID funded with the standard initial supply.
                    </p>
                </div>

                {/* Step indicator */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                    {([1, 2, 3] as const).map(n => (
                        <div
                            key={n}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontFamily: 'var(--mono)',
                                fontSize: 11,
                                color: step === n ? 'var(--ink)' : 'var(--muted)',
                            }}
                        >
                            <div
                                style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    border: `1px solid ${step === n ? 'var(--ink)' : 'var(--rule)'}`,
                                    background: step > n ? 'var(--ink)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 10,
                                    color: step > n ? '#fff' : step === n ? 'var(--ink)' : 'var(--muted)',
                                }}
                            >
                                {step > n ? '✓' : n}
                            </div>
                            {n === 1 ? 'Name' : n === 2 ? 'Seeds' : 'Confirm'}
                            {n < 3 && (
                                <div
                                    style={{
                                        width: 32,
                                        height: 1,
                                        background: 'var(--rule)',
                                        marginLeft: 6,
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Card */}
                <div className="steward-card">
                    {/* --- STEP 1: Name --- */}
                    {step === 1 && (
                        <div style={{ padding: 24 }}>
                            <div
                                style={{
                                    fontFamily: 'var(--serif)',
                                    fontSize: 16,
                                    color: 'var(--ink)',
                                    marginBottom: 16,
                                }}
                            >
                                Step 1 — Name
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <label style={labelStyle}>Nous Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    maxLength={64}
                                    placeholder="e.g. Sophia, Hermes, Themis"
                                    style={inputStyle}
                                    autoFocus
                                />
                                <div
                                    style={{
                                        fontFamily: 'var(--mono)',
                                        fontSize: 10,
                                        color: 'var(--muted)',
                                        marginTop: 6,
                                    }}
                                >
                                    This becomes the human-readable name. The Nous DID is auto-generated.{' '}
                                    {name.length}/64
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    style={{
                                        ...btnPrimary,
                                        opacity: nameValid ? 1 : 0.5,
                                        cursor: nameValid ? 'pointer' : 'not-allowed',
                                    }}
                                    disabled={!nameValid}
                                    onClick={() => setStep(2)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- STEP 2: Personality seeds --- */}
                    {step === 2 && (
                        <div style={{ padding: 24 }}>
                            <div
                                style={{
                                    fontFamily: 'var(--serif)',
                                    fontSize: 16,
                                    color: 'var(--ink)',
                                    marginBottom: 8,
                                }}
                            >
                                Step 2 — Personality Seeds
                            </div>
                            <p
                                style={{
                                    fontFamily: 'var(--sans)',
                                    fontSize: 12,
                                    color: 'var(--muted)',
                                    lineHeight: 1.5,
                                    marginBottom: 16,
                                }}
                            >
                                These bootstrap the Nous's initial creed and self-model. Examples:{' '}
                                <em>patient teacher</em>, <em>skeptical empiricist</em>.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                                {seeds.map((seed, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={seed}
                                            onChange={e => updateSeed(i, e.target.value)}
                                            placeholder={`Seed ${i + 1}`}
                                            style={{ ...inputStyle, flex: 1 }}
                                        />
                                        {seeds.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeSeed(i)}
                                                style={{
                                                    background: 'none',
                                                    border: '1px solid var(--rule)',
                                                    borderRadius: 4,
                                                    padding: '4px 8px',
                                                    fontFamily: 'var(--mono)',
                                                    fontSize: 11,
                                                    color: 'var(--muted)',
                                                    cursor: 'pointer',
                                                    flexShrink: 0,
                                                }}
                                                title="Remove seed"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {seeds.length < 8 && (
                                <button
                                    type="button"
                                    onClick={addSeed}
                                    style={{
                                        ...btnSecondary,
                                        fontSize: 12,
                                        padding: '5px 14px',
                                        marginBottom: 20,
                                    }}
                                >
                                    + Add Seed
                                </button>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <button
                                    type="button"
                                    style={btnSecondary}
                                    onClick={() => setStep(1)}
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    style={{
                                        ...btnPrimary,
                                        opacity: seedsValid ? 1 : 0.5,
                                        cursor: seedsValid ? 'pointer' : 'not-allowed',
                                    }}
                                    disabled={!seedsValid}
                                    onClick={() => setStep(3)}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- STEP 3: Confirm + Spawn --- */}
                    {step === 3 && !result && (
                        <div style={{ padding: 24 }}>
                            <div
                                style={{
                                    fontFamily: 'var(--serif)',
                                    fontSize: 16,
                                    color: 'var(--ink)',
                                    marginBottom: 16,
                                }}
                            >
                                Step 3 — Confirm Spawn
                            </div>

                            {/* Review panel */}
                            <div
                                style={{
                                    background: 'var(--vellum)',
                                    border: '1px solid var(--rule)',
                                    borderRadius: 6,
                                    padding: '14px 18px',
                                    marginBottom: 20,
                                }}
                            >
                                <div
                                    style={{
                                        fontFamily: 'var(--mono)',
                                        fontSize: 9,
                                        letterSpacing: '0.14em',
                                        textTransform: 'uppercase',
                                        color: 'var(--muted)',
                                        marginBottom: 10,
                                    }}
                                >
                                    Review
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                    <span
                                        style={{
                                            fontFamily: 'var(--mono)',
                                            fontSize: 10,
                                            textTransform: 'uppercase',
                                            color: 'var(--muted)',
                                            marginRight: 8,
                                        }}
                                    >
                                        Name:
                                    </span>
                                    <span style={{ fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink)' }}>
                                        {name.trim()}
                                    </span>
                                </div>
                                <div>
                                    <span
                                        style={{
                                            fontFamily: 'var(--mono)',
                                            fontSize: 10,
                                            textTransform: 'uppercase',
                                            color: 'var(--muted)',
                                            marginRight: 8,
                                        }}
                                    >
                                        Seeds:
                                    </span>
                                    <span style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--ink)' }}>
                                        {seeds.filter(s => s.trim()).join(' · ')}
                                    </span>
                                </div>
                            </div>

                            {/* SPAWN confirm gate */}
                            <p style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 16 }}>
                                This action spawns a new system Nous and cannot be easily undone. Type{' '}
                                <span
                                    style={{
                                        fontFamily: 'var(--mono)',
                                        fontSize: 12,
                                        background: 'var(--vellum)',
                                        padding: '1px 6px',
                                        borderRadius: 3,
                                        border: '1px solid var(--rule)',
                                    }}
                                >
                                    SPAWN
                                </span>{' '}
                                to confirm.
                            </p>

                            <div style={{ marginBottom: 14 }}>
                                <label style={labelStyle}>Confirm</label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    placeholder="Type SPAWN"
                                    style={inputStyle}
                                />
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <label style={labelStyle}>Operator Reason (≥ 10 chars)</label>
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="Operator rationale for spawning this Nous…"
                                    style={inputStyle}
                                />
                            </div>

                            {error && (
                                <div
                                    style={{
                                        fontFamily: 'var(--mono)',
                                        fontSize: 12,
                                        color: 'var(--terracotta)',
                                        padding: '8px 12px',
                                        background: 'rgba(184,84,47,0.08)',
                                        borderRadius: 5,
                                        border: '1px solid rgba(184,84,47,0.2)',
                                        marginBottom: 14,
                                    }}
                                >
                                    {error}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <button
                                    type="button"
                                    style={btnSecondary}
                                    onClick={() => { setStep(2); setConfirmText(''); setError(null); }}
                                    disabled={submitting}
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    style={{
                                        ...btnPrimary,
                                        opacity: confirmValid && !submitting ? 1 : 0.5,
                                        cursor: confirmValid && !submitting ? 'pointer' : 'not-allowed',
                                    }}
                                    disabled={!confirmValid || submitting}
                                    onClick={handleSpawn}
                                >
                                    {submitting ? 'Spawning…' : 'Spawn Nous'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Success */}
                    {result && (
                        <div style={{ padding: 24 }}>
                            <div
                                style={{
                                    fontFamily: 'var(--mono)',
                                    fontSize: 12,
                                    color: '#2d7a2d',
                                    padding: '12px 16px',
                                    background: 'rgba(34,139,34,0.08)',
                                    borderRadius: 5,
                                    border: '1px solid rgba(34,139,34,0.2)',
                                    marginBottom: 16,
                                }}
                            >
                                Nous spawned successfully.
                            </div>
                            <div
                                style={{
                                    fontFamily: 'var(--mono)',
                                    fontSize: 9,
                                    letterSpacing: '0.14em',
                                    textTransform: 'uppercase',
                                    color: 'var(--muted)',
                                    marginBottom: 6,
                                }}
                            >
                                New DID
                            </div>
                            <div
                                style={{
                                    fontFamily: 'var(--mono)',
                                    fontSize: 13,
                                    color: 'var(--ink)',
                                    wordBreak: 'break-all',
                                    marginBottom: 20,
                                }}
                            >
                                {result.nous_did}
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <a
                                    href={`/nous/${encodeURIComponent(result.nous_did)}`}
                                    style={{
                                        ...btnPrimary,
                                        display: 'inline-block',
                                        textDecoration: 'none',
                                    }}
                                >
                                    View Nous
                                </a>
                                <button
                                    type="button"
                                    style={btnSecondary}
                                    onClick={() => {
                                        setStep(1);
                                        setName('');
                                        setSeeds(['']);
                                        setConfirmText('');
                                        setReason('');
                                        setResult(null);
                                        setError(null);
                                    }}
                                >
                                    Spawn Another
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </StewardShell>
    );
}
