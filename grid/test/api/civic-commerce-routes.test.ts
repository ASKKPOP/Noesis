/**
 * Phase 60 HOUSE-3 · Wave 4 — commerce / role / cowork / place HTTP route matrix
 * (D-60-01..09 / R-60-04/05/08/09/11/12).
 *
 * Un-skipped from the Wave 0 stub. Exercises the real registerCivicParcelRoutes commerce
 * endpoints against a real ParcelRegistry (seeded; OWNER owns + built a shop) + a real
 * AuditChain + a real NousRegistry + a mock ParcelStore, mirroring the Phase 59
 * civic-interior-routes pattern (bare onRequest sets req.didContext; the route enforces
 * its own tier + owner/staff/guest authorization).
 *
 * Covers:
 *   - bind-shop / unbind-shop: owner-only; non-owner → 403 not_owner; non-shop → 422
 *     structure_not_shop; unbind routes through severance (never a hard kill).
 *   - name (place://): owner-only; duplicate → 409 place_name_taken (NO chain event).
 *   - invite: owner or staff appends to the entry allowlist AND mints a guest role edge
 *     (emits zoning.role_granted); a did:civic:noesis:human:* invitee → 403.
 *   - roles grant / revoke: owner-only; staff|guest grant emits zoning.role_granted;
 *     revoke routes through severance + emits zoning.role_revoked; a human holder → 403.
 *   - board post / claim / complete: completion ALWAYS settles + emits zoning.cowork_session
 *     (participants_hash only — no raw DIDs / board text on chain).
 *   - ROUTE_DID_POLICY coverage for every new route.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { AuditChain } from '../../src/audit/chain.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { registerCivicParcelRoutes } from '../../src/api/routes/civic-parcels.js';
import { TREASURY_DID } from '../../src/api/routes/registry.js';
import { ROUTE_DID_POLICY } from '../../src/api/policy.js';
import { _resetCowork } from '../../src/civic/cowork.js';
import { _resetLedger } from '../../src/civic/credit-ledger.js';
import { _resetPlace } from '../../src/civic/place-registry.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import type { ParcelStore } from '../../src/civic/parcel-store.js';
import '../../src/api/preHandlers/types.js';

const OWNER = 'did:civic:noesis:alice';
const STAFF = 'did:civic:noesis:bob';
const OTHER = 'did:civic:noesis:carol';
const HUMAN = 'did:civic:noesis:human:dave';
const SHOP = 'genesis:shopping:0001';
const SHOP2 = 'genesis:shopping:0002';

const POST = (app: FastifyInstance, url: string, payload?: unknown) =>
    app.inject({ method: 'POST', url, payload: payload as Record<string, unknown> });

function nousCtx(did: string): DIDContext {
    return { did, tier: 'civic_member' };
}

interface AppHandle {
    app: FastifyInstance;
    audit: AuditChain;
    parcelRegistry: ParcelRegistry;
    setCtx: (ctx: DIDContext | null) => void;
}

/**
 * Build a Fastify app with a real registry seeded so OWNER owns + built a SHOP structure on
 * both SHOP and SHOP2. The store is mocked. ctx is mutable per-request so a single app can
 * act as different callers (owner / staff / other / human).
 */
function buildApp(): AppHandle {
    const audit = new AuditChain();
    const parcelRegistry = new ParcelRegistry('genesis');
    parcelRegistry.seedZone({ zoneId: 'shopping', count: 4, priceBios: 400, ring: 2 });

    const nousRegistry = new NousRegistry();
    nousRegistry.spawn({ name: 'treasury', did: TREASURY_DID, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 0);
    nousRegistry.spawn({ name: 'alice', did: OWNER, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 100_000);
    nousRegistry.spawn({ name: 'bob', did: STAFF, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 100_000);

    // OWNER owns SHOP; STAFF owns SHOP2 (the per-zone cap allows ≤1 shopping parcel each).
    parcelRegistry.purchase(SHOP, OWNER, 100_000);
    parcelRegistry.stampAcquired(SHOP, 1);
    parcelRegistry.build(SHOP, OWNER, { name: 'Shop One', type: 'shop', visibility: 'open' }, 2);
    parcelRegistry.purchase(SHOP2, STAFF, 100_000);
    parcelRegistry.stampAcquired(SHOP2, 1);
    parcelRegistry.build(SHOP2, STAFF, { name: 'Shop Two', type: 'shop', visibility: 'open' }, 2);

    const store = {
        persistBuild: vi.fn(async () => {}),
        persistEntryPolicy: vi.fn(async () => {}),
    } as unknown as ParcelStore;

    let ctx: DIDContext | null = nousCtx(OWNER);
    const app = Fastify({ logger: false });
    app.addHook('onRequest', async (req) => {
        (req as never as { didContext: DIDContext | null }).didContext = ctx;
    });
    const services = {
        parcels: { registry: parcelRegistry, store },
        registry: nousRegistry,
        audit,
        currentTick: () => 7,
    } as unknown as GridServices;
    registerCivicParcelRoutes(app, services);

    return { app, audit, parcelRegistry, setCtx: (c) => { ctx = c; } };
}

let handle: AppHandle;
beforeEach(async () => {
    _resetCowork();
    _resetLedger();
    _resetPlace();
    handle = buildApp();
    await handle.app.ready();
});

describe('Phase 60 HOUSE-3 — bind/unbind-shop routes', () => {
    it('a non-owner binding a shop → 403 not_owner', async () => {
        handle.setCtx(nousCtx(OTHER));
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/bind-shop`, { shop_id: 'shop:aurora' });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'not_owner' });
    });

    it('the owner binding a shop structure → 200', async () => {
        handle.setCtx(nousCtx(OWNER));
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/bind-shop`, { shop_id: 'shop:aurora' });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ bound: true });
    });

    it('binding a non-shop structure → 422 structure_not_shop', async () => {
        // Provision a residential home (not a shop) for OWNER and try to bind.
        handle.parcelRegistry.seedZone({ zoneId: 'residential', count: 1, priceBios: 100, ring: 3 });
        handle.parcelRegistry.purchase('genesis:residential:0001', OWNER, 100_000);
        handle.parcelRegistry.build('genesis:residential:0001', OWNER, { name: 'home', type: 'home', visibility: 'open' }, 2);
        handle.setCtx(nousCtx(OWNER));
        const res = await POST(handle.app, `/api/v1/civic/parcels/genesis:residential:0001/bind-shop`, { shop_id: 'shop:x' });
        expect(res.statusCode).toBe(422);
        expect(res.json()).toMatchObject({ error: 'structure_not_shop' });
    });

    it('unbind-shop routes through the severance FSM (not a hard kill) → 200', async () => {
        handle.setCtx(nousCtx(OWNER));
        await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/bind-shop`, { shop_id: 'shop:aurora' });
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/unbind-shop`, {});
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ unbound: true, severance_state: 'ARCHIVED' });
    });
});

describe('Phase 60 HOUSE-3 — name (place://) route', () => {
    it('a duplicate place name → 409 place_name_taken', async () => {
        handle.setCtx(nousCtx(OWNER));
        const first = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/name`, { place_name: 'aurora-cafe' });
        expect(first.statusCode).toBe(200);
        // SHOP2 belongs to STAFF — a DIFFERENT owner claiming the taken name is the conflict.
        handle.setCtx(nousCtx(STAFF));
        const dup = await POST(handle.app, `/api/v1/civic/parcels/${SHOP2}/name`, { place_name: 'aurora-cafe' });
        expect(dup.statusCode).toBe(409);
        expect(dup.json()).toMatchObject({ error: 'place_name_taken' });
    });

    it('a non-owner naming a parcel → 403 not_owner', async () => {
        handle.setCtx(nousCtx(OTHER));
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/name`, { place_name: 'mine' });
        expect(res.statusCode).toBe(403);
    });

    it('naming emits NO chain event (place names stay Grid-side)', async () => {
        handle.setCtx(nousCtx(OWNER));
        await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/name`, { place_name: 'quiet-corner' });
        const names = handle.audit.query({}).filter(e => e.eventType.includes('name') || e.eventType.includes('place'));
        expect(names).toHaveLength(0);
    });
});

describe('Phase 60 HOUSE-3 — invite route mints a guest edge', () => {
    it('owner invite appends to the entry allowlist AND mints a guest role edge → 200', async () => {
        handle.setCtx(nousCtx(OWNER));
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/invite`, { invitee_civic_did: OTHER });
        expect(res.statusCode).toBe(200);
        // Guest role edge minted.
        expect(handle.parcelRegistry.roleOf(SHOP, OTHER)).toBe('guest');
        // Entry allowlist updated.
        expect(handle.parcelRegistry.get(SHOP)!.entryPolicy.allowlist).toContain(OTHER);
        // zoning.role_granted emitted (DIDs hashed).
        const granted = handle.audit.query({ eventType: 'zoning.role_granted' });
        expect(granted).toHaveLength(1);
        expect(JSON.stringify(granted[0].payload)).not.toContain('did:civic:');
    });

    it('staff (with a board edge) may also invite → 200', async () => {
        handle.setCtx(nousCtx(OWNER));
        await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        handle.setCtx(nousCtx(STAFF));
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/invite`, { invitee_civic_did: OTHER });
        expect(res.statusCode).toBe(200);
    });

    it('a did:civic:noesis:human:* invitee is rejected from the role edge (D-NH-07)', async () => {
        handle.setCtx(nousCtx(OWNER));
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/invite`, { invitee_civic_did: HUMAN });
        expect(res.statusCode).toBe(403);
        expect(handle.parcelRegistry.roleOf(SHOP, HUMAN)).toBeNull();
    });
});

describe('Phase 60 HOUSE-3 — role grant / revoke routes', () => {
    it('owner grants a staff role (role ∈ {staff,guest}) → 200 + emits zoning.role_granted', async () => {
        handle.setCtx(nousCtx(OWNER));
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        expect(res.statusCode).toBe(200);
        expect(handle.parcelRegistry.roleOf(SHOP, STAFF)).toBe('staff');
        expect(handle.audit.query({ eventType: 'zoning.role_granted' })).toHaveLength(1);
    });

    it('a did:civic:noesis:human:* holder → 403 (humans never hold a role edge)', async () => {
        handle.setCtx(nousCtx(OWNER));
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: HUMAN, role: 'guest' });
        expect(res.statusCode).toBe(403);
    });

    it('revoke routes through the severance FSM → 200 + emits zoning.role_revoked', async () => {
        handle.setCtx(nousCtx(OWNER));
        await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/roles/revoke`, { holder_civic_did: STAFF });
        expect(res.statusCode).toBe(200);
        // Edge downgraded to history → roleOf resolves to null.
        expect(handle.parcelRegistry.roleOf(SHOP, STAFF)).toBeNull();
        const revoked = handle.audit.query({ eventType: 'zoning.role_revoked' });
        expect(revoked).toHaveLength(1);
        expect(revoked[0].payload).toMatchObject({ reason: 'owner_revoked' });
    });

    it('a non-owner granting a role → 403', async () => {
        handle.setCtx(nousCtx(OTHER));
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        expect(res.statusCode).toBe(403);
    });
});

describe('Phase 60 HOUSE-3 — task board post / claim / complete routes', () => {
    it('owner posts a task → 200', async () => {
        handle.setCtx(nousCtx(OWNER));
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: 50 });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ posted: true });
    });

    it('a role with board access claims a task → 200', async () => {
        handle.setCtx(nousCtx(OWNER));
        await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        const posted = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: 50 });
        const taskId = posted.json().task_id;
        handle.setCtx(nousCtx(STAFF));
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: taskId });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ claimed: true });
    });

    it('completion ALWAYS settles + emits zoning.cowork_session (participants_hash only) → 200', async () => {
        handle.setCtx(nousCtx(OWNER));
        await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        const posted = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/board/post`, { task_ref: 'clean', pay_bios: 50 });
        const taskId = posted.json().task_id;
        handle.setCtx(nousCtx(STAFF));
        await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/board/claim`, { task_id: taskId });
        handle.setCtx(nousCtx(OWNER));
        const res = await POST(handle.app, `/api/v1/civic/parcels/${SHOP}/board/complete`, { task_id: taskId });
        expect(res.statusCode).toBe(200);
        const sessions = handle.audit.query({ eventType: 'zoning.cowork_session' });
        expect(sessions).toHaveLength(1);
        const serialized = JSON.stringify(sessions[0].payload);
        expect(serialized).not.toContain('did:civic:');
        expect(serialized).not.toMatch(/clean|scope|task_ref/i);
        expect(sessions[0].payload).toMatchObject({ participant_count: 2 });
    });
});

describe('Phase 60 HOUSE-3 — ROUTE_DID_POLICY coverage', () => {
    it.each([
        'POST /api/v1/civic/parcels/:id/bind-shop',
        'POST /api/v1/civic/parcels/:id/unbind-shop',
        'POST /api/v1/civic/parcels/:id/name',
        'POST /api/v1/civic/parcels/:id/invite',
        'POST /api/v1/civic/parcels/:id/roles',
        'POST /api/v1/civic/parcels/:id/roles/revoke',
        'POST /api/v1/civic/parcels/:id/board/post',
        'POST /api/v1/civic/parcels/:id/board/claim',
        'POST /api/v1/civic/parcels/:id/board/complete',
    ])('%s has a civic_did_required policy entry', (route) => {
        expect(ROUTE_DID_POLICY[route]).toBe('civic_did_required');
    });
});
