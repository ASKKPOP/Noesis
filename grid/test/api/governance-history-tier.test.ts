/**
 * Tests for GET /api/v1/governance/proposals/:id/ballots/history — H5 only.
 *
 * Phase 12 Wave 3 — VOTE-01 / D-12-09.
 *
 * Cases:
 *   - 403 H1 — tier too low, response contains NO voter_did
 *   - 403 H4 — tier too low
 *   - 200 H5 — returns revealed ballot list; choices only for revealed ballots
 *   - response shape includes only revealed ballots' choices, never plaintext body
 */

import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { createInMemoryStore } from '../../src/governance/store.js';
import { appendProposalOpened } from '../../src/governance/appendProposalOpened.js';
import { appendBallotCommitted } from '../../src/governance/appendBallotCommitted.js';
import { appendBallotRevealed } from '../../src/governance/appendBallotRevealed.js';
import { computeCommitHash } from '../../src/governance/commit-reveal.js';
import { registerGovernanceRoutes } from '../../src/api/governance/index.js';
import type { GovernanceStore } from '../../src/governance/store.js';

const ALICE = 'did:noesis:alice';
const BOB = 'did:noesis:bob';
const VALID_NONCE = '00000000000000000000000000000000';

function makeRegistry() {
    return {
        get: (did: string) => ({ did, status: 'active' }),
        has: (_did: string) => true,
        isTombstoned: (_did: string) => false,
        count: 3,
        active: () => [],
    };
}

function makeLogos() {
    return { addLaw: () => {}, activeLaws: () => [] };
}

async function buildApp(): Promise<{ app: FastifyInstance; audit: AuditChain; store: GovernanceStore }> {
    const app = Fastify({ logger: false });
    const audit = new AuditChain();
    const store = createInMemoryStore('test-grid');
    const registry = makeRegistry();
    const logos = makeLogos();

    await registerGovernanceRoutes(app, { audit, store, registry, logos });
    await app.ready();
    return { app, audit, store };
}

describe('GET /api/v1/governance/proposals/:id/ballots/history', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        await app?.close();
    });

    it('403 H1 — tier too low, response contains NO voter_did', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const { proposal_id } = await appendProposalOpened(audit, {
            proposer_did: ALICE,
            body_text: 'A proposal.',
            deadline_tick: 100,
            currentTick: 1,
            store,
        });
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposal_id}/ballots/history`,
            headers: { 'x-operator-tier': '1' },
        });
        expect(res.statusCode).toBe(403);
        // H1 response MUST NOT contain voter_did
        expect(res.body).not.toContain('voter_did');
        const parsed = JSON.parse(res.body) as Record<string, unknown>;
        expect(parsed['error']).toBe('tier_too_low');
    });

    it('403 H4 — tier too low', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const { proposal_id } = await appendProposalOpened(audit, {
            proposer_did: ALICE,
            body_text: 'A proposal.',
            deadline_tick: 100,
            currentTick: 1,
            store,
        });
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposal_id}/ballots/history`,
            headers: { 'x-operator-tier': '4' },
        });
        expect(res.statusCode).toBe(403);
    });

    it('200 H5 — returns ballot history; choice=null for committed-but-unrevealed', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;

        const { proposal_id } = await appendProposalOpened(audit, {
            proposer_did: ALICE,
            body_text: 'A proposal.',
            deadline_tick: 100,
            currentTick: 1,
            store,
        });

        // Alice commits and reveals
        const aliceHash = computeCommitHash('yes', VALID_NONCE, ALICE);
        await appendBallotCommitted(audit, {
            proposal_id,
            voter_did: ALICE,
            commit_hash: aliceHash,
            currentTick: 5,
            store,
        });
        await appendBallotRevealed(audit, {
            proposal_id,
            voter_did: ALICE,
            choice: 'yes',
            nonce: VALID_NONCE,
            currentTick: 6,
            store,
        });

        // Bob commits but does NOT reveal
        const bobHash = computeCommitHash('no', VALID_NONCE, BOB);
        await appendBallotCommitted(audit, {
            proposal_id,
            voter_did: BOB,
            commit_hash: bobHash,
            currentTick: 5,
            store,
        });

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposal_id}/ballots/history`,
            headers: { 'x-operator-tier': '5' },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as {
            ballots: Array<{ voter_did: string; committed_at_tick: number; revealed_at_tick: number | null; choice: string | null }>;
        };
        expect(body.ballots).toHaveLength(2);

        const alice = body.ballots.find(b => b.voter_did === ALICE);
        expect(alice).toBeDefined();
        expect(alice!.choice).toBe('yes');
        expect(alice!.revealed_at_tick).toBe(6);

        const bob = body.ballots.find(b => b.voter_did === BOB);
        expect(bob).toBeDefined();
        expect(bob!.choice).toBeNull();

        // Confirm response contains NO body_text (privacy invariant)
        expect(res.body).not.toContain('body_text');
        expect(res.body).not.toContain('This is the full');
    });
});
