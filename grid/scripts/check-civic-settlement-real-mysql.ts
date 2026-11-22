/**
 * Real-MySQL gate for the task board and the IOU ledger.
 *
 * The vitest suite runs these writes against a fake database that cannot hold two open
 * transactions apart, so it cannot show what the database itself guarantees: that a task
 * is claimed by exactly one worker, settled exactly once (also by two requests at the same
 * moment), that a settlement which cannot be paid leaves no trace, and that two Grids in
 * one database may use the same ids. This script asserts those on a real MySQL 8.0, after
 * the migration chain (run check-migrations-real-mysql.ts first; same env variables).
 *
 * Usage (CI: .github/workflows/real-mysql-migrations.yml):
 *   cd grid && npx tsx scripts/check-civic-settlement-real-mysql.ts
 */
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/db/connection.js';
import { ParcelStore } from '../src/civic/parcel-store.js';
import { ParcelRegistry } from '../src/civic/parcel-registry.js';
import { NousAccountStore } from '../src/economy/nous-account-store.js';
import { _resetCowork, allAgreements, type CoworkAgreement } from '../src/civic/cowork.js';
import { _resetLedger, allIous, outstandingFor } from '../src/civic/credit-ledger.js';

const TAG = '[check-civic-settlement-real-mysql]';

async function main(): Promise<void> {
    const db = new DatabaseConnection({
        host:     process.env['MYSQL_HOST']     ?? '127.0.0.1',
        port:     parseInt(process.env['MYSQL_PORT'] ?? '3306', 10),
        user:     process.env['MYSQL_USER']     ?? 'root',
        password: process.env['MYSQL_PASSWORD'] ?? 'root',
        database: process.env['MYSQL_DATABASE'] ?? 'noesis_grid',
    });
    const pool = db.getPool();
    // A Grid name of its own, so a re-run on the same database starts clean.
    const G = `gate_${Date.now().toString(36)}`;
    const store = new ParcelStore(pool, G);
    const other = new ParcelStore(pool, `${G}_b`);
    const accts = new NousAccountStore(pool);
    const A = 'did:civic:noesis:alice', B = 'did:civic:noesis:bob', C = 'did:civic:noesis:carol';
    const balance = async (did: string) => Number(await accts.getBalance(G, did));
    const row = async (id: string, grid = G) => {
        const [r] = await pool.query('SELECT status, worker_civic_did, completed_tick FROM civic_cowork_agreements WHERE grid_name = ? AND agreement_id = ?', [grid, id]);
        return (r as Array<Record<string, unknown>>)[0];
    };
    const task = (id: string): CoworkAgreement => ({
        agreement_id: id, parcel_id: 'gate:shopping:0001', parties: [A, ''], scope_ref: 'clean',
        settlement_amount_wei: 50, term_ticks: 0, status: 'posted',
    });
    const outcome = async (fn: () => Promise<unknown>) => {
        try { await fn(); return 'ok'; } catch (e) { return (e as Error).message.split(':')[0]; }
    };
    try {
        await accts.credit({ gridName: G, civicDid: A, amountWei: 100n, currentTick: 1 });

        // 1. A posted task is claimed by exactly one worker.
        await store.persistCowork(task('cowork:0'), { created: 1 });
        const claims = await Promise.all([store.persistClaim('cowork:0', B), store.persistClaim('cowork:0', C)]);
        assert.deepEqual([...claims].sort(), [false, true], 'two claims at once: exactly one wins');
        const claimed = await row('cowork:0');
        assert.equal(claimed.status, 'claimed');
        assert.equal(claimed.worker_civic_did, claims[0] ? B : C, 'the row names the claim that won');
        const worker = claimed.worker_civic_did as string;
        console.log(`${TAG} 1/6 one claim wins`);

        // 2. A settlement flips the row and moves the money together, once.
        await store.settleCowork({ agreementId: 'cowork:0', tick: 5, pay: { fromDid: A, toDid: worker, amountWei: 50n } });
        assert.equal((await row('cowork:0')).status, 'completed');
        assert.equal(await balance(A), 50);
        assert.equal(await balance(worker), 50);
        assert.equal(await outcome(() => store.settleCowork({ agreementId: 'cowork:0', tick: 6, pay: { fromDid: A, toDid: worker, amountWei: 50n } })), 'cowork_not_completable');
        assert.equal(await balance(A), 50, 'a second settlement moves nothing');
        console.log(`${TAG} 2/6 a task is paid once`);

        // 3. A settlement the host cannot cover leaves the task claimed; the debt is then written with the flip.
        await store.persistCowork(task('cowork:1'), { created: 1 });
        await store.persistClaim('cowork:1', B);
        assert.equal(await outcome(() => store.settleCowork({ agreementId: 'cowork:1', tick: 7, pay: { fromDid: A, toDid: B, amountWei: 1000n } })), 'insufficient_balance');
        assert.equal((await row('cowork:1')).status, 'claimed', 'the flip was rolled back with the failed payment');
        await store.settleCowork({ agreementId: 'cowork:1', tick: 7, ious: [
            { iou_id: 'iou:0', creditor_civic_did: B, debtor_civic_did: A, amount_wei: 1000, reason_ref: 'cowork:1', created_tick: 7, settled_tick: null },
        ] });
        assert.equal((await row('cowork:1')).status, 'completed');
        console.log(`${TAG} 3/6 unpaid work becomes a debt, written with the task`);

        // 4. Two settlements of one task at the same moment: one lands.
        await store.persistCowork(task('cowork:2'), { created: 1 });
        await store.persistClaim('cowork:2', B);
        const before = await balance(A);
        const both = await Promise.all([1, 2].map(() => outcome(() => store.settleCowork({ agreementId: 'cowork:2', tick: 9, pay: { fromDid: A, toDid: B, amountWei: 10n } }))));
        assert.deepEqual([...both].sort(), ['cowork_not_completable', 'ok']);
        assert.equal(await balance(A), before - 10, 'the money moved once');
        console.log(`${TAG} 4/6 two settlements at once pay once`);

        // 5. Another Grid in the same database may use the same ids.
        await other.persistCowork({ ...task('cowork:0'), scope_ref: 'theirs' }, { created: 1 });
        await other.persistIou({ iou_id: 'iou:0', creditor_civic_did: C, debtor_civic_did: A, amount_wei: 7, reason_ref: 'theirs', created_tick: 1, settled_tick: null });
        assert.equal((await row('cowork:0')).status, 'completed', 'this Grid\'s row is untouched');
        assert.equal((await row('cowork:0', `${G}_b`)).status, 'posted');
        console.log(`${TAG} 5/6 ids are per Grid`);

        // 6. A restart finds what was stored, as the right types, and mints fresh ids after it.
        _resetCowork(); _resetLedger();
        await store.hydrate(new ParcelRegistry(G));
        const tasks = allAgreements();
        assert.deepEqual(tasks.map((t) => [t.agreement_id, t.status]).sort(), [['cowork:0', 'settled'], ['cowork:1', 'settled'], ['cowork:2', 'settled']]);
        assert.equal(typeof tasks[0].settlement_amount_wei, 'number');
        assert.deepEqual(allIous().map((e) => [e.iou_id, e.amount_wei, e.settled_tick]), [['iou:0', 1000, null]]);
        assert.equal(outstandingFor(A), 1000);
        console.log(`${TAG} 6/6 a restart finds the board and the ledger`);
        console.log(`${TAG} PASS`);
    } finally {
        await pool.query('DELETE FROM civic_cowork_agreements WHERE grid_name IN (?, ?)', [G, `${G}_b`]);
        await pool.query('DELETE FROM civic_credit_ledger WHERE grid_name IN (?, ?)', [G, `${G}_b`]);
        await pool.query('DELETE FROM nous_accounts WHERE grid_name = ?', [G]);
        await pool.end();
    }
}

main().catch((err) => {
    console.error(`${TAG} FAIL`, err);
    process.exit(1);
});
