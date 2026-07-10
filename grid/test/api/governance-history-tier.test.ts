/**
 * Tests for GET /api/v1/governance/proposals/:id/ballots/history — H5-only operator read.
 *
 * Phase 12 Wave 3 — VOTE-01 / D-12-09.
 *
 * SECURITY 2026-07-10: tier is now server-trusted via the operator_only gate
 * (resolved from the Portal-session DID against the GRID_OPERATOR_DIDS allowlist),
 * NOT the spoofable x-operator-tier header. Ballot history touches VOTE-05 secrecy,
 * so the forged-header REGRESSION case is load-bearing: it proves an anonymous caller
 * can no longer read the reveal history by asserting a tier header.
 *
 * Cases:
 *   - 401 anonymous / 401 forged-header REGRESSION (no voter_did leak)
 *   - 403 not_operator — logged-in DID not on the allowlist
 *   - 403 tier_too_low — operator below H5, response contains NO voter_did
 *   - 200 H5 — returns revealed ballot list; choices only for revealed ballots
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
import { appendBallotCommitted } from '../../src/governance/appendBallotCommitted.js';
import { appendBallotRevealed } from '../../src/governance/appendBallotRevealed.js';
import { computeCommitHash } from '../../src/governance/commit-reveal.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import type { OperatorGrant } from '../../src/api/preHandlers/operatorAuth.js';
import type { GovernanceStore } from '../../src/governance/store.js';
import type { NousRegistry } from '../../src/registry/registry.js';
import type { FastifyInstance } from 'fastify';

const ALICE = 'did:noesis:alice';
const BOB = 'did:noesis:bob';
const VALID_NONCE = '00000000000000000000000000000000';
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
    const { proposal_id } = await appendProposalOpened(audit, {
        proposer_did: ALICE,
        body_text: 'A proposal.',
        deadline_tick: 100,
        currentTick: 1,
        store,
    });
    return proposal_id;
}

describe('GET /api/v1/governance/proposals/:id/ballots/history — server-trusted H5 read', () => {
    let app: FastifyInstance;
    let clock: WorldClock;

    afterEach(async () => {
        await app?.close();
        clock?.stop();
    });

    it('401 — anonymous caller (no Portal session), no voter_did leak', async () => {
        const t = buildApp(allowAtTier(5)); app = t.app; clock = t.clock;
        await app.ready();
        const proposalId = await openProposal(t.audit, t.store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/history`,
        });
        expect(res.statusCode).toBe(401);
        expect(res.body).not.toContain('voter_did');
    });

    it('401 REGRESSION — forged x-operator-tier:5 header with NO session (VOTE-05 secrecy hole closed)', async () => {
        const t = buildApp(allowAtTier(5)); app = t.app; clock = t.clock;
        await app.ready();
        const proposalId = await openProposal(t.audit, t.store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/history`,
            headers: { 'x-operator-tier': '5', 'x-operator-id': OP_ID },
        });
        expect(res.statusCode).toBe(401);
        expect(res.statusCode).not.toBe(200);
        expect(res.body).not.toContain('voter_did');
    });

    it('403 not_operator — logged-in DID not on the allowlist', async () => {
        const t = buildApp(allowAtTier(5)); app = t.app; clock = t.clock;
        await app.ready();
        const proposalId = await openProposal(t.audit, t.store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/history`,
            cookies: { [COOKIE_NAME]: await cookie(STRANGER_DID) },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('not_operator');
        expect(res.body).not.toContain('voter_did');
    });

    it('403 tier_too_low — operator at H4 (below H5), response contains NO voter_did', async () => {
        const t = buildApp(allowAtTier(4)); app = t.app; clock = t.clock;
        await app.ready();
        const proposalId = await openProposal(t.audit, t.store);
        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposalId}/ballots/history`,
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
        });
        expect(res.statusCode).toBe(403);
        expect(res.body).not.toContain('voter_did');
        const parsed = JSON.parse(res.body) as Record<string, unknown>;
        expect(parsed['error']).toBe('tier_too_low');
    });

    it('200 H5 — returns ballot history; choice=null for committed-but-unrevealed', async () => {
        const t = buildApp(allowAtTier(5)); app = t.app; clock = t.clock;
        await app.ready();
        const proposal_id = await openProposal(t.audit, t.store);

        // Alice commits and reveals
        const aliceHash = computeCommitHash('yes', VALID_NONCE, ALICE);
        await appendBallotCommitted(t.audit, {
            proposal_id,
            voter_did: ALICE,
            commit_hash: aliceHash,
            currentTick: 5,
            store: t.store,
        });
        await appendBallotRevealed(t.audit, {
            proposal_id,
            voter_did: ALICE,
            choice: 'yes',
            nonce: VALID_NONCE,
            currentTick: 6,
            store: t.store,
        });

        // Bob commits but does NOT reveal
        const bobHash = computeCommitHash('no', VALID_NONCE, BOB);
        await appendBallotCommitted(t.audit, {
            proposal_id,
            voter_did: BOB,
            commit_hash: bobHash,
            currentTick: 5,
            store: t.store,
        });

        const res = await app.inject({
            method: 'GET',
            url: `/api/v1/governance/proposals/${proposal_id}/ballots/history`,
            cookies: { [COOKIE_NAME]: await cookie(OPERATOR_DID) },
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
