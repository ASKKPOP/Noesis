/**
 * SYNC: mirrors grid/src/governance/types.ts
 * SYNC: mirrors brain/src/noesis_brain/governance/types.py
 *
 * Drift detected by dashboard/test/lib/governance-types.drift.test.ts (lands in Wave 4).
 *
 * PRIVACY — VOTE-05/06 render surface:
 *   Body text NEVER enters this file or any downstream dashboard module.
 *   Operators are read-only at all tiers — no Vote/Propose/Reveal affordance is rendered.
 *   Vote-weighting keys (weight, reputation, relationship_score, ousia_weight) MUST NOT appear.
 *
 * This is the FIFTH dashboard protocol mirror (after audit, ananke, agency, whisper).
 * The post-fifth consolidation refactor into @noesis/protocol-types is logged as deferred per CONTEXT-11 D-11-16
 * and does NOT block Phase 12.
 *
 * Two-source copy intentional — dashboard is a Next.js app with no
 * workspace dep on grid/ or brain/; a divergent copy surfaces in grep the
 * moment upstream shapes change.
 *
 * NO Date.now, NO Math.random — dashboard governance tree is render-only
 * counts/aggregates; wall-clock is allowed for UI state but NOT for
 * governance payload processing or type definitions.
 */

// ── proposal.opened ────────────────────────────────────────────────────────────

/**
 * Closed 6-key payload carried by the 'proposal.opened' audit event.
 * Mirrors grid/src/governance/types.ts ProposalOpenedPayload.
 *
 * PRIVACY: body text never here — only title_hash (sha256(body_text)[:32]).
 */
export interface ProposalOpenedPayload {
    readonly deadline_tick: number;
    readonly proposal_id: string;
    readonly proposer_did: string;
    readonly quorum_pct: number;
    readonly supermajority_pct: number;
    readonly title_hash: string;
}

/**
 * Alphabetical tuple of ProposalOpenedPayload keys.
 * Mirrors grid/src/governance/types.ts PROPOSAL_OPENED_KEYS.
 */
export const PROPOSAL_OPENED_KEYS = [
    'deadline_tick',
    'proposal_id',
    'proposer_did',
    'quorum_pct',
    'supermajority_pct',
    'title_hash',
] as const;

// ── ballot.committed ───────────────────────────────────────────────────────────

/**
 * Closed 3-key payload carried by the 'ballot.committed' audit event.
 * Mirrors grid/src/governance/types.ts BallotCommittedPayload.
 */
export interface BallotCommittedPayload {
    readonly commit_hash: string;
    readonly proposal_id: string;
    readonly voter_did: string;
}

/**
 * Alphabetical tuple of BallotCommittedPayload keys.
 */
export const BALLOT_COMMITTED_KEYS = ['commit_hash', 'proposal_id', 'voter_did'] as const;

// ── ballot.revealed ────────────────────────────────────────────────────────────

/**
 * Valid ballot choices.
 * Mirrors grid/src/governance/types.ts BallotChoice.
 */
export type BallotChoice = 'yes' | 'no' | 'abstain';

/**
 * Closed 4-key payload carried by the 'ballot.revealed' audit event.
 * Mirrors grid/src/governance/types.ts BallotRevealedPayload.
 *
 * Dashboard renders aggregate counts only — individual voter choices
 * are NOT shown unless H5 ballot history endpoint is used.
 */
export interface BallotRevealedPayload {
    readonly choice: BallotChoice;
    readonly nonce: string;
    readonly proposal_id: string;
    readonly voter_did: string;
}

/**
 * Alphabetical tuple of BallotRevealedPayload keys.
 */
export const BALLOT_REVEALED_KEYS = ['choice', 'nonce', 'proposal_id', 'voter_did'] as const;

// ── proposal.tallied ───────────────────────────────────────────────────────────

/**
 * Outcome of a tallied proposal.
 * Mirrors grid/src/governance/types.ts ProposalOutcome.
 */
export type ProposalOutcome = 'passed' | 'rejected' | 'quorum_fail';

/**
 * Closed 6-key payload carried by the 'proposal.tallied' audit event.
 * Mirrors grid/src/governance/types.ts ProposalTalliedPayload.
 *
 * Dashboard renders aggregate counts; individual ballot choices are
 * available only via H5-tier API (GET /api/v1/governance/proposals/:id/ballots/history).
 */
export interface ProposalTalliedPayload {
    readonly abstain_count: number;
    readonly no_count: number;
    readonly outcome: ProposalOutcome;
    readonly proposal_id: string;
    readonly quorum_met: boolean;
    readonly yes_count: number;
}

/**
 * Alphabetical tuple of ProposalTalliedPayload keys.
 */
export const PROPOSAL_TALLIED_KEYS = [
    'abstain_count',
    'no_count',
    'outcome',
    'proposal_id',
    'quorum_met',
    'yes_count',
] as const;
