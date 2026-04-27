/**
 * Tests for GET /api/v1/governance/proposals — list proposals (H1+).
 *
 * Phase 12 Wave 3 — VOTE-01 / D-12-09.
 *
 * Cases:
 *   - 200 H1 — returns aggregate counts (no body_text, no per-Nous breakdown)
 *   - response shape is SWR-compatible JSON with proposals array
 *   - no body_text in response at any tier
 *   - no voter_did breakdown in response
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

describe('GET /api/v1/governance/proposals', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        await app?.close();
    });

    it('200 H1 — returns proposals list (aggregate only, no body_text)', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;

        // Open a proposal
        const { proposal_id } = await appendProposalOpened(audit, {
            proposer_did: ALICE,
            body_text: 'This is the secret body of the proposal.',
            deadline_tick: 100,
            currentTick: 1,
            store,
        });

        // Add a commit
        const hash = computeCommitHash('yes', VALID_NONCE, ALICE);
        await appendBallotCommitted(audit, {
            proposal_id,
            voter_did: ALICE,
            commit_hash: hash,
            currentTick: 5,
            store,
        });

        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/governance/proposals',
        });
        expect(res.statusCode).toBe(200);

        const body = JSON.parse(res.body) as {
            proposals: Array<{
                proposal_id: string;
                status: string;
                opened_at_tick: number;
                deadline_tick: number;
                commit_count: number;
                reveal_count: number;
                outcome: string | null;
            }>;
        };

        expect(body.proposals).toHaveLength(1);
        const p = body.proposals[0];
        expect(p.proposal_id).toBe(proposal_id);
        expect(p.status).toBe('open');
        expect(p.deadline_tick).toBe(100);
        expect(p.commit_count).toBe(1);
        expect(p.reveal_count).toBe(0);

        // CRITICAL: No body_text in any form
        expect(res.body).not.toContain('body_text');
        expect(res.body).not.toContain('secret body');
        expect(res.body).not.toContain('"body"');

        // No per-Nous voter breakdown
        expect(res.body).not.toContain('voter_did');
    });

    it('200 H1 — empty list when no proposals', async () => {
        const { app: a } = await buildApp();
        app = a;
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/governance/proposals',
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as { proposals: unknown[] };
        expect(body.proposals).toHaveLength(0);
    });
});
