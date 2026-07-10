/**
 * Phase 37b Type B Registry (Plan 1) — α charter + β sponsor routes.
 */
import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { registerRegistryTypeBRoutes } from '../../src/api/routes/registry-type-b.js';
import { makeAccountsPool } from '../helpers/accounts-pool.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import { AuditChain } from '../../src/audit/chain.js';

const SPONSOR = 'did:civic:noesis:founder';

// Phase 62.5-02: the refundable bond is charged/refunded on the unified in-DB ledger
// (sponsor ⇄ civic_treasury). `transferOk` now means "the sponsor/treasury are funded":
// true → seed the sponsor account + treasury generously (bond charge & refund succeed);
// false → leave the sponsor unfunded so the bond charge fails (402). The type-b store's
// own queries still resolve via otherQuery returning the caller-supplied `rows`.
function makeApp(rows: unknown[], ctx: DIDContext | null, transferOk = true, tickVal = 999999): FastifyInstance {
    const accts = makeAccountsPool({ otherQuery: () => [rows as RowDataPacket[], {}] });
    if (transferOk) {
        accts.seedAccount(SPONSOR, 1_000_000);
        accts.seedTreasury(1_000_000);
    }
    const services = { gridName: 'genesis', currentTick: () => tickVal, pool: accts.pool, audit: new AuditChain() } as unknown as GridServices;
    const a = Fastify({ logger: false });
    a.addHook('onRequest', async (req) => { req.didContext = ctx ?? undefined; });
    registerRegistryTypeBRoutes(a, services);
    return a;
}
const GOV: DIDContext = { did: 'did:gov:noesis:session', tier: 'government' };
const CIVIC: DIDContext = { did: SPONSOR, tier: 'civic_member' };

describe('Polis-α /charter', () => {
    it('201 files a charter (Foundation)', async () => {
        const a = makeApp([{ n: 0 }], GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/charter', payload: { purpose: 'a librarian', sponsor_did: 'did:civic:noesis:s' } });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('pending_review');
        await a.close();
    });
    it('403 for non-Government', async () => {
        const a = makeApp([{ n: 0 }], CIVIC);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/charter', payload: { purpose: 'x', sponsor_did: 'did:civic:noesis:s' } });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
    it('429 when the quarter limit is hit', async () => {
        const a = makeApp([{ n: 5 }], GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/charter', payload: { purpose: 'x', sponsor_did: 'did:civic:noesis:s' } });
        expect(res.statusCode).toBe(429);
        await a.close();
    });
    it('425 approving before the review window', async () => {
        const a = makeApp([{ ceremony: 'alpha', status: 'pending_review', type_b_did: 'x', sponsor_did: 'did:civic:noesis:s', eligible_tick: 9_999_999 }], GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/charter/req1/approve' });
        expect(res.statusCode).toBe(425);
        await a.close();
    });
});

describe('Polis-β /sponsor', () => {
    it('201 posts a sufficient bond', async () => {
        const a = makeApp([{ n: 0 }], CIVIC, true);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/sponsor', payload: { purpose: 'a maker', bond_amount: 1000 } });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('comment_window');
        await a.close();
    });
    it('400 when the bond is below the required amount', async () => {
        const a = makeApp([{ n: 0 }], CIVIC, true);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/sponsor', payload: { purpose: 'x', bond_amount: 500 } });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('insufficient_bond');
        await a.close();
    });
    it('402 when the sponsor cannot afford the bond', async () => {
        const a = makeApp([{ n: 0 }], CIVIC, false);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/sponsor', payload: { purpose: 'x', bond_amount: 1000 } });
        expect(res.statusCode).toBe(402);
        await a.close();
    });
    it('401 for a non-civic caller', async () => {
        const a = makeApp([{ n: 0 }], GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/sponsor', payload: { purpose: 'x', bond_amount: 1000 } });
        expect(res.statusCode).toBe(401);
        await a.close();
    });
});

const issuedBeta = [{ ceremony: 'beta', status: 'issued', type_b_did: 'did:noesis:nous:typeb:b', sponsor_did: 'did:civic:noesis:founder', eligible_tick: 0, bond_amount: 1000, filed_tick: 0 }];

describe('Plan 2 — bond refund / slash / γ-spawn routes', () => {
    it('201 refunds a bond after 12mo (and settles treasury→sponsor)', async () => {
        const a = makeApp(issuedBeta, CIVIC, true, 99_999_999);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/req1/bond-refund', payload: {} });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('bond_refunded');
        await a.close();
    });
    it('425 refunding before the 12mo window', async () => {
        const a = makeApp([{ ceremony: 'beta', status: 'issued', type_b_did: 'x', sponsor_did: 'did:civic:noesis:founder', eligible_tick: 0, bond_amount: 1000, filed_tick: 0 }], CIVIC, true, 100);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/req1/bond-refund', payload: {} });
        expect(res.statusCode).toBe(425);
        await a.close();
    });
    it('201 slashes a bond (Government)', async () => {
        const a = makeApp(issuedBeta, GOV);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/req1/bond-slash' });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('bond_slashed');
        await a.close();
    });
    it('403 slashing as a non-Government caller', async () => {
        const a = makeApp(issuedBeta, CIVIC);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/req1/bond-slash' });
        expect(res.statusCode).toBe(403);
        await a.close();
    });
    it('🔒 403 forbidden_in_v3.0 for Polis-γ spawn (gated to v3.1+)', async () => {
        const a = makeApp([], CIVIC);
        const res = await a.inject({ method: 'POST', url: '/api/v1/registry/type-b/spawn', payload: { purpose: 'x' } });
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('forbidden_in_v3.0');
        await a.close();
    });
});
