import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { QueuedMessage } from './types.js';
import { QUEUE_DEPTH_MAX } from './types.js';

interface MessageRow extends RowDataPacket {
    id: number;
    grid_name: string;
    recipient_civic_did: string;
    sender_civic_did: string;
    message_json: string | object;
    sent_at_tick: number;
    sent_at: Date;
    status: 'pending' | 'delivered';
}

function rowToMessage(row: MessageRow): QueuedMessage {
    return {
        id: row.id,
        gridName: row.grid_name,
        recipientCivicDid: row.recipient_civic_did,
        senderCivicDid: row.sender_civic_did,
        messageJson: typeof row.message_json === 'string'
            ? JSON.parse(row.message_json)
            : row.message_json,
        sentAtTick: row.sent_at_tick,
        sentAt: row.sent_at,
        status: row.status,
    };
}

export class MessageQueueStore {
    constructor(private readonly pool: Pool) {}

    /** Returns the inserted row id, or null if queue depth cap (T-41-02) hit. */
    async enqueue(
        gridName: string,
        recipientCivicDid: string,
        senderCivicDid: string,
        messageJson: unknown,
        sentAtTick: number,
    ): Promise<number | null> {
        // T-41-02 mitigation: cap pending depth per recipient at QUEUE_DEPTH_MAX.
        const depth = await this.depth(gridName, recipientCivicDid);
        if (depth >= QUEUE_DEPTH_MAX) return null;
        const [result] = await this.pool.query<ResultSetHeader>(
            `INSERT INTO civic_message_queue
                (grid_name, recipient_civic_did, sender_civic_did, message_json, sent_at_tick)
             VALUES (?, ?, ?, ?, ?)`,
            [gridName, recipientCivicDid, senderCivicDid, JSON.stringify(messageJson), sentAtTick],
        );
        return result.insertId;
    }

    /** Pending message count for the recipient (used by depth-cap + Steward Console). */
    async depth(gridName: string, recipientCivicDid: string): Promise<number> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS n FROM civic_message_queue
             WHERE grid_name = ? AND recipient_civic_did = ? AND status='pending'`,
            [gridName, recipientCivicDid],
        );
        return Number(rows[0]?.n ?? 0);
    }

    /** Inbox endpoint backing query — pending messages for caller Civic-DID. */
    async listPending(
        gridName: string,
        recipientCivicDid: string,
        sinceTick: number | undefined,
    ): Promise<QueuedMessage[]> {
        const sinceClause = sinceTick !== undefined ? ' AND sent_at_tick >= ?' : '';
        const params = sinceTick !== undefined
            ? [gridName, recipientCivicDid, sinceTick]
            : [gridName, recipientCivicDid];
        const [rows] = await this.pool.query<MessageRow[]>(
            `SELECT id, grid_name, recipient_civic_did, sender_civic_did, message_json,
                    sent_at_tick, sent_at, status
             FROM civic_message_queue
             WHERE grid_name = ? AND recipient_civic_did = ? AND status='pending'${sinceClause}
             ORDER BY sent_at_tick ASC, id ASC`,
            params,
        );
        return rows.map(rowToMessage);
    }

    /**
     * Batch mark delivered. recipientCivicDid REQUIRED — prevents cross-DID ack (T-41-05).
     * Returns count of rows updated.
     */
    async markDelivered(
        gridName: string,
        recipientCivicDid: string,
        messageIds: number[],
    ): Promise<number> {
        if (messageIds.length === 0) return 0;
        const placeholders = messageIds.map(() => '?').join(',');
        const [result] = await this.pool.query<ResultSetHeader>(
            `UPDATE civic_message_queue
             SET status='delivered'
             WHERE grid_name = ? AND recipient_civic_did = ?
               AND status='pending' AND id IN (${placeholders})`,
            [gridName, recipientCivicDid, ...messageIds],
        );
        return result.affectedRows;
    }

    /**
     * Steward Console / Grid Manager — depth per recipient. Returns map of
     * civic_did → pending_count for the entire grid.
     */
    async depthByRecipient(gridName: string): Promise<Record<string, number>> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT recipient_civic_did, COUNT(*) AS n
             FROM civic_message_queue
             WHERE grid_name = ? AND status='pending'
             GROUP BY recipient_civic_did`,
            [gridName],
        );
        const out: Record<string, number> = {};
        for (const row of rows) {
            out[row.recipient_civic_did as string] = Number(row.n);
        }
        return out;
    }
}
