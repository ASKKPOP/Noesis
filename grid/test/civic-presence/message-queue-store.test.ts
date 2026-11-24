/**
 * MessageQueueStore — the statements behind the civic inbox, against a recording pool.
 * No test runs these against MySQL; this pins their text and parameters.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { MessageQueueStore } from '../../src/civic-presence/message-queue-store.js';

function store(result: unknown = [[], {}]) {
    const query = vi.fn().mockResolvedValue(result);
    return { store: new MessageQueueStore({ query } as unknown as Pool), query };
}
const sql = (q: ReturnType<typeof vi.fn>, call = 0): string => String(q.mock.calls[call]![0]).replace(/\s+/g, ' ');

describe('MessageQueueStore', () => {
    it('listPending reads only the recipient\'s pending rows, oldest first, with no LIMIT unless asked', async () => {
        const { store: s, query } = store();
        await s.listPending('genesis', 'did:civic:noesis:a', undefined);
        expect(sql(query)).toContain("WHERE grid_name = ? AND recipient_civic_did = ? AND status='pending' ORDER BY sent_at_tick ASC, id ASC");
        expect(sql(query)).not.toContain('LIMIT');
        expect(query.mock.calls[0]![1]).toEqual(['genesis', 'did:civic:noesis:a']);
    });

    it('listPending passes since and limit as parameters', async () => {
        const { store: s, query } = store();
        await s.listPending('genesis', 'did:civic:noesis:a', 7, 10);
        expect(sql(query)).toContain("status='pending' AND sent_at_tick >= ? ORDER BY sent_at_tick ASC, id ASC LIMIT ?");
        expect(query.mock.calls[0]![1]).toEqual(['genesis', 'did:civic:noesis:a', 7, 10]);
    });

    it('markDelivered flips only pending rows of that recipient, empties the message, and reports the count', async () => {
        const { store: s, query } = store([{ affectedRows: 1 }, {}]);
        expect(await s.markDelivered('genesis', 'did:civic:noesis:a', [4, 9])).toBe(1);
        expect(sql(query)).toContain(
            "UPDATE civic_message_queue SET status='delivered', message_json='{}' WHERE grid_name = ? AND recipient_civic_did = ? AND status='pending' AND id IN (?,?)",
        );
        expect(query.mock.calls[0]![1]).toEqual(['genesis', 'did:civic:noesis:a', 4, 9]);
    });

    it('markDelivered with no ids touches nothing', async () => {
        const { store: s, query } = store();
        expect(await s.markDelivered('genesis', 'did:civic:noesis:a', [])).toBe(0);
        expect(query).not.toHaveBeenCalled();
    });
});
