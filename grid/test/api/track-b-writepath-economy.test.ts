/**
 * Track B (Round 2) — authenticated write-path economic invariant.
 *
 * The existing community-route.test.ts mocks `registry.transferWei`, so it never checks
 * that money is actually conserved (founder debited, treasury credited, nothing created or
 * destroyed). This suite wires a REAL NousRegistry with seeded balances and asserts the
 * Bios sybil-cost conservation on POST /api/v1/community/found — the invariant a live
 * authenticated founder exercises. Auth is injected as a civic_member DIDContext (the same
 * tier a real EdDSA Brain-JWT resolves to via tryDid); the DB write is mocked (hermetic).
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { registerCommunityRoutes } from '../../src/api/routes/community.js';
import { TREASURY_DID } from '../../src/api/routes/registry.js';
import { FOUND_WEI_COST } from '../../src/community/types.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';

const FOUNDER = 'did:civic:noesis:r2-econ-founder';
const CHARTER = { membership: 'open', subgovernance: 'founder_led', conduct_rules: 'be kind', exit_terms: 'leave anytime' };

/** Spawn a DID into a real registry with a starting balance (unique name per call). */
function seed(registry: NousRegistry, did: string, name: string, wei: number): void {
    registry.spawn({ did, name, publicKey: `pk-${name}`, region: 'agora' } as never, 'genesis.noesis', 1, wei);
}

function buildApp(
    registry: NousRegistry,
    ctx: DIDContext | null,
    opts: { failInsert?: boolean } = {},
): { app: FastifyInstance; audit: AuditChain } {
    // found() persists via a getConnection transaction (Option A). failInsert makes the
    // transactional INSERT throw, exercising the DB-failure path.
    const conn = {
        beginTransaction: vi.fn(),
        query: opts.failInsert
            ? vi.fn().mockRejectedValue(new Error('ER_LOCK_DEADLOCK: simulated DB failure'))
            : vi.fn().mockResolvedValue([[], {}]),
        commit: vi.fn(),
        rollback: vi.fn(),
        release: vi.fn(),
    };
    const pool = {
        query: vi.fn().mockResolvedValue([[] as RowDataPacket[], {}]),
        getConnection: vi.fn(async () => conn),
    } as unknown as Pool;
    const audit = new AuditChain();
    const services = { gridName: 'genesis', currentTick: () => 5, pool, audit, registry } as unknown as GridServices;
    const app = Fastify({ logger: false });
    app.addHook('onRequest', async (req) => { req.didContext = ctx ?? undefined; });
    registerCommunityRoutes(app, services);
    return { app, audit };
}

describe('Track B (Round 2) — community/found wei conservation', () => {
    it('201: founder debited FOUND_WEI_COST, treasury credited, total unchanged (no money created)', async () => {
        const registry = new NousRegistry();
        seed(registry, FOUNDER, 'r2founder', FOUND_WEI_COST * 3);
        seed(registry, TREASURY_DID, 'r2treasury', 0);
        const totalBefore = registry.get(FOUNDER)!.balance_wei + registry.get(TREASURY_DID)!.balance_wei;

        const { app } = buildApp(registry, { did: FOUNDER, tier: 'civic_member' });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/community/found',
            payload: { name: 'Econ Test', purpose: 'wei conservation', charter: CHARTER },
        });
        expect(res.statusCode).toBe(201);

        const founderBal = registry.get(FOUNDER)!.balance_wei;
        const treasuryBal = registry.get(TREASURY_DID)!.balance_wei;
        expect(founderBal).toBe(FOUND_WEI_COST * 3 - FOUND_WEI_COST);
        expect(treasuryBal).toBe(FOUND_WEI_COST);
        expect(founderBal + treasuryBal).toBe(totalBefore); // conservation
        await app.close();
    });

    it('402 insufficient_wei when the founder cannot cover the sybil cost — and NO wei moves', async () => {
        const registry = new NousRegistry();
        seed(registry, FOUNDER, 'r2founder-broke', FOUND_WEI_COST - 1);
        seed(registry, TREASURY_DID, 'r2treasury-b', 0);

        const { app } = buildApp(registry, { did: FOUNDER, tier: 'civic_member' });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/community/found',
            payload: { name: 'Broke', purpose: 'x', charter: CHARTER },
        });
        expect(res.statusCode).toBe(402);
        expect(res.json().error).toBe('insufficient_wei');
        expect(registry.get(FOUNDER)!.balance_wei).toBe(FOUND_WEI_COST - 1); // untouched
        expect(registry.get(TREASURY_DID)!.balance_wei).toBe(0);
        await app.close();
    });

    it('emits a community.* audit event on a successful found', async () => {
        const registry = new NousRegistry();
        seed(registry, FOUNDER, 'r2founder-audit', FOUND_WEI_COST * 2);
        seed(registry, TREASURY_DID, 'r2treasury-a', 0);

        const { app, audit } = buildApp(registry, { did: FOUNDER, tier: 'civic_member' });
        await app.inject({
            method: 'POST', url: '/api/v1/community/found',
            payload: { name: 'Audited', purpose: 'x', charter: CHARTER },
        });
        const events = (audit as unknown as { all: () => Array<{ eventType: string }> }).all();
        expect(events.some((e) => e.eventType.startsWith('community.'))).toBe(true);
        await app.close();
    });

    it('DB persistence failure leaves the founder’s balance untouched (Option A: charge only after commit)', async () => {
        const registry = new NousRegistry();
        seed(registry, FOUNDER, 'r2founder-dbfail', FOUND_WEI_COST * 3);
        seed(registry, TREASURY_DID, 'r2treasury-df', 0);
        const founderBefore = registry.get(FOUNDER)!.balance_wei;

        const { app } = buildApp(registry, { did: FOUNDER, tier: 'civic_member' }, { failInsert: true });
        const res = await app.inject({
            method: 'POST', url: '/api/v1/community/found',
            payload: { name: 'DB Fail', purpose: 'persist should roll back', charter: CHARTER },
        });
        // found() rolls back + rethrows → route returns 503; the wei transfer runs only
        // AFTER a successful commit, so a failed persist never debits the founder.
        expect(res.statusCode).toBe(503);
        expect(registry.get(FOUNDER)!.balance_wei).toBe(founderBefore);
        expect(registry.get(TREASURY_DID)!.balance_wei).toBe(0);
        await app.close();
    });
});
