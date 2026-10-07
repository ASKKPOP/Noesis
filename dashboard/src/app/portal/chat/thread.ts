import type { ConvMessage } from '@/lib/api/conversation';
import type { Message } from './page';

/** Static Nous are addressed by slug in the UI and by DID in the persistent thread. */
export const toNousDid = (nousId: string): string => (nousId.startsWith('did:') ? nousId : `did:noesis:${nousId}`);

export const threadToMessages = (thread: ConvMessage[]): Message[] =>
    thread.map((m) => ({ role: m.sender === 'human' ? 'user' : 'nous', content: m.text, id: m.message_id }));
