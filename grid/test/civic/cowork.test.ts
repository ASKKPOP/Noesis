/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for the Cowork Agreement + task board (A5 / D-60-06 / R-60-08).
 *
 * describe.skip: grid/src/civic/cowork.ts lands in Wave 2. Deferred dynamic import
 * (Phase 58/59 Wave-0 pattern) defers module resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - CoworkAgreement {agreement_id, parcel_id, parties:[host, worker], scope_ref,
 *     settlement_amount_wei, term_ticks, status} is the signed dual-DID source of truth.
 *   - board post (owner/staff) → claim (role with board access) → complete (host) transitions status.
 *   - completion ALWAYS settles: Ousia via settleWei (NousAccountStore.transfer) when funded, OR
 *     records an IOU when not (an underfunded funded-host falls back to an IOU) — a completion
 *     that pays NOTHING throws (never free, D-NH-06).
 *   - a completed session emits zoning.cowork_session carrying ONLY {end_tick, parcel_id,
 *     participant_count, participants_hash, start_tick} — no board/task text, no raw DIDs.
 *
 * Phase 62.6-03 — the settlement seam is the async settleWei (NousAccountStore.transfer,
 * Nous→Nous), no longer the sync Ledger-B seam; completeTask is async.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeAccountsPool } from '../helpers/accounts-pool.js';
import { NousAccountStore } from '../../src/economy/nous-account-store.js';

const loadCowork = () => import('../../src/civic/cowork.js');

const HOST = 'did:civic:noesis:alice';
const WORKER = 'did:civic:noesis:bob';
const PARCEL = 'genesis:business:0001';

beforeEach(async () => {
    const { _resetCowork } = await loadCowork();
    _resetCowork();
});

describe('Phase 60 HOUSE-3 — CoworkAgreement dual-DID schema [Wave 2 un-skips]', () => {
    it('CoworkAgreement is the signed dual-DID source of truth with the closed field set', async () => {
        const { createAgreement } = await loadCowork();
        const agreement = createAgreement({
            parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:clean-shelves', settlement_amount_wei: 50, term_ticks: 100,
        });
        expect(agreement.parties).toEqual([HOST, WORKER]);
        expect(agreement.parcel_id).toBe(PARCEL);
        expect(agreement.settlement_amount_wei).toBe(50);
        expect(agreement.status).toBe('posted');
    });
});

describe('Phase 60 HOUSE-3 — task board post / claim / complete [Wave 2 un-skips]', () => {
    it('post (owner/staff) → claim (board access) → complete (host) transitions status', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:x', settlement_amount_wei: 50, term_ticks: 100 });
        expect(posted.status).toBe('posted');
        const claimed = claimTask(posted.agreement_id, WORKER);
        expect(claimed.status).toBe('claimed');
        const completed = await completeTask(posted.agreement_id, HOST, { funded: true, start_tick: 1, end_tick: 2 });
        expect(completed.status).toBe('settled');
    });

    it('completion of a FUNDED agreement settles via the async settleWei seam (never free)', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const transfers: Array<[string, string, number]> = [];
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:y', settlement_amount_wei: 50, term_ticks: 100 });
        claimTask(posted.agreement_id, WORKER);
        const settleWei = vi.fn(async (from: string, to: string, amt: number) => { transfers.push([from, to, amt]); });
        await completeTask(posted.agreement_id, HOST, {
            funded: true, start_tick: 1, end_tick: 2, settleWei,
        });
        expect(settleWei).toHaveBeenCalledTimes(1);
        expect(transfers).toEqual([[HOST, WORKER, 50]]);
    });

    it('FUNDED settlement moves money on nous_accounts — host debited, worker credited (real transfer)', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const acc = makeAccountsPool();
        acc.seedAccount(HOST, 100);
        acc.seedAccount(WORKER, 0);
        const store = new NousAccountStore(acc.pool);
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:pay', settlement_amount_wei: 50, term_ticks: 100 });
        claimTask(posted.agreement_id, WORKER);
        await completeTask(posted.agreement_id, HOST, {
            funded: true, start_tick: 1, end_tick: 2,
            settleWei: (from, to, amt) => store.transfer({ gridName: 'genesis', fromDid: from, toDid: to, amountWei: BigInt(amt), currentTick: 2 }),
        });
        expect(acc.balanceOf(HOST)).toBe(50n);   // 100 - 50
        expect(acc.balanceOf(WORKER)).toBe(50n);  // 0 + 50 (conservation)
    });

    it('an UNDERFUNDED funded host falls back to an IOU when settleWei throws insufficient_balance (D-NH-06)', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const acc = makeAccountsPool();
        acc.seedAccount(HOST, 10); // < 50 → transfer throws insufficient_balance
        acc.seedAccount(WORKER, 0);
        const store = new NousAccountStore(acc.pool);
        const ious: Array<[string, string, number]> = [];
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:iou', settlement_amount_wei: 50, term_ticks: 100 });
        claimTask(posted.agreement_id, WORKER);
        const settled = await completeTask(posted.agreement_id, HOST, {
            funded: true, start_tick: 1, end_tick: 7,
            settleWei: (from, to, amt) => store.transfer({ gridName: 'genesis', fromDid: from, toDid: to, amountWei: BigInt(amt), currentTick: 7 }),
            recordIou: (creditor, debtor, amt) => { ious.push([creditor, debtor, amt]); },
        });
        // The transfer rolled back (no partial pay); the completion still settles via an IOU.
        expect(acc.balanceOf(HOST)).toBe(10n);
        expect(acc.balanceOf(WORKER)).toBe(0n);
        expect(ious).toEqual([[WORKER, HOST, 50]]); // worker creditor, host debtor
        expect(settled.status).toBe('settled');
    });

    it('completion of an UNFUNDED agreement records an IOU instead (never free)', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const ious: Array<[string, string, number]> = [];
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:z', settlement_amount_wei: 50, term_ticks: 100 });
        claimTask(posted.agreement_id, WORKER);
        await completeTask(posted.agreement_id, HOST, {
            funded: false, start_tick: 1, end_tick: 2,
            recordIou: (creditor, debtor, amt) => { ious.push([creditor, debtor, amt]); },
        });
        // Worker is the creditor (owed 50), host is the debtor.
        expect(ious).toEqual([[WORKER, HOST, 50]]);
    });

    it('a completion that pays NOTHING throws — co-work is NEVER free (D-NH-06)', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:free', settlement_amount_wei: 0, term_ticks: 100 });
        claimTask(posted.agreement_id, WORKER);
        await expect(completeTask(posted.agreement_id, HOST, { funded: true, start_tick: 1, end_tick: 2 }))
            .rejects.toThrow(/never free|settle|zero/i);
    });
});

describe.skip('Phase 60 HOUSE-3 — completion emits zoning.cowork_session (hashed participants) [Wave 2 un-skips]', () => {
    it('a completed session emits zoning.cowork_session carrying ONLY the closed 5-tuple', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const { AuditChain } = await import('../../src/audit/chain.js');
        const audit = new AuditChain();
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:s', settlement_amount_wei: 50, term_ticks: 100 });
        claimTask(posted.agreement_id, WORKER);
        await completeTask(posted.agreement_id, HOST, { funded: true, start_tick: 1, end_tick: 9, audit });
        const session = audit.query({ eventType: 'zoning.cowork_session' });
        expect(session).toHaveLength(1);
        expect(Object.keys(session[0].payload).sort())
            .toEqual(['end_tick', 'parcel_id', 'participant_count', 'participants_hash', 'start_tick']);
        // No board/task text, no raw DIDs on the payload.
        const blob = JSON.stringify(session[0].payload);
        expect(blob).not.toContain('did:civic:');
        expect(blob).not.toMatch(/task|scope|shelves/i);
    });
});

describe('Phase 62.6-03 — settlement safety (WR-01 self-transfer / WR-02 double-pay)', () => {
    it('WR-02: re-completing a settled agreement throws cowork_not_completable and does NOT pay twice', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, WORKER], scope_ref: 'task:x', settlement_amount_wei: 50, term_ticks: 100 });
        claimTask(posted.agreement_id, WORKER);
        const settleWei = vi.fn(async () => {});
        const settled = await completeTask(posted.agreement_id, HOST, { funded: true, start_tick: 1, end_tick: 2, settleWei });
        expect(settled.status).toBe('settled');
        expect(settleWei).toHaveBeenCalledTimes(1);
        // Second completion must be rejected — the money move must NOT run again.
        await expect(completeTask(posted.agreement_id, HOST, { funded: true, start_tick: 3, end_tick: 4, settleWei }))
            .rejects.toThrow(/cowork_not_completable/);
        expect(settleWei).toHaveBeenCalledTimes(1);
    });

    it('WR-01: host completing their OWN task (host === worker) settles with no transfer and no throw', async () => {
        const { createAgreement, claimTask, completeTask } = await loadCowork();
        const posted = createAgreement({ parcel_id: PARCEL, parties: [HOST, ''], scope_ref: 'task:self', settlement_amount_wei: 50, term_ticks: 100 });
        claimTask(posted.agreement_id, HOST); // host claims own task → worker === host
        const settleWei = vi.fn(async () => {});
        const settled = await completeTask(posted.agreement_id, HOST, { funded: true, start_tick: 1, end_tick: 2, settleWei });
        expect(settled.status).toBe('settled');
        expect(settleWei).not.toHaveBeenCalled(); // can't pay yourself — no money move, no throw, not stuck
    });
});
