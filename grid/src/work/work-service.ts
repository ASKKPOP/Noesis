/**
 * WorkService — what stands between a request and the stored Work Card.
 *
 * It checks the three things work-logic.ts cannot: that the writer is a current member
 * of this Grid (stage 1, Enter), that the write names the version it was based on, and
 * that the store still holds that version when the new card goes in. It then records the
 * move on the audit chain: one `work.stage_changed` per stage change, carrying the hash
 * of the stored card and never its wording.
 *
 * Order: database first, then the chain. If the process stops between the two, the card
 * has moved and the record is missing.
 *
 * Verified under the Triple Verification Rule as P-WORK-01..09
 * (verification/PROPERTIES.md).
 */
import { createHash } from 'node:crypto';
import type { AuditChain } from '../audit/chain.js';
import { appendWorkStageChanged } from '../audit/append-work-stage-changed.js';
import {
    applyWorkOp, builderOf, createWork,
    type MemberKind, type WorkCard, type WorkError, type WorkStage,
} from './work-logic.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/** A card as stored: the card, the exact JSON text kept for it, and that text's sha256. */
export interface WorkRow {
    readonly card: WorkCard;
    readonly json: string;
    readonly hash: string;
}

export function workRow(card: WorkCard): WorkRow {
    const json = JSON.stringify(card);
    return { card, json, hash: sha256Hex(json) };
}

/** Which Works to list. `notBuilder` leaves out the Works a DID builds. */
export interface WorkListOptions {
    stage?: WorkStage;
    owner?: string;
    builder?: string;
    notBuilder?: string;
    limit: number;
}

export interface WorkStore {
    insert(row: WorkRow): Promise<void>;
    get(gridName: string, workId: string): Promise<WorkRow | null>;
    /** Stores `row` only if the stored card still has `expectedVersion`. True if it did. */
    replace(expectedVersion: number, row: WorkRow): Promise<boolean>;
    /** Latest change first. */
    list(gridName: string, opts: WorkListOptions): Promise<WorkRow[]>;
}

export interface WorkServiceDeps {
    readonly gridName: string;
    readonly store: WorkStore;
    readonly audit: AuditChain;
    /** What this Grid knows of a Civic-DID: a person, a Nous, or null when it holds no active one. */
    memberKind(civicDid: string): Promise<MemberKind | null>;
    newId(): string;
}

export type WorkServiceError = WorkError | 'not_member' | 'unknown_work' | 'stale_version';
export type WorkServiceResult =
    | { ok: true; card: WorkCard }
    | { ok: false; error: WorkServiceError; version?: number };

export class WorkService {
    constructor(private readonly deps: WorkServiceDeps) {}

    /** Stage 2 — a member states a goal. */
    async create(actorDid: string, input: unknown, tick: number): Promise<WorkServiceResult> {
        const kind = await this.deps.memberKind(actorDid);
        if (kind === null) return { ok: false, error: 'not_member' };
        const builder = builderOf(input, actorDid);
        const builderKind = builder === actorDid ? kind
            : typeof builder === 'string' ? await this.deps.memberKind(builder) : null;
        const made = createWork(this.deps.newId(), this.deps.gridName, { did: actorDid, kind }, input, builderKind, tick);
        if (!made.ok) return made;
        const row = workRow(made.card);
        await this.deps.store.insert(row);
        appendWorkStageChanged(this.deps.audit, {
            actor_did_hash: sha256Hex(actorDid), card_hash: row.hash, from_stage: 'enter',
            tick, to_stage: made.card.stage, work_id: made.card.work_id,
        });
        return made;
    }

    /** Stages 2 to 9 — one write on a Work, based on `baseVersion`. */
    async write(actorDid: string, workId: string, baseVersion: unknown, op: unknown, tick: number): Promise<WorkServiceResult> {
        const kind = await this.deps.memberKind(actorDid);
        if (kind === null) return { ok: false, error: 'not_member' };
        const stored = await this.deps.store.get(this.deps.gridName, workId);
        if (stored === null) return { ok: false, error: 'unknown_work' };
        if (baseVersion !== stored.card.version) return { ok: false, error: 'stale_version', version: stored.card.version };
        const applied = applyWorkOp(stored.card, { did: actorDid, kind }, op, tick);
        if (!applied.ok) return applied;
        const row = workRow(applied.card);
        // Someone else may have written since the read above: the store decides.
        if (!(await this.deps.store.replace(stored.card.version, row))) return { ok: false, error: 'stale_version' };
        if (applied.card.stage !== stored.card.stage) {
            appendWorkStageChanged(this.deps.audit, {
                actor_did_hash: sha256Hex(actorDid), card_hash: row.hash, from_stage: stored.card.stage,
                tick, to_stage: applied.card.stage, work_id: workId,
            });
        }
        return applied;
    }

    async get(workId: string): Promise<WorkCard | null> {
        return (await this.deps.store.get(this.deps.gridName, workId))?.card ?? null;
    }

    async list(opts: WorkListOptions): Promise<WorkCard[]> {
        return (await this.deps.store.list(this.deps.gridName, opts)).map((r) => r.card);
    }
}
