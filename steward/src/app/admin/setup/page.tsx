'use client';

import { useState } from 'react';
import StewardShell from '@/components/StewardShell';
import { getConfig, putConfig, restartService, usePolling, type ConfigResponse } from '@/lib/admin-api';

const PANEL: React.CSSProperties = { padding: 18, background: '#faf9f5', border: '1px solid #dbd8cc', borderRadius: 6, marginBottom: 14 };
const PANEL_TITLE: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5a554e', marginBottom: 12 };
const ROW: React.CSSProperties = { display: 'grid', gridTemplateColumns: '220px 1fr 80px', gap: 12, padding: '8px 0', borderBottom: '1px solid #ebe8de', alignItems: 'center' };
const INPUT: React.CSSProperties = { padding: '6px 10px', border: '1px solid #dbd8cc', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 12, background: 'white', width: '100%' };
const BTN: React.CSSProperties = { padding: '6px 12px', background: '#4a7a6a', color: 'white', border: 0, borderRadius: 3, fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' };
const BTN_GHOST: React.CSSProperties = { ...BTN, background: 'transparent', color: '#4a7a6a', border: '1px solid #4a7a6a' };
const BTN_DANGER: React.CSSProperties = { ...BTN, background: '#b8542f' };

type Group = { title: string; keys: string[]; description?: string };

const GROUPS: Group[] = [
    {
        title: 'LLM Provider',
        description: 'Brain cognition + Sophia onboarding chat. Restart all 3 Brains after changes.',
        keys: ['LLM_PROVIDER', 'LLM_MODEL', 'OLLAMA_HOST', 'HERMES_PROVIDER', 'HERMES_MODEL', 'HERMES_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_AI_API_KEY', 'XAI_API_KEY'],
    },
    {
        title: 'Wallet (EVM, zero-custody)',
        description: 'Connection settings only — private keys never leave the user wallet.',
        keys: ['NEXT_PUBLIC_GRID_ORIGIN'],
    },
    {
        title: 'Grid Runtime',
        description: 'Clock cadence + bridge ports. Restart Grid after changes.',
        keys: ['GRID_TICK_RATE_MS', 'BRAIN_HTTP_PORT', 'HUMAN_CHANNEL_PORT'],
    },
    {
        title: 'Secrets',
        description: 'Stored masked. Set new value to overwrite; empty value to keep current.',
        keys: ['BRAIN_HTTP_SECRET', 'MYSQL_PASSWORD', 'MYSQL_ROOT_PASSWORD'],
    },
];

const SERVICES_FOR_LLM = ['nous-sophia', 'nous-hermes', 'nous-themis'];

export default function AdminSetupPage() {
    const { result: configResult, refresh } = usePolling<ConfigResponse>(getConfig, 60_000);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
    const [restarting, setRestarting] = useState<string | null>(null);

    if (configResult?.ok === false && configResult.status === 503) {
        return (
            <StewardShell title="Setup & Config" breadcrumb="Steward · Local Admin · Setup">
                <div style={{ ...PANEL, borderLeft: '3px solid #b8542f' }}>
                    <div style={{ ...PANEL_TITLE, color: '#b8542f' }}>Admin API disabled</div>
                    <p style={{ fontSize: 13 }}>
                        Set <code>GRID_ADMIN_ENABLED=true</code> in <code>.env</code>, restart Grid, and refresh this page.
                    </p>
                </div>
            </StewardShell>
        );
    }

    const cfg = configResult?.data?.config ?? {};

    async function save(key: string) {
        const value = drafts[key];
        if (value === undefined) return;
        setSavingKey(key);
        setStatus(null);
        const res = await putConfig({ [key]: value });
        if (res.ok) {
            setStatus({ kind: 'ok', msg: `Saved ${key}. Restart affected services to apply.` });
            setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
            refresh();
        } else {
            setStatus({ kind: 'err', msg: `${res.error}${res.detail ? `: ${res.detail}` : ''}` });
        }
        setSavingKey(null);
    }

    async function restart(svc: string) {
        if (!confirm(`Restart ${svc}? In-flight requests to this service will be dropped.`)) return;
        setRestarting(svc);
        setStatus(null);
        const res = await restartService(svc);
        if (res.ok) {
            setStatus({ kind: 'ok', msg: `${svc} restart triggered.` });
        } else {
            setStatus({ kind: 'err', msg: `${svc} restart failed: ${res.error}${res.detail ? `: ${res.detail}` : ''}` });
        }
        setRestarting(null);
    }

    return (
        <StewardShell title="Setup & Config" breadcrumb="Steward · Local Admin · Setup">
            <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#8a8479', marginBottom: 18 }}>
                Edit <code>{configResult?.data?.env_path ?? '.env'}</code>. A backup is written before every save (<code>.env.backup.&lt;timestamp&gt;</code>). H5 tier required for writes.
            </p>

            {status && (
                <div style={{ ...PANEL, borderLeft: `3px solid ${status.kind === 'ok' ? '#2d7a2d' : '#b8542f'}` }}>
                    <div style={{ fontSize: 13 }}>{status.msg}</div>
                </div>
            )}

            {/* Quick LLM restart toolbar */}
            <div style={PANEL}>
                <div style={PANEL_TITLE}>After LLM changes — restart Brains</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {SERVICES_FOR_LLM.map((svc) => (
                        <button key={svc} style={BTN_GHOST} disabled={restarting === svc} onClick={() => restart(svc)}>
                            {restarting === svc ? `${svc}…` : `Restart ${svc}`}
                        </button>
                    ))}
                </div>
            </div>

            {GROUPS.map((g) => (
                <div key={g.title} style={PANEL}>
                    <div style={PANEL_TITLE}>{g.title}</div>
                    {g.description && (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#8a8479', marginBottom: 8 }}>{g.description}</div>
                    )}
                    {g.keys.map((key) => {
                        const entry = cfg[key];
                        const draft = drafts[key];
                        const currentValue = draft ?? entry?.value ?? '';
                        const editable = entry?.editable ?? false;
                        const masked = entry?.masked ?? false;
                        const dirty = draft !== undefined && draft !== entry?.value;
                        const inputType = masked ? 'password' : 'text';
                        return (
                            <div key={key} style={ROW}>
                                <code style={{ fontSize: 12, color: '#1a1714' }}>{key}</code>
                                <input
                                    type={inputType}
                                    value={currentValue}
                                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                                    disabled={!editable}
                                    placeholder={entry === undefined ? '(not set)' : ''}
                                    style={{ ...INPUT, opacity: editable ? 1 : 0.5 }}
                                />
                                <button
                                    style={dirty ? BTN : BTN_GHOST}
                                    disabled={!editable || !dirty || savingKey === key}
                                    onClick={() => save(key)}
                                >
                                    {savingKey === key ? '…' : 'Save'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            ))}

            <div style={{ ...PANEL, borderLeft: '3px solid #b88a2f' }}>
                <div style={{ ...PANEL_TITLE, color: '#b88a2f' }}>Security notice</div>
                <p style={{ fontSize: 13, margin: 0 }}>
                    The admin API has filesystem write access to <code>.env</code> and (when <code>GRID_ADMIN_DOCKER_ENABLED=true</code>) Docker socket access to restart containers. <strong>Use only on localhost</strong>. Never bind Grid to <code>0.0.0.0</code> with admin enabled.
                </p>
            </div>
        </StewardShell>
    );
}
