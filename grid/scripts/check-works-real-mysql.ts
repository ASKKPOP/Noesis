/**
 * Real-MySQL gate for the Work Card (P-WORK-01..09).
 *
 * The property tests run WorkService against an in-memory store. Only a real database
 * shows what MysqlWorkStore's statements do: that the card comes back byte for byte (so
 * its hash still fits), that a write lands only on the version it was based on — also
 * when several are sent at once — and that the lists select and order what they claim.
 * Run after the migration chain (check-migrations-real-mysql.ts; same env variables).
 *
 * Usage (CI: .github/workflows/real-mysql-migrations.yml):
 *   cd grid && npx tsx scripts/check-works-real-mysql.ts
 */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseConnection } from '../src/db/connection.js';
import { AuditChain } from '../src/audit/chain.js';
import { MysqlWorkStore } from '../src/work/mysql-work-store.js';
import { WorkService } from '../src/work/work-service.js';
import type { MemberKind } from '../src/work/work-logic.js';

const TAG = '[check-works-real-mysql]';
const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

async function main(): Promise<void> {
    const db = new DatabaseConnection({
        host:     process.env['MYSQL_HOST']     ?? '127.0.0.1',
        port:     parseInt(process.env['MYSQL_PORT'] ?? '3306', 10),
        user:     process.env['MYSQL_USER']     ?? 'root',
        password: process.env['MYSQL_PASSWORD'] ?? 'root',
        database: process.env['MYSQL_DATABASE'] ?? 'noesis_grid',
    });
    const pool = db.getPool();
    const G = `works_${Date.now().toString(36)}`;     // a Grid of its own: a re-run starts clean
    const ADA = 'did:civic:noesis:human:ada', BO = 'did:civic:noesis:human:bo';
    const SOPHIA = 'did:civic:noesis:sophia', HERMES = 'did:civic:noesis:hermes';
    const kinds = new Map<string, MemberKind>([[ADA, 'person'], [BO, 'person'], [SOPHIA, 'nous'], [HERMES, 'nous']]);
    const audit = new AuditChain();
    const store = new MysqlWorkStore(pool);
    const svc = new WorkService({ gridName: G, store, audit, memberKind: async (d) => kinds.get(d) ?? null, newId: randomUUID });
    const ok = async (p: ReturnType<WorkService['write']>) => {
        const r = await p;
        assert.equal(r.ok, true, r.ok ? '' : `refused: ${r.error}`);
        if (!r.ok) throw new Error(r.error);
        return r.card;
    };

    try {
        // 1. A card is stored and read back byte for byte, with wording MySQL might rewrite.
        const goal = '읽을 곳 🌍 — "quotes", \\ backslash, <b>tags</b>,   spaces';
        let card = await ok(svc.create(ADA, { goal, for_whom: 'new residents', builder: SOPHIA }, 10));
        const id = card.work_id;
        const [raw] = await pool.query('SELECT card_json, card_hash, stage, version, owner_civic_did, builder_civic_did FROM works WHERE grid_name = ? AND work_id = ?', [G, id]);
        const r0 = (raw as Array<Record<string, unknown>>)[0]!;
        assert.equal(r0.card_json, JSON.stringify(card));
        assert.equal(r0.card_hash, sha(String(r0.card_json)));
        assert.deepEqual([r0.stage, r0.version, r0.owner_civic_did, r0.builder_civic_did], ['goal', 1, ADA, SOPHIA]);
        assert.deepEqual(await svc.get(id), card);
        assert.equal((await svc.get(id))!.goal, goal);
        console.log(`${TAG} 1/6 a card is stored once and read back byte for byte; its hash fits`);

        // 2. A write lands only on the version it was based on.
        const stale = await svc.write(SOPHIA, id, 0, { op: 'answer', accept: true }, 11);
        assert.deepEqual(stale, { ok: false, error: 'stale_version', version: 1 });
        assert.equal(await store.replace(7, { card: { ...card, version: 8 }, json: '{}', hash: sha('{}') }), false);
        assert.deepEqual(await svc.get(id), card, 'a refused replace changed the row');
        card = await ok(svc.write(SOPHIA, id, 1, { op: 'answer', accept: true, reason: 'yes' }, 11));
        assert.equal(card.version, 2);
        console.log(`${TAG} 2/6 a write on a stale version changes nothing`);

        // 3. Several writes sent at once on the same version: exactly one is applied.
        const define = { op: 'define', for_what: 'a', how: 'b', which: ['block:venue'], checks: ['c1', 'c2'] };
        const racers = await Promise.all([ADA, SOPHIA, ADA, SOPHIA, ADA, SOPHIA, ADA, SOPHIA].map((who, i) =>
            svc.write(who, id, 2, { ...define, for_what: `writer ${i}` }, 12)));
        const won = racers.filter((r) => r.ok);
        assert.equal(won.length, 1, `${won.length} of 8 concurrent writes were applied`);
        card = (await svc.get(id))!;
        assert.equal(card.version, 3);
        assert.deepEqual(card, won[0]!.ok ? won[0]!.card : null);
        assert.equal(audit.all().filter((e) => e.eventType === 'work.stage_changed' && e.payload.to_stage === 'plan').length, 1);
        console.log(`${TAG} 3/6 of 8 writes sent at once on one version, exactly one is applied and audited`);

        // 4. The rest of the loop, on the real table.
        card = await ok(svc.write(SOPHIA, id, 3, { op: 'set_plan', steps: [{ do: 'buy a parcel', by_tick: 30 }, { do: 'build', by_tick: 50 }] }, 13));
        card = await ok(svc.write(ADA, id, 4, { op: 'approve_plan' }, 14));
        card = await ok(svc.write(SOPHIA, id, 5, { op: 'complete_step', step: 1 }, 15));
        card = await ok(svc.write(SOPHIA, id, 6, { op: 'complete_step', step: 2, note: 'done' }, 16));
        card = await ok(svc.write(SOPHIA, id, 7, { op: 'record_check', check: 1, passed: true, evidence: 'e1' }, 17));
        card = await ok(svc.write(SOPHIA, id, 8, { op: 'record_check', check: 2, passed: true, evidence: 'e2' }, 18));
        assert.equal((await svc.write(SOPHIA, id, 9, { op: 'verify', confirm: true, reason: 'mine' }, 19)).ok, false, 'the builder verified its own work');
        assert.equal((await svc.write(BO, id, 9, { op: 'verify', confirm: true, reason: 'me' }, 19)).ok, false, 'a person verified');
        card = await ok(svc.write(HERMES, id, 9, { op: 'verify', confirm: true, reason: 'seen' }, 19));
        card = await ok(svc.write(SOPHIA, id, 10, { op: 'deploy', where: 'parcel 12', changed: 'a venue' }, 20));
        card = await ok(svc.write(SOPHIA, id, 11, { op: 'announce', goal_info: 'open', guide: 'walk in', presentation: 'two steps' }, 21));
        assert.deepEqual([card.stage, card.version], ['done', 12]);
        const [fin] = await pool.query('SELECT card_json, card_hash, stage, version, updated_tick FROM works WHERE grid_name = ? AND work_id = ?', [G, id]);
        const f0 = (fin as Array<Record<string, unknown>>)[0]!;
        assert.equal(f0.card_json, JSON.stringify(card));
        assert.equal(f0.card_hash, sha(String(f0.card_json)));
        assert.deepEqual([f0.stage, f0.version, Number(f0.updated_tick)], ['done', 12, 21]);
        const path = audit.all().filter((e) => e.eventType === 'work.stage_changed').map((e) => e.payload.to_stage);
        assert.deepEqual(path, ['goal', 'define', 'plan', 'build', 'test', 'verify', 'deploy', 'notice', 'done']);
        const last = audit.all().filter((e) => e.eventType === 'work.stage_changed').pop()!;
        assert.equal(last.payload.card_hash, f0.card_hash);
        console.log(`${TAG} 4/6 one Work goes round the whole loop; row columns, card and audit agree`);

        // 5. Lists: by stage, latest change first, bounded.
        const second = await ok(svc.create(HERMES, { goal: 'second', for_whom: 'w' }, 40));
        const third = await ok(svc.create(HERMES, { goal: 'third', for_whom: 'w' }, 30));
        assert.deepEqual((await svc.list({ limit: 10 })).map((w) => w.work_id), [second.work_id, third.work_id, id]);
        assert.deepEqual((await svc.list({ stage: 'done', limit: 10 })).map((w) => w.work_id), [id]);
        assert.deepEqual((await svc.list({ stage: 'define', limit: 1 })).map((w) => w.work_id), [second.work_id]);
        assert.deepEqual(await svc.list({ stage: 'verify', limit: 10 }), []);
        // By role: what an owner, a builder and a would-be verifier are shown.
        assert.deepEqual((await svc.list({ owner: ADA, limit: 10 })).map((w) => w.work_id), [id]);
        assert.deepEqual((await svc.list({ owner: HERMES, limit: 10 })).map((w) => w.work_id), [second.work_id, third.work_id]);
        assert.deepEqual((await svc.list({ builder: SOPHIA, limit: 10 })).map((w) => w.work_id), [id]);
        assert.deepEqual((await svc.list({ stage: 'done', notBuilder: HERMES, limit: 10 })).map((w) => w.work_id), [id]);
        assert.deepEqual(await svc.list({ stage: 'done', notBuilder: SOPHIA, limit: 10 }), []);
        assert.deepEqual((await svc.list({ stage: 'define', builder: HERMES, limit: 10 })).map((w) => w.work_id), [second.work_id, third.work_id]);
        console.log(`${TAG} 5/6 lists select by stage and by role, latest change first, within the limit`);

        // 6. Grids are apart: another Grid neither sees nor can write this Work.
        const other = new WorkService({ gridName: `${G}_b`, store, audit, memberKind: async (d) => kinds.get(d) ?? null, newId: randomUUID });
        assert.equal(await other.get(id), null);
        assert.deepEqual(await other.list({ limit: 10 }), []);
        assert.deepEqual(await other.write(HERMES, second.work_id, 1, define, 41), { ok: false, error: 'unknown_work' });
        console.log(`${TAG} 6/6 a Work belongs to its Grid`);
        console.log(`${TAG} OK`);
    } finally {
        await pool.query('DELETE FROM works WHERE grid_name LIKE ?', [`${G}%`]);
        await pool.end();
    }
}

main().catch((err) => {
    console.error(`${TAG} FAIL`, err);
    process.exit(1);
});
