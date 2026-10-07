'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import NousSidebar from './NousSidebar';
import ConversationPane from './ConversationPane';
import { getThread, postMessage } from '@/lib/api/conversation';
import { threadToMessages, toNousDid } from './thread';

export interface Message {
    role: 'nous' | 'user' | 'system';
    content: string;
    id: string;
}

const MSG_CAP = 50;
const POLL_MS = 15_000;
/** While a message is waiting on the Nous's own Brain, look for the answer more often. */
const POLL_WAITING_MS = 4_000;
const gridBase = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

export default function ChatPage() {
    const searchParams = useSearchParams();

    const [selectedNousId, setSelectedNousId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // How many persisted messages we have already shown — the poll replaces the
    // view only when the server has something newer (e.g. the Nous answered later).
    const serverCount = useRef(0);
    const [awaitingBrain, setAwaitingBrain] = useState(false);

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
            if (res.status === 202) return; // the Nous's own Brain is connected — no scripted greeting
            if (!res.ok) throw new Error('llm_unavailable');
            const data = await res.json() as { reply: string; done: boolean };
            const greetingMsg: Message = {
                role: 'nous',
                content: data.reply,
                id: `nous-${Date.now()}`,
            };
            setMessages([greetingMsg]);
        } catch {
            const nousName = nousId.charAt(0).toUpperCase() + nousId.slice(1);
            setError(`${nousName} is unavailable right now — please try again.`);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // When Nous is selected: load the persisted thread, decide greeting
    const handleSelectNous = useCallback((nousId: string) => {
        setSelectedNousId(nousId);
        setError(null);
        setMessages([]);
        setAwaitingBrain(false);
        serverCount.current = 0;
        void getThread(toNousDid(nousId)).then((thread) => {
            serverCount.current = thread.length;
            // D-04 + Pitfall 4: Fire greeting ONLY when conversation is genuinely empty
            if (thread.length === 0) void fireGreeting(nousId);
            else setMessages(threadToMessages(thread));
        });
    }, [fireGreeting]);

    // Pick up replies that arrive later (a Nous answering when it wakes).
    useEffect(() => {
        if (!selectedNousId) return;
        const id = setInterval(() => {
            if (isLoading) return;
            void getThread(toNousDid(selectedNousId)).then((thread) => {
                if (thread.length > serverCount.current) {
                    serverCount.current = thread.length;
                    setMessages(threadToMessages(thread));
                    setAwaitingBrain(false);
                }
            });
        }, awaitingBrain ? POLL_WAITING_MS : POLL_MS);
        return () => clearInterval(id);
    }, [selectedNousId, isLoading, awaitingBrain]);

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
        const nousName = selectedNousId.charAt(0).toUpperCase() + selectedNousId.slice(1);
        const userMsg: Message = { role: 'user', content: text, id: `user-${Date.now()}` };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setIsLoading(true);
        setError(null);

        // 1. Persist the human turn first — it must not depend on a live reply.
        const saved = await postMessage(toNousDid(selectedNousId), text);
        if (!saved.ok) {
            setError('Your message was not saved. Sign in again and retry.');
            setIsLoading(false);
            return;
        }
        serverCount.current += 1;

        // 2. Ask for a live reply. The route persists it; if nothing answers now,
        //    the message stays delivered and the poll shows the reply when it comes.
        try {
            const llmMessages = updatedMessages
                .filter(m => m.role !== 'system')
                .slice(-MSG_CAP)
                .map(m => ({ role: m.role === 'nous' ? 'assistant' : 'user', content: m.content }));
            const res = await fetch(`${gridBase}/api/v1/portal/chat/nous/${selectedNousId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ messages: llmMessages }),
            });
            if (res.status === 202) {
                // The Nous's own Brain is connected and will answer in the thread.
                setAwaitingBrain(true);
                setMessages([...updatedMessages, {
                    role: 'system', content: `Delivered. ${nousName} is awake and will answer here.`, id: `sys-${Date.now()}`,
                }]);
                return;
            }
            if (!res.ok) throw new Error('llm_unavailable');
            const data = await res.json() as { reply: string; done: boolean };
            serverCount.current += 1;
            setMessages([...updatedMessages, { role: 'nous', content: data.reply, id: `nous-${Date.now()}` }]);
        } catch {
            setMessages([...updatedMessages, {
                role: 'system',
                content: `Delivered. ${nousName} is not answering right now and will see this on waking.`,
                id: `sys-${Date.now()}`,
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedNousId, messages, isLoading]);

    // D-12: system message inserted after tip confirmed
    const handleTipConfirmed = useCallback((amount: number) => {
        if (!selectedNousId) return;
        const nousName = selectedNousId.charAt(0).toUpperCase() + selectedNousId.slice(1);
        const sysMsg: Message = {
            role: 'system',
            content: `✓ You sent ${amount} USDT to ${nousName}`,
            id: `sys-${Date.now()}`,
        };
        setMessages([...messages, sysMsg]);
    }, [selectedNousId, messages]);

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
