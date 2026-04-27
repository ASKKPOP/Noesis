/**
 * GovernanceStore — MySQL-backed persistence for governance proposals and ballots.
 *
 * SSR-safe singleton pattern — no module-level instance state. Caller (GenesisLauncher
 * or test harness) constructs an instance and passes it explicitly as a dependency.
 *
 * Schema: governance_proposals + governance_ballots (migration v6, D-12-08).
 *
 * All methods are async (mysql2/promise). No wall-clock reads (D-12-11).
 * No Date.now, no Math.random — tick comes from caller.
 *
 * Phase 12 Wave 2 — VOTE-01..04 / D-12-08 / CONTEXT-12.
 */

// ── in-memory record shapes ────────────────────────────────────────────────────

export interface ProposalRow {
    grid_name: string;
    proposal_id: string;
    proposer_did: string;
    title_hash: string;
    body_text: string;
    quorum_pct: number;
    supermajority_pct: number;
    deadline_tick: number;
    status: 'open' | 'tallied';
    outcome: string | null;
    opened_at_tick: number;
    tallied_at_tick: number | null;
}

export interface BallotRow {
    grid_name: string;
    proposal_id: string;
    voter_did: string;
    commit_hash: string;
    revealed: 0 | 1;
    choice: 'yes' | 'no' | 'abstain' | null;
    nonce: string | null;
    committed_tick: number;
    revealed_tick: number | null;
}

// ── insert/update input shapes ─────────────────────────────────────────────────

export interface InsertProposalInput {
    proposal_id: string;
    proposer_did: string;
    title_hash: string;
    body_text: string;
    quorum_pct: number;
    supermajority_pct: number;
    deadline_tick: number;
    opened_at_tick: number;
}

export interface InsertBallotCommitInput {
    proposal_id: string;
    voter_did: string;
    commit_hash: string;
    committed_tick: number;
}

export interface UpdateBallotRevealInput {
    proposal_id: string;
    voter_did: string;
    choice: 'yes' | 'no' | 'abstain';
    nonce: string;
    revealed_tick: number;
}

export interface UpdateProposalTalliedInput {
    proposal_id: string;
    outcome: string;
    tallied_at_tick: number;
}

// ── minimal DB interface (for testability without real mysql2) ─────────────────

export interface GovernanceDb {
    execute(sql: string, values?: unknown[]): Promise<void>;
    query<T = unknown>(sql: string, values?: unknown[]): Promise<T[]>;
}

// ── GovernanceStore ────────────────────────────────────────────────────────────

export class GovernanceStore {
    constructor(
        private readonly db: GovernanceDb,
        private readonly gridName: string,
    ) {}

    /** INSERT a new proposal (status='open'). */
    async insertProposal(input: InsertProposalInput): Promise<void> {
        await this.db.execute(
            `INSERT INTO governance_proposals
               (grid_name, proposal_id, proposer_did, title_hash, body_text,
                quorum_pct, supermajority_pct, deadline_tick, status, opened_at_tick)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
            [
                this.gridName,
                input.proposal_id,
                input.proposer_did,
                input.title_hash,
                input.body_text,
                input.quorum_pct,
                input.supermajority_pct,
                input.deadline_tick,
                input.opened_at_tick,
            ],
        );
    }

    /** INSERT a ballot commit (revealed=0). */
    async insertBallotCommit(input: InsertBallotCommitInput): Promise<void> {
        await this.db.execute(
            `INSERT INTO governance_ballots
               (grid_name, proposal_id, voter_did, commit_hash, revealed, committed_tick)
             VALUES (?, ?, ?, ?, 0, ?)`,
            [
                this.gridName,
                input.proposal_id,
                input.voter_did,
                input.commit_hash,
                input.committed_tick,
            ],
        );
    }

    /** UPDATE ballot on reveal: set revealed=1, choice, nonce, revealed_tick. */
    async updateBallotReveal(input: UpdateBallotRevealInput): Promise<void> {
        await this.db.execute(
            `UPDATE governance_ballots
             SET revealed = 1, choice = ?, nonce = ?, revealed_tick = ?
             WHERE grid_name = ? AND proposal_id = ? AND voter_did = ?`,
            [
                input.choice,
                input.nonce,
                input.revealed_tick,
                this.gridName,
                input.proposal_id,
                input.voter_did,
            ],
        );
    }

    /** UPDATE proposal to tallied state with outcome. */
    async updateProposalTallied(input: UpdateProposalTalliedInput): Promise<void> {
        await this.db.execute(
            `UPDATE governance_proposals
             SET status = 'tallied', outcome = ?, tallied_at_tick = ?
             WHERE grid_name = ? AND proposal_id = ?`,
            [
                input.outcome,
                input.tallied_at_tick,
                this.gridName,
                input.proposal_id,
            ],
        );
    }

    /** Returns true iff a ballot already exists for (proposal_id, voter_did). */
    async ballotExists(proposal_id: string, voter_did: string): Promise<boolean> {
        const rows = await this.db.query<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM governance_ballots
             WHERE grid_name = ? AND proposal_id = ? AND voter_did = ?`,
            [this.gridName, proposal_id, voter_did],
        );
        return (rows[0]?.cnt ?? 0) > 0;
    }

    /** Returns all proposals with status='open'. */
    async getOpenProposals(): Promise<ProposalRow[]> {
        const rows = await this.db.query<ProposalRow>(
            `SELECT grid_name, proposal_id, proposer_did, title_hash, body_text,
                    quorum_pct, supermajority_pct, deadline_tick, status, outcome,
                    opened_at_tick, tallied_at_tick
             FROM governance_proposals
             WHERE grid_name = ? AND status = 'open'`,
            [this.gridName],
        );
        return rows;
    }

    /** Returns all revealed ballots for a proposal. */
    async getRevealsForProposal(proposal_id: string): Promise<BallotRow[]> {
        const rows = await this.db.query<BallotRow>(
            `SELECT grid_name, proposal_id, voter_did, commit_hash, revealed,
                    choice, nonce, committed_tick, revealed_tick
             FROM governance_ballots
             WHERE grid_name = ? AND proposal_id = ? AND revealed = 1`,
            [this.gridName, proposal_id],
        );
        return rows;
    }

    /** Returns all committed (revealed or not) voter_dids for a proposal. */
    async getCommittedDidsForProposal(proposal_id: string): Promise<string[]> {
        const rows = await this.db.query<{ voter_did: string }>(
            `SELECT voter_did FROM governance_ballots
             WHERE grid_name = ? AND proposal_id = ?`,
            [this.gridName, proposal_id],
        );
        return rows.map(r => r.voter_did);
    }

    /** Returns a single proposal row (or null if not found). */
    async getProposal(proposal_id: string): Promise<ProposalRow | null> {
        const rows = await this.db.query<ProposalRow>(
            `SELECT grid_name, proposal_id, proposer_did, title_hash, body_text,
                    quorum_pct, supermajority_pct, deadline_tick, status, outcome,
                    opened_at_tick, tallied_at_tick
             FROM governance_proposals
             WHERE grid_name = ? AND proposal_id = ?`,
            [this.gridName, proposal_id],
        );
        return rows[0] ?? null;
    }

    /** Returns the stored commit_hash for (proposal_id, voter_did), or null. */
    async getBallot(proposal_id: string, voter_did: string): Promise<BallotRow | null> {
        const rows = await this.db.query<BallotRow>(
            `SELECT grid_name, proposal_id, voter_did, commit_hash, revealed,
                    choice, nonce, committed_tick, revealed_tick
             FROM governance_ballots
             WHERE grid_name = ? AND proposal_id = ? AND voter_did = ?`,
            [this.gridName, proposal_id, voter_did],
        );
        return rows[0] ?? null;
    }
}

// ── In-memory test store (no MySQL required) ───────────────────────────────────

/**
 * createInMemoryStore — returns a GovernanceStore backed by in-memory Maps.
 *
 * Used by replay harness and governance test suites to avoid real MySQL.
 * Per Phase 11 pattern (PendingStore / InMemoryStore discipline).
 */
export function createInMemoryStore(gridName = 'test-grid'): GovernanceStore {
    const proposals = new Map<string, ProposalRow>();
    const ballots = new Map<string, BallotRow>();   // key: `${proposal_id}::${voter_did}`

    const db: GovernanceDb = {
        async execute(sql: string, values?: unknown[]): Promise<void> {
            const s = sql.replace(/\s+/g, ' ');
            const v = values ?? [];
            // INSERT INTO governance_proposals
            if (/INSERT INTO governance_proposals/.test(s)) {
                const row: ProposalRow = {
                    grid_name: v[0] as string,
                    proposal_id: v[1] as string,
                    proposer_did: v[2] as string,
                    title_hash: v[3] as string,
                    body_text: v[4] as string,
                    quorum_pct: v[5] as number,
                    supermajority_pct: v[6] as number,
                    deadline_tick: v[7] as number,
                    status: 'open',
                    outcome: null,
                    opened_at_tick: v[8] as number,
                    tallied_at_tick: null,
                };
                proposals.set(row.proposal_id, row);
                return;
            }
            // INSERT INTO governance_ballots
            if (/INSERT INTO governance_ballots/.test(s)) {
                const row: BallotRow = {
                    grid_name: v[0] as string,
                    proposal_id: v[1] as string,
                    voter_did: v[2] as string,
                    commit_hash: v[3] as string,
                    revealed: 0,
                    choice: null,
                    nonce: null,
                    committed_tick: v[4] as number,
                    revealed_tick: null,
                };
                ballots.set(`${row.proposal_id}::${row.voter_did}`, row);
                return;
            }
            // UPDATE governance_ballots SET revealed
            if (/UPDATE governance_ballots\s+SET revealed/.test(s)) {
                // values: [choice, nonce, revealed_tick, gridName, proposal_id, voter_did]
                const key = `${v[4] as string}::${v[5] as string}`;
                const row = ballots.get(key);
                if (row) {
                    row.revealed = 1;
                    row.choice = v[0] as 'yes' | 'no' | 'abstain';
                    row.nonce = v[1] as string;
                    row.revealed_tick = v[2] as number;
                }
                return;
            }
            // UPDATE governance_proposals SET status = 'tallied'
            if (/UPDATE governance_proposals\s+SET status/.test(s)) {
                // values: [outcome, tallied_at_tick, gridName, proposal_id]
                const row = proposals.get(v[3] as string);
                if (row) {
                    row.status = 'tallied';
                    row.outcome = v[0] as string;
                    row.tallied_at_tick = v[1] as number;
                }
                return;
            }
        },

        async query<T = unknown>(sql: string, values?: unknown[]): Promise<T[]> {
            const s = sql.replace(/\s+/g, ' ');
            const v = values ?? [];
            // COUNT ballot exists
            if (/SELECT COUNT/.test(s) && /governance_ballots/.test(s)) {
                const key = `${v[1] as string}::${v[2] as string}`;
                const cnt = ballots.has(key) ? 1 : 0;
                return [{ cnt } as unknown as T];
            }
            // SELECT open proposals
            if (/SELECT.*FROM governance_proposals.*status = 'open'/.test(s)) {
                const open = [...proposals.values()].filter(p => p.status === 'open');
                return open as unknown as T[];
            }
            // SELECT revealed ballots
            if (/SELECT.*FROM governance_ballots.*revealed = 1/.test(s)) {
                const pid = v[1] as string;
                const revealed = [...ballots.values()].filter(b => b.proposal_id === pid && b.revealed === 1);
                return revealed as unknown as T[];
            }
            // SELECT all committed voter_dids
            if (/SELECT voter_did FROM governance_ballots/.test(s)) {
                const pid = v[1] as string;
                const dids = [...ballots.values()]
                    .filter(b => b.proposal_id === pid)
                    .map(b => ({ voter_did: b.voter_did }));
                return dids as unknown as T[];
            }
            // SELECT single proposal
            if (/SELECT.*FROM governance_proposals.*proposal_id = \?/.test(s)) {
                const row = proposals.get(v[1] as string);
                return (row ? [row] : []) as unknown as T[];
            }
            // SELECT single ballot
            if (/SELECT.*FROM governance_ballots.*voter_did = \?/.test(s)) {
                const key = `${v[1] as string}::${v[2] as string}`;
                const row = ballots.get(key);
                return (row ? [row] : []) as unknown as T[];
            }
            return [];
        },
    };

    return new GovernanceStore(db, gridName);
}
