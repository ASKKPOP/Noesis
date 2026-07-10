/**
 * Tests for GET /api/v1/governance/proposals/:id/body — H2+ operator read.
 *
 * Phase 12 Wave 3 — VOTE-01 / D-12-04 / D-12-09.
 *
 * SECURITY 2026-07-10: tier is now server-trusted via the operator_only gate
 * (resolved from the Portal-session DID against the GRID_OPERATOR_DIDS allowlist),
 * NOT the spoofable x-operator-tier header. This suite drives the full server so
 * the real gate runs. The forged-header REGRESSION case proves the old hole is shut.
 *
 * Cases:
 *   - 401 anonymous (no session)
 *   - 401 REGRESSION — forged x-operator-tier:5 header, no session (the closed hole)
 *   - 403 not_operator — logged-in DID not on the allowlist
 *   - 403 tier_too_low — operator below H2, response contains NO body_text
 *   - 200 H2 / 200 H5 — operator can read body_text
 *   - 404 unknown proposal
 */

import { describe, it, expect, afterEach } from 'vitest';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { createInMemoryStore } from '../../src/governance/store.js';
import { GovernanceEngine } from '../../src/governance/engine.js';
import { appendProposalOpened } from '../../src/governance/appendProposalOpened.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { OperatorGrant } from '../../src/api/preHandlers/operatorAuth.js';
import type { GovernanceStore } from '../../src/governance/store.js';
import type { NousRegistry } from '../../src/registry/registry.js';
import type { FastifyInstance } from 'fastify';

const ALICE = 'did:noesis:alice';
const OPERATOR_DID = 'did:noesis:human:0xoperator';
const OP_ID = 'op:11111111-1111-4111-8111-111111111111';
const STRANGER_DID = 'did:noesis:human:0xstranger';

const allowAtTier = (tier: number) =>
    new Map<string, OperatorGrant>([[OPERATOR_DID, { operatorId: OP_ID, tier }]]);

function makeRegistry(): NousRegistry {
    return {
        get: (did: string) => ({ did, status: 'active' }),
        has: (_did: string) => true,
        isTombstoned: (_did: string) => false,
        count: 3,
        active: () => [],
    } as unknown as NousRegistry;
}

async function cookie(did: string): Promise<string> {
    const { privateKey } = await keyPairPromise;
    return new SignJWT({ did, grid_name: 'test-grid' })
        .setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
}

function buildApp(allow: Map<string, OperatorGrant>): {
    app: FastifyInstance; audit: AuditChain; store: GovernanceStore; clock: WorldClock;
} {
    const clock = new WorldClock({ tickRateMs: 100_000 });
    const audit = new AuditChain();
    const store = createInMemoryStore('test-grid');
    const registry = makeRegistry();
    const logos = new LogosEngine();
    const engine = new GovernanceEngine(audit, store, registry, logos);
    const app = buildServer({
        clock,
        space: new SpatialMap(),
        logos,
        audit,
        gridName: 'test-grid',
        registry,
        governance: { store, engine },
        operatorAllowlist: allow,
    });
    return { app, audit, store, clock };
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

describe('GET /api/v1/governance/proposals/:id/body — server-trusted operator read', () => {
    let app: FastifyInstance;
    let clock: WorldClock;

    afterEach(async () => {
        await app?.close();
        clock?.stop();
    });

    it('401 — anonymous caller (no Portal session)', async () => {
        const t = buildApp(allowAtTier(2)); app = t.app; clock = t.clock;
        await app.ready();
        const proposalId = await openProposal(t.audit, t.store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/body`,
        });
        expect(res.statusCode).toBe(401);
        expect(res.body).not.toContain('body_text');
    });

    it('401 REGRESSION — forged x-operator-tier:5 header with NO session (the closed hole)', async () => {
        const t = buildApp(allowAtTier(2)); app = t.app; clock = t.clock;
        await app.ready();
        const proposalId = await openProposal(t.audit, t.store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/body`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
        });
        expect(res.statusCode).toBe(401);
        expect(res.statusCode).not.toBe(200);
        expect(res.body).not.toContain('body_text');
    });

    it('403 not_operator — logged-in DID not on the allowlist', async () => {
        const t = buildApp(allowAtTier(2)); app = t.app; clock = t.clock;
        await app.ready();
        const proposalId = await openProposal(t.audit, t.store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/body`,
            cookies: { [COOKIE_NAME]: await cookie(STRANGER_DID) },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('not_operator');
        expect(res.body).not.toContain('body_text');
    });

    it('403 tier_too_low — operator below H2, response has NO body_text', async () => {
        const t = buildApp(allowAtTier(1)); app = t.app; clock = t.clock;
        await app.ready();
        const proposalId = await openProposal(t.audit, t.store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/body`,
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
        });
        expect(res.statusCode).toBe(403);
        const parsed = JSON.parse(res.body) as Record<string, unknown>;
        expect(parsed).not.toHaveProperty('body_text');
        expect(parsed).not.toHaveProperty('body');
        expect(parsed['error']).toBe('tier_too_low');
    });

    it('200 H2 — operator can read body_text', async () => {
        const t = buildApp(allowAtTier(2)); app = t.app; clock = t.clock;
        await app.ready();
        const proposalId = await openProposal(t.audit, t.store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/body`,
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as Record<string, unknown>;
        expect(body['body_text']).toBe('This is the full body text of the proposal.');
        expect(body['proposal_id']).toBe(proposalId);
    });

    it('200 H5 — operator can also read body_text', async () => {
        const t = buildApp(allowAtTier(5)); app = t.app; clock = t.clock;
        await app.ready();
        const proposalId = await openProposal(t.audit, t.store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/body`,
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body) as Record<string, unknown>;
        expect(body['body_text']).toBe('This is the full body text of the proposal.');
    });

    it('404 unknown proposal — operator at H2', async () => {
        const t = buildApp(allowAtTier(2)); app = t.app; clock = t.clock;
        await app.ready();
        const res = await app.inject({
            method: 'GET',
            url: '/api/v1/governance/proposals/no-such-id/body',
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
        });
        expect(res.statusCode).toBe(404);
    });
});
