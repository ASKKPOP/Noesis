/**
 * Join-a-Grid S2 — Type A pairing. A human owns/sponsors a Nous; the human joins a
 * Grid THROUGH that Nous (land is Nous-only, D-NH-07 — the human never owns land, the
 * Nous holds the home). Keyed by (grid_name, human_did, nous_did).
 *
 * PRIVATE: an ownership relationship, not a civic broadcast. No audit events,
 * allowlist +0 (same posture as ConversationStore). nous_sponsors, migration v55.
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';

export class NousSponsorStore {
    constructor(private readonly pool: Pool) {}

    /** A human claims ownership of a Nous. Idempotent (re-claim is a no-op). */
    async claim(gridName: string, humanDid: string, nousDid: string, tick: number): Promise<void> {
        await this.pool.query(
            `INSERT INTO nous_sponsors (grid_name, human_did, nous_did, created_at)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE created_at = created_at`,
            [gridName, humanDid, nousDid, tick],
        );
    }

    /** The Nous existence-DIDs a human owns. */
    async sponsorsOf(gridName: string, humanDid: string): Promise<string[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT nous_did FROM nous_sponsors WHERE grid_name = ? AND human_did = ? LIMIT 200`,
            [gridName, humanDid],
        );
        return (rows as unknown as { nous_did: string }[]).map((r) => r.nous_did);
    }

    /** The human who owns a Nous, or null. */
    async sponsorOf(gridName: string, nousDid: string): Promise<string | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT human_did FROM nous_sponsors WHERE grid_name = ? AND nous_did = ? LIMIT 1`,
            [gridName, nousDid],
        );
        const r = rows as unknown as { human_did: string }[];
        return r.length ? r[0].human_did : null;
    }

    /** Does this human own this Nous? (the authorization check for S3 recommendations) */
    async owns(gridName: string, humanDid: string, nousDid: string): Promise<boolean> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT 1 FROM nous_sponsors WHERE grid_name = ? AND human_did = ? AND nous_did = ? LIMIT 1`,
            [gridName, humanDid, nousDid],
        );
        return (rows as unknown as unknown[]).length > 0;
    }
}
