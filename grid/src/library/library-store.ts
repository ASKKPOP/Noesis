/**
 * Phase 48 Library v3 (CIVLIB-01/02) — the public reading room.
 *
 * Stores READABLE content grid-side (the visitor-accessible commons), and on each
 * contribution ALSO upserts the v2.4 lore_commons (hash metadata) and emits the
 * existing v2.4 lore.contributed / lore.cited events — the lore commons IS the Library
 * backend. The K=3-per-epoch quota (LoreQuotaTracker) is enforced at the route layer.
 */
import { randomUUID, createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { LoreStorage } from '../lore/LoreStorage.js';
import { appendLoreContributed } from '../lore/appendLoreContributed.js';
import { appendLoreCited } from '../lore/appendLoreCited.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/** Visitor list view — no body (deep-link fetches full content). */
export interface LibraryEntrySummary {
    entry_id: string; title: string; category: string;
    contributor_civic_did: string; citation_count: number; contributed_tick: number; content_hash: string;
}
export interface LibraryEntryFull extends LibraryEntrySummary { body: string; status: string; }

export class LibraryStore {
    constructor(private readonly pool: Pool, private readonly audit: AuditChain) {}

    /** CIVLIB-02 — store a readable entry, mirror it into the lore commons, emit
     *  lore.contributed (actorDid = the Civic-DID contributor). Returns the entry. */
    async contribute(p: {
        gridName: string; contributorDid: string; title: string; body: string; category: string; tick: number;
    }): Promise<{ entryId: string; contentHash: string }> {
        const contentHash = sha256Hex(`${p.title}\n${p.body}`);
        const titleHash = sha256Hex(p.title);
        const entryId = randomUUID();
        await this.pool.query(
            `INSERT INTO library_entries
               (entry_id, grid_name, contributor_civic_did, content_hash, title, body, category, citation_count, status, contributed_tick)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'published', ?)`,
            [entryId, p.gridName, p.contributorDid, contentHash, p.title.slice(0, 255), p.body, p.category, p.tick],
        );
        // Reuse the v2.4 commons storage (hash metadata) + the sole-producer event.
        await new LoreStorage(this.pool).upsertContribution(p.gridName, contentHash, p.contributorDid, titleHash, p.category, p.tick);
        appendLoreContributed(this.audit, p.contributorDid, {
            category_tag: p.category, content_hash: contentHash, contributor_did: p.contributorDid, tick: p.tick,
        });
        return { entryId, contentHash };
    }

    /** CIVLIB-02 — register a citation of an entry (by its content_hash). Bumps the
     *  count in both the library + commons and emits lore.cited (actorDid = citer). */
    async cite(p: { gridName: string; citingDid: string; contentHash: string; tick: number }): Promise<void> {
        await this.pool.query(
            `UPDATE library_entries SET citation_count = citation_count + 1 WHERE grid_name = ? AND content_hash = ?`,
            [p.gridName, p.contentHash],
        );
        await new LoreStorage(this.pool).incrementCitationCount(p.gridName, p.contentHash);
        appendLoreCited(this.audit, p.citingDid, { citing_did: p.citingDid, content_hash: p.contentHash, tick: p.tick });
    }

    /** CIVLIB-01 — visitor reading room: search + category filter + pagination. */
    async listEntries(p: { gridName: string; search?: string; category?: string; limit: number; offset: number }): Promise<LibraryEntrySummary[]> {
        const where = ["grid_name = ?", "status = 'published'"]; const params: unknown[] = [p.gridName];
        if (p.category) { where.push('category = ?'); params.push(p.category); }
        if (p.search) { where.push('title LIKE ?'); params.push(`%${p.search}%`); }
        params.push(p.limit, p.offset);
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT entry_id, title, category, contributor_civic_did, citation_count, contributed_tick, content_hash
               FROM library_entries WHERE ${where.join(' AND ')} ORDER BY contributed_tick DESC LIMIT ? OFFSET ?`,
            params,
        );
        return rows as unknown as LibraryEntrySummary[];
    }

    /** CIVLIB-01 — per-entry deep link: full content (visitor-readable when published). */
    async getEntry(gridName: string, entryId: string): Promise<LibraryEntryFull | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT entry_id, title, body, category, status, contributor_civic_did, citation_count, contributed_tick, content_hash
               FROM library_entries WHERE grid_name = ? AND entry_id = ? LIMIT 1`,
            [gridName, entryId],
        );
        const r = rows as unknown as LibraryEntryFull[];
        return r.length ? r[0] : null;
    }
}
