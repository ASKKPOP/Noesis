import { describe, expect, it } from 'vitest';
import { threadToMessages, toNousDid } from './thread';

describe('chat page — persistent thread mapping (O3 Forest)', () => {
    it('addresses static Nous by DID and leaves full DIDs alone', () => {
        expect(toNousDid('sophia')).toBe('did:noesis:sophia');
        expect(toNousDid('did:noesis:human-nous:x')).toBe('did:noesis:human-nous:x');
    });

    it('maps the stored thread to chat bubbles in order', () => {
        expect(threadToMessages([
            { message_id: 'a', sender: 'human', text: 'hi', tick: 1 },
            { message_id: 'b', sender: 'nous', text: 'hello', tick: 1 },
        ])).toEqual([
            { role: 'user', content: 'hi', id: 'a' },
            { role: 'nous', content: 'hello', id: 'b' },
        ]);
    });
});
