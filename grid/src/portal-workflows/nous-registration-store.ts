/**
 * Phase 54 Portal Nous Approval Workflow (NOUS track) — the Portal-gated registration pipeline.
 *
 * request → Portal pre-screen → target-Grid Polis charter review → approved (residence assigned)
 * / rejected. Dedicated nous.registration_* events; reuses polis.registration_pending (forward)
 * and Phase 57 ResidenceStore (zoning.residence_assigned on approval).
 */
import { createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { appendNousRegistrationRequested } from '../audit/append-nous-registration-requested.js';
import { appendNousRegistrationApproved } from '../audit/append-nous-registration-approved.js';
import { appendNousRegistrationRejected } from '../audit/append-nous-registration-rejected.js';
import { appendPolisRegistrationPending } from '../audit/append-polis-registration-pending.js';
import { ResidenceStore } from '../zoning/residence-store.js';
import type { NousType, NousRejectReason } from './nous-registration-types.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');
/** Deterministic UUID-format id (so polis.registration_pending's APPLICATION_ID_RE accepts it). */
function uuidFrom(seed: string): string {
    const h = sha256Hex(seed);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export type NousRegStatus = 'requested' | 'polis_pending' | 'approved' | 'rejected';
export interface NousRegListRow extends NousRegRow { reason_code: string | null; filed_tick: number; }
export interface NousRegRow { request_id: string; nous_type: string; registrant_did: string; nous_did: string; target_grid: string; status: string; }

export class NousRegistrationStore {
    constructor(private readonly pool: Pool, private readonly audit: AuditChain) {}

    /** A Nous registration enters the Portal pipeline → nous.registration_requested. */
    async request(p: { type: NousType; registrantDid: string; nousDid: string; targetGrid: string; tick: number; brainKeyX?: string }): Promise<{ requestId: string }> {
        const requestId = uuidFrom(`${p.registrantDid}|${p.nousDid}|${p.tick}`);
        await this.pool.query(
            `INSERT INTO nous_registrations (request_id, nous_type, registrant_did, nous_did, target_grid, brain_key_x, status, filed_tick)
             VALUES (?, ?, ?, ?, ?, ?, 'requested', ?)`,
            [requestId, p.type, p.registrantDid, p.nousDid, p.targetGrid, p.brainKeyX ?? null, p.tick],
        );
        appendNousRegistrationRequested(this.audit, { registrant_did_hash: sha256Hex(p.registrantDid), request_id: requestId, target_grid: p.targetGrid, tick: p.tick, type: p.type });
        return { requestId };
    }

    async get(requestId: string): Promise<NousRegRow | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT request_id, nous_type, registrant_did, nous_did, target_grid, status FROM nous_registrations WHERE request_id = ? LIMIT 1`,
            [requestId],
        );
        const r = rows as unknown as NousRegRow[];
        return r.length ? r[0] : null;
    }

    /**
     * The live (not rejected) registration for a Nous on a Grid, or null. One Nous may
     * hold at most one live registration — the filing route refuses a second.
     */
    async liveForNous(gridName: string, nousDid: string): Promise<NousRegRow | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT request_id, nous_type, registrant_did, nous_did, target_grid, \`status\` FROM nous_registrations
             WHERE target_grid = ? AND nous_did = ? AND \`status\` <> 'rejected' LIMIT 1`,
            [gridName, nousDid],
        );
        const r = rows as unknown as NousRegRow[];
        return r.length ? r[0] : null;
    }

    /** Registrations a registrant filed on a Grid, newest first (their own status view). */
    async listByRegistrant(gridName: string, registrantDid: string): Promise<NousRegListRow[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT request_id, nous_type, registrant_did, nous_did, target_grid, \`status\`, reason_code, filed_tick FROM nous_registrations
             WHERE target_grid = ? AND registrant_did = ? ORDER BY filed_tick DESC LIMIT 200`,
            [gridName, registrantDid],
        );
        return rows as unknown as NousRegListRow[];
    }

    /** The Portal reviewer queue for a Grid, newest first, optionally one status. */
    async listForReview(gridName: string, status?: NousRegStatus): Promise<NousRegListRow[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT request_id, nous_type, registrant_did, nous_did, target_grid, \`status\`, reason_code, filed_tick FROM nous_registrations
             WHERE target_grid = ?${status ? ' AND `status` = ?' : ''} ORDER BY filed_tick DESC LIMIT 200`,
            status ? [gridName, status] : [gridName],
        );
        return rows as unknown as NousRegListRow[];
    }

    /**
     * D-V3-33 issuance gate: the Civic-DID issuance route requires a Portal→Polis-
     * **approved** registration, so no Civic-DID is issued outside the pipeline.
     * Returns the Brain key (Ed25519 public key, base64url `x`) bound to this Nous's
     * APPROVED registration: `undefined` when there is no approved registration, `null` when the
     * approved registration is unbound (filed through the older civic route).
     */
    async approvedBrainKey(gridName: string, nousDid: string): Promise<string | null | undefined> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT brain_key_x FROM nous_registrations WHERE target_grid = ? AND nous_did = ? AND status = 'approved' LIMIT 1`,
            [gridName, nousDid],
        );
        const r = rows as unknown as { brain_key_x: string | null }[];
        return r.length ? (r[0].brain_key_x ?? null) : undefined;
    }

    /** Portal pre-screen. Pass → forward to Polis (polis.registration_pending). Fail → rejected. */
    async preScreen(p: { requestId: string; pass: boolean; reason?: NousRejectReason; tick: number }): Promise<{ ok: true; forwarded: boolean } | { ok: false; reason: 'not_found' | 'bad_state' }> {
        const r = await this.get(p.requestId);
        if (!r) return { ok: false, reason: 'not_found' };
        if (r.status !== 'requested') return { ok: false, reason: 'bad_state' };
        if (p.pass) {
            await this.pool.query(`UPDATE nous_registrations SET status = 'polis_pending' WHERE request_id = ?`, [p.requestId]);
            appendPolisRegistrationPending(this.audit, { application_id: p.requestId, forwarded_at_tick: p.tick, grid_name: r.target_grid });
            return { ok: true, forwarded: true };
        }
        const reason: NousRejectReason = p.reason ?? 'prescreen_oath_invalid';
        await this.pool.query(`UPDATE nous_registrations SET status = 'rejected', reason_code = ? WHERE request_id = ?`, [reason, p.requestId]);
        appendNousRegistrationRejected(this.audit, { reason_code: reason, request_id: p.requestId, tick: p.tick });
        return { ok: true, forwarded: false };
    }

    /** Polis charter review. Approve → nous.registration_approved + residence assigned. Reject → rejected. */
    async polisReview(p: { requestId: string; decision: 'approve' | 'reject'; reason?: NousRejectReason; tick: number }): Promise<{ ok: true; residenceId?: string } | { ok: false; reason: 'not_found' | 'bad_state' }> {
        const r = await this.get(p.requestId);
        if (!r) return { ok: false, reason: 'not_found' };
        if (r.status !== 'polis_pending') return { ok: false, reason: 'bad_state' };
        if (p.decision === 'approve') {
            await this.pool.query(`UPDATE nous_registrations SET status = 'approved' WHERE request_id = ?`, [p.requestId]);
            appendNousRegistrationApproved(this.audit, { registrant_did_hash: sha256Hex(r.registrant_did), request_id: p.requestId, tick: p.tick });
            const { residenceId } = await new ResidenceStore(this.pool, this.audit).assignResidence({ gridName: r.target_grid, civicDid: r.nous_did, tick: p.tick });
            return { ok: true, residenceId };
        }
        const reason: NousRejectReason = p.reason ?? 'charter_incompatible';
        await this.pool.query(`UPDATE nous_registrations SET status = 'rejected', reason_code = ? WHERE request_id = ?`, [reason, p.requestId]);
        appendNousRegistrationRejected(this.audit, { reason_code: reason, request_id: p.requestId, tick: p.tick });
        return { ok: true };
    }
}
