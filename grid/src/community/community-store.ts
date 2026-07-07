/**
 * Phase 49 Communities v3 (Plan 1) — found + join. The Bios sybil cost is charged by the
 * route (registry.transferWei → treasury) BEFORE found(); this store persists + emits.
 * Raw DIDs/charter live in the tables; the audit chain carries only hashes.
 */
import { randomUUID, createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { appendCommunityFounded } from '../audit/append-community-founded.js';
import { appendCommunityJoined } from '../audit/append-community-joined.js';
import { appendCommunityPosted } from '../audit/append-community-posted.js';
import { appendCommunityDissolved } from '../audit/append-community-dissolved.js';
import type { Charter } from './types.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export interface CommunityRow {
    community_id: string; founder_civic_did: string; name: string; charter_json: string; charter_hash: string; status: string; founded_tick: number;
}

export class CommunityStore {
    constructor(private readonly pool: Pool, private readonly audit: AuditChain) {}

    /** COMM-01 — found a community + seat the founder + emit community.founded.
     *  The community row and the founder-member row commit together or not at all
     *  (one MySQL transaction, matching the IRS disburse idiom) so a mid-way failure
     *  never leaves an orphan community without its founder. community.founded is
     *  emitted only after commit — a rolled-back found() emits nothing. */
    async found(p: { gridName: string; founderDid: string; name: string; purpose: string; charter: Charter; weiPaid: number; tick: number }): Promise<string> {
        const communityId = randomUUID();
        const charterJson = JSON.stringify(p.charter);
        const charterHash = sha256Hex(charterJson);
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(
                `INSERT INTO communities
                   (community_id, grid_name, founder_civic_did, name, purpose, charter_json, charter_hash, wei_paid, status, founded_tick)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
                [communityId, p.gridName, p.founderDid, p.name.slice(0, 255), p.purpose, charterJson, charterHash, p.weiPaid, p.tick],
            );
            await conn.query(
                `INSERT INTO community_members (grid_name, community_id, member_civic_did, role, status, joined_tick)
                 VALUES (?, ?, ?, 'founder', 'active', ?)`,
                [p.gridName, communityId, p.founderDid, p.tick],
            );
            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
        appendCommunityFounded(this.audit, {
            wei_paid: p.weiPaid, charter_hash: charterHash, community_id: communityId,
            founder_did_hash: sha256Hex(p.founderDid), name_hash: sha256Hex(p.name), tick: p.tick,
        });
        return communityId;
    }

    async getCommunity(gridName: string, communityId: string): Promise<CommunityRow | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT community_id, founder_civic_did, name, charter_json, charter_hash, status, founded_tick
               FROM communities WHERE grid_name = ? AND community_id = ? LIMIT 1`,
            [gridName, communityId],
        );
        const r = rows as unknown as CommunityRow[];
        return r.length ? r[0] : null;
    }

    /** COMM-03 — add a member. `active` emits community.joined; `pending` (approval flow)
     *  is queued silently (the event fires only on actual membership). */
    async addMember(p: { gridName: string; communityId: string; memberDid: string; status: 'active' | 'pending'; tick: number }): Promise<void> {
        await this.pool.query(
            `INSERT INTO community_members (grid_name, community_id, member_civic_did, role, status, joined_tick)
             VALUES (?, ?, ?, 'member', ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status)`,
            [p.gridName, p.communityId, p.memberDid, p.status, p.tick],
        );
        if (p.status === 'active') {
            appendCommunityJoined(this.audit, { community_id: p.communityId, member_did_hash: sha256Hex(p.memberDid), tick: p.tick });
        }
    }

    /** Is this Civic-DID an active member of the community? */
    async isMember(gridName: string, communityId: string, memberDid: string): Promise<boolean> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT 1 FROM community_members WHERE grid_name = ? AND community_id = ? AND member_civic_did = ? AND status = 'active' LIMIT 1`,
            [gridName, communityId, memberDid],
        );
        return (rows as unknown as unknown[]).length > 0;
    }

    /** COMM-04 — a member posts (body off-chain) + emit community.posted. */
    async post(p: { gridName: string; communityId: string; posterDid: string; body: string; tick: number }): Promise<string> {
        const postId = randomUUID();
        await this.pool.query(
            `INSERT INTO community_posts (post_id, grid_name, community_id, poster_civic_did, body, posted_tick)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [postId, p.gridName, p.communityId, p.posterDid, p.body.slice(0, 8000), p.tick],
        );
        appendCommunityPosted(this.audit, { community_id: p.communityId, post_id: postId, poster_did_hash: sha256Hex(p.posterDid), tick: p.tick });
        return postId;
    }

    /** COMM-05 — dissolve a community (founding Bios stays in the treasury, D-V3-09). */
    async dissolve(p: { gridName: string; communityId: string; byDid: string; tick: number }): Promise<void> {
        await this.pool.query(
            `UPDATE communities SET status = 'dissolved' WHERE grid_name = ? AND community_id = ? AND status = 'active'`,
            [p.gridName, p.communityId],
        );
        appendCommunityDissolved(this.audit, { community_id: p.communityId, dissolved_by_did_hash: sha256Hex(p.byDid), tick: p.tick });
    }

    async memberCount(gridName: string, communityId: string): Promise<number> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS n FROM community_members WHERE grid_name = ? AND community_id = ? AND status = 'active'`,
            [gridName, communityId],
        );
        return Number((rows as unknown as { n: number }[])[0]?.n ?? 0);
    }
}
