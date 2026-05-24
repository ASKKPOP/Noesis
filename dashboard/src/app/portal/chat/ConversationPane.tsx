'use client';

import type { Message } from './page';
import NousHeader from './NousHeader';
import MessageList from './MessageList';
import ChatFooter from './ChatFooter';

interface ConversationPaneProps {
    selectedNousId: string | null;
    messages: Message[];
    isLoading: boolean;
    error: string | null;
    onSend: (text: string) => void;
    onTipConfirmed: (amount: number) => void;
}

export default function ConversationPane({
    selectedNousId,
    messages,
    isLoading,
    error,
    onSend,
    onTipConfirmed,
}: ConversationPaneProps) {
    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--vellum)',
            overflow: 'hidden',
            position: 'relative', // CRITICAL: anchor for TipPanel position:absolute
        }}>
            {selectedNousId && <NousHeader nousId={selectedNousId} />}
            <MessageList messages={messages} nousId={selectedNousId} isLoading={isLoading} />
            {error && (
                <div style={{
                    padding: '6px 16px',
                    background: 'rgba(184,50,50,0.08)',
                    borderTop: '1px solid rgba(184,50,50,0.18)',
                    fontFamily: 'var(--sans-portal)',
                    fontSize: 13,
                    color: '#b83232',
                }}>
                    {error}
                </div>
            )}
            <ChatFooter
                selectedNousId={selectedNousId}
                onSend={onSend}
                onTipConfirmed={onTipConfirmed}
                isLoading={isLoading}
            />
        </div>
    );
}
