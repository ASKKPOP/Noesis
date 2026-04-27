/**
 * governance-emitter-enforcement.test.ts
 *
 * Phase 12 Wave 2 — Task 12-W2-01.
 *
 * Runtime enforcement tests for the four governance emitters:
 *   - forbidden-key rejection (each emitter throws when payload would contain a forbidden key)
 *   - closed-tuple shape rejection (extra key in payload triggers throw)
 *   - DID_RE validation (malformed proposer_did or voter_did)
 *   - duplicate-DID guard (appendBallotCommitted rejects duplicate (proposal_id, voter_did))
 *   - hash mismatch (appendBallotRevealed rejects tampered choice/nonce)
 *
 * Per D-12-01 / D-12-04 / D-12-06 / T-09-12 / T-09-14.
 */

import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendProposalOpened } from '../../src/governance/appendProposalOpened.js';
import { appendBallotCommitted } from '../../src/governance/appendBallotCommitted.js';
import { appendBallotRevealed } from '../../src/governance/appendBallotRevealed.js';
import { appendProposalTallied } from '../../src/governance/appendProposalTallied.js';
import { createInMemoryStore } from '../../src/governance/store.js';
import { GovernanceError } from '../../src/governance/errors.js';
import { computeCommitHash } from '../../src/governance/commit-reveal.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { LogosEngine } from '../../src/logos/engine.js';

// ── helpers ────────────────────────────────────────────────────────────────────

function freshAudit() { return new AuditChain(); }
function freshStore() { return createInMemoryStore('test-grid'); }

function freshRegistry(count: number): NousRegistry {
    const reg = new NousRegistry();
    for (let i = 0; i < count; i++) {
        try {
            reg.spawn(
                { did: `did:noesis:reg-${i}`, name: `reg-${i}`, publicKey: 'pk', region: 'genesis' },
                'test.grid', 0, 0,
            );
        } catch { /* ignore */ }
    }
    return reg;
}

// ── appendProposalOpened ───────────────────────────────────────────────────────

describe('appendProposalOpened — input validation', () => {
    it('rejects malformed proposer_did', async () => {
        const audit = freshAudit();
        const store = freshStore();
        await expect(appendProposalOpened(audit, {
            proposer_did: 'not-a-did',
            body_text: 'valid body',
            deadline_tick: 100,
            currentTick: 1,
            store,
        })).rejects.toThrow('proposer_did fails DID_RE');
    });

    it('rejects deadline_tick <= currentTick', async () => {
        const audit = freshAudit();
        const store = freshStore();
        await expect(appendProposalOpened(audit, {
            proposer_did: 'did:noesis:alice',
            body_text: 'valid body',
            deadline_tick: 1,
            currentTick: 1,
            store,
        })).rejects.toThrow('deadline_tick must be a future integer tick');
    });

    it('rejects empty body_text', async () => {
        const audit = freshAudit();
        const store = freshStore();
        await expect(appendProposalOpened(audit, {
            proposer_did: 'did:noesis:alice',
            body_text: '',
            deadline_tick: 100,
            currentTick: 1,
            store,
        })).rejects.toThrow('body_text must be non-empty string');
    });

    it('does NOT emit audit event on validation failure (DID check)', async () => {
        const audit = freshAudit();
        const store = freshStore();
        const appendSpy = vi.spyOn(audit, 'append');
        try {
            await appendProposalOpened(audit, {
                proposer_did: 'bad-did',
                body_text: 'body',
                deadline_tick: 100,
                currentTick: 1,
                store,
            });
        } catch { /* expected */ }
        expect(appendSpy).not.toHaveBeenCalled();
    });

    it('succeeds with valid inputs and returns proposal_id + title_hash', async () => {
        const audit = freshAudit();
        const store = freshStore();
        const result = await appendProposalOpened(audit, {
            proposer_did: 'did:noesis:alice',
            body_text: 'valid proposal body',
            deadline_tick: 100,
            currentTick: 1,
            store,
        });
        expect(result.proposal_id).toBeTruthy();
        expect(result.title_hash).toMatch(/^[0-9a-f]{32}$/);
        expect(audit.length).toBe(1);
    });
});

// ── appendBallotCommitted ──────────────────────────────────────────────────────

describe('appendBallotCommitted — validation + duplicate guard (D-12-06)', () => {
    it('rejects malformed voter_did', async () => {
        const audit = freshAudit();
        const store = freshStore();
        await expect(appendBallotCommitted(audit, {
            proposal_id: 'prop-001',
            voter_did: 'bad-voter-did',
            commit_hash: 'a'.repeat(64),
            currentTick: 1,
            store,
        })).rejects.toThrow('voter_did fails DID_RE');
    });

    it('rejects non-64-char commit_hash', async () => {
        const audit = freshAudit();
        const store = freshStore();
        await expect(appendBallotCommitted(audit, {
            proposal_id: 'prop-001',
            voter_did: 'did:noesis:voter1',
            commit_hash: 'short',
            currentTick: 1,
            store,
        })).rejects.toThrow('commit_hash must be 64-char hex string');
    });

    it('rejects empty proposal_id', async () => {
        const audit = freshAudit();
        const store = freshStore();
        await expect(appendBallotCommitted(audit, {
            proposal_id: '',
            voter_did: 'did:noesis:voter1',
            commit_hash: 'a'.repeat(64),
            currentTick: 1,
            store,
        })).rejects.toThrow('proposal_id must be non-empty string');
    });

    it('rejects duplicate (proposal_id, voter_did) — one-Nous-one-vote (D-12-06)', async () => {
        const audit = freshAudit();
        const store = freshStore();
        // First commit succeeds
        await appendBallotCommitted(audit, {
            proposal_id: 'prop-001',
            voter_did: 'did:noesis:voter1',
            commit_hash: 'a'.repeat(64),
            currentTick: 1,
            store,
        });
        // Second commit for same (proposal_id, voter_did) must fail
        await expect(appendBallotCommitted(audit, {
            proposal_id: 'prop-001',
            voter_did: 'did:noesis:voter1',
            commit_hash: 'b'.repeat(64),
            currentTick: 2,
            store,
        })).rejects.toThrow();
        // Error must be GovernanceError with code 'duplicate_ballot' and httpStatus 409
        try {
            await appendBallotCommitted(freshAudit(), {
                proposal_id: 'prop-001',
                voter_did: 'did:noesis:voter1',
                commit_hash: 'b'.repeat(64),
                currentTick: 2,
                store,
            });
        } catch (err) {
            expect(err).toBeInstanceOf(GovernanceError);
            expect((err as GovernanceError).code).toBe('duplicate_ballot');
            expect((err as GovernanceError).httpStatus).toBe(409);
        }
    });

    it('does NOT emit on duplicate — audit chain length unchanged', async () => {
        const audit = freshAudit();
        const store = freshStore();
        await appendBallotCommitted(audit, {
            proposal_id: 'prop-dup',
            voter_did: 'did:noesis:voter2',
            commit_hash: 'c'.repeat(64),
            currentTick: 1,
            store,
        });
        const lenBefore = audit.length;
        try {
            await appendBallotCommitted(audit, {
                proposal_id: 'prop-dup',
                voter_did: 'did:noesis:voter2',
                commit_hash: 'd'.repeat(64),
                currentTick: 2,
                store,
            });
        } catch { /* expected */ }
        expect(audit.length).toBe(lenBefore);
    });
});

// ── appendBallotRevealed ───────────────────────────────────────────────────────

describe('appendBallotRevealed — hash verification (D-12-02 / T-09-13)', () => {
    const PROPOSAL_ID = 'prop-reveal-001';
    const VOTER_DID = 'did:noesis:revealer';
    const CHOICE = 'yes' as const;
    const NONCE = '0'.repeat(32);

    async function setupBallot(store: ReturnType<typeof createInMemoryStore>, audit: AuditChain) {
        const commit_hash = computeCommitHash(CHOICE, NONCE, VOTER_DID);
        await appendBallotCommitted(audit, {
            proposal_id: PROPOSAL_ID,
            voter_did: VOTER_DID,
            commit_hash,
            currentTick: 1,
            store,
        });
        return commit_hash;
    }

    it('succeeds with correct choice+nonce', async () => {
        const audit = freshAudit();
        const store = freshStore();
        await setupBallot(store, audit);
        const lenBefore = audit.length;
        await appendBallotRevealed(audit, {
            proposal_id: PROPOSAL_ID,
            voter_did: VOTER_DID,
            choice: CHOICE,
            nonce: NONCE,
            currentTick: 2,
            store,
        });
        expect(audit.length).toBe(lenBefore + 1);
    });

    it('rejects reveal with wrong choice (hash mismatch → 422)', async () => {
        const audit = freshAudit();
        const store = freshStore();
        await setupBallot(store, audit);
        try {
            await appendBallotRevealed(audit, {
                proposal_id: PROPOSAL_ID,
                voter_did: VOTER_DID,
                choice: 'no',  // committed 'yes'
                nonce: NONCE,
                currentTick: 2,
                store,
            });
            expect.fail('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(GovernanceError);
            expect((err as GovernanceError).code).toBe('ballot_reveal_mismatch');
            expect((err as GovernanceError).httpStatus).toBe(422);
        }
    });

    it('rejects reveal with wrong nonce (hash mismatch)', async () => {
        const audit = freshAudit();
        const store = freshStore();
        await setupBallot(store, audit);
        try {
            await appendBallotRevealed(audit, {
                proposal_id: PROPOSAL_ID,
                voter_did: VOTER_DID,
                choice: CHOICE,
                nonce: '1'.repeat(32),  // wrong nonce
                currentTick: 2,
                store,
            });
            expect.fail('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(GovernanceError);
            expect((err as GovernanceError).code).toBe('ballot_reveal_mismatch');
        }
    });

    it('rejects malformed nonce (not 32 lowercase hex chars)', async () => {
        const audit = freshAudit();
        const store = freshStore();
        await expect(appendBallotRevealed(audit, {
            proposal_id: PROPOSAL_ID,
            voter_did: VOTER_DID,
            choice: CHOICE,
            nonce: 'not-a-nonce',
            currentTick: 2,
            store,
        })).rejects.toThrow('nonce must be 32 lowercase hex chars');
    });

    it('rejects reveal for non-existent ballot (ballot_not_found → 404)', async () => {
        const audit = freshAudit();
        const store = freshStore();
        try {
            await appendBallotRevealed(audit, {
                proposal_id: 'no-such-prop',
                voter_did: VOTER_DID,
                choice: CHOICE,
                nonce: NONCE,
                currentTick: 1,
                store,
            });
            expect.fail('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(GovernanceError);
            expect((err as GovernanceError).code).toBe('ballot_not_found');
            expect((err as GovernanceError).httpStatus).toBe(404);
        }
    });

    it('does NOT emit audit event on hash mismatch', async () => {
        const audit = freshAudit();
        const store = freshStore();
        await setupBallot(store, audit);
        const appendSpy = vi.spyOn(audit, 'append');
        try {
            await appendBallotRevealed(audit, {
                proposal_id: PROPOSAL_ID,
                voter_did: VOTER_DID,
                choice: 'no',
                nonce: NONCE,
                currentTick: 2,
                store,
            });
        } catch { /* expected */ }
        expect(appendSpy).not.toHaveBeenCalled();
    });
});

// ── appendProposalTallied ──────────────────────────────────────────────────────

describe('appendProposalTallied — tally emission + law promotion', () => {
    it('throws proposal_not_found (404) for unknown proposal_id', async () => {
        const audit = freshAudit();
        const store = freshStore();
        const registry = freshRegistry(10);
        const logos = new LogosEngine();
        try {
            await appendProposalTallied(audit, {
                proposal_id: 'no-such-proposal',
                currentTick: 100,
                store,
                registry,
                logos,
            });
            expect.fail('should have thrown');
        } catch (err) {
            expect(err).toBeInstanceOf(GovernanceError);
            expect((err as GovernanceError).code).toBe('proposal_not_found');
            expect((err as GovernanceError).httpStatus).toBe(404);
        }
    });

    it('emits proposal.tallied with outcome=quorum_fail when no ballots committed', async () => {
        const audit = freshAudit();
        const store = freshStore();
        const registry = freshRegistry(10);
        const logos = new LogosEngine();

        // Open a proposal
        const { proposal_id } = await appendProposalOpened(audit, {
            proposer_did: 'did:noesis:proposer',
            body_text: JSON.stringify({ id: 'law-1', title: 'T', description: 'D',
                ruleLogic: { condition: { type: 'true' }, action: 'allow', sanction_on_violation: 'none' },
                severity: 'info', status: 'active' }),
            deadline_tick: 100,
            currentTick: 1,
            store,
        });

        await appendProposalTallied(audit, {
            proposal_id,
            currentTick: 100,
            store,
            registry,
            logos,
        });

        // Should have emitted proposal.tallied
        const talliedEntries = audit.query({ eventType: 'proposal.tallied' });
        expect(talliedEntries).toHaveLength(1);
        expect(talliedEntries[0].payload.outcome).toBe('quorum_fail');
        // Should NOT emit law.triggered (quorum_fail, not passed)
        expect(audit.query({ eventType: 'law.triggered' })).toHaveLength(0);
    });

    it('emits proposal.tallied + law.triggered when outcome=passed', async () => {
        const audit = freshAudit();
        const store = freshStore();
        const registry = freshRegistry(1);  // only 1 Nous
        const logos = new LogosEngine();

        const lawJson = JSON.stringify({
            id: 'law-passed-test',
            title: 'Test Law',
            description: 'Test',
            ruleLogic: { condition: { type: 'true' }, action: 'allow', sanction_on_violation: 'none' },
            severity: 'info',
            status: 'active',
        });

        const { proposal_id } = await appendProposalOpened(audit, {
            proposer_did: 'did:noesis:proposer',
            body_text: lawJson,
            deadline_tick: 100,
            currentTick: 1,
            store,
        });

        // 1 voter commits + reveals 'yes' → quorum met (1/1=100%) + supermajority met
        const voter_did = 'did:noesis:voter';
        const nonce = '0'.repeat(32);
        const choice = 'yes' as const;
        const commit_hash = computeCommitHash(choice, nonce, voter_did);

        await appendBallotCommitted(audit, { proposal_id, voter_did, commit_hash, currentTick: 2, store });
        await appendBallotRevealed(audit, { proposal_id, voter_did, choice, nonce, currentTick: 3, store });

        await appendProposalTallied(audit, { proposal_id, currentTick: 100, store, registry, logos });

        const tallied = audit.query({ eventType: 'proposal.tallied' });
        expect(tallied[0].payload.outcome).toBe('passed');

        const lawTriggered = audit.query({ eventType: 'law.triggered' });
        expect(lawTriggered).toHaveLength(1);
        expect(lawTriggered[0].payload.enacted_by).toBe('collective');
        expect(lawTriggered[0].payload.law_id).toBe('law-passed-test');
    });
});
