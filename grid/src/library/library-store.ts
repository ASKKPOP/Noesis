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
import { appendLibraryCuratorElected } from '../audit/append-library-curator-elected.js';
import { appendLibraryEntryCurated } from '../audit/append-library-entry-curated.js';
import type { CurateAction } from './types.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export interface CuratorRow { curator_civic_did: string; term_start_tick: number; term_end_tick: number; status: string; }

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

    // ── CIVLIB-03 — curation council ────────────────────────────────────────────

    /** Government-enacted election: seat a curator (term-bounded), emit library.curator_elected. */
    async electCurator(p: { gridName: string; curatorDid: string; termStartTick: number; termEndTick: number; tick: number }): Promise<void> {
        await this.pool.query(
            `INSERT INTO library_curators (grid_name, curator_civic_did, term_start_tick, term_end_tick, status, elected_at_tick)
             VALUES (?, ?, ?, ?, 'active', ?)
             ON DUPLICATE KEY UPDATE term_start_tick = VALUES(term_start_tick), term_end_tick = VALUES(term_end_tick), status = 'active', elected_at_tick = VALUES(elected_at_tick)`,
            [p.gridName, p.curatorDid, p.termStartTick, p.termEndTick, p.tick],
        );
        appendLibraryCuratorElected(this.audit, {
            curator_did_hash: sha256Hex(p.curatorDid), term_end_tick: p.termEndTick, term_start_tick: p.termStartTick,
        });
    }

    /** The active curation council (visitor-readable). */
    async listCurators(gridName: string): Promise<CuratorRow[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT curator_civic_did, term_start_tick, term_end_tick, status FROM library_curators
               WHERE grid_name = ? AND status = 'active' ORDER BY elected_at_tick DESC LIMIT 100`,
            [gridName],
        );
        return rows as unknown as CuratorRow[];
    }

    /** Is this Civic-DID an active curator whose term covers `tick`? */
    async isActiveCurator(gridName: string, civicDid: string, tick: number): Promise<boolean> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT 1 FROM library_curators WHERE grid_name = ? AND curator_civic_did = ? AND status = 'active' AND term_end_tick > ? LIMIT 1`,
            [gridName, civicDid, tick],
        );
        return (rows as unknown as unknown[]).length > 0;
    }

    /** Apply a curation action (pin/flag/categorize/link) + emit library.entry_curated.
     *  The caller MUST have verified the curator is active. */
    async curate(p: { gridName: string; curatorDid: string; entryId: string; action: CurateAction; category?: string; relatedEntryId?: string; tick: number }): Promise<void> {
        if (p.action === 'pin') {
            await this.pool.query(`UPDATE library_entries SET pinned = 1 WHERE grid_name = ? AND entry_id = ?`, [p.gridName, p.entryId]);
        } else if (p.action === 'flag') {
            await this.pool.query(`UPDATE library_entries SET status = 'flagged' WHERE grid_name = ? AND entry_id = ?`, [p.gridName, p.entryId]);
        } else if (p.action === 'categorize') {
            await this.pool.query(`UPDATE library_entries SET category = ? WHERE grid_name = ? AND entry_id = ?`, [p.category ?? 'observation', p.gridName, p.entryId]);
        } else { // link
            await this.pool.query(
                `INSERT INTO library_entry_links (grid_name, entry_id, related_entry_id, linked_by_did, linked_at_tick)
                 VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE linked_at_tick = VALUES(linked_at_tick)`,
                [p.gridName, p.entryId, p.relatedEntryId ?? '', p.curatorDid, p.tick],
            );
        }
        appendLibraryEntryCurated(this.audit, {
            action: p.action, curator_did_hash: sha256Hex(p.curatorDid), entry_id: p.entryId, tick: p.tick,
        });
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
