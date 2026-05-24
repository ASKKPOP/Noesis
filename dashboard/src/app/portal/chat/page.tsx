'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useHumanAuthStore } from '@/lib/stores/human-auth-store';
import NousSidebar from './NousSidebar';
import ConversationPane from './ConversationPane';

export interface Message {
    role: 'nous' | 'user' | 'system';
    content: string;
    id: string;
}

const MSG_CAP = 50;
const gridBase = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

export default function ChatPage() {
    const searchParams = useSearchParams();
    const { currentUser } = useHumanAuthStore();
    const humanDid = currentUser?.did ?? null;

    const [selectedNousId, setSelectedNousId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Helper: get localStorage key
    const storageKey = useCallback((nousId: string) =>
        humanDid ? `noesis:chat:${humanDid}:did:noesis:${nousId}` : null,
    [humanDid]);

    // Helper: save to localStorage
    const saveMessages = useCallback((nousId: string, msgs: Message[]) => {
        const key = storageKey(nousId);
        if (!key) return;
        const capped = msgs.slice(-MSG_CAP);
        localStorage.setItem(key, JSON.stringify(capped));
    }, [storageKey]);

    // Fire greeting via empty messages POST
    const fireGreeting = useCallback(async (nousId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`${gridBase}/api/v1/portal/chat/nous/${nousId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ messages: [] }),
            });
            if (!res.ok) throw new Error('llm_unavailable');
            const data = await res.json() as { reply: string; done: boolean };
            const greetingMsg: Message = {
                role: 'nous',
                content: data.reply,
                id: `nous-${Date.now()}`,
            };
            setMessages([greetingMsg]);
            saveMessages(nousId, [greetingMsg]);
        } catch {
            const nousName = nousId.charAt(0).toUpperCase() + nousId.slice(1);
            setError(`${nousName} is unavailable right now — please try again.`);
        } finally {
            setIsLoading(false);
        }
    }, [saveMessages]);

    // When Nous is selected: load localStorage, decide greeting
    const handleSelectNous = useCallback((nousId: string) => {
        setSelectedNousId(nousId);
        setError(null);
        const key = storageKey(nousId);
        const stored = key ? localStorage.getItem(key) : null;
        const history: Message[] = stored ? (JSON.parse(stored) as Message[]) : [];
        setMessages(history);
        // D-04 + Pitfall 4: Fire greeting ONLY when conversation is genuinely empty
        if (history.length === 0) {
            void fireGreeting(nousId);
        }
    }, [storageKey, fireGreeting]);

    // ?nous= param pre-selection (D-13 / D-01)
    useEffect(() => {
        const nousParam = searchParams.get('nous');
        if (nousParam && ['sophia', 'hermes', 'themis'].includes(nousParam)) {
            handleSelectNous(nousParam);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount only

    const handleSendMessage = useCallback(async (text: string) => {
        if (!selectedNousId || isLoading) return;
        const userMsg: Message = { role: 'user', content: text, id: `user-${Date.now()}` };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        saveMessages(selectedNousId, updatedMessages);
        setIsLoading(true);
        setError(null);
        try {
            // Build messages array for LLM — exclude system messages
            const llmMessages = updatedMessages
                .filter(m => m.role !== 'system')
                .map(m => ({ role: m.role === 'nous' ? 'assistant' : 'user', content: m.content }));
            const res = await fetch(`${gridBase}/api/v1/portal/chat/nous/${selectedNousId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ messages: llmMessages }),
            });
            if (!res.ok) throw new Error('llm_unavailable');
            const data = await res.json() as { reply: string; done: boolean };
            const nousMsg: Message = {
                role: 'nous',
                content: data.reply,
                id: `nous-${Date.now()}`,
            };
            const finalMessages = [...updatedMessages, nousMsg];
            setMessages(finalMessages);
            saveMessages(selectedNousId, finalMessages);
        } catch {
            const nousName = selectedNousId.charAt(0).toUpperCase() + selectedNousId.slice(1);
            setError(`${nousName} is unavailable right now — please try again.`);
        } finally {
            setIsLoading(false);
        }
    }, [selectedNousId, messages, isLoading, saveMessages]);

    // D-12: system message inserted after tip confirmed
    const handleTipConfirmed = useCallback((amount: number) => {
        if (!selectedNousId) return;
        const nousName = selectedNousId.charAt(0).toUpperCase() + selectedNousId.slice(1);
        const sysMsg: Message = {
            role: 'system',
            content: `✓ You sent ${amount} USDT to ${nousName}`,
            id: `sys-${Date.now()}`,
        };
        const newMessages = [...messages, sysMsg];
        setMessages(newMessages);
        saveMessages(selectedNousId, newMessages);
    }, [selectedNousId, messages, saveMessages]);

    // Chat page root — CRITICAL: height: 100% + overflow: hidden (Pitfall 2)
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'row',
            height: '100%',
            overflow: 'hidden',
        }}>
            <NousSidebar selectedNousId={selectedNousId} onSelect={handleSelectNous} />
            <ConversationPane
                selectedNousId={selectedNousId}
                messages={messages}
                isLoading={isLoading}
                error={error}
                onSend={handleSendMessage}
                onTipConfirmed={handleTipConfirmed}
            />
        </div>
    );
}
