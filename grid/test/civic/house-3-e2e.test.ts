/**
 * Phase 60 HOUSE-3 · Wave 0 — SKIP-STUB for the HOUSE-3 Definition-of-Done end-to-end
 * (R-60-02..11). describe.skip until Wave 6/7 wires the full scenario through the real
 * registerCivicParcelRoutes handlers (mirroring house-2-e2e.test.ts).
 *
 * Deferred dynamic import (Phase 58/59 Wave-0 pattern) defers module resolution until un-skipped.
 *
 * The master-plan HOUSE-3 acceptance scenario, end-to-end:
 *   1. ROLE — an owner grants a staff role to a second Nous → zoning.role_granted (5-tuple).
 *   2. COWORK — owner posts a task to the task_board → staff claims + completes it →
 *      completion settles in Ousia when funded, else records an IOU (never free) →
 *      zoning.cowork_session emitted (participants_hash only, no raw DIDs/board text).
 *   3. SHOP — owner binds a shop to the parcel + names it place://aurora-cafe.genesis →
 *      a sale at the addressed shop emits treasury.structure_revenue with the zone tax.
 *   4. UNIQUENESS — a duplicate place name → 409 place_name_taken.
 *   5. RING — a ring-expansion bill enacted via gov.law_enacted seeds a new ring (no audit emit).
 *   6. SEVERANCE — revoking the staff role drains the IOU ledger then traverses the severance
 *      FSM to ARCHIVED → zoning.role_revoked.
 *   7. HUMAN — a human attempting any role grant is rejected (D-NH-07).
 */
import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

const loadRoutes = () => import('../../src/api/routes/civic-parcels.js');

const OWNER = 'did:civic:noesis:alice';
const STAFF = 'did:civic:noesis:bob';
const HUMAN = 'did:civic:noesis:human:carol';
const SHOP_PARCEL = 'genesis:shopping:0001';

const POST = (app: FastifyInstance, url: string, payload?: unknown) =>
    app.inject({ method: 'POST', url, payload: payload as Record<string, unknown> });

describe.skip('HOUSE-3 Definition of Done — roles → co-work → shop/place → revenue → severance end-to-end [Wave 7 un-skips]', () => {
    it('grants a staff role, runs a paid co-work session, binds+names a shop, collects structure revenue, then severs the role', async () => {
        const { registerCivicParcelRoutes } = await loadRoutes();
        const app = Fastify({ logger: false });
        let ctx: { did: string; tier: string } | null = { did: OWNER, tier: 'civic_member' };
        app.addHook('onRequest', async (req) => { (req as never as { didContext: unknown }).didContext = ctx; });
        registerCivicParcelRoutes(app, {} as never);
        await app.ready();

        // 1. ROLE — owner grants staff → zoning.role_granted.
        const grant = await POST(app, `/api/v1/civic/parcels/${SHOP_PARCEL}/roles`, { holder_civic_did: STAFF, role: 'staff' });
        expect(grant.statusCode).toBe(200);

        // 2. COWORK — post (owner) → claim (staff) → complete (host); settles in Ousia or IOU, never free.
        const post = await POST(app, `/api/v1/civic/parcels/${SHOP_PARCEL}/board/post`, { task_ref: 'stock-shelves', pay_bios: 50 });
        expect(post.statusCode).toBe(200);
        ctx = { did: STAFF, tier: 'civic_member' };
        const claim = await POST(app, `/api/v1/civic/parcels/${SHOP_PARCEL}/board/claim`, { task_id: 'task:1' });
        expect(claim.statusCode).toBe(200);
        ctx = { did: OWNER, tier: 'civic_member' };
        const complete = await POST(app, `/api/v1/civic/parcels/${SHOP_PARCEL}/board/complete`, { task_id: 'task:1' });
        expect(complete.statusCode).toBe(200);

        // 3. SHOP — bind a shop + name the place.
        const bind = await POST(app, `/api/v1/civic/parcels/${SHOP_PARCEL}/bind-shop`, { shop_id: 'shop:aurora' });
        expect(bind.statusCode).toBe(200);
        const name = await POST(app, `/api/v1/civic/parcels/${SHOP_PARCEL}/name`, { place_name: 'aurora-cafe' });
        expect(name.statusCode).toBe(200);

        // 4. UNIQUENESS — a duplicate place name → 409.
        const dup = await POST(app, `/api/v1/civic/parcels/genesis:shopping:0002/name`, { place_name: 'aurora-cafe' });
        expect(dup.statusCode).toBe(409);
        expect(dup.json()).toMatchObject({ error: 'place_name_taken' });

        // 6. SEVERANCE — revoke the staff role → drains IOU ledger then FSM to ARCHIVED → zoning.role_revoked.
        const revoke = await POST(app, `/api/v1/civic/parcels/${SHOP_PARCEL}/roles/revoke`, { holder_civic_did: STAFF });
        expect(revoke.statusCode).toBe(200);

        // 7. HUMAN — a human attempting any role grant is rejected (D-NH-07).
        const humanGrant = await POST(app, `/api/v1/civic/parcels/${SHOP_PARCEL}/roles`, { holder_civic_did: HUMAN, role: 'guest' });
        expect(humanGrant.statusCode).toBe(403);

        await app.close();
    });

    it('emits the four new HOUSE-3 events on the trail with privacy discipline (hashes/enums/counts only)', async () => {
        const { AuditChain } = await import('../../src/audit/chain.js');
        const audit = new AuditChain();
        // The full run lands zoning.role_granted, zoning.cowork_session, treasury.structure_revenue,
        // zoning.role_revoked — each carrying only hashed DIDs / enums / counts / ticks (no raw DIDs).
        for (const e of audit.all()) {
            const blob = JSON.stringify(e.payload);
            expect(blob).not.toContain('did:civic:');
            expect(blob).not.toMatch(/task|scope|aurora-cafe/i);
        }
        const topics = audit.all().map((e) => e.eventType);
        for (const t of ['zoning.role_granted', 'zoning.cowork_session', 'treasury.structure_revenue', 'zoning.role_revoked']) {
            expect(topics).toContain(t);
        }
    });
});
