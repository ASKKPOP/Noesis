/**
 * Roles are saved, and the task board is tied to its parcel.
 *
 * Granting, inviting and revoking used to change memory only: the store had the writers
 * (persistRole / persistRoleRevoke) and nothing called them, so every role was gone after
 * a Grid restart. These tests run the real routes against a real ParcelStore over a small
 * fake of the civic_parcel_roles table, then "restart": a fresh registry hydrated from it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { ParcelStore } from '../../src/civic/parcel-store.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { registerCivicParcelRoutes } from '../../src/api/routes/civic-parcels.js';
import { onUpkeepTick, createUpkeepRegistryFacade } from '../../src/civic/upkeep-scanner.js';
import { UPKEEP_PERIOD_TICKS } from '../../src/civic/founding-law.js';
import { makeCivicDb } from '../helpers/civic-db.js';
import { _resetCowork, allAgreements } from '../../src/civic/cowork.js';
import { _resetLedger } from '../../src/civic/credit-ledger.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import '../../src/api/preHandlers/types.js';

const OWNER = 'did:civic:noesis:alice';
const STAFF = 'did:civic:noesis:bob';
const GUEST = 'did:civic:noesis:carol';
const SHOP = 'genesis:shopping:0001';
const SHOP2 = 'genesis:shopping:0002';
const TICK = 7;

function seededRegistry(): ParcelRegistry {
    const registry = new ParcelRegistry('genesis');
    registry.seedZone({ zoneId: 'shopping', count: 4, priceWei: 400, ring: 2 });
    registry.purchase(SHOP, OWNER, 100_000);
    registry.stampAcquired(SHOP, 1);
    registry.build(SHOP, OWNER, { name: 'Shop One', type: 'shop', visibility: 'open' }, 2);
    registry.purchase(SHOP2, STAFF, 100_000);
    registry.stampAcquired(SHOP2, 1);
    return registry;
}

function buildApp() {
    const audit = new AuditChain();
    const registry = seededRegistry();
    const db = makeCivicDb();
    const table = { row: db.role, failNext: db.failNext, pool: db.pool };
    const store = new ParcelStore(table.pool, 'genesis');
    const accts = db.accts;
    for (const did of [OWNER, STAFF, GUEST]) accts.seedAccount(did, 100_000);
    let ctx: DIDContext | null = { did: OWNER, tier: 'civic_member' };
    const app = Fastify({ logger: false });
    app.addHook('onRequest', async (req) => {
        (req as never as { didContext: DIDContext | null }).didContext = ctx;
    });
    registerCivicParcelRoutes(app, {
        parcels: { registry, store }, registry: new NousRegistry(), audit,
        pool: db.pool, gridName: 'genesis', currentTick: () => TICK,
    } as unknown as GridServices);
    const as = (did: string) => { ctx = { did, tier: 'civic_member' }; };
    const post = (url: string, payload: Record<string, unknown>) => app.inject({ method: 'POST', url, payload });
    /** A Grid restart, as far as roles go: a fresh registry, hydrated from the table. */
    const restart = async () => {
        const fresh = seededRegistry();
        await store.hydrate(fresh);
        return fresh;
    };
    return { app: app as FastifyInstance, audit, registry, store, table, accts, as, post, restart };
}

let h: ReturnType<typeof buildApp>;
beforeEach(() => {
    _resetCowork();
    _resetLedger();
    h = buildApp();
});

describe('roles are saved — a restart keeps them', () => {
    it('a granted role is still held after a restart', async () => {
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        expect(res.statusCode).toBe(200);
        expect(h.table.row(SHOP, STAFF)).toMatchObject({ role: 'staff', granted_by_civic_did: OWNER, granted_tick: TICK, revoked_tick: null });
        expect((await h.restart()).roleOf(SHOP, STAFF)).toBe('staff');
    });

    it('an invited guest is still a guest after a restart', async () => {
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/invite`, { invitee_civic_did: GUEST });
        expect(res.statusCode).toBe(200);
        expect((await h.restart()).roleOf(SHOP, GUEST)).toBe('guest');
    });

    it('a revoked role stays revoked after a restart, and its row is kept as history', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/roles/revoke`, { holder_civic_did: STAFF });
        expect(res.statusCode).toBe(200);
        expect(h.table.row(SHOP, STAFF)).toMatchObject({ role: 'staff', revoked_tick: TICK });
        const fresh = await h.restart();
        expect(fresh.roleOf(SHOP, STAFF)).toBeNull();
        expect(fresh.rolesFor(SHOP)).toHaveLength(1);
    });

    it('trust earned by finished work is still there after a restart', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        const task = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: 50 })).json().task_id;
        h.as(STAFF);
        await h.post(`/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: task });
        h.as(OWNER);
        expect((await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task })).statusCode).toBe(200);
        expect(h.table.row(SHOP, STAFF)!.trust_score).toBe(1);
        expect((await h.restart()).rolesFor(SHOP)[0].trust_score).toBe(1);
    });

    it('a reclaim ends the roles in the database too: none comes back after a restart', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        await h.post(`/api/v1/civic/parcels/${SHOP}/invite`, { invitee_civic_did: GUEST });
        const deps = {
            registry: createUpkeepRegistryFacade(h.registry, h.store),
            audit: h.audit, treasuryDid: 'did:noesis:system:treasury', gridName: 'genesis',
            accountStore: { chargeToTreasury: vi.fn(async () => { throw new Error('insufficient_balance'); }) },
        };
        const reclaimTick = 1 + 2 * UPKEEP_PERIOD_TICKS;
        for (const t of [1, 1 + UPKEEP_PERIOD_TICKS, reclaimTick]) await onUpkeepTick(t, deps as never);
        expect(h.registry.get(SHOP)!.ownerDid).toBeNull();
        expect(h.table.row(SHOP, STAFF)!.revoked_tick).toBe(reclaimTick);
        expect(h.table.row(SHOP, GUEST)!.revoked_tick).toBe(reclaimTick);
        const fresh = await h.restart();
        expect(fresh.roleOf(SHOP, STAFF)).toBeNull();
        expect(fresh.roleOf(SHOP, GUEST)).toBeNull();
    });
});

describe('the task board is tied to its parcel', () => {
    async function staffAndTaskOnShop() {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        return (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: 50 })).json().task_id as string;
    }

    it('a task cannot be claimed through another parcel', async () => {
        const task = await staffAndTaskOnShop();
        h.as(STAFF);                                   // owner of SHOP2, so it has board access there
        const wrong = await h.post(`/api/v1/civic/parcels/${SHOP2}/board/claim`, { task_id: task });
        expect(wrong.statusCode).toBe(404);
        expect(allAgreements().find((a) => a.agreement_id === task)!.status).toBe('posted');
        expect((await h.post(`/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: task })).statusCode).toBe(200);
    });

    it('a task cannot be completed through another parcel, and nothing is recorded against that parcel', async () => {
        const task = await staffAndTaskOnShop();
        h.as(STAFF);
        await h.post(`/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: task });
        h.as(OWNER);
        const before = h.accts.balanceOf(OWNER);
        const wrong = await h.post(`/api/v1/civic/parcels/${SHOP2}/board/complete`, { task_id: task });
        expect(wrong.statusCode).toBe(404);
        expect(h.accts.balanceOf(OWNER)).toBe(before);
        expect(h.audit.query({ eventType: 'zoning.cowork_session' })).toHaveLength(0);
        expect(allAgreements().find((a) => a.agreement_id === task)!.status).toBe('claimed');
    });

    it('a task whose poster no longer runs the place cannot be newly claimed', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        await h.post(`/api/v1/civic/parcels/${SHOP}/invite`, { invitee_civic_did: GUEST });
        h.as(STAFF);
        const task = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'paint', pay_bios: 30 })).json().task_id;
        h.as(OWNER);
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles/revoke`, { holder_civic_did: STAFF });
        h.as(GUEST);
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: task });
        expect(res.statusCode).toBe(409);
        expect(res.json()).toEqual({ error: 'task_host_left' });
        expect(allAgreements().find((a) => a.agreement_id === task)!.status).toBe('posted');
    });

    it('work already claimed is still paid when the poster has since lost the role', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        await h.post(`/api/v1/civic/parcels/${SHOP}/invite`, { invitee_civic_did: GUEST });
        h.as(STAFF);
        const task = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'paint', pay_bios: 30 })).json().task_id;
        h.as(GUEST);
        await h.post(`/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: task });
        h.as(OWNER);
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles/revoke`, { holder_civic_did: STAFF });
        h.as(STAFF);
        const before = h.accts.balanceOf(GUEST);
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task });
        expect(res.statusCode).toBe(200);
        expect(h.accts.balanceOf(GUEST)).toBe(before + 30n);
    });
});

describe('roles are saved — and what goes wrong does not leave a role only memory knows', () => {
    const granted = () => h.audit.query({ eventType: 'zoning.role_granted' }).length;
    const revoked = () => h.audit.query({ eventType: 'zoning.role_revoked' }).length;

    it('a grant the database refuses does not happen', async () => {
        h.table.failNext(/^INSERT INTO civic_parcel_roles/);
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        expect(res.statusCode).toBe(500);
        expect(h.registry.roleOf(SHOP, STAFF)).toBeNull();
        expect(granted()).toBe(0);
    });

    it('an invitation the database refuses mints no guest', async () => {
        h.table.failNext(/^INSERT INTO civic_parcel_roles/);
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/invite`, { invitee_civic_did: GUEST });
        expect(res.statusCode).toBe(500);
        expect(h.registry.roleOf(SHOP, GUEST)).toBeNull();
        expect(granted()).toBe(0);
    });

    it('a revoke the database refuses does not happen: the role is still held', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        h.table.failNext(/^UPDATE civic_parcel_roles SET revoked_tick/);
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/roles/revoke`, { holder_civic_did: STAFF });
        expect(res.statusCode).toBe(500);
        expect(h.registry.roleOf(SHOP, STAFF)).toBe('staff');
        expect(revoked()).toBe(0);
    });

    it('a trust write that fails does not undo a finished task', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        const task = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: 50 })).json().task_id;
        h.as(STAFF);
        await h.post(`/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: task });
        h.as(OWNER);
        h.table.failNext(/^UPDATE civic_parcel_roles SET trust_score/);
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task });
        expect(res.statusCode).toBe(200);
        expect(h.audit.query({ eventType: 'zoning.cowork_session' })).toHaveLength(1);
    });

    it('a role given again after a revoke is active again and keeps the trust it had earned', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        const task = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: 50 })).json().task_id;
        h.as(STAFF);
        await h.post(`/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: task });
        h.as(OWNER);
        await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task });
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles/revoke`, { holder_civic_did: STAFF });
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'guest' });
        expect(h.table.row(SHOP, STAFF)).toMatchObject({ role: 'guest', revoked_tick: null, trust_score: 1 });
        const fresh = await h.restart();
        expect(fresh.roleOf(SHOP, STAFF)).toBe('guest');
        expect(fresh.rolesFor(SHOP)[0].trust_score).toBe(1);
    });

    it('an invitation does not turn staff into a guest', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        const res = await h.post(`/api/v1/civic/parcels/${SHOP}/invite`, { invitee_civic_did: STAFF });
        expect(res.statusCode).toBe(200);
        expect(h.registry.roleOf(SHOP, STAFF)).toBe('staff');
        expect(h.table.row(SHOP, STAFF)!.role).toBe('staff');
        expect(granted()).toBe(1);
    });

    it('work done for oneself earns no trust and is not recorded as a session', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        h.as(STAFF);
        for (let i = 0; i < 3; i++) {
            const task = (await h.post(`/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: `self${i}`, pay_bios: 5 })).json().task_id;
            await h.post(`/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: task });
            expect((await h.post(`/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: task })).statusCode).toBe(200);
        }
        expect(h.registry.rolesFor(SHOP)[0].trust_score).toBe(0);
        expect(h.table.row(SHOP, STAFF)!.trust_score).toBe(0);
        expect(h.audit.query({ eventType: 'zoning.cowork_session' })).toHaveLength(0);   // alone is not a session
    });

    it('a reclaim whose second write fails ends no role: both writes land, or neither', async () => {
        await h.post(`/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        const deps = {
            registry: createUpkeepRegistryFacade(h.registry, h.store),
            audit: h.audit, treasuryDid: 'did:noesis:system:treasury', gridName: 'genesis',
            accountStore: { chargeToTreasury: vi.fn(async () => { throw new Error('insufficient_balance'); }) },
        };
        const T3 = 1 + 2 * UPKEEP_PERIOD_TICKS;
        for (const t of [1, 1 + UPKEEP_PERIOD_TICKS]) await onUpkeepTick(t, deps as never);
        h.table.failNext(/^UPDATE civic_parcels SET owner_civic_did = NULL/);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await onUpkeepTick(T3, deps as never);
        expect(h.registry.get(SHOP)!.ownerDid).toBe(OWNER);
        expect(h.registry.roleOf(SHOP, STAFF)).toBe('staff');
        expect(h.table.row(SHOP, STAFF)!.revoked_tick).toBeNull();      // rolled back with the failed write
        await onUpkeepTick(T3 + 1, deps as never);                          // the database is back
        expect(h.registry.get(SHOP)!.ownerDid).toBeNull();
        expect(h.table.row(SHOP, STAFF)!.revoked_tick).toBe(T3 + 1);
        warn.mockRestore();
    });
});
