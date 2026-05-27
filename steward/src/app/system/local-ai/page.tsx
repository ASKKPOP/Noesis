'use client';

/**
 * Phase 40 — Steward Console /system/local-ai
 * Tier-1 Local Nous Manager surface (D-V3-36 / D-40-03).
 * Operator selects Ollama model tiers + temperature + max_tokens.
 * Settings persisted to Grid via PATCH /api/v1/operator/me/settings.
 * Red banner shown when Brain status is degraded (Q-V3-I mandatory text).
 */
import { useEffect, useState, useRef } from 'react';
import StewardShell from '@/components/StewardShell';

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

export default function LocalAiPage() {
    const [models, setModels] = useState<string[]>([]);
    const [draft, setDraft] = useState<LocalAiSettings | null>(null);
    const [brainStatus, setBrainStatus] = useState<BrainStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load settings from Grid + models from Brain on mount
    useEffect(() => {
        async function load() {
            try {
                const [settingsRes, modelsRes] = await Promise.all([
                    fetch('/api/v1/operator/me/settings', { credentials: 'include' }),
                    fetch('/api/brain/local-ai/models'),
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
