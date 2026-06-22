/**
 * W4 (D-MONEY-09) — EndowmentStore: the model-first wei source.
 *
 * A bounded, operator-authorized wei injection into a member account that stands
 * in for "the human brings ETH" until on-chain settlement (D-MONEY-02) lands. This
 * is the SINGLE documented bend of D-MONEY-01 "no internal mint" — and it is kept
 * honest by four constraints:
 *   - Ledgered: every endowment writes one account_endowments row (the conservation
 *     record + the on-chain retirement path: one row ↔ one future Sepolia deposit).
 *   - Bounded: per-call cap + per-account lifetime cap, both enforced in-transaction.
 *   - Atomic: cap-check (SUM FOR UPDATE) → ledger insert → account credit, one txn.
 *   - Audited: emits portal.account_endowed via the sole-producer emitter.
 *
 * reason + operator_did are Grid-side provenance only (ledger columns) and never
 * cross the audit boundary.
 */
import { randomUUID, createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AuditChain } from '../audit/chain.js';
import { creditAccountOnConn } from './wei-ops.js';
import { appendPortalAccountEndowed } from '../audit/append-portal-account-endowed.js';

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/** Per-call cap: at most 1 ETH-equiv (1e18 wei) per endowment. */
export const MODEL_ENDOWMENT_CAP_WEI = 1_000_000_000_000_000_000n;
/** Per-account lifetime cap: at most 10 ETH-equiv (1e19 wei) endowed to one DID. */
export const MODEL_ENDOWMENT_ACCOUNT_CAP_WEI = 10_000_000_000_000_000_000n;

export class EndowmentStore {
    constructor(
        private readonly pool: Pool,
        private readonly audit?: AuditChain,
    ) {}

    /**
     * Endow a member account with model-first wei. Returns the new endowment id and
     * the account's resulting wei balance. Throws:
     *   - 'invalid_amount'                  amountWei <= 0
     *   - 'endowment_exceeds_cap'           amountWei > MODEL_ENDOWMENT_CAP_WEI
     *   - 'endowment_account_cap_exceeded'  prior + amountWei > MODEL_ENDOWMENT_ACCOUNT_CAP_WEI
     */
    async endow(p: {
        gridName: string;
        civicDid: string;
        amountWei: bigint;
        reason?: string;
        operatorDid?: string;
        currentTick: number;
    }): Promise<{ endowmentId: string; newBalance: bigint }> {
        if (p.amountWei <= 0n) throw new Error('invalid_amount');
        if (p.amountWei > MODEL_ENDOWMENT_CAP_WEI) throw new Error('endowment_exceeds_cap');

        const endowmentId = randomUUID();
        const conn = await this.pool.getConnection();
        let newBalance: bigint;
        try {
            await conn.beginTransaction();

            // Per-account lifetime cap — sum prior endowments under a write lock.
            const [sumRows] = await conn.query<RowDataPacket[]>(
                `SELECT COALESCE(SUM(amount_wei), 0) AS total FROM account_endowments
                 WHERE grid_name = ? AND civic_did = ? FOR UPDATE`,
                [p.gridName, p.civicDid],
            );
            const prior = BigInt(sumRows[0]?.total ?? 0);
            if (prior + p.amountWei > MODEL_ENDOWMENT_ACCOUNT_CAP_WEI) {
                await conn.rollback();
                throw new Error('endowment_account_cap_exceeded');
            }

            // Ledger row — the conservation record (reason/operator_did stay Grid-side).
            await conn.query(
                `INSERT INTO account_endowments
                   (endowment_id, grid_name, civic_did, amount_wei, source, reason, operator_did, endowed_tick, created_at)
                 VALUES (?, ?, ?, ?, 'model_first', ?, ?, ?, ?)`,
                [endowmentId, p.gridName, p.civicDid, p.amountWei.toString(), p.reason ?? null, p.operatorDid ?? null, p.currentTick, p.currentTick],
            );

            // Credit the member account (composes the shared wei rail inside this txn).
            await creditAccountOnConn(conn, { gridName: p.gridName, civicDid: p.civicDid, amountWei: p.amountWei, currentTick: p.currentTick });

            const [balRows] = await conn.query<RowDataPacket[]>(
                `SELECT balance_wei FROM nous_accounts WHERE grid_name = ? AND civic_did = ?`,
                [p.gridName, p.civicDid],
            );
            newBalance = BigInt(balRows[0]?.balance_wei ?? 0);

            await conn.commit();
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }

        if (this.audit) {
            appendPortalAccountEndowed(this.audit, {
                amount_wei: p.amountWei.toString(),
                civic_did_hash: sha256Hex(p.civicDid),
                endowment_id: endowmentId,
                source: 'model_first',
                tick: p.currentTick,
            });
        }

        return { endowmentId, newBalance };
    }
}
