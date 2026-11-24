/**
 * In-memory stand-in for MessageQueueStore (the `civic_message_queue` table), for
 * tests that run the peer-message path without MySQL. It stands in for the database
 * only and keeps the statements' meaning:
 *
 *   enqueue        refuses when the recipient already has QUEUE_DEPTH_MAX pending rows
 *   listPending    the recipient's pending rows, by sent tick then id, optional limit
 *   markDelivered  flips a row only if it is pending AND addressed to that recipient,
 *                  empties its message, and reports how many rows it flipped
 *
 * The SQL itself is not run by any test (stated in verification/PROPERTIES.md).
 */
import type { QueuedMessage } from '../../src/civic-presence/types.js';
import { QUEUE_DEPTH_MAX } from '../../src/civic-presence/types.js';
import type { MessageQueueStore } from '../../src/civic-presence/message-queue-store.js';

type Row = { -readonly [K in keyof QueuedMessage]: QueuedMessage[K] };

export class InMemoryMessageQueue {
    readonly rows: Row[] = [];
    private nextId = 1;

    constructor(private readonly depthMax: number = QUEUE_DEPTH_MAX) {}

    async enqueue(
        gridName: string, recipientCivicDid: string, senderCivicDid: string,
        messageJson: unknown, sentAtTick: number,
    ): Promise<number | null> {
        if (await this.depth(gridName, recipientCivicDid) >= this.depthMax) return null;
        const id = this.nextId++;
        this.rows.push({
            id, gridName, recipientCivicDid, senderCivicDid,
            messageJson: JSON.parse(JSON.stringify(messageJson)),
            sentAtTick, sentAt: new Date(0), status: 'pending',
        });
        return id;
    }

    async depth(gridName: string, recipientCivicDid: string): Promise<number> {
        return this.rows.filter(r =>
            r.gridName === gridName && r.recipientCivicDid === recipientCivicDid && r.status === 'pending').length;
    }

    async listPending(
        gridName: string, recipientCivicDid: string, sinceTick: number | undefined, limit?: number,
    ): Promise<QueuedMessage[]> {
        const rows = this.rows
            .filter(r => r.gridName === gridName && r.recipientCivicDid === recipientCivicDid
                && r.status === 'pending' && (sinceTick === undefined || r.sentAtTick >= sinceTick))
            .sort((a, b) => a.sentAtTick - b.sentAtTick || a.id - b.id);
        return (limit === undefined ? rows : rows.slice(0, limit)).map(r => ({ ...r }));
    }

    async markDelivered(gridName: string, recipientCivicDid: string, messageIds: number[]): Promise<number> {
        let changed = 0;
        for (const row of this.rows) {
            if (row.gridName === gridName && row.recipientCivicDid === recipientCivicDid
                && row.status === 'pending' && messageIds.includes(row.id)) {
                row.status = 'delivered';
                row.messageJson = {};
                changed++;
            }
        }
        return changed;
    }

    /** For the PresenceService constructor, which is typed against the MySQL store. */
    asStore(): MessageQueueStore {
        return this as unknown as MessageQueueStore;
    }
}
