/**
 * Real-MySQL gate for the civic duty (D-MONEY-10).
 *
 * The vitest suite checks the statements; only a real database shows what they select:
 * who owes the duty, that a period is assessed once also across a restart, that a
 * member's standing follows its NEWEST settled period, and that one payment of the open
 * period restores it however many periods were missed (it is never a debt); and the two
 * ways besides tax: public work done unpaid earns credit (paid work does not), a parcel
 * handed to the Polis earns credit once, and credit pays a due.
 * Run after the migration chain (check-migrations-real-mysql.ts; same env variables).
 *
 * Usage (CI: .github/workflows/real-mysql-migrations.yml):
 *   cd grid && npx tsx scripts/check-civic-duty-real-mysql.ts
 */
import assert from 'node:assert/strict';
import { DatabaseConnection } from '../src/db/connection.js';
import { AuditChain } from '../src/audit/chain.js';
import { CivicDueStore } from '../src/economy/civic-due-store.js';
import { NousAccountStore } from '../src/economy/nous-account-store.js';
import {
    listDutyMembers, runDueDelinquencySweep, runDutyCycle, DUE_PERIOD_TICKS, DUE_AMOUNT_WEI, DUE_AMOUNT_CREDIT,
} from '../src/economy/civic-due-driver.js';
import { randomUUID } from 'node:crypto';
import { ProcurementStore } from '../src/economy/procurement-store.js';
import { CivicLaborCreditStore } from '../src/economy/civic-labor-credit-store.js';
import { TreasuryWeiStore } from '../src/economy/treasury-wei-store.js';
import { ParcelStore } from '../src/civic/parcel-store.js';
import { ParcelRegistry } from '../src/civic/parcel-registry.js';
import { CIVIC_WORK_CREDIT, parcelDutyCredit } from '../src/civic/founding-law.js';

const TAG = '[check-civic-duty-real-mysql]';

async function main(): Promise<void> {
    const db = new DatabaseConnection({
        host:     process.env['MYSQL_HOST']     ?? '127.0.0.1',
        port:     parseInt(process.env['MYSQL_PORT'] ?? '3306', 10),
        user:     process.env['MYSQL_USER']     ?? 'root',
        password: process.env['MYSQL_PASSWORD'] ?? 'root',
        database: process.env['MYSQL_DATABASE'] ?? 'noesis_grid',
    });
    const pool = db.getPool();
    const G = `duty_${Date.now().toString(36)}`;     // a Grid of its own: a re-run starts clean
    const NOUS = `did:civic:noesis:${G}-nous`, HUMAN = `did:civic:noesis:${G}-human`, GONE = `did:civic:noesis:${G}-gone`;
    const audit = new AuditChain();
    const dues = new CivicDueStore(pool, audit);
    const accts = new NousAccountStore(pool);
    const member = (civic: string, existence: string, status: string) => pool.query(
        `INSERT INTO civic_did_registry (grid_name, civic_did, existence_did, credential_json, status, issued_at_tick)
         VALUES (?, ?, ?, '{}', ?, 1)`, [G, civic, existence, status]);
    const rows = async (did = NOUS) => {
        const [r] = await pool.query(
            'SELECT due_id, period, status, due_tick FROM civic_dues WHERE grid_name = ? AND civic_did = ? ORDER BY due_tick', [G, did]);
        return r as Array<{ due_id: string; period: string; status: string; due_tick: number }>;
    };
    const P = DUE_PERIOD_TICKS;
    try {
        // 1. Who owes it: a Nous with an active civic identity. Not a person, not a revoked identity.
        await member(NOUS, `did:noesis:${G}-sophia`, 'active');
        await member(HUMAN, `did:noesis:human:${G}`, 'active');
        await member(GONE, `did:noesis:${G}-old`, 'revoked');
        assert.deepEqual(await listDutyMembers(pool, G), [NOUS]);
        console.log(`${TAG} 1/9 the duty falls on each Nous with an active civic identity`);

        // 2. A period is assessed once — also when the clock has started again from zero.
        const before = 3 * P;                                   // the Grid ran three periods before this start
        assert.deepEqual(await listDutyMembers(pool, G, 'p3'), [NOUS], 'not yet assessed for p3');
        await runDutyCycle(pool, audit, 60, { gridName: G, ticksBeforeStart: before });
        assert.deepEqual(await listDutyMembers(pool, G, 'p3'), [], 'assessed now');
        await runDutyCycle(pool, audit, 120, { gridName: G, ticksBeforeStart: before });   // later rounds of the same period
        await runDutyCycle(pool, audit, 60, { gridName: G, ticksBeforeStart: before });    // "restart", same lifetime period
        let r = await rows();
        assert.equal(r.length, 1, 'one due for the period');
        assert.equal(r[0]!.period, 'p3');
        assert.equal(Number(r[0]!.due_tick), before + 60 + P, 'the deadline is a lifetime tick');
        assert.equal(await dues.standing(G, NOUS), 'met', 'an open period decides nothing');
        console.log(`${TAG} 2/9 one due per period, across rounds and a restart`);

        // 3. Missing it denies; nothing is added up.
        await runDueDelinquencySweep(pool, audit, P + 120, G, before);         // the sweep alone, past the deadline
        assert.equal((await rows())[0]!.status, 'delinquent');
        assert.equal(await dues.standing(G, NOUS), 'met', 'missed, but no open period yet: not shut out with nothing to pay');
        console.log(`${TAG} 3/9 nobody is denied while there is nothing it could pay`);

        await runDutyCycle(pool, audit, P + 120, { gridName: G, ticksBeforeStart: before });      // p4 assessed
        assert.equal(await dues.standing(G, NOUS), 'denied');
        await runDutyCycle(pool, audit, 2 * P + 180, { gridName: G, ticksBeforeStart: before });  // p5 assessed, p4 missed
        r = await rows();
        assert.deepEqual(r.map((x) => [x.period, x.status]), [['p3', 'delinquent'], ['p4', 'delinquent'], ['p5', 'assessed']]);
        assert.equal(await dues.standing(G, NOUS), 'denied');
        console.log(`${TAG} 4/9 a missed period denies`);

        // 4. Never a debt: paying the ONE open period restores it, and costs one period.
        await accts.credit({ gridName: G, civicDid: NOUS, amountWei: 1000n, currentTick: 1 });
        await dues.payWithWei({ gridName: G, dueId: r[2]!.due_id, currentTick: 2 * P + 190 });
        assert.equal(await dues.standing(G, NOUS), 'met', 'one payment restores every right');
        assert.equal(await accts.getBalance(G, NOUS), 1000n - DUE_AMOUNT_WEI, 'two missed periods are not collected');
        await assert.rejects(dues.payWithWei({ gridName: G, dueId: r[0]!.due_id, currentTick: 2 * P + 191 }), /due_not_payable/);
        console.log(`${TAG} 5/9 one payment restores it; missed periods are not owed`);

        // 5. A row charged to an id no caller can act under is left as it is.
        await pool.query(
            `INSERT INTO civic_dues (due_id, grid_name, civic_did, period, amount_wei, amount_credit, status, paid_in, due_tick, created_at, updated_at)
             VALUES (?, ?, ?, 'p1', '1', 1, 'assessed', NULL, 5, 1, 1)`, [`${G}-legacy`, G, `did:noesis:${G}-sophia`]);
        await runDueDelinquencySweep(pool, audit, 9 * P, G, before);
        assert.equal((await rows(`did:noesis:${G}-sophia`))[0]!.status, 'assessed');
        console.log(`${TAG} 6/9 older rows under a registry id are untouched`);

        // 7. Building for the Polis: work done UNPAID and accepted earns credit, takes nothing
        //    from the treasury and pays no money; the credit then pays a due.
        const work = new ProcurementStore(pool, audit);
        const credits = new CivicLaborCreditStore(pool);
        const treasury = new TreasuryWeiStore(pool);
        const T0 = 2 * P + 200;
        const job = async (priceWei: bigint) => {
            const noticeId = randomUUID(), bidId = randomUUID(), contractId = randomUUID();
            await work.issueNotice({ gridName: G, noticeId, polisAuthorizationRef: 'bill-1', title: 'a bench', spec: 'wood', budgetWei: 100n, zone: 'shopping', functionType: 'relay', deadlineTick: T0 + 500, currentTick: T0 });
            await work.placeBid({ gridName: G, bidId, noticeId, bidderDid: NOUS, priceWei, artifactSpec: 'bench', currentTick: T0 + 1 });
            await work.award({ gridName: G, noticeId, bidId, contractId, escrowId: randomUUID(), currentTick: T0 + 2 });
            await work.settleContract({ gridName: G, contractId, attestationRef: 'seen', currentTick: T0 + 3 });
            return contractId;
        };
        const before7 = { wei: await accts.getBalance(G, NOUS), treasury: await treasury.getWeiBalance(G) };
        const unpaid = await job(0n);
        assert.equal(await credits.getCredit(G, NOUS), CIVIC_WORK_CREDIT, 'one accepted unpaid build = one period of credit');
        assert.equal(await accts.getBalance(G, NOUS), before7.wei, 'no money for unpaid work');
        assert.equal(await treasury.getWeiBalance(G), before7.treasury, 'nothing taken from the treasury');
        await assert.rejects(work.settleContract({ gridName: G, contractId: unpaid, attestationRef: 'again', currentTick: T0 + 4 }), /contract_not_active/);
        assert.equal(await credits.getCredit(G, NOUS), CIVIC_WORK_CREDIT, 'settled once, credited once');
        await runDutyCycle(pool, audit, 3 * P + 240, { gridName: G, ticksBeforeStart: before });      // p6 assessed, open
        const p6 = (await rows()).find((x) => x.period === 'p6')!;
        await dues.payWithCredit({ gridName: G, dueId: p6.due_id, currentTick: 3 * P + 250 });
        assert.equal((await rows()).find((x) => x.period === 'p6')!.status, 'paid');
        assert.equal(await credits.getCredit(G, NOUS), CIVIC_WORK_CREDIT - DUE_AMOUNT_CREDIT, 'the credit paid the period');
        assert.equal(await dues.standing(G, NOUS), 'met');
        console.log(`${TAG} 7/9 unpaid public work earns credit, and credit pays a due`);

        // 8. Paid public work is a job: paid from the treasury, and earns no credit.
        const before8 = { wei: await accts.getBalance(G, NOUS), credit: await credits.getCredit(G, NOUS), treasury: await treasury.getWeiBalance(G) };
        assert.ok(before8.treasury >= 15n, 'the treasury holds the tax paid in step 5');
        await job(15n);
        assert.equal(await accts.getBalance(G, NOUS), before8.wei + 15n);
        assert.equal(await treasury.getWeiBalance(G), before8.treasury - 15n);
        assert.equal(await credits.getCredit(G, NOUS), before8.credit, 'no credit for paid work');
        console.log(`${TAG} 8/9 paid public work is paid and earns no credit`);

        // 9. Transferring property: the parcel returns to the Polis and its worth is credited — once.
        const registry = new ParcelRegistry(G);
        const land = new ParcelStore(pool, G);
        await land.seedGenesisCore(registry);
        await land.hydrate(registry);
        // The first parcel of this Grid that may be bought (not every ring is for sale).
        const lot = registry.list({ available: true }).find((c) => registry.purchase(c.id, NOUS, 1_000_000).ok);
        assert.ok(lot, 'bought a parcel');
        await land.persistPurchase(registry.get(lot.id)!);
        const worth = parcelDutyCredit(lot.priceWei);
        assert.ok(worth > 0n);
        const before9 = await credits.getCredit(G, NOUS);
        const gifts = await Promise.allSettled([
            land.giveToPolis(registry.get(lot.id)!, NOUS, worth, 9), land.giveToPolis(registry.get(lot.id)!, NOUS, worth, 9),
        ]);
        assert.deepEqual(gifts.map((g) => g.status).sort(), ['fulfilled', 'rejected'], 'two gifts at once: one lands');
        assert.match(String((gifts.find((g) => g.status === 'rejected') as PromiseRejectedResult).reason), /not_owner/);
        assert.equal(await credits.getCredit(G, NOUS), before9 + worth, 'credited once');
        const [owner] = await pool.query('SELECT owner_civic_did, structure_type FROM civic_parcels WHERE parcel_id = ?', [lot.id]);
        assert.equal((owner as Array<{ owner_civic_did: string | null }>)[0]!.owner_civic_did, null, 'the parcel has no owner');
        await assert.rejects(land.giveToPolis(registry.get(lot.id)!, HUMAN, worth, 10), /not_owner/);
        console.log(`${TAG} 9/9 a parcel handed to the Polis is credited once`);
        console.log(`${TAG} PASS`);
    } finally {
        await pool.query('DELETE FROM civic_labor_credit WHERE grid_name = ?', [G]);
        await pool.query('DELETE FROM procurement_bids WHERE grid_name = ?', [G]);
        await pool.query('DELETE FROM procurement_contracts WHERE grid_name = ?', [G]);
        await pool.query('DELETE FROM procurement_notices WHERE grid_name = ?', [G]);
        await pool.query('DELETE FROM labor_escrow WHERE grid_name = ?', [G]);
        await pool.query('DELETE FROM civic_treasury WHERE grid_name = ?', [G]);
        await pool.query('DELETE FROM civic_parcels WHERE parcel_id LIKE ?', [`${G}:%`]);
        await pool.query('DELETE FROM civic_dues WHERE grid_name = ?', [G]);
        await pool.query('DELETE FROM civic_did_registry WHERE grid_name = ?', [G]);
        await pool.query('DELETE FROM nous_accounts WHERE grid_name = ?', [G]);
        await pool.end();
    }
}

main().catch((err) => {
    console.error(`${TAG} FAIL`, err);
    process.exit(1);
});
