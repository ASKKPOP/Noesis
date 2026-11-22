/**
 * A reclaimed parcel must not break the public parcel feed.
 *
 * When a parcel is reclaimed for unpaid upkeep its structure is razed. The registry
 * used to mark that with `structure = undefined`, while every reader tests
 * `structure === null`: the public feed then read `.type` of undefined and answered
 * 500 for EVERY parcel — the world map reads the same feed — until the Grid restarted.
 *
 * Real ParcelRegistry + real routes; the store is a mock (no DB in this suite).
 */
import { describe, it, expect, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { registerCivicParcelRoutes } from '../../src/api/routes/civic-parcels.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import type { ParcelStore } from '../../src/civic/parcel-store.js';
import '../../src/api/preHandlers/types.js';

const OWNER = 'did:civic:noesis:alice';
const ADDR = 'genesis:residential:0001';
const OTHER = 'genesis:residential:0002';

function buildApp(ctx?: DIDContext): { app: FastifyInstance; registry: ParcelRegistry } {
    const registry = new ParcelRegistry('genesis');
    registry.seedZone({ zoneId: 'residential', count: 3, priceWei: 400, ring: 3 });
    const services: Partial<GridServices> = {
        audit: new AuditChain(),
        gridName: 'genesis',
        currentTick: () => 100,
        registry: new NousRegistry(),
        parcels: { registry, store: {} as unknown as ParcelStore },
    };
    const app = Fastify({ logger: false });
    if (ctx) app.addHook('onRequest', async (req) => { req.didContext = ctx; });
    registerCivicParcelRoutes(app, services as GridServices);
    return { app, registry };
}

/** Alice buys, builds a home, furnishes it, then misses three upkeep periods. */
function ownBuildAndLose(registry: ParcelRegistry): void {
    expect(registry.purchase(ADDR, OWNER, 10_000).ok).toBe(true);
    expect(registry.build(ADDR, OWNER, { name: 'Oikos', type: 'home', visibility: 'open' }, 5).ok).toBe(true);
    registry.extendInterior(ADDR, OWNER, { area: 'bedroom', kind: 'bed' });
    expect(registry.advanceCondition(ADDR)).toBe('worn');
    expect(registry.advanceCondition(ADDR)).toBe('derelict');
    expect(registry.advanceCondition(ADDR)).toBe('reclaimed');
}

describe('reclaimed parcel — registry state', () => {
    it('a razed structure is null, like any parcel with nothing built on it', () => {
        const { registry } = buildApp();
        ownBuildAndLose(registry);
        expect(registry.get(ADDR)!.structure).toBeNull();
    });

    it('join and entry-policy answer no_structure instead of throwing', () => {
        const { registry } = buildApp();
        ownBuildAndLose(registry);
        expect(registry.join(ADDR, 'did:civic:noesis:bob')).toEqual({ ok: false, reason: 'no_structure' });
        expect(registry.get(ADDR)!.ownerDid).toBeNull();
        expect(registry.setEntryPolicy(ADDR, OWNER, { policy: 'open', allowlist: [] }))
            .toEqual({ ok: false, reason: 'not_owner' });       // the former owner owns nothing here
    });
});

describe('reclaimed parcel — public routes keep answering', () => {
    it('GET /api/v1/civic/parcels is 200 and lists every parcel', async () => {
        const { app, registry } = buildApp();
        await app.ready();
        ownBuildAndLose(registry);

        const res = await app.inject({ method: 'GET', url: '/api/v1/civic/parcels' });
        expect(res.statusCode).toBe(200);
        const parcels = res.json().parcels as Array<{ id: string; structure: unknown; status: string }>;
        expect(parcels).toHaveLength(3);
        const reclaimed = parcels.find((p) => p.id === ADDR)! as unknown as Record<string, unknown>;
        expect(reclaimed.structure).toBeNull();
        expect(reclaimed.status).toBe('available');          // back in the pool, for sale again
        expect(reclaimed.owner_civic_did_hash).toBeNull();
        expect(reclaimed.condition).toBe('maintained');
        expect(parcels.find((p) => p.id === OTHER)!.status).toBe('available');
        await app.close();
    });

    it('GET /api/v1/civic/parcels/:id is 200 with structure null', async () => {
        const { app, registry } = buildApp();
        await app.ready();
        ownBuildAndLose(registry);
        const res = await app.inject({ method: 'GET', url: `/api/v1/civic/parcels/${ADDR}` });
        expect(res.statusCode).toBe(200);
        expect(res.json().structure).toBeNull();
        await app.close();
    });

    it('GET /api/v1/civic/parcels/:id/interior is 404 no_structure, not 500', async () => {
        const { app, registry } = buildApp();
        await app.ready();
        ownBuildAndLose(registry);
        const res = await app.inject({ method: 'GET', url: `/api/v1/civic/parcels/${ADDR}/interior` });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ error: 'no_structure' });
        await app.close();
    });

    it('no parcel ever leaves the registry with an undefined structure', () => {
        // The registry is the boundary: every reader tests `structure === null`.
        const { registry } = buildApp();
        const raw = registry.get(ADDR)!;
        registry.upsert({ ...raw, structure: undefined as unknown as null });
        expect(registry.get(ADDR)!.structure).toBeNull();
        expect(registry.list().every((p) => p.structure !== undefined)).toBe(true);
    });
});

describe('reclaimed parcel — the database forgets the razed structure', () => {
    it('persistReclaim clears the structure columns, so the structure does not return after a restart', async () => {
        const { ParcelStore } = await import('../../src/civic/parcel-store.js');
        const query = vi.fn(async () => [{ affectedRows: 1 }, []]);
        const store = new ParcelStore({ query } as never);
        const { registry } = buildApp();
        ownBuildAndLose(registry);
        await store.persistReclaim(registry.get(ADDR)!);

        expect(query).toHaveBeenCalledTimes(1);
        const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
        const flat = sql.replace(/\s+/g, ' ');
        // rowToParcel rebuilds a structure whenever name and type are both non-null.
        expect(flat).toContain('structure_name = NULL');
        expect(flat).toContain('structure_type = NULL');
        expect(flat).toContain('structure_interior = NULL');
        expect(flat).toContain('built_at_tick = NULL');
        // No owner, and nothing of the former owner's left to attach to the next structure.
        expect(flat).toContain('owner_civic_did = NULL');
        expect(flat).toContain('acquired_at_tick = NULL');
        expect(flat).toContain('last_upkeep_tick = NULL');
        expect(flat).toContain('bound_shop_id = NULL');
        expect(flat).toContain("entry_policy = 'open'");
        expect(flat).toContain('entry_allowlist = NULL');
        expect(params).toEqual([ADDR]);
    });
});
