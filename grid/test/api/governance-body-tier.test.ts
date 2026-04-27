/**
 * Tests for GET /api/v1/governance/proposals/:id/body — H2+ tier gate.
 *
 * Phase 12 Wave 3 — VOTE-01 / D-12-04 / D-12-09.
 *
 * Cases:
 *   - 403 H1 — tier too low, response contains NO body_text, NO body key
 *   - 200 H2 — can read body_text
 *   - 200 H5 — can read body_text
 *   - 401 missing x-operator-tier header
 *   - 404 unknown proposal
 */

import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { createInMemoryStore } from '../../src/governance/store.js';
import { appendProposalOpened } from '../../src/governance/appendProposalOpened.js';
import { registerGovernanceRoutes } from '../../src/api/governance/index.js';
import type { GovernanceStore } from '../../src/governance/store.js';

const ALICE = 'did:noesis:alice';

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

async function openProposal(audit: AuditChain, store: GovernanceStore): Promise<string> {
    const result = await appendProposalOpened(audit, {
        proposer_did: ALICE,
        body_text: 'This is the full body text of the proposal.',
        deadline_tick: 100,
        currentTick: 1,
        store,
    });
    return result.proposal_id;
}

describe('GET /api/v1/governance/proposals/:id/body', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        await app?.close();
    });

    it('403 H1 — tier too low, response has NO body_text', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openProposal(audit, store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/body`,
            headers: { 'x-operator-tier': '1' },
        });
        expect(res.statusCode).toBe(403);
        // Confirm response body contains no body_text key and no body key
        expect(res.body).not.toContain('body_text');
        expect(res.body).not.toContain('"body"');
        const parsed = JSON.parse(res.body) as Record<string, unknown>;
        expect(parsed).not.toHaveProperty('body_text');
        expect(parsed).not.toHaveProperty('body');
        expect(parsed['error']).toBe('tier_too_low');
    });

    it('200 H2 — can read body_text', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openProposal(audit, store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/body`,
            headers: { 'x-operator-tier': '2' },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as Record<string, unknown>;
        expect(body['body_text']).toBe('This is the full body text of the proposal.');
        expect(body['proposal_id']).toBe(proposalId);
    });

    it('200 H5 — can also read body_text', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openProposal(audit, store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/body`,
            headers: { 'x-operator-tier': '5' },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as Record<string, unknown>;
        expect(body['body_text']).toBe('This is the full body text of the proposal.');
    });

    it('401 missing x-operator-tier header', async () => {
        const { app: a, audit, store } = await buildApp();
        app = a;
        const proposalId = await openProposal(audit, store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/body`,
            // no header
        });
        expect(res.statusCode).toBe(401);
    });

    it('404 unknown proposal', async () => {
        const { app: a } = await buildApp();
        app = a;
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/governance/proposals/no-such-id/body',
            headers: { 'x-operator-tier': '2' },
        });
        expect(res.statusCode).toBe(404);
    });
});
