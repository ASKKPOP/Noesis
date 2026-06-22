/**
 * O2c — Portal↔Nous conversation: the persistent human↔Nous chat thread (the
 * "talking with user" channel; pairs with the O2 approval gate so a human can
 * discuss a big decision before approving it). Keyed by (human_did, nous_did).
 *
 * PRIVATE: chat content NEVER crosses the audit boundary (same posture as the
 * Phase-42 whisper relay + interior contents). No audit events, allowlist +0.
 * Distinct from the Phase-41 Nous↔Nous civic_message_queue (different participants,
 * a persistent readable thread for both sides).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface ConversationMessageRow {
    message_id: string; sender: 'human' | 'nous'; text: string; tick: number;
}

export class ConversationStore {
    constructor(private readonly pool: Pool) {}

    /** Append a message to the human↔nous thread (sender = 'human' | 'nous'). */
    async postMessage(p: { gridName: string; messageId: string; humanDid: string; nousDid: string; sender: 'human' | 'nous'; text: string; tick: number }): Promise<void> {
        if (p.sender !== 'human' && p.sender !== 'nous') throw new Error('invalid_sender');
        if (!p.text || p.text.trim() === '') throw new Error('empty_text');
        await this.pool.query(
            `INSERT INTO conversation_messages (message_id, grid_name, human_did, nous_did, sender, text, tick, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.messageId, p.gridName, p.humanDid, p.nousDid, p.sender, p.text, p.tick, p.tick],
        );
    }

    /** Read the conversation between a human and a nous, oldest-first (bounded). */
    async listThread(gridName: string, humanDid: string, nousDid: string, limit = 200): Promise<ConversationMessageRow[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT message_id, sender, text, tick FROM conversation_messages
             WHERE grid_name = ? AND human_did = ? AND nous_did = ? ORDER BY tick ASC LIMIT ?`,
            [gridName, humanDid, nousDid, limit],
        );
        return rows as unknown as ConversationMessageRow[];
    }

    /** The distinct Nous a human has conversed with (for a conversation list). */
    async listPartners(gridName: string, humanDid: string): Promise<string[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT DISTINCT nous_did FROM conversation_messages WHERE grid_name = ? AND human_did = ? LIMIT 200`,
            [gridName, humanDid],
        );
        return (rows as unknown as { nous_did: string }[]).map((r) => r.nous_did);
    }
}
