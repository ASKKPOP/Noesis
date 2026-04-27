/**
 * Tests for POST /api/v1/governance/proposals/:id/ballots/commit and
 *         POST /api/v1/governance/proposals/:id/ballots/reveal
 *
 * Phase 12 Wave 3 — VOTE-02 / VOTE-03 / VOTE-05 / D-12-02 / D-12-05 / D-12-06.
 *
 * Commit cases:
 *   - 400 bad DID
 *   - 400 bad commit_hash length (not 64 hex)
 *   - 404 unknown proposal
 *   - 409 duplicate (proposal_id, voter_did)
 *   - 410 tombstoned voter
 *   - 422 deadline passed
 *   - 201 happy path
 *
 * Reveal cases:
 *   - 400 bad choice enum
 *   - 400 bad nonce length
 *   - 404 missing committed ballot
 *   - 410 tombstoned voter
 *   - 422 hash mismatch — asserts NO ballot.revealed in audit chain
 *   - 201 happy path
 */

import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { createInMemoryStore } from '../../src/governance/store.js';
import { appendProposalOpened } from '../../src/governance/appendProposalOpened.js';
import { appendBallotCommitted } from '../../src/governance/appendBallotCommitted.js';
import { computeCommitHash } from '../../src/governance/commit-reveal.js';
import { registerGovernanceRoutes } from '../../src/api/governance/index.js';
import type { GovernanceStore } from '../../src/governance/store.js';

const ALICE = 'did:noesis:alice';
const BOB = 'did:noesis:bob';

const VALID_NONCE = '00000000000000000000000000000000'; // 32 hex chars
const VALID_COMMIT_HASH = computeCommitHash('yes', VALID_NONCE, ALICE);

function makeRegistry(opts: { hasDid?: boolean; tombstoned?: string } = {}) {
    const { hasDid = true, tombstoned } = opts;
    return {
        get: (did: string) => {
            if (!hasDid) return undefined;
            return { did, status: tombstoned === did ? 'deleted' : 'active', deletedAtTick: tombstoned === did ? 5 : undefined };
        },
        has: (_did: string) => hasDid,
        isTombstoned: (did: string) => tombstoned === did,
        count: 3,
        active: () => [],
    };
}

function makeLogos() {
    return { addLaw: () => {}, activeLaws: () => [] };
}

async function buildApp(opts: {
    hasDid?: boolean;
    tombstoned?: string;
    audit?: AuditChain;
    store?: GovernanceStore;
} = {}): Promise<{ app: FastifyInstance; audit: AuditChain; store: GovernanceStore }> {
    const app = Fastify({ logger: false });
    const audit = opts.audit ?? new AuditChain();
    const store = opts.store ?? createInMemoryStore('test-grid');
    const registry = makeRegistry({ hasDid: opts.hasDid, tombstoned: opts.tombstoned });
    const logos = makeLogos();

    await registerGovernanceRoutes(app, { audit, store, registry, logos });
    await app.ready();
    return { app, audit, store };
}

async function openTestProposal(audit: AuditChain, store: GovernanceStore, overrides: {
    proposer_did?: string;
    deadline_tick?: number;
    opened_at_tick?: number;
} = {}): Promise<string> {
    const result = await appendProposalOpened(audit, {
        proposer_did: overrides.proposer_did ?? ALICE,
        body_text: 'Test proposal body',
        deadline_tick: overrides.deadline_tick ?? 100,
        currentTick: overrides.opened_at_tick ?? 1,
        store,
    });
    return result.proposal_id;
}

describe('POST /api/v1/governance/proposals/:id/ballots/commit', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        await app?.close();
    });

    it('400 bad DID — fails DID regex', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openTestProposal(audit, store);
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/commit`,
            payload: { voter_did: 'not-a-did', commit_hash: VALID_COMMIT_HASH, committed_at_tick: 5 },
        });
        expect(res.statusCode).toBe(400);
    });

    it('400 bad commit_hash — not 64 hex chars', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openTestProposal(audit, store);
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/commit`,
            payload: { voter_did: ALICE, commit_hash: 'tooshort', committed_at_tick: 5 },
        });
        expect(res.statusCode).toBe(400);
    });

    it('404 unknown proposal', async () => {
        const { app: a } = await buildApp();
        app = a;
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/governance/proposals/nonexistent-id/ballots/commit',
            payload: { voter_did: ALICE, commit_hash: VALID_COMMIT_HASH, committed_at_tick: 5 },
        });
        expect(res.statusCode).toBe(404);
    });

    it('409 duplicate — (proposal_id, voter_did) already committed', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openTestProposal(audit, store);

        // First commit
        await app.inject({
            method: 'POST',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/commit`,
            payload: { voter_did: ALICE, commit_hash: VALID_COMMIT_HASH, committed_at_tick: 5 },
        });

        // Duplicate commit
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/commit`,
            payload: { voter_did: ALICE, commit_hash: VALID_COMMIT_HASH, committed_at_tick: 6 },
        });
        expect(res.statusCode).toBe(409);
        const body = JSON.parse(res.body) as { error: string };
        expect(body.error).toContain('duplicate');
    });

    it('410 tombstoned voter', async () => {
        const { app: a, audit, store } = await buildApp({ tombstoned: BOB });
        app = a;
        const proposalId = await openTestProposal(audit, store);
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/commit`,
            payload: { voter_did: BOB, commit_hash: VALID_COMMIT_HASH, committed_at_tick: 5 },
        });
        expect(res.statusCode).toBe(410);
    });

    it('422 deadline passed — committed_at_tick > deadline_tick', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openTestProposal(audit, store, { deadline_tick: 5, opened_at_tick: 1 });
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/commit`,
            payload: { voter_did: ALICE, commit_hash: VALID_COMMIT_HASH, committed_at_tick: 10 },
        });
        expect(res.statusCode).toBe(422);
    });

    it('201 happy path — commit ballot', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openTestProposal(audit, store);
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/commit`,
            payload: { voter_did: ALICE, commit_hash: VALID_COMMIT_HASH, committed_at_tick: 5 },
        });
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body) as { proposal_id: string; voter_did: string };
        expect(body.proposal_id).toBe(proposalId);
        expect(body.voter_did).toBe(ALICE);
    });
});

describe('POST /api/v1/governance/proposals/:id/ballots/reveal', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        await app?.close();
    });

    it('400 bad choice enum', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openTestProposal(audit, store);
        await appendBallotCommitted(audit, {
            proposal_id: proposalId,
            voter_did: ALICE,
            commit_hash: VALID_COMMIT_HASH,
            currentTick: 5,
            store,
        });
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/reveal`,
            payload: { voter_did: ALICE, choice: 'maybe', nonce: VALID_NONCE, revealed_at_tick: 6 },
        });
        expect(res.statusCode).toBe(400);
    });

    it('400 bad nonce length', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openTestProposal(audit, store);
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/reveal`,
            payload: { voter_did: ALICE, choice: 'yes', nonce: 'tooshort', revealed_at_tick: 6 },
        });
        expect(res.statusCode).toBe(400);
    });

    it('404 missing committed ballot', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openTestProposal(audit, store);
        // No commit step — reveal without commit
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/reveal`,
            payload: { voter_did: ALICE, choice: 'yes', nonce: VALID_NONCE, revealed_at_tick: 6 },
        });
        expect(res.statusCode).toBe(404);
    });

    it('410 tombstoned voter on reveal', async () => {
        const { app: a, audit, store } = await buildApp({ tombstoned: BOB });
        app = a;
        const proposalId = await openTestProposal(audit, store);
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/reveal`,
            payload: { voter_did: BOB, choice: 'yes', nonce: VALID_NONCE, revealed_at_tick: 6 },
        });
        expect(res.statusCode).toBe(410);
    });

    it('422 hash mismatch — NO ballot.revealed in audit chain', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openTestProposal(audit, store);
        // Commit with correct hash for 'yes'
        await appendBallotCommitted(audit, {
            proposal_id: proposalId,
            voter_did: ALICE,
            commit_hash: VALID_COMMIT_HASH,
            currentTick: 5,
            store,
        });

        const auditLengthBefore = audit.length;

        // Reveal with wrong choice → hash mismatch
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/reveal`,
            payload: { voter_did: ALICE, choice: 'no', nonce: VALID_NONCE, revealed_at_tick: 6 },
        });
        expect(res.statusCode).toBe(422);

        // Assert NO ballot.revealed in audit chain after the 422 response
        const entries = audit.query({ eventType: 'ballot.revealed' });
        expect(entries.length).toBe(0);
        // Audit chain length unchanged (no new entries from the failed reveal)
        expect(audit.length).toBe(auditLengthBefore);
    });

    it('201 happy path — reveal ballot', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openTestProposal(audit, store);
        await appendBallotCommitted(audit, {
            proposal_id: proposalId,
            voter_did: ALICE,
            commit_hash: VALID_COMMIT_HASH,
            currentTick: 5,
            store,
        });
        const res = await app.inject({
            method: 'POST',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/reveal`,
            payload: { voter_did: ALICE, choice: 'yes', nonce: VALID_NONCE, revealed_at_tick: 6 },
        });
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body) as { proposal_id: string; voter_did: string; choice: string };
        expect(body.proposal_id).toBe(proposalId);
        expect(body.voter_did).toBe(ALICE);
        expect(body.choice).toBe('yes');
    });
});
