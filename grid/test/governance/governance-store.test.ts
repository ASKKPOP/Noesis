/**
 * governance-store.test.ts
 *
 * Phase 12 Wave 2 — Task 12-W2-01.
 *
 * Round-trip tests for GovernanceStore using the in-memory implementation
 * (createInMemoryStore) — no real MySQL required.
 *
 * Covers all 9 store methods:
 *   insertProposal → getProposal (round-trip)
 *   insertBallotCommit → ballotExists (round-trip)
 *   updateBallotReveal → getRevealsForProposal (round-trip)
 *   updateProposalTallied → getOpenProposals exclusion
 *   getCommittedDidsForProposal — returns all committed voter_dids
 *   getBallot — returns stored commit row
 *
 * Per D-12-08 / T-09-12.
 */

import { describe, it, expect } from 'vitest';
import { createInMemoryStore } from '../../src/governance/store.js';

const GRID = 'test-grid';

function freshStore() {
    return createInMemoryStore(GRID);
}

// ── insertProposal + getProposal ───────────────────────────────────────────────

describe('GovernanceStore — insertProposal + getProposal', () => {
    it('round-trip: inserted proposal is retrieved by proposal_id', async () => {
        const store = freshStore();
        await store.insertProposal({
            proposal_id: 'prop-001',
            proposer_did: 'did:noesis:alice',
            title_hash: 'a'.repeat(32),
            body_text: '{"law": "fixture"}',
            quorum_pct: 50,
            supermajority_pct: 67,
            deadline_tick: 100,
            opened_at_tick: 1,
        });
        const row = await store.getProposal('prop-001');
        expect(row).not.toBeNull();
        expect(row!.proposal_id).toBe('prop-001');
        expect(row!.proposer_did).toBe('did:noesis:alice');
        expect(row!.quorum_pct).toBe(50);
        expect(row!.supermajority_pct).toBe(67);
        expect(row!.deadline_tick).toBe(100);
        expect(row!.status).toBe('open');
        expect(row!.outcome).toBeNull();
        expect(row!.tallied_at_tick).toBeNull();
    });

    it('getProposal returns null for unknown proposal_id', async () => {
        const store = freshStore();
        const row = await store.getProposal('no-such-proposal');
        expect(row).toBeNull();
    });
});

// ── insertBallotCommit + ballotExists ──────────────────────────────────────────

describe('GovernanceStore — insertBallotCommit + ballotExists', () => {
    it('ballotExists returns false before insert', async () => {
        const store = freshStore();
        expect(await store.ballotExists('prop-001', 'did:noesis:voter1')).toBe(false);
    });

    it('ballotExists returns true after insert', async () => {
        const store = freshStore();
        await store.insertBallotCommit({
            proposal_id: 'prop-001',
            voter_did: 'did:noesis:voter1',
            commit_hash: 'a'.repeat(64),
            committed_tick: 1,
        });
        expect(await store.ballotExists('prop-001', 'did:noesis:voter1')).toBe(true);
    });

    it('ballotExists is scoped to (proposal_id, voter_did) pair', async () => {
        const store = freshStore();
        await store.insertBallotCommit({
            proposal_id: 'prop-001',
            voter_did: 'did:noesis:voter1',
            commit_hash: 'b'.repeat(64),
            committed_tick: 1,
        });
        // Different voter → false
        expect(await store.ballotExists('prop-001', 'did:noesis:voter2')).toBe(false);
        // Different proposal → false
        expect(await store.ballotExists('prop-002', 'did:noesis:voter1')).toBe(false);
    });
});

// ── getBallot ──────────────────────────────────────────────────────────────────

describe('GovernanceStore — getBallot', () => {
    it('returns null for non-existent ballot', async () => {
        const store = freshStore();
        expect(await store.getBallot('prop-001', 'did:noesis:voter1')).toBeNull();
    });

    it('returns the committed ballot row with correct commit_hash', async () => {
        const store = freshStore();
        const commit_hash = 'c'.repeat(64);
        await store.insertBallotCommit({
            proposal_id: 'prop-001',
            voter_did: 'did:noesis:voter1',
            commit_hash,
            committed_tick: 5,
        });
        const row = await store.getBallot('prop-001', 'did:noesis:voter1');
        expect(row).not.toBeNull();
        expect(row!.commit_hash).toBe(commit_hash);
        expect(row!.revealed).toBe(0);
        expect(row!.choice).toBeNull();
        expect(row!.nonce).toBeNull();
        expect(row!.committed_tick).toBe(5);
    });
});

// ── updateBallotReveal + getRevealsForProposal ─────────────────────────────────

describe('GovernanceStore — updateBallotReveal + getRevealsForProposal', () => {
    it('round-trip: updated ballot appears in getRevealsForProposal', async () => {
        const store = freshStore();
        await store.insertBallotCommit({
            proposal_id: 'prop-reveal',
            voter_did: 'did:noesis:voter1',
            commit_hash: 'd'.repeat(64),
            committed_tick: 1,
        });
        await store.updateBallotReveal({
            proposal_id: 'prop-reveal',
            voter_did: 'did:noesis:voter1',
            choice: 'yes',
            nonce: '0'.repeat(32),
            revealed_tick: 5,
        });
        const reveals = await store.getRevealsForProposal('prop-reveal');
        expect(reveals).toHaveLength(1);
        expect(reveals[0].choice).toBe('yes');
        expect(reveals[0].voter_did).toBe('did:noesis:voter1');
        expect(reveals[0].revealed).toBe(1);
        expect(reveals[0].nonce).toBe('0'.repeat(32));
    });

    it('getRevealsForProposal returns only revealed ballots', async () => {
        const store = freshStore();
        // voter1 commits + reveals; voter2 only commits
        await store.insertBallotCommit({
            proposal_id: 'prop-partial',
            voter_did: 'did:noesis:voter1',
            commit_hash: 'e'.repeat(64),
            committed_tick: 1,
        });
        await store.insertBallotCommit({
            proposal_id: 'prop-partial',
            voter_did: 'did:noesis:voter2',
            commit_hash: 'f'.repeat(64),
            committed_tick: 2,
        });
        await store.updateBallotReveal({
            proposal_id: 'prop-partial',
            voter_did: 'did:noesis:voter1',
            choice: 'no',
            nonce: '1'.repeat(32),
            revealed_tick: 3,
        });
        const reveals = await store.getRevealsForProposal('prop-partial');
        expect(reveals).toHaveLength(1);
        expect(reveals[0].voter_did).toBe('did:noesis:voter1');
    });
});

// ── getCommittedDidsForProposal ────────────────────────────────────────────────

describe('GovernanceStore — getCommittedDidsForProposal', () => {
    it('returns all committed voter_dids regardless of revealed status', async () => {
        const store = freshStore();
        await store.insertBallotCommit({ proposal_id: 'prop-all', voter_did: 'did:noesis:v1', commit_hash: 'a'.repeat(64), committed_tick: 1 });
        await store.insertBallotCommit({ proposal_id: 'prop-all', voter_did: 'did:noesis:v2', commit_hash: 'b'.repeat(64), committed_tick: 2 });
        await store.updateBallotReveal({ proposal_id: 'prop-all', voter_did: 'did:noesis:v1', choice: 'yes', nonce: '0'.repeat(32), revealed_tick: 3 });

        const dids = await store.getCommittedDidsForProposal('prop-all');
        expect(dids).toHaveLength(2);
        expect(dids).toContain('did:noesis:v1');
        expect(dids).toContain('did:noesis:v2');
    });

    it('returns empty array for proposal with no ballots', async () => {
        const store = freshStore();
        const dids = await store.getCommittedDidsForProposal('no-ballots');
        expect(dids).toHaveLength(0);
    });
});

// ── updateProposalTallied + getOpenProposals ───────────────────────────────────

describe('GovernanceStore — updateProposalTallied + getOpenProposals', () => {
    it('getOpenProposals returns all status=open proposals', async () => {
        const store = freshStore();
        await store.insertProposal({ proposal_id: 'p1', proposer_did: 'did:noesis:a', title_hash: 'h1'.padEnd(32, '0'), body_text: '{}', quorum_pct: 50, supermajority_pct: 67, deadline_tick: 100, opened_at_tick: 1 });
        await store.insertProposal({ proposal_id: 'p2', proposer_did: 'did:noesis:b', title_hash: 'h2'.padEnd(32, '0'), body_text: '{}', quorum_pct: 50, supermajority_pct: 67, deadline_tick: 200, opened_at_tick: 2 });
        const open = await store.getOpenProposals();
        expect(open.map(p => p.proposal_id)).toContain('p1');
        expect(open.map(p => p.proposal_id)).toContain('p2');
    });

    it('tallied proposal is excluded from getOpenProposals', async () => {
        const store = freshStore();
        await store.insertProposal({ proposal_id: 'tallied-p', proposer_did: 'did:noesis:a', title_hash: 'h3'.padEnd(32, '0'), body_text: '{}', quorum_pct: 50, supermajority_pct: 67, deadline_tick: 100, opened_at_tick: 1 });
        await store.updateProposalTallied({ proposal_id: 'tallied-p', outcome: 'rejected', tallied_at_tick: 100 });

        const open = await store.getOpenProposals();
        expect(open.find(p => p.proposal_id === 'tallied-p')).toBeUndefined();
    });

    it('updateProposalTallied sets status, outcome, tallied_at_tick', async () => {
        const store = freshStore();
        await store.insertProposal({ proposal_id: 'tally-check', proposer_did: 'did:noesis:a', title_hash: '0'.repeat(32), body_text: '{}', quorum_pct: 50, supermajority_pct: 67, deadline_tick: 100, opened_at_tick: 1 });
        await store.updateProposalTallied({ proposal_id: 'tally-check', outcome: 'passed', tallied_at_tick: 101 });

        const row = await store.getProposal('tally-check');
        expect(row!.status).toBe('tallied');
        expect(row!.outcome).toBe('passed');
        expect(row!.tallied_at_tick).toBe(101);
    });
});
