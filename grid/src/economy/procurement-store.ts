/**
 * L2 — RFP procurement: the Polis commissions builds with the treasury.
 *
 * issueNotice:    the Polis posts an RFP (budget + spec), authorized by a VOTE-05
 *                 legislative act (polis_authorization_ref recorded; never self-authorized).
 * placeBid:       a Nous bids (price + a physics-valid artifact spec) on an open notice.
 * award:          pick one bid — debit the TREASURY the award, fund a labor_escrow row
 *                 (payer = the treasury), write a contract, mark notice/bid awarded.
 * settleContract: on Grid-oracle attestation, release the escrow to the builder, mark settled.
 * cancelNotice:   withdraw an open (un-awarded) notice.
 *
 * award + settleContract each run ONE transaction composing the F1 rails (wei-ops),
 * so the money move and the status changes are atomic. award-once / settle-once under
 * FOR UPDATE. No mint; conservation (treasury −award on award; escrow → builder on settle).
 *
 * L2b: optional AuditChain dep (default undefined → no-op) emits procurement.* events
 * via the sole-producer emitter functions (not via audit.append directly —
 * producer-boundary tests stay green).
 */
import { createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { debitTreasuryWeiOnConn, creditAccountOnConn } from './wei-ops.js';
import { appendProcurementNoticeIssued } from '../audit/append-procurement-notice-issued.js';
import { appendProcurementBidPlaced } from '../audit/append-procurement-bid-placed.js';
import { appendProcurementAwarded } from '../audit/append-procurement-awarded.js';
import { appendProcurementAttested } from '../audit/append-procurement-attested.js';
import { appendProcurementSettled } from '../audit/append-procurement-settled.js';
import { appendProcurementCancelled } from '../audit/append-procurement-cancelled.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/** The civic treasury's account sentinel (matches grid/src/api/routes/irs.ts). */
const TREASURY_CIVIC_DID = 'did:civic:noesis:treasury';

export class ProcurementStore {
    constructor(
        private readonly pool: Pool,
        private readonly audit?: AuditChain,
    ) {}

    async issueNotice(p: { gridName: string; noticeId: string; polisAuthorizationRef: string; title: string; spec: string; budgetWei: bigint; zone: string; functionType: string; deadlineTick: number; currentTick: number }): Promise<void> {
        if (p.budgetWei <= 0n) throw new Error('invalid_amount');
        await this.pool.query(
            `INSERT INTO procurement_notices
               (notice_id, grid_name, polis_authorization_ref, title, spec, budget_wei, zone, function_type, status, deadline_tick, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
            [p.noticeId, p.gridName, p.polisAuthorizationRef, p.title, p.spec, p.budgetWei.toString(), p.zone, p.functionType, p.deadlineTick, p.currentTick, p.currentTick],
        );
        if (this.audit) {
            appendProcurementNoticeIssued(this.audit, {
                budget_wei: p.budgetWei.toString(),
                function_type: p.functionType,
                notice_id: p.noticeId,
                polis_authorization_ref_hash: sha256Hex(p.polisAuthorizationRef),
                tick: p.currentTick,
                zone: p.zone,
            });
        }
    }

    async placeBid(p: { gridName: string; bidId: string; noticeId: string; bidderDid: string; priceWei: bigint; artifactSpec: string; currentTick: number }): Promise<void> {
        if (p.priceWei <= 0n) throw new Error('invalid_amount');
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status, deadline_tick FROM procurement_notices WHERE notice_id = ? AND grid_name = ? FOR UPDATE`,
                [p.noticeId, p.gridName],
            );
            const notice = rows[0];
            if (!notice || notice.status !== 'open') {
                await conn.rollback();
                throw new Error('notice_not_open');
            }
            await conn.query(
                `INSERT INTO procurement_bids (bid_id, notice_id, grid_name, bidder_did, price_wei, artifact_spec, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?)`,
                [p.bidId, p.noticeId, p.gridName, p.bidderDid, p.priceWei.toString(), p.artifactSpec, p.currentTick],
            );
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
        if (this.audit) {
            appendProcurementBidPlaced(this.audit, {
                bid_id: p.bidId,
                bidder_did_hash: sha256Hex(p.bidderDid),
                notice_id: p.noticeId,
                price_wei: p.priceWei.toString(),
                tick: p.currentTick,
            });
        }
    }

    async award(p: { gridName: string; noticeId: string; bidId: string; contractId: string; escrowId: string; currentTick: number }): Promise<void> {
        const conn = await this.pool.getConnection();
        let winnerDid: string | undefined;
        let awardWei: bigint | undefined;
        try {
            await conn.beginTransaction();
            const [noticeRows] = await conn.query<RowDataPacket[]>(
                `SELECT status, budget_wei FROM procurement_notices WHERE notice_id = ? AND grid_name = ? FOR UPDATE`,
                [p.noticeId, p.gridName],
            );
            const notice = noticeRows[0];
            if (!notice || notice.status !== 'open') {
                await conn.rollback();
                throw new Error('notice_not_open');
            }
            const [bidRows] = await conn.query<RowDataPacket[]>(
                `SELECT status, price_wei, notice_id, bidder_did FROM procurement_bids WHERE bid_id = ? AND grid_name = ? FOR UPDATE`,
                [p.bidId, p.gridName],
            );
            const bid = bidRows[0];
            if (!bid || bid.status !== 'submitted' || String(bid.notice_id) !== p.noticeId) {
                await conn.rollback();
                throw new Error('bid_not_eligible');
            }
            const award = BigInt(bid.price_wei);
            if (award > BigInt(notice.budget_wei)) {
                await conn.rollback();
                throw new Error('bid_exceeds_budget');
            }
            winnerDid = String(bid.bidder_did);
            awardWei = award;
            // Fund the escrow FROM the treasury (the Polis is the payer).
            await debitTreasuryWeiOnConn(conn, { gridName: p.gridName, amountWei: award, currentTick: p.currentTick });
            await conn.query(
                `INSERT INTO labor_escrow
                   (escrow_id, grid_name, payer_did, worker_did, amount_wei, fee_wei, ref, status, attestation_ref, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 0, ?, 'funded', NULL, ?, ?)`,
                [p.escrowId, p.gridName, TREASURY_CIVIC_DID, winnerDid, award.toString(), `rfp:${p.noticeId}`, p.currentTick, p.currentTick],
            );
            await conn.query(
                `INSERT INTO procurement_contracts
                   (contract_id, notice_id, grid_name, winner_did, award_wei, escrow_id, status, attested_tick, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)`,
                [p.contractId, p.noticeId, p.gridName, winnerDid, award.toString(), p.escrowId, p.currentTick, p.currentTick],
            );
            await conn.query(`UPDATE procurement_notices SET status = 'awarded', updated_at = ? WHERE notice_id = ?`, [p.currentTick, p.noticeId]);
            await conn.query(`UPDATE procurement_bids SET status = 'awarded' WHERE bid_id = ?`, [p.bidId]);
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
        if (this.audit && winnerDid !== undefined && awardWei !== undefined) {
            appendProcurementAwarded(this.audit, {
                award_wei: awardWei.toString(),
                contract_id: p.contractId,
                notice_id: p.noticeId,
                tick: p.currentTick,
                winner_did_hash: sha256Hex(winnerDid),
            });
        }
    }

    async settleContract(p: { gridName: string; contractId: string; attestationRef: string; currentTick: number }): Promise<void> {
        const conn = await this.pool.getConnection();
        let winnerDid: string | undefined;
        let awardWei: bigint | undefined;
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status, winner_did, award_wei, escrow_id FROM procurement_contracts WHERE contract_id = ? AND grid_name = ? FOR UPDATE`,
                [p.contractId, p.gridName],
            );
            const c = rows[0];
            if (!c || c.status !== 'active') {
                await conn.rollback();
                throw new Error('contract_not_active');
            }
            winnerDid = String(c.winner_did);
            awardWei = BigInt(c.award_wei);
            // Grid (oracle) attests done → release the escrow to the builder.
            await creditAccountOnConn(conn, { gridName: p.gridName, civicDid: winnerDid, amountWei: awardWei, currentTick: p.currentTick });
            await conn.query(`UPDATE labor_escrow SET status = 'released', attestation_ref = ?, updated_at = ? WHERE escrow_id = ?`, [p.attestationRef, p.currentTick, String(c.escrow_id)]);
            await conn.query(`UPDATE procurement_contracts SET status = 'settled', attested_tick = ?, updated_at = ? WHERE contract_id = ?`, [p.currentTick, p.currentTick, p.contractId]);
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
        if (this.audit && winnerDid !== undefined && awardWei !== undefined) {
            appendProcurementAttested(this.audit, {
                attestation_ref_hash: sha256Hex(p.attestationRef),
                contract_id: p.contractId,
                tick: p.currentTick,
            });
            appendProcurementSettled(this.audit, {
                award_wei: awardWei.toString(),
                contract_id: p.contractId,
                tick: p.currentTick,
                winner_did_hash: sha256Hex(winnerDid),
            });
        }
    }

    async cancelNotice(p: { gridName: string; noticeId: string; currentTick: number }): Promise<void> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT status FROM procurement_notices WHERE notice_id = ? AND grid_name = ? FOR UPDATE`,
                [p.noticeId, p.gridName],
            );
            const notice = rows[0];
            if (!notice || notice.status !== 'open') {
                await conn.rollback();
                throw new Error('notice_not_open');
            }
            await conn.query(`UPDATE procurement_notices SET status = 'cancelled', updated_at = ? WHERE notice_id = ?`, [p.currentTick, p.noticeId]);
            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
        if (this.audit) {
            appendProcurementCancelled(this.audit, {
                notice_id: p.noticeId,
                reason: 'withdrawn',
                tick: p.currentTick,
            });
        }
    }
}
