/**
 * Phase 46 (CIVGOV-01..05) — Government v3 persistence layer.
 *
 * Owns gov_bills / gov_bill_cosponsors / gov_sessions / gov_session_arguments / gov_laws
 * (migration v36). Voting itself is NOT here — it reuses the existing VOTE-05
 * governance_proposals/ballots tables (Phase 12). A bill links to its vote via
 * gov_bills.proposal_id once a session advances to a vote.
 *
 * Two implementations behind one interface (no brittle SQL-string mocking in tests):
 *   - InMemoryGovBillStore — Map-backed, for route/unit tests.
 *   - MySqlGovBillStore     — mysql2 Pool-backed, for production.
 *
 * No Date.now / Math.random — every tick comes from the caller (request boundary).
 */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { SessionOutcome } from './types.js';

export type BillStatus = 'drafted' | 'cosponsored' | 'in_session' | 'enacted' | 'rejected' | 'withdrawn';
export type SessionStatus = 'open' | 'closed';
export type LawStatus = 'active' | 'repealed';

export interface BillRow {
    bill_id: string;
    grid_name: string;
    author_civic_did: string;
    title_hash: string;
    body_text: string;
    body_hash: string;
    category: string;
    status: BillStatus;
    cosponsor_count: number;
    proposal_id: string | null;
    created_at_tick: number;
}

export interface SessionRow {
    session_id: string;
    bill_id: string;
    grid_name: string;
    speaker_civic_did: string;
    debate_deadline_tick: number;
    status: SessionStatus;
    opened_at_tick: number;
    closed_at_tick: number | null;
    outcome: SessionOutcome | null;
}

export interface LawRow {
    law_id: string;
    grid_name: string;
    bill_id: string;
    enacted_at_tick: number;
    status: LawStatus;
    supersedes_law_id: string | null;
    repealed_at_tick: number | null;
    repealing_bill_id: string | null;
}

export interface InsertBillInput {
    bill_id: string;
    author_civic_did: string;
    title_hash: string;
    body_text: string;
    body_hash: string;
    category: string;
    created_at_tick: number;
}

export interface GovBillStore {
    insertBill(input: InsertBillInput): Promise<void>;
    getBill(bill_id: string): Promise<BillRow | null>;
    /** Adds a distinct co-sponsor; throws Error('duplicate_cosponsor') on repeat. Returns the new count. */
    addCosponsor(input: { bill_id: string; cosponsor_civic_did: string; cosponsored_at_tick: number }): Promise<number>;
    setBillStatus(bill_id: string, status: BillStatus): Promise<void>;
    setBillProposalId(bill_id: string, proposal_id: string): Promise<void>;
    openSession(input: { session_id: string; bill_id: string; speaker_civic_did: string; debate_deadline_tick: number; opened_at_tick: number }): Promise<void>;
    getSession(session_id: string): Promise<SessionRow | null>;
    addArgument(input: { session_id: string; author_civic_did: string; argument_text: string; posted_at_tick: number }): Promise<void>;
    closeSession(input: { session_id: string; outcome: SessionOutcome; closed_at_tick: number }): Promise<void>;
    enactLaw(input: { law_id: string; bill_id: string; enacted_at_tick: number; supersedes_law_id: string | null }): Promise<void>;
    getActiveLaws(): Promise<LawRow[]>;
    getLaw(law_id: string): Promise<LawRow | null>;
    repealLaw(input: { law_id: string; repealing_bill_id: string; repealed_at_tick: number }): Promise<void>;
}

// ── In-memory implementation ───────────────────────────────────────────────────

export class InMemoryGovBillStore implements GovBillStore {
    private readonly bills = new Map<string, BillRow>();
    private readonly cosponsors = new Set<string>();           // `${bill_id}::${civic_did}`
    private readonly sessions = new Map<string, SessionRow>();
    private readonly args: { session_id: string; author_civic_did: string; argument_text: string; posted_at_tick: number }[] = [];
    private readonly laws = new Map<string, LawRow>();

    constructor(private readonly gridName = 'genesis') {}

    async insertBill(input: InsertBillInput): Promise<void> {
        this.bills.set(input.bill_id, {
            bill_id: input.bill_id,
            grid_name: this.gridName,
            author_civic_did: input.author_civic_did,
            title_hash: input.title_hash,
            body_text: input.body_text,
            body_hash: input.body_hash,
            category: input.category,
            status: 'drafted',
            cosponsor_count: 0,
            proposal_id: null,
            created_at_tick: input.created_at_tick,
        });
    }

    async getBill(bill_id: string): Promise<BillRow | null> {
        const row = this.bills.get(bill_id);
        return row ? { ...row } : null;
    }

    async addCosponsor(input: { bill_id: string; cosponsor_civic_did: string; cosponsored_at_tick: number }): Promise<number> {
        const key = `${input.bill_id}::${input.cosponsor_civic_did}`;
        if (this.cosponsors.has(key)) {
            throw new Error('duplicate_cosponsor');
        }
        this.cosponsors.add(key);
        const bill = this.bills.get(input.bill_id);
        if (!bill) throw new Error('bill_not_found');
        bill.cosponsor_count += 1;
        return bill.cosponsor_count;
    }

    async setBillStatus(bill_id: string, status: BillStatus): Promise<void> {
        const bill = this.bills.get(bill_id);
        if (bill) bill.status = status;
    }

    async setBillProposalId(bill_id: string, proposal_id: string): Promise<void> {
        const bill = this.bills.get(bill_id);
        if (bill) bill.proposal_id = proposal_id;
    }

    async openSession(input: { session_id: string; bill_id: string; speaker_civic_did: string; debate_deadline_tick: number; opened_at_tick: number }): Promise<void> {
        this.sessions.set(input.session_id, {
            session_id: input.session_id,
            bill_id: input.bill_id,
            grid_name: this.gridName,
            speaker_civic_did: input.speaker_civic_did,
            debate_deadline_tick: input.debate_deadline_tick,
            status: 'open',
            opened_at_tick: input.opened_at_tick,
            closed_at_tick: null,
            outcome: null,
        });
    }

    async getSession(session_id: string): Promise<SessionRow | null> {
        const row = this.sessions.get(session_id);
        return row ? { ...row } : null;
    }

    async addArgument(input: { session_id: string; author_civic_did: string; argument_text: string; posted_at_tick: number }): Promise<void> {
        this.args.push({ ...input });
    }

    async closeSession(input: { session_id: string; outcome: SessionOutcome; closed_at_tick: number }): Promise<void> {
        const s = this.sessions.get(input.session_id);
        if (s) {
            s.status = 'closed';
            s.outcome = input.outcome;
            s.closed_at_tick = input.closed_at_tick;
        }
    }

    async enactLaw(input: { law_id: string; bill_id: string; enacted_at_tick: number; supersedes_law_id: string | null }): Promise<void> {
        this.laws.set(input.law_id, {
            law_id: input.law_id,
            grid_name: this.gridName,
            bill_id: input.bill_id,
            enacted_at_tick: input.enacted_at_tick,
            status: 'active',
            supersedes_law_id: input.supersedes_law_id,
            repealed_at_tick: null,
            repealing_bill_id: null,
        });
    }

    async getActiveLaws(): Promise<LawRow[]> {
        return [...this.laws.values()].filter(l => l.status === 'active').map(l => ({ ...l }));
    }

    async getLaw(law_id: string): Promise<LawRow | null> {
        const row = this.laws.get(law_id);
        return row ? { ...row } : null;
    }

    async repealLaw(input: { law_id: string; repealing_bill_id: string; repealed_at_tick: number }): Promise<void> {
        const l = this.laws.get(input.law_id);
        if (l) {
            l.status = 'repealed';
            l.repealing_bill_id = input.repealing_bill_id;
            l.repealed_at_tick = input.repealed_at_tick;
        }
    }
}

// ── MySQL implementation ───────────────────────────────────────────────────────

export class MySqlGovBillStore implements GovBillStore {
    constructor(private readonly pool: Pool, private readonly gridName: string) {}

    async insertBill(input: InsertBillInput): Promise<void> {
        await this.pool.query(
            `INSERT INTO gov_bills
               (bill_id, grid_name, author_civic_did, title_hash, body_text, body_hash, category, status, cosponsor_count, created_at_tick)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'drafted', 0, ?)`,
            [input.bill_id, this.gridName, input.author_civic_did, input.title_hash, input.body_text, input.body_hash, input.category, input.created_at_tick],
        );
    }

    async getBill(bill_id: string): Promise<BillRow | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT bill_id, grid_name, author_civic_did, title_hash, body_text, body_hash, category,
                    status, cosponsor_count, proposal_id, created_at_tick
             FROM gov_bills WHERE grid_name = ? AND bill_id = ?`,
            [this.gridName, bill_id],
        );
        return (rows[0] as BillRow | undefined) ?? null;
    }

    async addCosponsor(input: { bill_id: string; cosponsor_civic_did: string; cosponsored_at_tick: number }): Promise<number> {
        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();
            try {
                await conn.query(
                    `INSERT INTO gov_bill_cosponsors (bill_id, cosponsor_civic_did, cosponsored_at_tick) VALUES (?, ?, ?)`,
                    [input.bill_id, input.cosponsor_civic_did, input.cosponsored_at_tick],
                );
            } catch (err) {
                await conn.rollback();
                if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
                    throw new Error('duplicate_cosponsor');
                }
                throw err;
            }
            await conn.query(
                `UPDATE gov_bills SET cosponsor_count = cosponsor_count + 1 WHERE grid_name = ? AND bill_id = ?`,
                [this.gridName, input.bill_id],
            );
            const [rows] = await conn.query<RowDataPacket[]>(
                `SELECT cosponsor_count FROM gov_bills WHERE grid_name = ? AND bill_id = ?`,
                [this.gridName, input.bill_id],
            );
            await conn.commit();
            return Number(rows[0]?.cosponsor_count ?? 0);
        } catch (err) {
            try { await conn.rollback(); } catch { /* ignore rollback error */ }
            throw err;
        } finally {
            conn.release();
        }
    }

    async setBillStatus(bill_id: string, status: BillStatus): Promise<void> {
        await this.pool.query(
            `UPDATE gov_bills SET status = ? WHERE grid_name = ? AND bill_id = ?`,
            [status, this.gridName, bill_id],
        );
    }

    async setBillProposalId(bill_id: string, proposal_id: string): Promise<void> {
        await this.pool.query(
            `UPDATE gov_bills SET proposal_id = ? WHERE grid_name = ? AND bill_id = ?`,
            [proposal_id, this.gridName, bill_id],
        );
    }

    async openSession(input: { session_id: string; bill_id: string; speaker_civic_did: string; debate_deadline_tick: number; opened_at_tick: number }): Promise<void> {
        await this.pool.query(
            `INSERT INTO gov_sessions
               (session_id, bill_id, grid_name, speaker_civic_did, debate_deadline_tick, status, opened_at_tick)
             VALUES (?, ?, ?, ?, ?, 'open', ?)`,
            [input.session_id, input.bill_id, this.gridName, input.speaker_civic_did, input.debate_deadline_tick, input.opened_at_tick],
        );
    }

    async getSession(session_id: string): Promise<SessionRow | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT session_id, bill_id, grid_name, speaker_civic_did, debate_deadline_tick,
                    status, opened_at_tick, closed_at_tick, outcome
             FROM gov_sessions WHERE grid_name = ? AND session_id = ?`,
            [this.gridName, session_id],
        );
        return (rows[0] as SessionRow | undefined) ?? null;
    }

    async addArgument(input: { session_id: string; author_civic_did: string; argument_text: string; posted_at_tick: number }): Promise<void> {
        await this.pool.query(
            `INSERT INTO gov_session_arguments (session_id, author_civic_did, argument_text, posted_at_tick) VALUES (?, ?, ?, ?)`,
            [input.session_id, input.author_civic_did, input.argument_text, input.posted_at_tick],
        );
    }

    async closeSession(input: { session_id: string; outcome: SessionOutcome; closed_at_tick: number }): Promise<void> {
        await this.pool.query(
            `UPDATE gov_sessions SET status = 'closed', outcome = ?, closed_at_tick = ?
             WHERE grid_name = ? AND session_id = ?`,
            [input.outcome, input.closed_at_tick, this.gridName, input.session_id],
        );
    }

    async enactLaw(input: { law_id: string; bill_id: string; enacted_at_tick: number; supersedes_law_id: string | null }): Promise<void> {
        await this.pool.query(
            `INSERT INTO gov_laws (law_id, grid_name, bill_id, enacted_at_tick, status, supersedes_law_id)
             VALUES (?, ?, ?, ?, 'active', ?)`,
            [input.law_id, this.gridName, input.bill_id, input.enacted_at_tick, input.supersedes_law_id],
        );
    }

    async getActiveLaws(): Promise<LawRow[]> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT law_id, grid_name, bill_id, enacted_at_tick, status, supersedes_law_id, repealed_at_tick, repealing_bill_id
             FROM gov_laws WHERE grid_name = ? AND status = 'active' ORDER BY enacted_at_tick ASC LIMIT 500`,
            [this.gridName],
        );
        return rows as unknown as LawRow[];
    }

    async getLaw(law_id: string): Promise<LawRow | null> {
        const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT law_id, grid_name, bill_id, enacted_at_tick, status, supersedes_law_id, repealed_at_tick, repealing_bill_id
             FROM gov_laws WHERE grid_name = ? AND law_id = ?`,
            [this.gridName, law_id],
        );
        return (rows[0] as LawRow | undefined) ?? null;
    }

    async repealLaw(input: { law_id: string; repealing_bill_id: string; repealed_at_tick: number }): Promise<void> {
        await this.pool.query(
            `UPDATE gov_laws SET status = 'repealed', repealing_bill_id = ?, repealed_at_tick = ?
             WHERE grid_name = ? AND law_id = ?`,
            [input.repealing_bill_id, input.repealed_at_tick, this.gridName, input.law_id],
        );
    }
}
