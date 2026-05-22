'use client';

import { useEffect, useRef, useState } from 'react';
import SophiaBubble from './SophiaBubble';
import UserBubble from './UserBubble';
import ChatInput from './ChatInput';
import ContinueButton from './ContinueButton';

type ChatMessage = { role: 'sophia' | 'user'; content: string };

const GRID_BASE = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

function detectClose(content: string): boolean {
    const lower = content.toLowerCase();
    return lower.includes('shall we explore') ||
           lower.includes('shall we see the world') ||
           lower.includes('ready to explore') ||
           lower.includes("let's explore");
}

interface Props { onDone: (lastUserMessage: string) => void; }

export default function StepSophiaChat({ onDone }: Props) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [userMessageCount, setUserMessageCount] = useState(0);
    const [showContinue, setShowContinue] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const sentInitialRef = useRef(false);
    // Track current messages and user count in refs for use inside async callbacks
    const messagesRef = useRef<ChatMessage[]>([]);
    const userMessageCountRef = useRef(0);

    function scrollToBottom() {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    async function sendMessages(
        history: Array<{ role: 'user' | 'assistant'; content: string }>,
        currentMessages: ChatMessage[],
        currentUserCount: number,
    ) {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${GRID_BASE}/api/v1/portal/chat/onboard`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history }),
            });
            if (!res.ok) {
                setError('Sophia is unavailable right now — please try again.');
                return;
            }
            const data = await res.json() as { reply: string; done: boolean };
            const newMessages: ChatMessage[] = [...currentMessages, { role: 'sophia', content: data.reply }];
            setMessages(newMessages);
            messagesRef.current = newMessages;
            // done from server, or fallback detectClose on client
            const isClose = data.done || detectClose(data.reply);
            if (isClose && currentUserCount >= 2) setShowContinue(true);
            // Force continue after 3 exchanges regardless
            if (currentUserCount >= 3) setShowContinue(true);
        } catch {
            setError('Sophia is unavailable right now — please try again.');
        } finally {
            setLoading(false);
            setTimeout(scrollToBottom, 50);
        }
    }

    // Load Sophia's opening message on mount
    useEffect(() => {
        if (sentInitialRef.current) return;
        sentInitialRef.current = true;
        void sendMessages([], [], 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function handleSend() {
        const text = inputValue.trim();
        if (!text || loading) return;
        setInputValue('');
        const newUserMessage: ChatMessage = { role: 'user', content: text };
        const updatedMessages = [...messagesRef.current, newUserMessage];
        setMessages(updatedMessages);
        messagesRef.current = updatedMessages;
        const newCount = userMessageCountRef.current + 1;
        setUserMessageCount(newCount);
        userMessageCountRef.current = newCount;
        setTimeout(scrollToBottom, 50);
        // Build OpenAI-compatible history for backend (sophia → assistant)
        const history = updatedMessages.map((m) => ({
            role: m.role === 'sophia' ? 'assistant' as const : 'user' as const,
            content: m.content,
        }));
        await sendMessages(history, updatedMessages, newCount);
    }

    function handleContinue() {
        // Pass last user message as goal (verbatim, per D-07 / RESEARCH.md Q7)
        const lastUserMsg = messagesRef.current.filter((m) => m.role === 'user').pop()?.content ?? '';
        onDone(lastUserMsg);
    }

    return (
        <div style={{
            background: 'rgba(2,6,16,0.72)', border: '1px solid rgba(0,212,255,0.15)',
            borderRadius: 16, padding: '32px 32px 24px', backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 48px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,212,255,0.03)',
        }}>
            <style>{`
                @keyframes portal-pulse {
                    0%, 100% { opacity: 0.3; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1); }
                }
            `}</style>
            <div style={{ fontFamily: 'var(--mono-portal)', fontSize: 11, color: '#da7a4e', fontWeight: 600, marginBottom: 12, letterSpacing: '0.08em' }}>
                SOPHIA
            </div>
            {/* Chat message list */}
            <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 4 }}>
                {messages.map((m, i) =>
                    m.role === 'sophia'
                        ? <SophiaBubble key={i} content={m.content} />
                        : <UserBubble key={i} content={m.content} />,
                )}
                {/* Loading indicator */}
                {loading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {[0, 1, 2].map((i) => (
                                <div key={i} style={{
                                    width: 8, height: 8, borderRadius: '50%', background: '#da7a4e',
                                    animation: `portal-pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
                                }} />
                            ))}
                        </div>
                        <span style={{ fontFamily: 'var(--sans-portal)', fontSize: 11, color: 'rgba(245,240,234,0.45)' }}>
                            Sophia is thinking…
                        </span>
                    </div>
                )}
                {/* Error state */}
                {error && (
                    <div style={{
                        background: 'rgba(184,50,50,0.10)', border: '1px solid rgba(184,50,50,0.30)',
                        borderRadius: 8, padding: '8px 12px', marginTop: 8,
                        fontFamily: 'var(--mono-portal)', fontSize: 11, color: '#f87171',
                    }}>
                        {error}
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
            {/* Input row */}
            <ChatInput
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSend}
                loading={loading}
                disabled={showContinue}
            />
            {/* Continue button — fades in when Sophia closes */}
            <ContinueButton
                label="Explore the World →"
                onClick={handleContinue}
                visible={showContinue}
                disabled={loading}
            />
        </div>
    );
}
