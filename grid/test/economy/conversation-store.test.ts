import { describe, it, expect, vi } from 'vitest';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { MIGRATIONS } from '../../src/db/schema.js';
import { ConversationStore } from '../../src/economy/conversation-store.js';

describe('migration v53 — conversation_messages', () => {
    it('creates the conversation table', () => {
        const m = MIGRATIONS.find((x) => x.version === 53);
        expect(m, 'v53 must exist').toBeDefined();
        expect(m!.name).toBe('create_conversation_messages');
        expect(m!.up).toContain('CREATE TABLE IF NOT EXISTS conversation_messages');
        expect(m!.up).toContain('sender');
        expect(m!.up).toContain('human_did');
        expect(m!.up).toContain('nous_did');
        expect(m!.down).toContain('DROP TABLE IF EXISTS conversation_messages');
    });
    it('migration v53 has a unique version number', () => {
        expect(MIGRATIONS.filter((x) => x.version === 53)).toHaveLength(1);
    });
});

function mockPool(rows: unknown[] = []): { pool: Pool; calls: () => string[] } {
    const sql: string[] = [];
    const query = vi.fn().mockImplementation((q: string) => { sql.push(String(q)); return Promise.resolve([rows as RowDataPacket[], {}]); });
    return { pool: { query } as unknown as Pool, calls: () => sql };
}

describe('ConversationStore', () => {
    it('postMessage inserts a thread message', async () => {
        const m = mockPool();
        await new ConversationStore(m.pool).postMessage({ gridName: 'g', messageId: 'm1', humanDid: 'did:civic:noesis:human:h', nousDid: 'did:civic:noesis:n', sender: 'human', text: 'should we sell 5 ETH of compute?', tick: 10 });
        expect(m.calls()[0]).toContain('INSERT INTO conversation_messages');
    });
    it('postMessage rejects an invalid sender', async () => {
        await expect(new ConversationStore(mockPool().pool).postMessage({ gridName: 'g', messageId: 'm1', humanDid: 'h', nousDid: 'n', sender: 'robot' as never, text: 'hi', tick: 10 })).rejects.toThrow('invalid_sender');
    });
    it('postMessage rejects empty text', async () => {
        await expect(new ConversationStore(mockPool().pool).postMessage({ gridName: 'g', messageId: 'm1', humanDid: 'h', nousDid: 'n', sender: 'human', text: '   ', tick: 10 })).rejects.toThrow('empty_text');
    });
    it('listThread reads the human↔nous pair in order', async () => {
        const m = mockPool([{ message_id: 'm1', sender: 'human', text: 'hi', tick: 10 }]);
        const thread = await new ConversationStore(m.pool).listThread('g', 'did:civic:noesis:human:h', 'did:civic:noesis:n');
        expect(thread).toHaveLength(1);
        expect(m.calls()[0]).toContain('FROM conversation_messages');
        expect(m.calls()[0]).toContain('human_did = ?');
        expect(m.calls()[0]).toContain('nous_did = ?');
    });
    it('listPartners returns the distinct nous a human has talked with', async () => {
        const m = mockPool([{ nous_did: 'did:civic:noesis:n' }]);
        const partners = await new ConversationStore(m.pool).listPartners('g', 'did:civic:noesis:human:h');
        expect(partners).toEqual(['did:civic:noesis:n']);
        expect(m.calls()[0]).toContain('DISTINCT');
    });
});
