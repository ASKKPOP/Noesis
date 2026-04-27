/**
 * Tests for POST /api/v1/governance/proposals — open a proposal.
 *
 * Phase 12 Wave 3 — VOTE-01 / VOTE-05 / D-12-01 / D-12-04 / D-12-05.
 *
 * Cases:
 *   - 400 bad DID
 *   - 400 bad shape (missing required fields)
 *   - 400 quorum/supermajority out of range
 *   - 404 unknown Nous (not in registry)
 *   - 410 tombstoned proposer
 *   - 201 happy path returns valid UUID v4 proposal_id
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { createInMemoryStore } from '../../src/governance/store.js';
import { registerGovernanceRoutes } from '../../src/api/governance/index.js';

const ALICE = 'did:noesis:alice';

function makeRegistry(opts: { hasDid?: boolean; tombstoned?: boolean } = {}) {
    const { hasDid = true, tombstoned = false } = opts;
    return {
        get: (did: string) => {
            if (!hasDid) return undefined;
            return { did, status: tombstoned ? 'deleted' : 'active', deletedAtTick: tombstoned ? 5 : undefined };
        },
        has: (_did: string) => hasDid,
        isTombstoned: (_did: string) => tombstoned,
        count: 3,
        active: () => [],
    };
}

function makeLogos() {
    return { addLaw: () => {}, activeLaws: () => [] };
}

function makeAudit() {
    return new AuditChain();
}

async function buildApp(opts: { hasDid?: boolean; tombstoned?: boolean } = {}): Promise<FastifyInstance> {
    const app = Fastify({ logger: false });
    const audit = makeAudit();
    const store = createInMemoryStore('test-grid');
    const registry = makeRegistry(opts);
    const logos = makeLogos();

    await registerGovernanceRoutes(app, { audit, store, registry, logos });
    await app.ready();
    return app;
}

describe('POST /api/v1/governance/proposals', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        await app?.close();
    });

    it('400 bad DID — fails DID regex', async () => {
        app = await buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/governance/proposals',
            payload: {
                proposer_did: 'not-a-did',
                body_text: 'A valid proposal.',
                deadline_tick: 10,
                opened_at_tick: 1,
            },
        });
        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body) as { error: string };
        expect(body.error).toBeTruthy();
    });

    it('400 bad shape — missing body_text', async () => {
        app = await buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/governance/proposals',
            payload: {
                proposer_did: ALICE,
                deadline_tick: 10,
                opened_at_tick: 1,
                // missing body_text
            },
        });
        expect(res.statusCode).toBe(400);
    });

    it('400 quorum_pct out of range (0)', async () => {
        app = await buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/governance/proposals',
            payload: {
                proposer_did: ALICE,
                body_text: 'A proposal.',
                deadline_tick: 10,
                opened_at_tick: 1,
                quorum_pct: 0,
                supermajority_pct: 67,
            },
        });
        expect(res.statusCode).toBe(400);
    });

    it('400 supermajority_pct out of range (101)', async () => {
        app = await buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/governance/proposals',
            payload: {
                proposer_did: ALICE,
                body_text: 'A proposal.',
                deadline_tick: 10,
                opened_at_tick: 1,
                quorum_pct: 50,
                supermajority_pct: 101,
            },
        });
        expect(res.statusCode).toBe(400);
    });

    it('400 deadline_tick <= opened_at_tick', async () => {
        app = await buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/governance/proposals',
            payload: {
                proposer_did: ALICE,
                body_text: 'A proposal.',
                deadline_tick: 5,
                opened_at_tick: 5,
            },
        });
        expect(res.statusCode).toBe(400);
    });

    it('400 body_text empty', async () => {
        app = await buildApp();
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/governance/proposals',
            payload: {
                proposer_did: ALICE,
                body_text: '',
                deadline_tick: 10,
                opened_at_tick: 1,
            },
        });
        expect(res.statusCode).toBe(400);
    });

    it('404 unknown Nous — not in registry', async () => {
        app = await buildApp({ hasDid: false });
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/governance/proposals',
            payload: {
                proposer_did: ALICE,
                body_text: 'A proposal.',
                deadline_tick: 10,
                opened_at_tick: 1,
            },
        });
        expect(res.statusCode).toBe(404);
        const body = JSON.parse(res.body) as { error: string };
        expect(body.error).toBeTruthy();
    });

    it('410 tombstoned proposer', async () => {
        app = await buildApp({ hasDid: true, tombstoned: true });
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/governance/proposals',
            payload: {
                proposer_did: ALICE,
                body_text: 'A proposal.',
                deadline_tick: 10,
                opened_at_tick: 1,
            },
        });
        expect(res.statusCode).toBe(410);
        const body = JSON.parse(res.body) as { error: string };
        expect(body.error).toBeTruthy();
    });

    it('201 happy path returns valid UUID v4 proposal_id', async () => {
        app = await buildApp({ hasDid: true, tombstoned: false });
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/governance/proposals',
            payload: {
                proposer_did: ALICE,
                body_text: 'A governance proposal for collective decision.',
                deadline_tick: 10,
                opened_at_tick: 1,
            },
        });
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body) as { proposal_id: string; title_hash: string; deadline_tick: number };
        // UUID v4 pattern
        expect(body.proposal_id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
        expect(body.title_hash).toHaveLength(32);
        expect(body.deadline_tick).toBe(10);
    });
});
