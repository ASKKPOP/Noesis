'use client';

import { useRef, useEffect } from 'react';
import type { Message } from './page';
import NousBubble from './NousBubble';
import UserBubble from './UserBubble';
import LoadingBubble from './LoadingBubble';
import SystemMessage from './SystemMessage';

interface MessageListProps {
    messages: Message[];
    nousId: string | null;
    isLoading: boolean;
}

export default function MessageList({ messages, nousId, isLoading }: MessageListProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    if (!nousId) {
        return (
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
            }}>
                <span style={{
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 16,
                    fontWeight: 400,
                    fontStyle: 'italic',
                    color: 'var(--muted)',
                }}>
                    Select a Nous to begin a conversation.
                </span>
            </div>
        );
    }

    return (
        <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
        }}>
            {messages.map(msg => {
                if (msg.role === 'nous') {
                    return <NousBubble key={msg.id} content={msg.content} nousId={nousId} />;
                }
                if (msg.role === 'user') {
                    return <UserBubble key={msg.id} content={msg.content} />;
                }
                return <SystemMessage key={msg.id} content={msg.content} />;
            })}
            {isLoading && <LoadingBubble nousId={nousId} />}
            <div ref={bottomRef} />
        </div>
    );
}
