/**
 * Test helper — one fake database for the civic write paths.
 *
 * Builds on makeAccountsPool (the wei rails) and adds the three civic tables the routes
 * write: civic_parcel_roles, civic_credit_ledger and civic_cowork_agreements. They share
 * one pool and one transaction snapshot, because the code under test settles a task and
 * moves the money for it on ONE connection: a rollback must undo both.
 *
 * It recognises only the exact statements the store issues (each compared as text), so a
 * changed statement fails here instead of passing silently. BIGINT columns come back as
 * strings, the way mysql2 returns them. `failNext(re)` makes the next matching statement
 * throw once.
 */
import { makeAccountsPool, type AccountsPool } from './accounts-pool.js';
import type { Pool, PoolConnection } from 'mysql2/promise';

type Row = Record<string, unknown>;

export const SQL = {
    roleUpsert: 'INSERT INTO civic_parcel_roles (parcel_id, holder_civic_did, role, granted_by_civic_did, granted_tick, trust_score, revoked_tick) '
        + 'VALUES (?, ?, ?, ?, ?, ?, NULL) ON DUPLICATE KEY UPDATE role = VALUES(role), granted_by_civic_did = VALUES(granted_by_civic_did), '
        + 'granted_tick = VALUES(granted_tick), revoked_tick = NULL',
    roleRevoke: 'UPDATE civic_parcel_roles SET revoked_tick = ? WHERE parcel_id = ? AND holder_civic_did = ?',
    roleRevokeAll: 'UPDATE civic_parcel_roles SET revoked_tick = ? WHERE parcel_id = ? AND revoked_tick IS NULL',
    roleTrust: 'UPDATE civic_parcel_roles SET trust_score = ? WHERE parcel_id = ? AND holder_civic_did = ?',
    iouUpsert: 'INSERT INTO civic_credit_ledger (iou_id, grid_name, creditor_civic_did, debtor_civic_did, amount_wei, reason_ref, created_tick, settled_tick) '
        + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE amount_wei = VALUES(amount_wei), settled_tick = VALUES(settled_tick)',
    taskUpsert: 'INSERT INTO civic_cowork_agreements (agreement_id, grid_name, parcel_id, host_civic_did, worker_civic_did, scope_ref, settlement_amount_wei, term_ticks, status, created_tick, completed_tick) '
        + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE worker_civic_did = VALUES(worker_civic_did), status = VALUES(status), completed_tick = VALUES(completed_tick)',
    taskClaim: "UPDATE civic_cowork_agreements SET worker_civic_did = ?, status = 'claimed' WHERE grid_name = ? AND agreement_id = ? AND status = 'posted'",
    taskComplete: "UPDATE civic_cowork_agreements SET status = 'completed', completed_tick = ? WHERE grid_name = ? AND agreement_id = ? AND status = 'claimed'",
} as const;

export interface CivicDb {
    pool: Pool;
    accts: AccountsPool;
    role(parcel: string, holder: string): Row | undefined;
    iou(id: string, grid?: string): Row | undefined;
    task(id: string, grid?: string): Row | undefined;
    ious(grid?: string): Row[];
    tasks(grid?: string): Row[];
    /** The next statement matching `re` fails once. */
    failNext(re: RegExp): void;
}

export function makeCivicDb(): CivicDb {
    let roles = new Map<string, Row>();
    let ious = new Map<string, Row>();
    let tasks = new Map<string, Row>();
    let snap: { roles: Map<string, Row>; ious: Map<string, Row>; tasks: Map<string, Row> } | null = null;
    const failing: RegExp[] = [];
    const copy = (m: Map<string, Row>) => new Map([...m].map(([k, v]) => [k, { ...v }]));
    const k = (a: unknown, b: unknown) => `${String(a)} ${String(b)}`;
    const done = (affectedRows: number): [unknown, unknown] => [{ affectedRows }, []];

    function other(sqlRaw: string, params: unknown[]): [unknown, unknown] {
        const q = sqlRaw.replace(/\s+/g, ' ').trim();
        const hit = failing.findIndex((re) => re.test(q));
        if (hit >= 0) { failing.splice(hit, 1); throw new Error('db down'); }

        if (/^SELECT r\.\* FROM civic_parcel_roles r /.test(q)) return [[...roles.values()].map((r) => ({ ...r })), []];
        if (q === 'SELECT * FROM civic_credit_ledger WHERE grid_name = ?') {
            return [[...ious.values()].filter((r) => r.grid_name === params[0]).map((r) => ({ ...r, amount_wei: String(r.amount_wei) })), []];
        }
        if (q === 'SELECT * FROM civic_cowork_agreements WHERE grid_name = ?') {
            return [[...tasks.values()].filter((r) => r.grid_name === params[0]).map((r) => ({ ...r, settlement_amount_wei: String(r.settlement_amount_wei) })), []];
        }
        if (/^SELECT/.test(q)) return [[], []];

        if (/civic_parcel_roles/.test(q)) {
            if (q === SQL.roleUpsert) {
                const [parcel, holder, role, grantor, grantedTick, trust] = params;
                const prior = roles.get(k(parcel, holder));
                roles.set(k(parcel, holder), {
                    parcel_id: parcel, holder_civic_did: holder, role, granted_by_civic_did: grantor,
                    granted_tick: grantedTick, trust_score: prior ? prior.trust_score : trust, revoked_tick: null,
                });
                return done(1);
            }
            if (q === SQL.roleRevoke) {
                const row = roles.get(k(params[1], params[2]));
                if (row) row.revoked_tick = params[0];
                return done(row ? 1 : 0);
            }
            if (q === SQL.roleRevokeAll) {
                let n = 0;
                for (const row of roles.values()) {
                    if (row.parcel_id === params[1] && row.revoked_tick === null) { row.revoked_tick = params[0]; n++; }
                }
                return done(n);
            }
            if (q === SQL.roleTrust) {
                const row = roles.get(k(params[1], params[2]));
                if (row) row.trust_score = params[0];
                return done(row ? 1 : 0);
            }
            throw new Error(`civic-db: unexpected roles statement: ${q}`);
        }
        if (/civic_credit_ledger/.test(q)) {
            if (q !== SQL.iouUpsert) throw new Error(`civic-db: unexpected ledger statement: ${q}`);
            const [id, grid, creditor, debtor, amount, reason, created, settled] = params;
            const prior = ious.get(k(grid, id));
            ious.set(k(grid, id), prior
                ? { ...prior, amount_wei: amount, settled_tick: settled }
                : { iou_id: id, grid_name: grid, creditor_civic_did: creditor, debtor_civic_did: debtor, amount_wei: amount, reason_ref: reason, created_tick: created, settled_tick: settled });
            return done(1);
        }
        if (/civic_cowork_agreements/.test(q)) {
            if (q === SQL.taskUpsert) {
                const [id, grid, parcel, host, worker, scope, amount, term, status, created, completed] = params;
                const prior = tasks.get(k(grid, id));
                tasks.set(k(grid, id), prior
                    ? { ...prior, worker_civic_did: worker, status, completed_tick: completed }
                    : { agreement_id: id, grid_name: grid, parcel_id: parcel, host_civic_did: host, worker_civic_did: worker, scope_ref: scope, settlement_amount_wei: amount, term_ticks: term, status, created_tick: created, completed_tick: completed });
                return done(1);
            }
            if (q === SQL.taskClaim) {
                const row = tasks.get(k(params[1], params[2]));
                if (!row || row.status !== 'posted') return done(0);
                row.worker_civic_did = params[0]; row.status = 'claimed';
                return done(1);
            }
            if (q === SQL.taskComplete) {
                const row = tasks.get(k(params[1], params[2]));
                if (!row || row.status !== 'claimed') return done(0);
                row.status = 'completed'; row.completed_tick = params[0];
                return done(1);
            }
            throw new Error(`civic-db: unexpected task statement: ${q}`);
        }
        return done(1);
    }

    const accts = makeAccountsPool({ otherQuery: other });
    const inner = accts.pool as unknown as { query: Pool['query']; getConnection: () => Promise<PoolConnection> };
    const pool = {
        query: inner.query,
        getConnection: async () => {
            const conn = await inner.getConnection();
            return {
                query: conn.query,
                beginTransaction: async () => { snap = { roles: copy(roles), ious: copy(ious), tasks: copy(tasks) }; await conn.beginTransaction(); },
                commit: async () => { snap = null; await conn.commit(); },
                rollback: async () => {
                    if (snap) { roles = snap.roles; ious = snap.ious; tasks = snap.tasks; snap = null; }
                    await conn.rollback();
                },
                release: () => {},
            } as unknown as PoolConnection;
        },
    } as unknown as Pool;

    return {
        pool, accts,
        role: (parcel, holder) => roles.get(k(parcel, holder)),
        iou: (id, grid = 'genesis') => ious.get(k(grid, id)),
        task: (id, grid = 'genesis') => tasks.get(k(grid, id)),
        ious: (grid = 'genesis') => [...ious.values()].filter((r) => r.grid_name === grid),
        tasks: (grid = 'genesis') => [...tasks.values()].filter((r) => r.grid_name === grid),
        failNext: (re) => { failing.push(re); },
    };
}
