'use client';

import { useEffect, useRef, useState } from 'react';
import StewardShell from '@/components/StewardShell';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

const PANEL: React.CSSProperties = { padding: 18, background: '#faf9f5', border: '1px solid #dbd8cc', borderRadius: 6, marginBottom: 14 };
const PANEL_TITLE: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#5a554e', marginBottom: 12 };
const NOUS_OPTS = ['sophia', 'hermes', 'themis'];

interface Msg {
    role: 'admin' | 'nous';
    text: string;
    ts: number;
}

export default function AdminChatPage() {
    const [nous, setNous] = useState('sophia');
    const [draft, setDraft] = useState('');
    const [msgs, setMsgs] = useState<Msg[]>([]);
    const [sending, setSending] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [msgs.length]);

    async function send() {
        const text = draft.trim();
        if (!text || sending) return;
        setSending(true);
        setErr(null);
        const userMsg: Msg = { role: 'admin', text, ts: Date.now() };
        setMsgs((m) => [...m, userMsg]);
        setDraft('');

        try {
            // Uses the same portal chat endpoint Sophia/Nous use — reads from Ollama via Grid proxy.
            const res = await fetch(`${GRID_ORIGIN}/api/v1/portal/chat/nous/${nous}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        ...msgs.map((m) => ({ role: m.role === 'admin' ? 'user' : 'assistant', content: m.text })),
                        { role: 'user', content: text },
                    ],
                }),
            });
            if (!res.ok) {
                setErr(`HTTP ${res.status}`);
                return;
            }
            const body = await res.json();
            const reply = body?.message?.content ?? body?.reply ?? '(no response)';
            setMsgs((m) => [...m, { role: 'nous', text: reply, ts: Date.now() }]);
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setSending(false);
        }
    }

    function reset() {
        setMsgs([]);
        setErr(null);
    }

    return (
        <StewardShell title="Nous Chat" breadcrumb="Steward · Local Admin · Chat">
            <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#8a8479', marginBottom: 18 }}>
                Direct chat with any Genesis Nous from the admin console. Uses the same fast-proxy LLM as the Portal onboarding chat (out-of-tick, ~2s response). Conversations are NOT persisted — refresh clears history.
            </p>

            {/* Controls */}
            <div style={PANEL}>
                <div style={PANEL_TITLE}>Chat target</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                        Nous:&nbsp;
                        <select value={nous} onChange={(e) => { setNous(e.target.value); reset(); }} style={{ padding: '4px 8px', border: '1px solid #dbd8cc', fontFamily: 'var(--mono)', fontSize: 12 }}>
                            {NOUS_OPTS.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                    <button onClick={reset} style={{ padding: '4px 12px', background: 'transparent', color: '#4a7a6a', border: '1px solid #4a7a6a', borderRadius: 3, fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer' }}>
                        New conversation
                    </button>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#8a8479' }}>
                        {msgs.length} message{msgs.length === 1 ? '' : 's'}
                    </span>
                </div>
            </div>

            {/* Messages */}
            <div style={{ ...PANEL, padding: 0 }}>
                <div ref={scrollRef} style={{ maxHeight: 500, overflowY: 'auto', padding: 18 }}>
                    {msgs.length === 0 && (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#8a8479', textAlign: 'center', padding: '40px 0' }}>
                            Send a message to start the conversation with <code>{nous}</code>.
                        </div>
                    )}
                    {msgs.map((m, i) => (
                        <div key={i} style={{
                            marginBottom: 14,
                            padding: '10px 14px',
                            borderRadius: 6,
                            background: m.role === 'admin' ? '#f0ede2' : '#e8f0ea',
                            borderLeft: `3px solid ${m.role === 'admin' ? '#5a554e' : '#3a7a5a'}`,
                        }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#8a8479', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                                {m.role === 'admin' ? 'admin' : nous} · {new Date(m.ts).toLocaleTimeString()}
                            </div>
                            <div style={{ fontSize: 13, color: '#1a1714', whiteSpace: 'pre-wrap' }}>{m.text}</div>
                        </div>
                    ))}
                    {sending && (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#8a8479', padding: '6px 12px' }}>{nous} is thinking…</div>
                    )}
                </div>
            </div>

            {/* Input */}
            <div style={PANEL}>
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }}
                    placeholder={`Message to ${nous}… (Cmd/Ctrl+Enter to send)`}
                    rows={3}
                    style={{ width: '100%', padding: 10, border: '1px solid #dbd8cc', borderRadius: 4, fontFamily: 'inherit', fontSize: 13, resize: 'vertical', background: 'white' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    <button onClick={send} disabled={sending || !draft.trim()} style={{ padding: '8px 18px', background: '#4a7a6a', color: 'white', border: 0, borderRadius: 3, fontSize: 12, fontFamily: 'var(--mono)', cursor: 'pointer', opacity: sending || !draft.trim() ? 0.5 : 1 }}>
                        {sending ? 'Sending…' : 'Send'}
                    </button>
                    {err && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#b8542f' }}>Error: {err}</span>}
                </div>
            </div>
        </StewardShell>
    );
}
