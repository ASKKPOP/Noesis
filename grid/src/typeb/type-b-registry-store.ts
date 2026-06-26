/**
 * Phase 37b Type B Registry (Plan 1) — Polis-α charter + Polis-β sponsor ceremonies.
 *
 * Every ceremony has DELIBERATE LATENCY: a request is FILED (status pending_review /
 * comment_window) and can only be ISSUED once its window elapses (eligible_tick). This store
 * emits its OWN registry.type_b_* events (the Foundation/Polis pipeline) and never imports the
 * Phase-37 issuance producer, so D-V3-33 / check-civic-did-issuance-path.mjs stays green.
 */
import { createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { appendRegistryTypeBChartered } from '../audit/append-registry-type-b-chartered.js';
import { appendRegistrySponsorshipBondPosted } from '../audit/append-registry-sponsorship-bond-posted.js';
import { appendRegistryTypeBSponsored } from '../audit/append-registry-type-b-sponsored.js';
import { appendRegistrySponsorshipBondRefunded } from '../audit/append-registry-sponsorship-bond-refunded.js';
import { appendRegistrySponsorshipBondSlashed } from '../audit/append-registry-sponsorship-bond-slashed.js';
import { appendRegistryTypeBSpawnedByParent } from '../audit/append-registry-type-b-spawned-by-parent.js';
import {
    CHARTER_REVIEW_TICKS, CHARTER_QUARTER_TICKS, CHARTER_QUARTER_LIMIT,
    SPONSOR_COMMENT_TICKS, REFUND_ELIGIBLE_TICKS, requiredBond, prospectiveTypeBDid,
} from './registry-types.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');
const requestId = (sponsorDid: string, purpose: string, tick: number): string =>
    sha256Hex(`${sponsorDid}|${purpose}|${tick}`).slice(0, 32);

export interface RegistryRequestRow { request_id: string; ceremony: string; status: string; type_b_did: string; sponsor_did: string; eligible_tick: number; bond_amount: number; filed_tick: number; }

export class TypeBRegistryStore {
    constructor(private readonly pool: Pool, private readonly audit: AuditChain) {}

    private async get(gridName: string, reqId: string): Promise<RegistryRequestRow | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT request_id, ceremony, status, type_b_did, sponsor_did, eligible_tick, bond_amount, filed_tick FROM type_b_registry WHERE grid_name = ? AND request_id = ? LIMIT 1`,
            [gridName, reqId],
        );
        const r = rows as unknown as RegistryRequestRow[];
        return r.length ? r[0] : null;
    }

    /** Polis-α charters filed this quarter (rate-limit basis). */
    async alphaThisQuarter(gridName: string, tick: number): Promise<number> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS n FROM type_b_registry WHERE grid_name = ? AND ceremony = 'alpha' AND filed_tick >= ?`,
            [gridName, tick - CHARTER_QUARTER_TICKS],
        );
        return Number((rows as unknown as { n: number }[])[0]?.n ?? 0);
    }

    /** File a Polis-α charter (no event yet — review pending). Returns null if quarter rate-limited. */
    async fileCharter(p: { gridName: string; sponsorDid: string; purpose: string; tick: number }): Promise<{ requestId: string; typeBDid: string; eligibleTick: number } | null> {
        if (await this.alphaThisQuarter(p.gridName, p.tick) >= CHARTER_QUARTER_LIMIT) return null;
        const reqId = requestId(p.sponsorDid, p.purpose, p.tick);
        const typeBDid = prospectiveTypeBDid(p.sponsorDid, p.purpose, p.tick);
        const eligibleTick = p.tick + CHARTER_REVIEW_TICKS;
        await this.pool.query(
            `INSERT INTO type_b_registry (grid_name, request_id, ceremony, status, type_b_did, sponsor_did, purpose, filed_tick, eligible_tick)
             VALUES (?, ?, 'alpha', 'pending_review', ?, ?, ?, ?, ?)`,
            [p.gridName, reqId, typeBDid, p.sponsorDid, p.purpose, p.tick, eligibleTick],
        );
        return { requestId: reqId, typeBDid, eligibleTick };
    }

    /** Approve a charter after the ≥7-day review → issue + registry.type_b_chartered. */
    async approveCharter(p: { gridName: string; requestId: string; tick: number }): Promise<{ ok: true; typeBDid: string } | { ok: false; reason: 'not_found' | 'too_early' | 'bad_state' }> {
        const r = await this.get(p.gridName, p.requestId);
        if (!r || r.ceremony !== 'alpha') return { ok: false, reason: 'not_found' };
        if (r.status !== 'pending_review') return { ok: false, reason: 'bad_state' };
        if (p.tick < r.eligible_tick) return { ok: false, reason: 'too_early' };
        await this.pool.query(`UPDATE type_b_registry SET status = 'issued' WHERE grid_name = ? AND request_id = ?`, [p.gridName, p.requestId]);
        appendRegistryTypeBChartered(this.audit, { sponsor_did_hash: sha256Hex(r.sponsor_did), tick: p.tick, type_b_did_hash: sha256Hex(r.type_b_did) });
        return { ok: true, typeBDid: r.type_b_did };
    }

    /** Active (issued) Type B count — drives the nonlinear bond. */
    async activeTypeBCount(gridName: string): Promise<number> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS n FROM type_b_registry WHERE grid_name = ? AND status = 'issued'`,
            [gridName],
        );
        return Number((rows as unknown as { n: number }[])[0]?.n ?? 0);
    }

    /** Post a Polis-β bond → opens the 7-day comment window + registry.sponsorship_bond_posted.
     *  Returns null if the bond is below the required nonlinear amount. */
    async postSponsorBond(p: { gridName: string; sponsorDid: string; purpose: string; bondAmount: number; activeTypeBCount: number; tick: number }): Promise<{ requestId: string; typeBDid: string; eligibleTick: number } | null> {
        if (p.bondAmount < requiredBond(p.activeTypeBCount)) return null;
        const reqId = requestId(p.sponsorDid, p.purpose, p.tick);
        const typeBDid = prospectiveTypeBDid(p.sponsorDid, p.purpose, p.tick);
        const eligibleTick = p.tick + SPONSOR_COMMENT_TICKS;
        await this.pool.query(
            `INSERT INTO type_b_registry (grid_name, request_id, ceremony, status, type_b_did, sponsor_did, purpose, bond_amount, filed_tick, eligible_tick)
             VALUES (?, ?, 'beta', 'comment_window', ?, ?, ?, ?, ?, ?)`,
            [p.gridName, reqId, typeBDid, p.sponsorDid, p.purpose, p.bondAmount, p.tick, eligibleTick],
        );
        appendRegistrySponsorshipBondPosted(this.audit, { bond_amount: p.bondAmount, sponsor_did_hash: sha256Hex(p.sponsorDid), tick: p.tick, type_b_did_hash: sha256Hex(typeBDid) });
        return { requestId: reqId, typeBDid, eligibleTick };
    }

    /** Finalize a sponsorship after the comment window → issue + registry.type_b_sponsored. */
    async finalizeSponsorship(p: { gridName: string; requestId: string; tick: number }): Promise<{ ok: true; typeBDid: string } | { ok: false; reason: 'not_found' | 'too_early' | 'bad_state' }> {
        const r = await this.get(p.gridName, p.requestId);
        if (!r || r.ceremony !== 'beta') return { ok: false, reason: 'not_found' };
        if (r.status !== 'comment_window') return { ok: false, reason: 'bad_state' };
        if (p.tick < r.eligible_tick) return { ok: false, reason: 'too_early' };
        await this.pool.query(`UPDATE type_b_registry SET status = 'issued' WHERE grid_name = ? AND request_id = ?`, [p.gridName, p.requestId]);
        appendRegistryTypeBSponsored(this.audit, { sponsor_did_hash: sha256Hex(r.sponsor_did), tick: p.tick, type_b_did_hash: sha256Hex(r.type_b_did) });
        return { ok: true, typeBDid: r.type_b_did };
    }

    /** Refund a Polis-β bond after 12mo, if civic minimums are met. Returns the amount + sponsor
     *  so the route can settle treasury→sponsor; marks the bond consumed (no double refund). */
    async refundBond(p: { gridName: string; requestId: string; meetsMinimums: boolean; tick: number }): Promise<{ ok: true; amount: number; sponsorDid: string } | { ok: false; reason: 'not_found' | 'too_early' | 'minimums_unmet' | 'bad_state' }> {
        const r = await this.get(p.gridName, p.requestId);
        if (!r || r.ceremony !== 'beta') return { ok: false, reason: 'not_found' };
        if (r.status !== 'issued' || r.bond_amount <= 0) return { ok: false, reason: 'bad_state' };
        if (p.tick < r.filed_tick + REFUND_ELIGIBLE_TICKS) return { ok: false, reason: 'too_early' };
        if (!p.meetsMinimums) return { ok: false, reason: 'minimums_unmet' };
        await this.pool.query(`UPDATE type_b_registry SET bond_amount = 0 WHERE grid_name = ? AND request_id = ?`, [p.gridName, p.requestId]);
        appendRegistrySponsorshipBondRefunded(this.audit, { bond_amount: r.bond_amount, sponsor_did_hash: sha256Hex(r.sponsor_did), tick: p.tick, type_b_did_hash: sha256Hex(r.type_b_did) });
        return { ok: true, amount: r.bond_amount, sponsorDid: r.sponsor_did };
    }

    /** Slash a Polis-β bond on a sybil/spam Police sanction → forfeited to civic treasury. */
    async slashBond(p: { gridName: string; requestId: string; tick: number }): Promise<{ ok: true; amount: number } | { ok: false; reason: 'not_found' | 'bad_state' }> {
        const r = await this.get(p.gridName, p.requestId);
        if (!r || r.ceremony !== 'beta') return { ok: false, reason: 'not_found' };
        if (r.status !== 'issued' || r.bond_amount <= 0) return { ok: false, reason: 'bad_state' };
        await this.pool.query(`UPDATE type_b_registry SET bond_amount = 0 WHERE grid_name = ? AND request_id = ?`, [p.gridName, p.requestId]);
        appendRegistrySponsorshipBondSlashed(this.audit, { bond_amount: r.bond_amount, sponsor_did_hash: sha256Hex(r.sponsor_did), tick: p.tick, type_b_did_hash: sha256Hex(r.type_b_did) });
        return { ok: true, amount: r.bond_amount };
    }

    /** Polis-γ (gated to v3.1+): a parent Nous spawns a child after the 14-day wait. Emits
     *  registry.type_b_spawned_by_parent + persists the issued child. */
    async spawnByParent(p: { gridName: string; parentDid: string; purpose: string; tick: number }): Promise<{ typeBDid: string }> {
        const reqId = requestId(p.parentDid, p.purpose, p.tick);
        const typeBDid = prospectiveTypeBDid(p.parentDid, p.purpose, p.tick);
        await this.pool.query(
            `INSERT INTO type_b_registry (grid_name, request_id, ceremony, status, type_b_did, sponsor_did, purpose, filed_tick, eligible_tick)
             VALUES (?, ?, 'gamma', 'issued', ?, ?, ?, ?, ?)`,
            [p.gridName, reqId, typeBDid, p.parentDid, p.purpose, p.tick, p.tick],
        );
        appendRegistryTypeBSpawnedByParent(this.audit, { parent_did_hash: sha256Hex(p.parentDid), tick: p.tick, type_b_did_hash: sha256Hex(typeBDid) });
        return { typeBDid };
    }
}
