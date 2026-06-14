/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for the commerce / role / cowork / place HTTP routes
 * (D-60-01..07 / R-60-04/05/08/09).
 *
 * describe.skip: these routes are added to grid/src/api/routes/civic-parcels.ts in Wave 2/3
 * (extending the Phase 58/59 route shape). Deferred dynamic import (Phase 58/59 Wave-0 pattern)
 * defers module resolution until the suite is un-skipped.
 *
 * Contract under test:
 *   - POST .../bind-shop + .../unbind-shop: owner-only; structure type shop; non-owner → 403 not_owner;
 *     unbind routes through severance.
 *   - POST .../name {place_name}: owner-only; duplicate → 409 place_name_taken.
 *   - POST .../invite {invitee_civic_did}: owner or staff; appends to entry allowlist AND mints a
 *     guest role edge; a did:civic:noesis:human:* invitee → rejected from the role edge.
 *   - POST .../roles {holder_civic_did, role} (grant, owner-only, role ∈ {staff,guest}) +
 *     .../roles/revoke: a human holder → 403 (humans never hold a role edge); revoke routes through severance.
 *   - POST .../board/post + /board/claim + /board/complete: completion ALWAYS settles (Ousia or IOU, never free).
 *   - every new route has a ROUTE_DID_POLICY entry (check-did-policy-coverage.mjs asserts coverage in Wave 4).
 */
import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

const loadRoutes = () => import('../../src/api/routes/civic-parcels.js');

const OWNER = 'did:civic:noesis:alice';
const STAFF = 'did:civic:noesis:bob';
const OTHER = 'did:civic:noesis:carol';
const HUMAN = 'did:civic:noesis:human:dave';
const PARCEL = 'genesis:shopping:0001';

const POST = (app: FastifyInstance, url: string, payload?: unknown) =>
    app.inject({ method: 'POST', url, payload: payload as Record<string, unknown> });

function appAs(did: string | null, tier = 'civic_member') {
    return async () => {
        const { registerCivicParcelRoutes } = await loadRoutes();
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => {
            (req as never as { didContext: unknown }).didContext = did ? { did, tier } : null;
        });
        registerCivicParcelRoutes(app, {} as never);
        await app.ready();
        return app;
    };
}

describe.skip('Phase 60 HOUSE-3 — bind/unbind-shop routes [Wave 3 un-skips]', () => {
    it('a non-owner binding a shop → 403 not_owner', async () => {
        const app = await appAs(OTHER)();
        const res = await POST(app, `/api/v1/civic/parcels/${PARCEL}/bind-shop`, { shop_id: 'shop:aurora' });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ error: 'not_owner' });
        await app.close();
    });

    it('the owner binding a shop structure → 200', async () => {
        const app = await appAs(OWNER)();
        const res = await POST(app, `/api/v1/civic/parcels/${PARCEL}/bind-shop`, { shop_id: 'shop:aurora' });
        expect(res.statusCode).toBe(200);
        await app.close();
    });

    it('unbind-shop routes through the severance FSM (not a hard kill) → 200', async () => {
        const app = await appAs(OWNER)();
        const res = await POST(app, `/api/v1/civic/parcels/${PARCEL}/unbind-shop`, {});
        expect(res.statusCode).toBe(200);
        await app.close();
    });
});

describe.skip('Phase 60 HOUSE-3 — name (place://) route [Wave 3 un-skips]', () => {
    it('a duplicate place name → 409 place_name_taken', async () => {
        const app = await appAs(OWNER)();
        await POST(app, `/api/v1/civic/parcels/${PARCEL}/name`, { place_name: 'aurora-cafe' });
        const dup = await POST(app, `/api/v1/civic/parcels/genesis:shopping:0002/name`, { place_name: 'aurora-cafe' });
        expect(dup.statusCode).toBe(409);
        expect(dup.json()).toMatchObject({ error: 'place_name_taken' });
        await app.close();
    });

    it('a non-owner naming a parcel → 403 not_owner', async () => {
        const app = await appAs(OTHER)();
        const res = await POST(app, `/api/v1/civic/parcels/${PARCEL}/name`, { place_name: 'mine' });
        expect(res.statusCode).toBe(403);
        await app.close();
    });
});

describe.skip('Phase 60 HOUSE-3 — invite route mints a guest edge [Wave 3 un-skips]', () => {
    it('owner or staff invite appends to the entry allowlist AND mints a guest role edge → 200', async () => {
        const app = await appAs(STAFF)();
        const res = await POST(app, `/api/v1/civic/parcels/${PARCEL}/invite`, { invitee_civic_did: OTHER });
        expect(res.statusCode).toBe(200);
        await app.close();
    });

    it('a did:civic:noesis:human:* invitee is rejected from the role edge (D-NH-07)', async () => {
        const app = await appAs(OWNER)();
        const res = await POST(app, `/api/v1/civic/parcels/${PARCEL}/invite`, { invitee_civic_did: HUMAN });
        expect([403, 422]).toContain(res.statusCode);
        await app.close();
    });
});

describe.skip('Phase 60 HOUSE-3 — role grant / revoke routes [Wave 3 un-skips]', () => {
    it('owner grants a staff role (role ∈ {staff,guest}) → 200', async () => {
        const app = await appAs(OWNER)();
        const res = await POST(app, `/api/v1/civic/parcels/${PARCEL}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        expect(res.statusCode).toBe(200);
        await app.close();
    });

    it('a did:civic:noesis:human:* holder → 403 (humans never hold a role edge)', async () => {
        const app = await appAs(OWNER)();
        const res = await POST(app, `/api/v1/civic/parcels/${PARCEL}/roles`, { holder_civic_did: HUMAN, role: 'guest' });
        expect(res.statusCode).toBe(403);
        await app.close();
    });

    it('revoke routes through the severance FSM → 200', async () => {
        const app = await appAs(OWNER)();
        const res = await POST(app, `/api/v1/civic/parcels/${PARCEL}/roles/revoke`, { holder_civic_did: STAFF });
        expect(res.statusCode).toBe(200);
        await app.close();
    });

    it('a non-owner granting a role → 403', async () => {
        const app = await appAs(OTHER)();
        const res = await POST(app, `/api/v1/civic/parcels/${PARCEL}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        expect(res.statusCode).toBe(403);
        await app.close();
    });
});

describe.skip('Phase 60 HOUSE-3 — task board post / claim / complete routes [Wave 3 un-skips]', () => {
    it('owner/staff post a task → 200', async () => {
        const app = await appAs(OWNER)();
        const res = await POST(app, `/api/v1/civic/parcels/${PARCEL}/board/post`, { task_ref: 'clean', pay_bios: 50 });
        expect(res.statusCode).toBe(200);
        await app.close();
    });

    it('a role with board access claims a task → 200', async () => {
        const app = await appAs(STAFF)();
        const res = await POST(app, `/api/v1/civic/parcels/${PARCEL}/board/claim`, { task_id: 'task:1' });
        expect(res.statusCode).toBe(200);
        await app.close();
    });

    it('completion ALWAYS settles (Ousia or IOU, never free) → 200', async () => {
        const app = await appAs(OWNER)();
        const res = await POST(app, `/api/v1/civic/parcels/${PARCEL}/board/complete`, { task_id: 'task:1' });
        expect(res.statusCode).toBe(200);
        await app.close();
    });
});
