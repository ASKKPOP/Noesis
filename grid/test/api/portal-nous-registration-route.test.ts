/**
 * D-V3-39 — Nous registration through the Portal: filing, reviewer
 * pre-screen, and the automatic Polis charter stage.
 *
 * Pins the constitutional seams: a founding Nous can only be filed by an
 * allowlisted operator; only a citizen who owns the Nous can file; the human
 * decision is the Portal pre-screen; the Polis stage is rule evaluation; and
 * this module never issues a Civic-DID.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { SignJWT } from 'jose';
import type { Pool } from 'mysql2/promise';
import { registerPortalNousRegistrationRoutes } from '../../src/api/routes/portal-nous-registration.js';
import { reviewNousRegistration } from '../../src/civic-registry/nous-charter-review.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import { AuditChain } from '../../src/audit/chain.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';

const OPERATOR = 'did:noesis:human:email:op';
const CITIZEN = 'did:noesis:human:email:cit';
const HERMES = 'did:noesis:hermes';
const ALICE = 'did:noesis:nous:alice';

interface World {
    owned: Array<[string, string]>;                 // [humanDid, nousDid]
    civic: Record<string, { status: string }>;       // by existence DID
    sanctions: Record<string, { frozen: 0 | 1; banned: 0 | 1 }>;
    regs: Array<Record<string, unknown>>;
}

function makePool(w: World): Pool {
    const query = vi.fn(async (sql: string, params: unknown[] = []) => {
        if (/FROM nous_sponsors/i.test(sql)) {
            const hit = w.owned.some(([h, n]) => h === params[1] && n === params[2]);
            return [hit ? [{ '1': 1 }] : [], {}];
        }
        if (/FROM human_users/i.test(sql)) {
            const s = w.sanctions[params[0] as string];
            return [s ? [s] : [], {}];
        }
        if (/INSERT INTO nous_registrations/i.test(sql)) {
            w.regs.push({ request_id: params[0], nous_type: params[1], registrant_did: params[2], nous_did: params[3], target_grid: params[4], brain_key_x: params[5], status: 'requested', reason_code: null, filed_tick: params[6] });
            return [[], {}];
        }
        if (/UPDATE nous_registrations/i.test(sql)) {
            const status = /SET status = '(\w+)'/.exec(sql)![1];
            const row = w.regs.find((r) => r.request_id === params[params.length - 1])!;
            row.status = status;
            if (params.length === 2) row.reason_code = params[0];
            return [[], {}];
        }
        if (/FROM nous_registrations/i.test(sql)) {
            if (/request_id = \?/.test(sql)) return [w.regs.filter((r) => r.request_id === params[0]), {}];
            if (/nous_did = \?/.test(sql)) return [w.regs.filter((r) => r.nous_did === params[1] && r.status !== 'rejected'), {}];
            return [params.length === 2 ? w.regs.filter((r) => r.status === params[1]) : w.regs, {}];
        }
        return [[], {}];
    });
    return { query } as unknown as Pool;
}

function makeApp(w: World, ctx: DIDContext | null = null): { app: FastifyInstance; audit: AuditChain } {
    const audit = new AuditChain();
    const services = {
        gridName: 'genesis', currentTick: () => 7, pool: makePool(w), audit,
        civicDidStore: { getByExistenceDid: vi.fn(async (_g: string, did: string) => w.civic[did] ?? null) },
        operatorAllowlist: new Map([[OPERATOR, { operatorId: 'op:1', tier: 5 }]]),
    } as unknown as GridServices;
    const app = Fastify({ logger: false });
    void app.register(fastifyCookie);
    app.addHook('onRequest', async (req) => { req.didContext = ctx ?? undefined; });
    registerPortalNousRegistrationRoutes(app, services);
    return { app, audit };
}

async function cookie(did: string): Promise<Record<string, string>> {
    const { privateKey } = await keyPairPromise;
    const jwt = await new SignJWT({ did }).setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
    return { [COOKIE_NAME]: jwt };
}

const world = (over: Partial<World> = {}): World => ({
    owned: [[OPERATOR, HERMES], [CITIZEN, HERMES], [CITIZEN, ALICE]],
    civic: { [OPERATOR]: { status: 'active' }, [CITIZEN]: { status: 'active' } },
    sanctions: {},
    regs: [],
    ...over,
});

const REVIEWER: DIDContext = { did: OPERATOR, tier: 'human_visitor', operatorDid: OPERATOR, operatorTier: 5 } as DIDContext;
/** A well-formed Ed25519 public key `x` (32 bytes, base64url, no padding). */
const BRAIN_KEY = 'A'.repeat(43);
const file = (app: FastifyInstance, nous: string, cookies?: Record<string, string>, payload: unknown = { brain_public_key_x: BRAIN_KEY }) =>
    app.inject({ method: 'POST', url: `/api/v1/portal/nous/${nous}/registration`, cookies, payload });

describe('reviewNousRegistration — Polis charter rules', () => {
    const ok = { targetsThisGrid: true, sponsorIsActiveCitizen: true, sponsorFrozen: false, sponsorBanned: false, nousAlreadyCitizen: false };
    it('approves a clean filing', () => {
        expect(reviewNousRegistration(ok)).toEqual({ approved: true });
    });
    it('rejects another Grid as grid_not_accepting', () => {
        expect(reviewNousRegistration({ ...ok, targetsThisGrid: false })).toEqual({ approved: false, reasonCode: 'grid_not_accepting' });
    });
    it.each([
        { sponsorIsActiveCitizen: false }, { sponsorFrozen: true }, { sponsorBanned: true }, { nousAlreadyCitizen: true },
    ])('rejects %o as charter_incompatible', (over) => {
        expect(reviewNousRegistration({ ...ok, ...over })).toEqual({ approved: false, reasonCode: 'charter_incompatible' });
    });
});

describe('POST /api/v1/portal/nous/:nousId/registration — filing', () => {
    it('401 without a Portal session', async () => {
        const { app } = makeApp(world());
        expect((await file(app, HERMES)).statusCode).toBe(401);
    });

    it('404 for an id that is not a Nous existence DID', async () => {
        const { app } = makeApp(world());
        expect((await file(app, 'did:noesis:human:email:x', await cookie(OPERATOR))).statusCode).toBe(404);
    });

    it.each([{}, { brain_public_key_x: 'too-short' }, { brain_public_key_x: 42 }])(
        '400 invalid_brain_public_key for payload %o', async (payload) => {
            const w = world();
            const { app } = makeApp(w);
            const res = await file(app, HERMES, await cookie(OPERATOR), payload);
            expect(res.statusCode).toBe(400);
            expect(res.json().error).toBe('invalid_brain_public_key');
            expect(w.regs).toHaveLength(0);
        },
    );

    it('403 not_owner when the caller has not claimed the Nous', async () => {
        const { app } = makeApp(world({ owned: [] }));
        const res = await file(app, ALICE, await cookie(CITIZEN));
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('not_owner');
    });

    it('403 founding_nous_operator_only for a citizen who is not an operator', async () => {
        const w = world();
        const { app } = makeApp(w);
        const res = await file(app, HERMES, await cookie(CITIZEN));
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('founding_nous_operator_only');
        expect(w.regs).toHaveLength(0);
    });

    it('403 civic_did_required when the owner is not an active citizen', async () => {
        const { app } = makeApp(world({ civic: {} }));
        const res = await file(app, HERMES, await cookie(OPERATOR));
        expect(res.statusCode).toBe(403);
        expect(res.json().error).toBe('civic_did_required');
    });

    it('409 already_registered when the Nous already holds a Civic-DID', async () => {
        const { app } = makeApp(world({ civic: { [OPERATOR]: { status: 'active' }, [HERMES]: { status: 'active' } } }));
        const res = await file(app, HERMES, await cookie(OPERATOR));
        expect(res.statusCode).toBe(409);
        expect(res.json().error).toBe('already_registered');
    });

    it('201 files a Type A registration and emits nous.registration_requested', async () => {
        const w = world();
        const { app, audit } = makeApp(w);
        const res = await file(app, HERMES, await cookie(OPERATOR));
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('requested');
        expect(w.regs[0]).toMatchObject({ nous_type: 'A', registrant_did: OPERATOR, nous_did: HERMES, target_grid: 'genesis', brain_key_x: BRAIN_KEY, status: 'requested' });
        expect(audit.query({}).map((e) => e.eventType)).toEqual(['nous.registration_requested']);
    });

    it('409 registration_exists for a second live filing on the same Nous', async () => {
        const { app } = makeApp(world());
        await file(app, HERMES, await cookie(OPERATOR));
        const res = await file(app, HERMES, await cookie(OPERATOR));
        expect(res.statusCode).toBe(409);
        expect(res.json()).toMatchObject({ error: 'registration_exists', status: 'requested' });
    });

    it('a non-founding Nous can be filed by its citizen owner', async () => {
        const { app } = makeApp(world());
        expect((await file(app, ALICE, await cookie(CITIZEN))).statusCode).toBe(201);
    });
});

describe('reviewer panel — /api/v1/portal-reviewer/nous-registrations', () => {
    const PRIOR = process.env.GRID_PORTAL_MANAGER_ENABLED;
    beforeEach(() => { process.env.GRID_PORTAL_MANAGER_ENABLED = 'true'; });
    afterEach(() => { process.env.GRID_PORTAL_MANAGER_ENABLED = PRIOR; });

    async function filed(w: World, ctx: DIDContext | null = REVIEWER) {
        const made = makeApp(w, ctx);
        const res = await file(made.app, HERMES, await cookie(OPERATOR));
        return { ...made, requestId: res.json().request_id as string };
    }
    const decide = (app: FastifyInstance, id: string, payload: unknown) =>
        app.inject({ method: 'POST', url: `/api/v1/portal-reviewer/nous-registrations/${id}/prescreen`, payload });

    it('503 when the Portal Manager surface is disabled', async () => {
        delete process.env.GRID_PORTAL_MANAGER_ENABLED;
        const { app } = makeApp(world(), REVIEWER);
        expect((await app.inject({ method: 'GET', url: '/api/v1/portal-reviewer/nous-registrations' })).statusCode).toBe(503);
    });

    it('403 for a caller without operator tier 5', async () => {
        const { app, requestId } = await filed(world(), { did: CITIZEN, tier: 'human_visitor' } as DIDContext);
        expect((await app.inject({ method: 'GET', url: '/api/v1/portal-reviewer/nous-registrations' })).statusCode).toBe(403);
        expect((await decide(app, requestId, { pass: true })).statusCode).toBe(403);
    });

    it('lists the queue with the registrant hashed', async () => {
        const { app } = await filed(world());
        const res = await app.inject({ method: 'GET', url: '/api/v1/portal-reviewer/nous-registrations?status=requested' });
        expect(res.statusCode).toBe(200);
        const row = res.json().registrations[0];
        expect(row).toMatchObject({ nous_did: HERMES, status: 'requested', registrant_is_operator: true, founding_nous: true });
        expect(row.registrant_did_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(res.body).not.toContain(OPERATOR);
    });

    it('400 for an unknown status filter or a non-boolean decision', async () => {
        const { app, requestId } = await filed(world());
        expect((await app.inject({ method: 'GET', url: '/api/v1/portal-reviewer/nous-registrations?status=bogus' })).statusCode).toBe(400);
        expect((await decide(app, requestId, { pass: 'yes' })).statusCode).toBe(400);
    });

    it('pass → forwarded to the Polis, charter rules approve, residence assigned', async () => {
        const w = world();
        const { app, audit, requestId } = await filed(w);
        const res = await decide(app, requestId, { pass: true });
        expect(res.statusCode).toBe(201);
        expect(res.json().status).toBe('approved');
        expect(w.regs[0].status).toBe('approved');
        expect(audit.query({}).map((e) => e.eventType)).toEqual([
            'nous.registration_requested', 'polis.registration_pending',
            'nous.registration_approved', 'zoning.residence_assigned',
        ]);
    });

    it('pass, but the charter rules reject a sanctioned sponsor', async () => {
        const w = world({ sanctions: { [OPERATOR]: { frozen: 1, banned: 0 } } });
        const { app, requestId } = await filed(w);
        const res = await decide(app, requestId, { pass: true });
        expect(res.json()).toEqual({ status: 'rejected', reason_code: 'charter_incompatible' });
        expect(w.regs[0].status).toBe('rejected');
    });

    it('reject at pre-screen never reaches the Polis', async () => {
        const w = world();
        const { app, audit, requestId } = await filed(w);
        const res = await decide(app, requestId, { pass: false, reason: 'prescreen_sybil' });
        expect(res.json()).toEqual({ status: 'rejected', reason_code: 'prescreen_sybil' });
        expect(audit.query({}).map((e) => e.eventType)).toEqual(['nous.registration_requested', 'nous.registration_rejected']);
    });

    it('409 when a filing was already decided; 404 for an unknown request', async () => {
        const { app, requestId } = await filed(world());
        await decide(app, requestId, { pass: true });
        expect((await decide(app, requestId, { pass: true })).statusCode).toBe(409);
        expect((await decide(app, 'nope', { pass: true })).statusCode).toBe(404);
    });

    it('a rejected Nous can be filed again', async () => {
        const { app, requestId } = await filed(world());
        await decide(app, requestId, { pass: false });
        expect((await file(app, HERMES, await cookie(OPERATOR))).statusCode).toBe(201);
    });
});

describe('constitutional guards', () => {
    const SRC = readFileSync(fileURLToPath(new URL('../../src/api/routes/portal-nous-registration.ts', import.meta.url)), 'utf8');

    it('adds no broadcast event (allowlist +0)', () => {
        expect(ALLOWLIST_MEMBERS.length).toBe(159);
    });
    it('never issues a Civic-DID or mints a government session', () => {
        expect(SRC).not.toMatch(/civicDidStore\.insert|\.insert\(|buildCivicDidVc|SignJWT|did:gov:/);
    });
});
