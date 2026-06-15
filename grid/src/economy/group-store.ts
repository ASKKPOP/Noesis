/**
 * Groups & Holdings · Phase 1 — GroupStore (write-through persistence).
 *
 * DB-first: MySQL `civic_groups` is the source of truth. seedGenesisGroups
 * idempotently INSERT IGNOREs the five founding Businesses (D-GROUP-04) and emits
 * one group.founded per row actually inserted (mirrors the parcel seed pattern,
 * except Groups DO emit a founding event). listGroups powers the orbital map +
 * Group pages. Membership + treasury arrive in later phases.
 */
import { createHash } from 'node:crypto';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { appendGroupFounded } from '../audit/append-group-founded.js';
import { appendGroupMemberJoined } from '../audit/append-group-member-joined.js';
import { appendGroupMemberLeft } from '../audit/append-group-member-left.js';
import { appendGroupProjectStarted } from '../audit/append-group-project-started.js';
import { appendGroupProjectCompleted } from '../audit/append-group-project-completed.js';
import { buildGenesisGroups, type GroupDomain, type GroupKind } from './genesis-groups.js';

/** Hash a raw Civic-DID for the audit boundary — the raw DID is stored DB-side only. */
const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/** A Group membership role (D-GROUP-01). */
export type GroupRole = 'founder' | 'member' | 'affiliate';

export interface GroupRow extends RowDataPacket {
    group_id: string;
    grid_name: string;
    kind: GroupKind;
    domain: GroupDomain;
    display_name: string;
    crest_path: string | null;
    ring: number;
    sector_deg: string | number;
    status: string;
}

/** A Group summary for the map + Group pages (no member/treasury detail in Phase 1). */
export interface GroupSummary {
    readonly groupId: string;
    readonly kind: GroupKind;
    readonly domain: GroupDomain;
    readonly displayName: string;
    readonly crestPath: string | null;
    readonly ring: number;
    readonly sectorDeg: number;
    readonly status: string;
}

export class GroupStore {
    constructor(
        private readonly pool: Pool,
        private readonly gridName: string = 'genesis',
    ) {}

    /**
     * Seed the five founding Businesses (D-GROUP-04) idempotently. INSERT IGNORE per
     * buildGenesisGroups — a re-run on an already-seeded grid inserts 0 rows and emits
     * 0 events. Each freshly-inserted Group emits one group.founded onto the chain.
     * Returns the number of rows seeded.
     */
    async seedGenesisGroups(audit: AuditChain, tick: number): Promise<number> {
        const groups = buildGenesisGroups(this.gridName);
        let inserted = 0;
        for (const g of groups) {
            const [res] = await this.pool.query<ResultSetHeader>(
                `INSERT IGNORE INTO civic_groups
                    (group_id, grid_name, kind, domain, display_name, crest_path,
                     charter_text, zone_id, ring, sector_deg, level,
                     founder_civic_did, status, created_at_tick)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
                [
                    g.groupId, g.gridName, g.kind, g.domain, g.displayName, g.crestPath,
                    g.charter, g.zoneId, g.ring, g.sectorDeg, 0,
                    null, tick,
                ],
            );
            if (res.affectedRows > 0) {
                inserted++;
                appendGroupFounded(audit, {
                    domain: g.domain,
                    group_id: g.groupId,
                    kind: g.kind,
                    tick,
                });
            }
        }
        return inserted;
    }

    /** List all Groups for this grid (DB source of truth). */
    async listGroups(): Promise<GroupSummary[]> {
        const [rows] = await this.pool.query<GroupRow[]>(
            `SELECT * FROM civic_groups WHERE grid_name = ? ORDER BY sector_deg`,
            [this.gridName],
        );
        return rows.map((r) => ({
            groupId: r.group_id,
            kind: r.kind,
            domain: r.domain,
            displayName: r.display_name,
            crestPath: r.crest_path,
            ring: r.ring,
            sectorDeg: Number(r.sector_deg),
            status: r.status,
        }));
    }

    /**
     * Join a Group (Phase 63). Write-through INSERT … ON DUPLICATE KEY UPDATE so a
     * leave→rejoin resumes the SAME (group_id, member) row at `active`. The raw Civic-DID
     * is stored DB-side; the audit event carries only its HEX64 hash. Emits group.member_joined.
     */
    async joinGroup(
        audit: AuditChain,
        m: { groupId: string; memberCivicDid: string; role: GroupRole; tick: number },
    ): Promise<AuditEntry> {
        await this.pool.query<ResultSetHeader>(
            `INSERT INTO civic_group_members
                (group_id, member_civic_did, role, joined_at_tick, status)
             VALUES (?, ?, ?, ?, 'active')
             ON DUPLICATE KEY UPDATE role = VALUES(role), joined_at_tick = VALUES(joined_at_tick), status = 'active'`,
            [m.groupId, m.memberCivicDid, m.role, m.tick],
        );
        return appendGroupMemberJoined(audit, {
            group_id: m.groupId,
            member_civic_did_hash: sha256Hex(m.memberCivicDid),
            role: m.role,
            tick: m.tick,
        });
    }

    /**
     * Leave a Group (Phase 63). Marks the row `departed` (kept for history, never hard-deleted —
     * mirrors role-edge retention). Emits group.member_left.
     */
    async leaveGroup(
        audit: AuditChain,
        m: { groupId: string; memberCivicDid: string; reason: 'voluntary' | 'removed'; tick: number },
    ): Promise<AuditEntry> {
        await this.pool.query<ResultSetHeader>(
            `UPDATE civic_group_members SET status = 'departed'
              WHERE group_id = ? AND member_civic_did = ?`,
            [m.groupId, m.memberCivicDid],
        );
        return appendGroupMemberLeft(audit, {
            group_id: m.groupId,
            member_civic_did_hash: sha256Hex(m.memberCivicDid),
            reason: m.reason,
            tick: m.tick,
        });
    }

    /** List a Group's active members (DB source of truth). */
    async listMembers(groupId: string): Promise<GroupMemberSummary[]> {
        const [rows] = await this.pool.query<GroupMemberRow[]>(
            `SELECT * FROM civic_group_members WHERE group_id = ? AND status = 'active'`,
            [groupId],
        );
        return rows.map((r) => ({
            groupId: r.group_id,
            memberCivicDid: r.member_civic_did,
            role: r.role,
            joinedAtTick: r.joined_at_tick,
        }));
    }

    /**
     * Start a research project (Phase 69). The title stays Grid-side; the audit event
     * carries only the UUID project_id. Emits group.project_started.
     */
    async startProject(
        audit: AuditChain,
        p: { groupId: string; projectId: string; title: string; tick: number },
    ): Promise<AuditEntry> {
        await this.pool.query<ResultSetHeader>(
            `INSERT INTO civic_group_projects
                (project_id, group_id, grid_name, title, status, started_at_tick)
             VALUES (?, ?, ?, ?, 'active', ?)`,
            [p.projectId, p.groupId, this.gridName, p.title, p.tick],
        );
        return appendGroupProjectStarted(audit, {
            group_id: p.groupId,
            project_id: p.projectId,
            tick: p.tick,
        });
    }

    /**
     * Complete a research project (Phase 69): it PRODUCES a blueprint/skill. Records the
     * produced blueprint_hash (a Phase 18 skill hash) and emits group.project_completed.
     */
    async completeProject(
        audit: AuditChain,
        p: { groupId: string; projectId: string; blueprintHash: string; tick: number },
    ): Promise<AuditEntry> {
        await this.pool.query<ResultSetHeader>(
            `UPDATE civic_group_projects
                SET status = 'completed', produced_blueprint_hash = ?, completed_at_tick = ?
              WHERE project_id = ? AND group_id = ?`,
            [p.blueprintHash, p.tick, p.projectId, p.groupId],
        );
        return appendGroupProjectCompleted(audit, {
            blueprint_hash: p.blueprintHash,
            group_id: p.groupId,
            project_id: p.projectId,
            tick: p.tick,
        });
    }

    /** List a Group's projects (DB source of truth). */
    async listProjects(groupId: string): Promise<GroupProjectSummary[]> {
        const [rows] = await this.pool.query<GroupProjectRow[]>(
            `SELECT * FROM civic_group_projects WHERE group_id = ? ORDER BY started_at_tick`,
            [groupId],
        );
        return rows.map((r) => ({
            projectId: r.project_id,
            groupId: r.group_id,
            title: r.title,
            status: r.status,
            producedBlueprintHash: r.produced_blueprint_hash,
            startedAtTick: r.started_at_tick,
            completedAtTick: r.completed_at_tick,
        }));
    }
}

export interface GroupProjectRow extends RowDataPacket {
    project_id: string;
    group_id: string;
    title: string;
    status: 'active' | 'completed' | 'abandoned';
    produced_blueprint_hash: string | null;
    started_at_tick: number;
    completed_at_tick: number | null;
}

/** A Group research project (title is Grid-side; never on the audit chain). */
export interface GroupProjectSummary {
    readonly projectId: string;
    readonly groupId: string;
    readonly title: string;
    readonly status: 'active' | 'completed' | 'abandoned';
    readonly producedBlueprintHash: string | null;
    readonly startedAtTick: number;
    readonly completedAtTick: number | null;
}

export interface GroupMemberRow extends RowDataPacket {
    group_id: string;
    member_civic_did: string;
    role: GroupRole;
    joined_at_tick: number;
    status: string;
}

/** An active Group member (raw DID is Grid-side; never emitted to the audit boundary). */
export interface GroupMemberSummary {
    readonly groupId: string;
    readonly memberCivicDid: string;
    readonly role: GroupRole;
    readonly joinedAtTick: number;
}
