/**
 * The Work Card routes — who is writing comes from the request's identity, a person
 * (Portal cookie) and a Nous (bearer token) both reach the loop, and one Work goes all
 * the way round over HTTP. The rules themselves are tested in
 * test/work/work.property.test.ts (P-WORK-01..09).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';
import { buildServer } from '../../src/api/server.js';
import { WorldClock } from '../../src/clock/ticker.js';
import { SpatialMap } from '../../src/space/map.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { AuditChain } from '../../src/audit/chain.js';
import { COOKIE_NAME, keyPairPromise } from '../../src/api/portal/auth.js';
import { ROUTE_DID_POLICY } from '../../src/api/policy.js';
import { WORK_WRITE_ROUTES } from '../../src/api/routes/works.js';
import type { CivicDidStore } from '../../src/civic-registry/civic-did-store.js';
import { InMemoryWorkStore } from '../helpers/in-memory-work-store.js';

const PERSON = { civic: 'did:civic:noesis:human:ada', existence: 'did:noesis:human:ada' };
const OTHER_PERSON = { civic: 'did:civic:noesis:human:bo', existence: 'did:noesis:human:bo' };
const SOPHIA = { civic: 'did:civic:noesis:sophia', existence: 'did:noesis:sophia' };
const HERMES = { civic: 'did:civic:noesis:hermes', existence: 'did:noesis:hermes' };
const FROZEN = { civic: 'did:civic:noesis:themis', existence: 'did:noesis:themis' };
const STRANGER = 'did:noesis:human:nobody';

type Rec = { civicDid: string; existenceDid: string; status: string; frozen: boolean };

function registry(): CivicDidStore {
    const recs: Rec[] = [PERSON, OTHER_PERSON, SOPHIA, HERMES].map((m) => ({ civicDid: m.civic, existenceDid: m.existence, status: 'active', frozen: false }));
    recs.push({ civicDid: FROZEN.civic, existenceDid: FROZEN.existence, status: 'active', frozen: true });
    return {
        get: async (_g: string, civicDid: string) => recs.find((r) => r.civicDid === civicDid) ?? null,
        getByExistenceDid: async (_g: string, existenceDid: string) => recs.find((r) => r.existenceDid === existenceDid) ?? null,
    } as unknown as CivicDidStore;
}

async function bearer(civicDid: string): Promise<Record<string, string>> {
    const { privateKey } = await keyPairPromise;
    const token = await new SignJWT({ sub: civicDid }).setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
    return { authorization: `Bearer ${token}` };
}
async function cookie(humanDid: string): Promise<Record<string, string>> {
    const { privateKey } = await keyPairPromise;
    const token = await new SignJWT({ did: humanDid }).setProtectedHeader({ alg: 'ES256' }).setIssuedAt().setExpirationTime('1h').sign(privateKey);
    return { cookie: `${COOKIE_NAME}=${token}` };
}

let app: FastifyInstance;
let audit: AuditChain;
let store: InMemoryWorkStore;
let tick: number;

beforeEach(() => {
    audit = new AuditChain();
    store = new InMemoryWorkStore();
    tick = 100;
    app = buildServer({
        clock: new WorldClock({ tickRateMs: 100_000 }), space: new SpatialMap(), logos: new LogosEngine(),
        audit, gridName: 'genesis', civicDidStore: registry(), workStore: store, currentTick: () => tick,
    });
});

const post = async (url: string, headers: Record<string, string>, payload: unknown) => {
    const res = await app.inject({ method: 'POST', url, headers, payload: payload as object });
    return { status: res.statusCode, body: res.json() as { work?: any; error?: string; version?: number } };
};

describe('the policy table', () => {
    it('lists every Work route, so none falls to default-deny by accident', () => {
        for (const key of ['GET /api/v1/works', 'GET /api/v1/works/notices', 'GET /api/v1/works/:workId', 'POST /api/v1/works']) {
            expect(ROUTE_DID_POLICY[key]).toBe('public');
        }
        for (const [path] of WORK_WRITE_ROUTES) expect(ROUTE_DID_POLICY[`POST /api/v1/works/:workId/${path}`]).toBe('public');
    });
});

describe('who may write', () => {
    it('nobody without an identity', async () => {
        const r = await post('/api/v1/works', {}, { goal: 'g', for_whom: 'w', builder: SOPHIA.civic });
        expect(r.status).toBe(401);
        expect(store.rows.size).toBe(0);
    });

    it('not a signed-in person who holds no Civic-DID in this Grid', async () => {
        const r = await post('/api/v1/works', await cookie(STRANGER), { goal: 'g', for_whom: 'w', builder: SOPHIA.civic });
        expect(r.status).toBe(401);
        expect(store.rows.size).toBe(0);
    });

    it('not a frozen member', async () => {
        const r = await post('/api/v1/works', await bearer(FROZEN.civic), { goal: 'g', for_whom: 'w' });
        expect(r).toMatchObject({ status: 403, body: { error: 'not_member' } });
    });

    it('the owner is the caller, whatever the body claims', async () => {
        const r = await post('/api/v1/works', await cookie(PERSON.existence), {
            goal: 'g', for_whom: 'w', builder: SOPHIA.civic, owner: HERMES.civic, actor: HERMES.civic, owner_kind: 'nous',
        });
        expect(r.status).toBe(201);
        expect(r.body.work).toMatchObject({ owner: PERSON.civic, owner_kind: 'person', builder: SOPHIA.civic, stage: 'goal' });
    });

    it('a person cannot be the builder', async () => {
        const self = await post('/api/v1/works', await cookie(PERSON.existence), { goal: 'g', for_whom: 'w' });
        expect(self).toMatchObject({ status: 400, body: { error: 'builder_must_be_nous' } });
        const other = await post('/api/v1/works', await bearer(SOPHIA.civic), { goal: 'g', for_whom: 'w', builder: PERSON.civic });
        expect(other).toMatchObject({ status: 400, body: { error: 'builder_must_be_nous' } });
    });

    it('a body cannot pick another operation than the route', async () => {
        const made = await post('/api/v1/works', await bearer(SOPHIA.civic), { goal: 'g', for_whom: 'w' });
        const id = made.body.work.work_id as string;
        // Sent to /answer while the Work is in Define, with a body that says "define".
        const r = await post(`/api/v1/works/${id}/answer`, await bearer(SOPHIA.civic), {
            version: 1, op: 'define', for_what: 'a', how: 'b', which: [], checks: ['c'],
        });
        expect(r).toMatchObject({ status: 409, body: { error: 'wrong_stage' } });
    });
});

describe('one Work, all the way round', () => {
    it('a person sets it up, a Nous builds, another Nous verifies, and the notice board shows it', async () => {
        const ada = await cookie(PERSON.existence);
        const sophia = await bearer(SOPHIA.civic);
        const hermes = await bearer(HERMES.civic);

        // 2 Goal — a person asks a Nous.
        let r = await post('/api/v1/works', ada, { goal: 'A reading room', for_whom: 'new residents', builder: SOPHIA.civic });
        expect(r.status).toBe(201);
        const id = r.body.work.work_id as string;
        const url = (step: string) => `/api/v1/works/${id}/${step}`;

        // Someone else cannot answer for the asked Nous.
        expect(await post(url('answer'), hermes, { version: 1, accept: true })).toMatchObject({ status: 403, body: { error: 'not_allowed' } });
        // The card tells each member which step is theirs.
        const may = async (h: Record<string, string>) => (await app.inject({ method: 'GET', url: `/api/v1/works/${id}`, headers: h })).json().you.may;
        expect(await may(sophia)).toEqual(['answer']);
        expect(await may(ada)).toEqual([]);
        r = await post(url('answer'), sophia, { version: 1, accept: true, reason: 'I can build this.' });
        expect(r.body.work.stage).toBe('define');

        // 3 Define — by the person.
        r = await post(url('define'), ada, {
            version: 2, for_what: 'Nowhere to learn the laws.', how: 'A venue with the library inside.',
            which: ['block:venue', 'block:reading-shelf'], checks: ['A visitor can enter', 'The library opens inside'],
        });
        expect(r.body.work.stage).toBe('plan');

        // 4 Plan — the Nous plans, the person approves. A stale version is refused.
        r = await post(url('plan'), sophia, { version: 3, steps: [{ do: 'buy a parcel', by_tick: 300 }, { do: 'build the venue', by_tick: 500 }] });
        expect(r.body.work.plan).toHaveLength(2);
        expect(await post(url('plan/approve'), ada, { version: 3 })).toMatchObject({ status: 409, body: { error: 'stale_version', version: 4 } });
        expect(await post(url('plan/approve'), sophia, { version: 4 })).toMatchObject({ status: 403 });
        r = await post(url('plan/approve'), ada, { version: 4 });
        expect(r.body.work.stage).toBe('build');

        // 5 Build — only the builder, in order.
        expect(await post(url('build'), ada, { version: 5, step: 1 })).toMatchObject({ status: 403 });
        expect(await post(url('build'), sophia, { version: 5, step: 2 })).toMatchObject({ status: 400, body: { error: 'invalid_step' } });
        tick = 250;
        r = await post(url('build'), sophia, { version: 5, step: 1, note: 'parcel 12' });
        r = await post(url('build'), sophia, { version: 6, step: 2 });
        expect(r.body.work.stage).toBe('test');

        // 6 Test — a failed check keeps it in Test.
        r = await post(url('test'), sophia, { version: 7, check: 1, passed: true, evidence: 'visited at tick 260' });
        r = await post(url('test'), sophia, { version: 8, check: 2, passed: false, evidence: 'door is locked' });
        expect(r.body.work.stage).toBe('test');
        r = await post(url('test'), sophia, { version: 9, check: 2, passed: true, evidence: 'opened at tick 270' });
        expect(r.body.work.stage).toBe('verify');

        // 7 Verify — never the builder, and not a person: another Nous.
        expect(await post(url('verify'), sophia, { version: 10, confirm: true, reason: 'looks fine' })).toMatchObject({ status: 403 });
        expect(await post(url('verify'), await cookie(OTHER_PERSON.existence), { version: 10, confirm: true, reason: 'fine' })).toMatchObject({ status: 403, body: { error: 'not_allowed' } });
        expect(await post(url('verify'), ada, { version: 10, confirm: true, reason: 'fine' })).toMatchObject({ status: 403 });
        // What each caller is shown for this stage.
        const waiting = async (h: Record<string, string>, role: string) =>
            (await app.inject({ method: 'GET', url: `/api/v1/works?role=${role}`, headers: h })).json().works.map((w: { work_id: string }) => w.work_id);
        expect(await waiting(hermes, 'verify')).toEqual([id]);
        expect(await waiting(sophia, 'verify')).toEqual([]);
        expect(await waiting(sophia, 'builder')).toEqual([id]);
        expect(await waiting(ada, 'owner')).toEqual([id]);
        expect(await waiting(hermes, 'owner')).toEqual([]);
        expect((await app.inject({ method: 'GET', url: '/api/v1/works?role=owner' })).statusCode).toBe(401);
        expect((await app.inject({ method: 'GET', url: '/api/v1/works?role=boss', headers: ada })).statusCode).toBe(400);
        r = await post(url('verify'), hermes, { version: 10, confirm: true, reason: 'I went in and read a law.' });
        expect(r.body.work).toMatchObject({ stage: 'deploy', verified: { by: HERMES.civic } });

        // 8 Deploy, 9 Notice.
        r = await post(url('deploy'), sophia, { version: 11, where: 'parcel 12, Residential', changed: 'A venue with a reading shelf.' });
        expect(r.body.work.result).toMatchObject({ built_by: SOPHIA.civic, verified_by: HERMES.civic, built_from: ['block:venue', 'block:reading-shelf'] });
        // 9 Notice — the builder announces; the owner only watches from here on.
        expect(await post(url('notice'), ada, { version: 12, goal_info: 'x', guide: 'y', presentation: 'z' })).toMatchObject({ status: 403 });
        r = await post(url('notice'), sophia, { version: 12, goal_info: 'A reading room is open.', guide: 'Walk in; the shelf is on the left.', presentation: 'Built in two steps.' });
        expect(r.body.work).toMatchObject({ stage: 'done', version: 13 });

        // Done: nothing more is taken.
        expect(await post(url('notice'), sophia, { version: 13, goal_info: 'x', guide: 'y', presentation: 'z' })).toMatchObject({ status: 409 });

        // The same record for everyone: the stored card is what a reader gets.
        const read = await app.inject({ method: 'GET', url: `/api/v1/works/${id}` });
        expect(read.json().work).toEqual(r.body.work);
        expect(read.json().you).toBeNull();
        const mine = await app.inject({ method: 'GET', url: `/api/v1/works/${id}`, headers: ada });
        expect(mine.json().you).toEqual({ civic_did: PERSON.civic, kind: 'person', may: [] });

        const board = (await app.inject({ method: 'GET', url: '/api/v1/works/notices' })).json();
        expect(board.count).toBe(1);
        expect(board.notices[0].work_id).toBe(id);
        const inBuild = (await app.inject({ method: 'GET', url: '/api/v1/works?stage=build' })).json();
        expect(inBuild.count).toBe(0);
        expect((await app.inject({ method: 'GET', url: '/api/v1/works?stage=nonsense' })).statusCode).toBe(400);

        // One audit record per stage change: enter→goal→define→plan→build→test→verify→deploy→notice→done.
        const path = audit.all().filter((e) => e.eventType === 'work.stage_changed').map((e) => e.payload.to_stage);
        expect(path).toEqual(['goal', 'define', 'plan', 'build', 'test', 'verify', 'deploy', 'notice', 'done']);
    });

    it('an unknown or malformed work id is 404', async () => {
        const sophia = await bearer(SOPHIA.civic);
        expect((await post('/api/v1/works/not-a-uuid/define', sophia, { version: 1 })).status).toBe(404);
        expect((await post('/api/v1/works/00000000-0000-4000-8000-00000000dead/define', sophia, { version: 1 })).status).toBe(404);
        expect((await app.inject({ method: 'GET', url: '/api/v1/works/00000000-0000-4000-8000-00000000dead' })).statusCode).toBe(404);
    });
});
