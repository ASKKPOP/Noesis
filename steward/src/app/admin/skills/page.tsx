'use client';

import { useEffect, useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

const PANEL: React.CSSProperties = { padding: 18, background: '#faf9f5', border: '1px solid #dbd8cc', borderRadius: 6, marginBottom: 14 };
const PANEL_TITLE: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5a554e', marginBottom: 12 };

interface SkillSnapshot {
    skill_hash: string;
    title_hash?: string;
    learned_at_tick: number;
    method: 'taught' | 'inferred';
    source_did?: string;
}

export default function AdminSkillsPage() {
    const [skills, setSkills] = useState<SkillSnapshot[] | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function fetchSkills() {
            try {
                // Hash-only roll-up from the audit trail. Real skill content lives in each
                // Nous's private Brain (Voyager SkillStore + FTS5 retrieval); only the
                // diffusion record crosses the wire.
                const res = await fetch(`${GRID_ORIGIN}/api/v1/audit/trail?type=skill.taught&limit=50`);
                if (!cancelled) {
                    if (res.ok) {
                        const body = await res.json();
                        const arr = Array.isArray(body) ? body : body.entries ?? [];
                        setSkills(arr.map((e: { payload?: SkillSnapshot; tick?: number }) => ({
                            ...e.payload,
                            learned_at_tick: e.tick,
                        } as SkillSnapshot)));
                    } else {
                        setErr(`HTTP ${res.status}`);
                    }
                    setLoading(false);
                }
            } catch (e) {
                if (!cancelled) {
                    setErr(e instanceof Error ? e.message : String(e));
                    setLoading(false);
                }
            }
        }
        fetchSkills();
        const id = setInterval(fetchSkills, 10_000);
        return () => { cancelled = true; clearInterval(id); };
    }, []);

    return (
        <StewardShell title="Skills & APIs" breadcrumb="Steward · Local Admin · Skills">
            <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#8a8479', marginBottom: 18 }}>
                Skills are Brain-private (Voyager SkillStore + FTS5 retrieval). Only the diffusion record (<code>skill.taught</code> / <code>skill.inferred</code>) crosses the wire — content lives in each Nous's Long-Term Memory.
            </p>

            {/* External API setup — guidance only (no current write path) */}
            <div style={PANEL}>
                <div style={PANEL_TITLE}>External API setup (LLM + auth)</div>
                <p style={{ fontSize: 13, color: '#1a1714' }}>
                    Configure LLM provider API keys on <a href="/admin/setup" style={{ color: '#4a7a6a' }}>/admin/setup</a>. Brain processes will use them automatically after restart.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 10 }}>
                    <div style={{ padding: '10px 12px', background: 'white', border: '1px solid #dbd8cc', borderRadius: 4 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#8a8479', textTransform: 'uppercase' }}>Anthropic</div>
                        <code style={{ fontSize: 11 }}>ANTHROPIC_API_KEY</code>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'white', border: '1px solid #dbd8cc', borderRadius: 4 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#8a8479', textTransform: 'uppercase' }}>OpenAI</div>
                        <code style={{ fontSize: 11 }}>OPENAI_API_KEY</code>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'white', border: '1px solid #dbd8cc', borderRadius: 4 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#8a8479', textTransform: 'uppercase' }}>xAI</div>
                        <code style={{ fontSize: 11 }}>XAI_API_KEY</code>
                    </div>
                    <div style={{ padding: '10px 12px', background: 'white', border: '1px solid #dbd8cc', borderRadius: 4 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#8a8479', textTransform: 'uppercase' }}>Google AI</div>
                        <code style={{ fontSize: 11 }}>GOOGLE_AI_API_KEY</code>
                    </div>
                </div>
            </div>

            {/* Skill diffusion recent events */}
            <div style={PANEL}>
                <div style={PANEL_TITLE}>Recent skill diffusion (skill.taught events)</div>
                {loading && <div style={{ fontSize: 13, color: '#8a8479' }}>Loading…</div>}
                {err && <div style={{ fontSize: 13, color: '#b8542f' }}>Error: {err}</div>}
                {!loading && !err && skills && skills.length === 0 && (
                    <div style={{ fontSize: 13, color: '#8a8479' }}>No skill.taught events recorded yet.</div>
                )}
                {!loading && !err && skills && skills.length > 0 && (
                    <table style={{ width: '100%', fontSize: 12, fontFamily: 'var(--mono)' }}>
                        <thead>
                            <tr style={{ color: '#8a8479', textAlign: 'left' }}>
                                <th style={{ padding: '6px 0' }}>Tick</th>
                                <th>Skill hash</th>
                                <th>Method</th>
                                <th>Source DID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {skills.slice(0, 20).map((s, i) => (
                                <tr key={i} style={{ borderTop: '1px solid #ebe8de' }}>
                                    <td style={{ padding: '6px 12px 6px 0' }}>{s.learned_at_tick}</td>
                                    <td>{s.skill_hash?.slice(0, 12)}…</td>
                                    <td><code style={{ fontSize: 11, color: s.method === 'taught' ? '#3a7a5a' : '#b88a2f' }}>{s.method}</code></td>
                                    <td>{s.source_did?.slice(0, 32)}…</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* External integrations (placeholder for future) */}
            <div style={{ ...PANEL, borderLeft: '3px solid #5eead4' }}>
                <div style={{ ...PANEL_TITLE, color: '#2a7a8a' }}>External integrations (v2.7+ roadmap)</div>
                <p style={{ fontSize: 13, color: '#1a1714' }}>Currently configured: <strong>Ollama</strong> (local LLM), <strong>EVM wallet</strong> (MetaMask/WalletConnect via wagmi).</p>
                <p style={{ fontSize: 13, color: '#1a1714', marginTop: 8 }}>
                    Candidate integrations being scoped: Slack/Discord notifications, OpenAI vector embeddings cache, Pinecone/Weaviate for cross-Nous lore search, custom MCP servers for tool access.
                </p>
            </div>
        </StewardShell>
    );
}
