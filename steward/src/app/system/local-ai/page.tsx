'use client';

/**
 * Phase 40 — Steward Console /system/local-ai
 * Tier-1 Local Nous Manager surface (D-V3-36 / D-40-03).
 * Operator selects Ollama model tiers + temperature + max_tokens.
 * Settings persisted to Grid via PATCH /api/v1/operator/me/settings.
 * Red banner shown when Brain status is degraded (Q-V3-I mandatory text).
 *
 * Phase 43 — Fork Nous section added below Local AI Settings (D-43-03).
 * Operator can fork their Nous via the constitutional right-to-fork (D-V3-18).
 * Click → ForkIrreversibilityDialog → POST /api/v1/operator/fork/<civic-did> → download.
 */
import { useEffect, useState, useRef } from 'react';
import StewardShell from '@/components/StewardShell';
import { ForkIrreversibilityDialog } from '@/components/fork-irreversibility-dialog';

interface LocalAiSettings {
    small_model: string;
    primary_model: string;
    large_model: string;
    temperature: number;
    max_tokens: number;
    _version: 2;
}

interface BrainStatusResponse {
    status: 'ok' | 'degraded';
    provider: string;
    fallback_provider: string | null;
}

interface ModelsResponse {
    models: string[];
    ollama_available: boolean;
}

interface NousRecord {
    civic_did: string | null;
    brain_did: string;
    status: 'active' | 'away' | 'revoked';
}

interface ForkResult {
    download_url: string;
    package_hash: string;
    bytes: number;
}

export default function LocalAiPage() {
    const [models, setModels] = useState<string[]>([]);
    const [draft, setDraft] = useState<LocalAiSettings | null>(null);
    const [brainStatus, setBrainStatus] = useState<BrainStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Phase 43 — Fork Nous state (D-43-03 / D-V3-18 constitutional right-to-fork)
    const [civicDid, setCivicDid] = useState<string | null>(null);
    const [forkOpen, setForkOpen] = useState(false);
    const [forkStatus, setForkStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [forkError, setForkError] = useState<string | null>(null);
    const [forkResult, setForkResult] = useState<ForkResult | null>(null);
    const forkButtonRef = useRef<HTMLButtonElement | null>(null);

    // Load settings from Grid + models from Brain on mount
    useEffect(() => {
        async function load() {
            try {
                const [settingsRes, modelsRes, nousRes] = await Promise.all([
                    fetch('/api/v1/operator/me/settings', { credentials: 'include' }),
                    fetch('/api/brain/local-ai/models'),
                    // Phase 43: attempt to load Civic-DID from operator's Nous fleet.
                    // civic_did is stubbed null until Phase 46 wires the registry join.
                    fetch('/api/v1/operator/me/nous', { credentials: 'include' }),
                ]);
                if (settingsRes.ok) {
                    const s = await settingsRes.json() as { local_ai: LocalAiSettings };
                    setDraft({ ...s.local_ai });
                } else {
                    setError(`Settings load failed: ${settingsRes.status}`);
                }
                if (modelsRes.ok) {
                    const m = await modelsRes.json() as ModelsResponse;
                    setModels(m.models);
                }
                // models load failure is non-fatal — dropdowns show current saved model
                if (nousRes.ok) {
                    const fleet = await nousRes.json() as { nous: NousRecord[] };
                    const firstCivicDid = fleet.nous.find(n => n.civic_did)?.civic_did ?? null;
                    setCivicDid(firstCivicDid);
                }
                // civicDid load failure is non-fatal — Fork button renders disabled
            } catch (e) {
                setError(String(e));
            } finally {
                setLoading(false);
            }
        }
        void load();
    }, []);

    // Poll Brain status every 10 seconds for red banner
    useEffect(() => {
        async function pollStatus() {
            try {
                const res = await fetch('/api/brain/local-ai/status');
                if (res.ok) {
                    const status = await res.json() as BrainStatusResponse;
                    setBrainStatus(status);
                }
            } catch {
                // Brain offline — set degraded state
                setBrainStatus({ status: 'degraded', provider: 'ollama', fallback_provider: null });
            }
        }
        void pollStatus();
        pollRef.current = setInterval(() => void pollStatus(), 10_000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    async function handleSave() {
        if (!draft) return;
        try {
            const res = await fetch('/api/v1/operator/me/settings', {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ local_ai: draft }),
            });
            if (res.ok) {
                const updated = await res.json() as { local_ai: LocalAiSettings };
                setDraft({ ...updated.local_ai });
                setSaved(true);
            } else {
                setError(`Save failed: ${res.status}`);
            }
        } catch (e) {
            setError(String(e));
        }
    }

    function updateDraft(field: keyof LocalAiSettings, value: string | number) {
        setDraft(prev => prev ? { ...prev, [field]: value } : prev);
        setSaved(false);
    }

    // Phase 43 — Fork Nous handler (D-V3-18 constitutional right-to-fork)
    async function handleForkConfirm() {
        if (!civicDid) return;
        setForkOpen(false);
        setForkStatus('loading');
        setForkError(null);
        try {
            const res = await fetch(`/api/v1/operator/fork/${encodeURIComponent(civicDid)}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({ error: 'unknown' })) as { detail?: string; error?: string };
                const msg = body.detail ?? body.error ?? `HTTP ${res.status}`;
                setForkError(msg);
                setForkStatus('error');
                return;
            }
            const data = await res.json() as ForkResult;
            setForkResult(data);
            setForkStatus('success');
            // Trigger download: programmatic <a download> click (one-time token)
            const a = document.createElement('a');
            a.href = data.download_url;
            a.download = '';  // browser uses Content-Disposition filename
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            setForkError(String(err));
            setForkStatus('error');
        }
    }

    if (loading) {
        return (
            <StewardShell title="Local AI Settings" breadcrumb="Steward · Local Admin · Local AI">
                <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>Loading…</p>
            </StewardShell>
        );
    }

    return (
        <StewardShell title="Local AI Settings" breadcrumb="Steward · Local Admin · Local AI">
            <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 28 }}>
                Tier-1 Local Nous Manager — configure Ollama models and generation parameters.
                Changes take effect on Brain restart.
            </p>

            {/* Red banner — cloud fallback active (Q-V3-I MANDATORY text) */}
            {brainStatus?.status === 'degraded' && (
                <div
                    style={{
                        background: 'rgba(184,84,47,0.08)',
                        border: '1px solid rgba(184,84,47,0.4)',
                        borderLeft: '4px solid var(--terracotta)',
                        borderRadius: 8,
                        padding: '12px 16px',
                        marginBottom: 20,
                        fontFamily: 'var(--sans)',
                        fontSize: 13,
                        color: 'var(--terracotta)',
                    }}
                >
                    Local AI offline — using {brainStatus.fallback_provider ?? 'cloud'} fallback.{' '}
                    <strong>Memory content is leaving this machine.</strong>
                </div>
            )}

            {/* General error */}
            {error && (
                <div
                    style={{
                        background: 'rgba(184,84,47,0.08)',
                        border: '1px solid rgba(184,84,47,0.4)',
                        borderRadius: 8,
                        padding: '12px 16px',
                        marginBottom: 20,
                        fontFamily: 'var(--sans)',
                        fontSize: 13,
                        color: 'var(--terracotta)',
                    }}
                >
                    {error}
                </div>
            )}

            {/* Amber banner — restart required after save */}
            {saved && (
                <div
                    style={{
                        background: 'rgba(184,138,47,0.08)',
                        border: '1px solid rgba(184,138,47,0.35)',
                        borderRadius: 8,
                        padding: '12px 16px',
                        marginBottom: 20,
                        fontFamily: 'var(--sans)',
                        fontSize: 13,
                        color: '#b88a2f',
                    }}
                >
                    Restart Brain to apply changes.
                </div>
            )}

            {/* Phase 43 — Fork Nous section (D-V3-18 / D-43-03) */}
            <div data-testid="fork-section" className="steward-card" style={{ marginBottom: 32 }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
                    <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                        Fork Nous
                    </h2>
                </div>
                <div style={{ padding: '16px 20px' }}>
                    <p style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink)', marginBottom: 16 }}>
                        Constitutional right-to-fork (D-V3-18). Export this Nous&apos;s complete state — memory,
                        credentials, audit history — as a portable archive. The forked Nous can run standalone
                        on any machine via{' '}
                        <code>python -m noesis_brain standalone --import &lt;package.tar.gz&gt;</code>.
                        This permanently removes the Nous from civic life.
                    </p>
                    {civicDid ? (
                        <button
                            ref={forkButtonRef}
                            onClick={() => setForkOpen(true)}
                            disabled={forkStatus === 'loading'}
                            data-testid="fork-open-button"
                            style={{
                                background: 'var(--terracotta)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '7px 18px',
                                fontFamily: 'var(--sans)',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: forkStatus === 'loading' ? 'not-allowed' : 'pointer',
                                opacity: forkStatus === 'loading' ? 0.6 : 1,
                            }}
                        >
                            {forkStatus === 'loading' ? 'Preparing fork…' : 'Fork Nous'}
                        </button>
                    ) : (
                        <button
                            disabled
                            data-testid="fork-open-button"
                            style={{
                                background: 'var(--muted)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '7px 18px',
                                fontFamily: 'var(--sans)',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'not-allowed',
                                opacity: 0.5,
                            }}
                        >
                            Fork Nous
                        </button>
                    )}
                    {!civicDid && (
                        <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                            No Nous to fork yet. Register a Civic-DID first.
                        </p>
                    )}
                    {forkError && (
                        <div
                            role="alert"
                            data-testid="fork-error"
                            style={{
                                color: 'var(--terracotta)',
                                marginTop: 12,
                                fontFamily: 'var(--sans)',
                                fontSize: 13,
                            }}
                        >
                            Fork failed: {forkError}
                        </div>
                    )}
                    {forkStatus === 'success' && forkResult && (
                        <div
                            data-testid="fork-success"
                            style={{ color: '#2d8a4e', marginTop: 12, fontFamily: 'var(--sans)', fontSize: 13 }}
                        >
                            <p>Fork complete. Download started automatically.</p>
                            <p>Package hash: <code>{forkResult.package_hash}</code></p>
                            <p>Size: {forkResult.bytes} bytes</p>
                            <p>
                                If the download did not start,{' '}
                                <a href={forkResult.download_url}>click here</a> within 5 minutes.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <ForkIrreversibilityDialog
                open={forkOpen}
                targetDid={civicDid ?? ''}
                onConfirm={() => void handleForkConfirm()}
                onCancel={() => setForkOpen(false)}
                openerRef={forkButtonRef}
            />

            {draft && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {/* Model Tiers */}
                    <div className="steward-card">
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
                            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                                Model Tiers
                            </h2>
                        </div>
                        <div style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                {(['small_model', 'primary_model', 'large_model'] as const).map(tier => (
                                    <div key={tier}>
                                        <label
                                            style={{
                                                display: 'block',
                                                fontFamily: 'var(--mono)',
                                                fontSize: 10,
                                                letterSpacing: '0.12em',
                                                textTransform: 'uppercase',
                                                color: 'var(--muted)',
                                                marginBottom: 6,
                                            }}
                                        >
                                            {tier.replace('_model', '')} model
                                        </label>
                                        <select
                                            style={{
                                                width: '100%',
                                                background: 'var(--parchment)',
                                                border: '1px solid var(--rule)',
                                                borderRadius: 5,
                                                padding: '7px 10px',
                                                fontFamily: 'var(--sans)',
                                                fontSize: 13,
                                                color: 'var(--ink)',
                                                outline: 'none',
                                            }}
                                            value={draft[tier]}
                                            onChange={e => updateDraft(tier, e.target.value)}
                                        >
                                            {models.length === 0 && (
                                                <option value={draft[tier]}>{draft[tier]}</option>
                                            )}
                                            {models.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                            {models.length === 0 && (
                                <p style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
                                    Brain offline or Ollama not running — showing current saved model.
                                    Install models with: <code>ollama pull qwen3:4b</code>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Generation Parameters */}
                    <div className="steward-card">
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
                            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 400, color: 'var(--ink)' }}>
                                Generation Parameters
                            </h2>
                        </div>
                        <div style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label
                                        style={{
                                            display: 'block',
                                            fontFamily: 'var(--mono)',
                                            fontSize: 10,
                                            letterSpacing: '0.12em',
                                            textTransform: 'uppercase',
                                            color: 'var(--muted)',
                                            marginBottom: 6,
                                        }}
                                    >
                                        Temperature (0.0 – 2.0)
                                    </label>
                                    <input
                                        type="number"
                                        min={0.0}
                                        max={2.0}
                                        step={0.1}
                                        style={{
                                            width: '100%',
                                            background: 'var(--parchment)',
                                            border: '1px solid var(--rule)',
                                            borderRadius: 5,
                                            padding: '7px 10px',
                                            fontFamily: 'var(--sans)',
                                            fontSize: 13,
                                            color: 'var(--ink)',
                                            outline: 'none',
                                        }}
                                        value={draft.temperature}
                                        onChange={e => updateDraft('temperature', parseFloat(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label
                                        style={{
                                            display: 'block',
                                            fontFamily: 'var(--mono)',
                                            fontSize: 10,
                                            letterSpacing: '0.12em',
                                            textTransform: 'uppercase',
                                            color: 'var(--muted)',
                                            marginBottom: 6,
                                        }}
                                    >
                                        Max Tokens (256 – 8192)
                                    </label>
                                    <input
                                        type="number"
                                        min={256}
                                        max={8192}
                                        step={128}
                                        style={{
                                            width: '100%',
                                            background: 'var(--parchment)',
                                            border: '1px solid var(--rule)',
                                            borderRadius: 5,
                                            padding: '7px 10px',
                                            fontFamily: 'var(--sans)',
                                            fontSize: 13,
                                            color: 'var(--ink)',
                                            outline: 'none',
                                        }}
                                        value={draft.max_tokens}
                                        onChange={e => updateDraft('max_tokens', parseInt(e.target.value, 10))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <button
                            style={{
                                background: 'var(--terracotta)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '7px 18px',
                                fontFamily: 'var(--sans)',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                            }}
                            onClick={() => void handleSave()}
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            )}
        </StewardShell>
    );
}
