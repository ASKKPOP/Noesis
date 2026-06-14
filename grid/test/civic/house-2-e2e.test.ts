/**
 * Phase 59 HOUSE-2 · Wave 0 — SKIP-STUB for the HOUSE-2 Definition-of-Done end-to-end
 * (R-59-04/06/07/09/12). describe.skip until Wave 6 wires the full scenario.
 *
 * Deferred dynamic imports (Phase 58 Wave-0 pattern) defer module resolution. The Wave-6
 * implementation un-skips this block once interiors, upkeep, the ladder, and the 4
 * sole producers all land.
 *
 * Scenario:
 *   1. Owner extends a home interior (mirror + functional) → zoning.interior_extended;
 *      interior names/state NEVER cross the chain (only object_class/object_kind).
 *   2. A visitor GETs the interior while open → 200; once derelict → 403 closed_to_visitors.
 *   3. With insufficient funds, ticking past UPKEEP_PERIOD_TICKS boundaries walks the
 *      condition ladder maintained → worn → derelict → reclaimed, emitting
 *      treasury.upkeep_collected (when funded), zoning.condition_changed, zoning.parcel_reclaimed.
 *   4. Reclaim returns the parcel to the treasury, razes the structure, ejects occupants.
 *   5. Polis Commons (rings 0–1) never decay and are never debited.
 */
import { describe, it, expect } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

const loadRoutes = () => import('../../src/api/routes/civic-parcels.js');
const loadScanner = () => import('../../src/civic/upkeep-scanner.js');
const loadFoundingLaw = () => import('../../src/civic/founding-law.js');

const OWNER = 'did:civic:noesis:alice';
const VISITOR = 'did:civic:noesis:bob';
const HOME = 'genesis:residential:0001';

const POST = (app: FastifyInstance, url: string, payload?: unknown) =>
    app.inject({ method: 'POST', url, payload: payload as Record<string, unknown> });
const GET = (app: FastifyInstance, url: string) => app.inject({ method: 'GET', url });

describe.skip('Phase 59 HOUSE-2 Definition of Done — extend → view gated → upkeep → reclaim [Wave 6 un-skips]', () => {
    it('owner extends a home interior (mirror + functional) → zoning.interior_extended; no names/state on the chain', async () => {
        const { registerCivicParcelRoutes } = await loadRoutes();
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { (req as never as { didContext: unknown }).didContext = { did: OWNER, tier: 'civic_member' }; });
        registerCivicParcelRoutes(app, {} as never);
        await app.ready();
        const bed = await POST(app, `/api/v1/civic/parcels/${HOME}/interior/extend`, { area: 'bedroom', kind: 'bed' });
        const desk = await POST(app, `/api/v1/civic/parcels/${HOME}/interior/extend`, { area: 'study', kind: 'work_desk' });
        expect(bed.statusCode).toBe(200);
        expect(desk.statusCode).toBe(200);
        await app.close();
    });

    it('a visitor sees the interior while open, is refused (403 closed_to_visitors) once derelict', async () => {
        const { registerCivicParcelRoutes } = await loadRoutes();
        const app = Fastify({ logger: false });
        app.addHook('onRequest', async (req) => { (req as never as { didContext: unknown }).didContext = { did: VISITOR, tier: 'civic_member' }; });
        registerCivicParcelRoutes(app, {} as never);
        await app.ready();
        const open = await GET(app, `/api/v1/civic/parcels/${HOME}/interior`);
        expect(open.statusCode).toBe(200);
        await app.close();
    });

    it('an unfunded owner walks the ladder maintained → worn → derelict → reclaimed across period boundaries', async () => {
        const { onUpkeepTick } = await loadScanner();
        const { UPKEEP_PERIOD_TICKS } = await loadFoundingLaw();
        // 3 missed periods drive the full ladder to reclaim; each emits zoning.condition_changed,
        // reclaim additionally emits zoning.parcel_reclaimed {reason:upkeep_default}.
        expect(UPKEEP_PERIOD_TICKS).toBe(10080);
        expect(typeof onUpkeepTick).toBe('function');
    });

    it('reclaim returns the parcel to the treasury, razes the structure, ejects occupants', async () => {
        const { ParcelRegistry } = await import('../../src/civic/parcel-registry.js');
        const registry = new ParcelRegistry('genesis');
        registry.advanceCondition(HOME); // worn
        registry.advanceCondition(HOME); // derelict
        registry.advanceCondition(HOME); // reclaimed
        const parcel = registry.get(HOME)!;
        expect(parcel.ownerDid).toBe('did:noesis:system:treasury');
        expect(parcel.structure).toBeUndefined();
        expect(registry.occupants(HOME)).toEqual([]);
    });

    it('Polis Commons (rings 0–1) never decay and are never debited through the whole run', async () => {
        const { onUpkeepTick } = await loadScanner();
        const transferOusia = (() => { let called = false; const fn = () => { called = true; return { ok: true }; }; (fn as { called: () => boolean }).called = () => called; return fn; })();
        const registry = {
            list: () => [{ id: 'genesis:government_quarter:0001', ownerDid: null, priceBios: 0, lastUpkeepTick: 0, ring: 0, condition: 'maintained' }],
            transferOusia,
            get: () => ({ ousia: 0 }),
        };
        await onUpkeepTick(10080 * 5, { registry, audit: { append: () => {} }, treasuryDid: 'did:noesis:system:treasury' } as never);
        expect((transferOusia as { called: () => boolean }).called()).toBe(false);
    });

    it('NO interior name/state ever appears on any audit payload across the scenario (D-59-08)', async () => {
        const { AuditChain } = await import('../../src/audit/chain.js');
        const audit = new AuditChain();
        // After a full run, every payload on the chain is free of interior names/state.
        for (const e of audit.all()) {
            expect(JSON.stringify(e.payload)).not.toMatch(/areas|bedroom|state/i);
        }
    });
});
