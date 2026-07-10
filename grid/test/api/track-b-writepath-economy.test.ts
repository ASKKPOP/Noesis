/**
 * Track B (Round 2) — authenticated write-path economic invariant.
 *
 * Asserts Bios sybil-cost conservation on POST /api/v1/community/found — the invariant a
 * live authenticated founder exercises. Phase 62.5-02 (Issue #9) moved the charge onto the
 * unified in-DB ledger (nous_accounts → civic_treasury), so this suite wires a stateful fake
 * accounts pool with a seeded founder balance and asserts the money moves and is conserved on
 * that ledger (founder debited, treasury credited, nothing created or destroyed). Auth is
 * injected as a civic_member DIDContext (the same tier a real EdDSA Brain-JWT resolves to via
 * tryDid); the community-store DB write is stubbed by the fake pool (hermetic).
 */
import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { registerCommunityRoutes } from '../../src/api/routes/community.js';
import { FOUND_WEI_COST } from '../../src/community/types.js';
import { makeAccountsPool, type AccountsPool } from '../helpers/accounts-pool.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';

const FOUNDER = 'did:civic:noesis:r2-econ-founder';
const CHARTER = { membership: 'open', subgovernance: 'founder_led', conduct_rules: 'be kind', exit_terms: 'leave anytime' };

function buildApp(
    accts: AccountsPool,
    ctx: DIDContext | null,
): { app: FastifyInstance; audit: AuditChain } {
    const audit = new AuditChain();
    const services = { gridName: 'genesis', currentTick: () => 5, pool: accts.pool, audit } as unknown as GridServices;
    const app = Fastify({ logger: false });
    app.addHook('onRequest', async (req) => { req.didContext = ctx ?? undefined; });
    registerCommunityRoutes(app, services);
    return { app, audit };
}

describe('Track B (Round 2) — community/found wei conservation', () => {
    it('201: founder debited FOUND_WEI_COST, treasury credited, total unchanged (no money created)', async () => {
        const accts = makeAccountsPool();
        accts.seedAccount(FOUNDER, FOUND_WEI_COST * 3);
        const totalBefore = accts.balanceOf(FOUNDER) + accts.treasuryOf();

        const { app } = buildApp(accts, { did: FOUNDER, tier: 'civic_member' });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/community/found',
            payload: { name: 'Econ Test', purpose: 'wei conservation', charter: CHARTER },
        });
        expect(res.statusCode).toBe(201);

        const founderBal = accts.balanceOf(FOUNDER);
        const treasuryBal = accts.treasuryOf();
        expect(founderBal).toBe(BigInt(FOUND_WEI_COST * 3 - FOUND_WEI_COST));
        expect(treasuryBal).toBe(BigInt(FOUND_WEI_COST));
        expect(founderBal + treasuryBal).toBe(totalBefore); // conservation
        await app.close();
    });

    it('402 insufficient_wei when the founder cannot cover the sybil cost — and NO wei moves', async () => {
        const accts = makeAccountsPool();
        accts.seedAccount(FOUNDER, FOUND_WEI_COST - 1);

        const { app } = buildApp(accts, { did: FOUNDER, tier: 'civic_member' });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/community/found',
            payload: { name: 'Broke', purpose: 'x', charter: CHARTER },
        });
        expect(res.statusCode).toBe(402);
        expect(res.json().error).toBe('insufficient_wei');
        expect(accts.balanceOf(FOUNDER)).toBe(BigInt(FOUND_WEI_COST - 1)); // untouched
        expect(accts.treasuryOf()).toBe(0n);
        await app.close();
    });

    it('emits a community.* audit event on a successful found', async () => {
        const accts = makeAccountsPool();
        accts.seedAccount(FOUNDER, FOUND_WEI_COST * 2);

        const { app, audit } = buildApp(accts, { did: FOUNDER, tier: 'civic_member' });
        await app.inject({
            method: 'POST', url: '/api/v1/community/found',
            payload: { name: 'Audited', purpose: 'x', charter: CHARTER },
        });
        const events = (audit as unknown as { all: () => Array<{ eventType: string }> }).all();
        expect(events.some((e) => e.eventType.startsWith('community.'))).toBe(true);
        await app.close();
    });

    it('DB persistence failure leaves the founder’s balance untouched (charge only after commit)', async () => {
        // The community-store INSERT throws; found() rolls back + rethrows → route returns 503;
        // the wei charge runs only AFTER a successful found(), so a failed persist never debits.
        const accts = makeAccountsPool({
            otherQuery: () => { throw new Error('ER_LOCK_DEADLOCK: simulated DB failure'); },
        });
        accts.seedAccount(FOUNDER, FOUND_WEI_COST * 3);
        const founderBefore = accts.balanceOf(FOUNDER);

        const { app } = buildApp(accts, { did: FOUNDER, tier: 'civic_member' });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/community/found',
            payload: { name: 'DB Fail', purpose: 'persist should roll back', charter: CHARTER },
        });
        expect(res.statusCode).toBe(503);
        expect(accts.balanceOf(FOUNDER)).toBe(founderBefore);
        expect(accts.treasuryOf()).toBe(0n);
        await app.close();
    });
});
