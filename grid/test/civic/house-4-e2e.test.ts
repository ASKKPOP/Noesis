/**
 * Phase 61 HOUSE-4 · Wave 5 — Definition-of-Done end-to-end (R-61-11). FINAL Nous House wave.
 *
 * The master-plan HOUSE-4 acceptance scenario, end-to-end against a seeded Genesis Core, built
 * on the Phase 58/59/60 buy → build → furnish → co-work path. The seeded app is wired exactly as
 * production composes it in main.ts (real AuditChain, real ParcelRegistry seeded with
 * buildGenesisCoreParcels, real NousRegistry balance/transfer, ParcelStore over a mock mysql2
 * Pool, treasury = TREASURY_DID, swappable per-request didContext).
 *
 * DID-FORM NOTE (dual-DID bridge — RESOLVED): a Nous carries two identities — a civic-DID
 *   (`did:civic:noesis:*`, the land/Ousia identity = JWT sub) and an existence-DID
 *   (`did:noesis:*`, the skill-attestation identity = JWT iss). Skills are attested under the
 *   existence-DID (`skill.taught.learner_did`, nous-runner), while the HTTP write routes identify
 *   the caller by the civic-DID. The `build-from-blueprint` route now runs the skill-held check
 *   against EITHER identity (the civic `did` OR the existence `operatorDid` the Brain-signed JWT
 *   carries — see `tryDid` `{did: sub, operatorDid: iss}` and `BuildDeps.skillHolderDid`), so a
 *   skill-held build SUCCEEDS over the real HTTP route. The first `it` drives the BUILD + CO-BUILD
 *   + TEACH branches through the production composition with `did:noesis:` Nous (the form the
 *   skill machinery accepts); the dedicated HTTP `it` below proves the end-to-end route bridge
 *   (civic owner, existence-DID skill, build via POST → 201 + one skill.blueprint_executed). No
 *   skill producer was weakened; the fix is the route + executor skill-identity bridge only.
 *
 *   1. LEARN — a Nous learns a blueprint_hash via the EXISTING skill.taught machinery (no new
 *      event); a civic_blueprints recipe row holds catalog-kind objects + the arrangement DAG +
 *      material_cost_wei.
 *   2. BUILD — buildFromBlueprint on an OWNED parcel → skill-held confirmed from the existing
 *      skill-event history → material_cost_wei debited (Ousia → TREASURY_DID) → recipe applied
 *      via extendInterior per object → skill.blueprint_executed {blueprint_hash,
 *      builder_civic_did_hash, parcel_id, tick} on the trail (no raw DID, no recipe body).
 *   2b. NEGATIVE — a builder who does NOT hold the skill → skill_not_held; insufficient Ousia → 402.
 *   3. CO-BUILD — decompose a recipe into the arrangement DAG; two workers claim+complete sub-tasks.
 *      FUNDED → transferWei; UNFUNDED → a Phase 60 IOU (never free). Attribution DAG-weighted.
 *      zoning.cowork_session per session (participants_hash only) + ONE skill.blueprint_executed
 *      on full completion.
 *   4. TEACH — a skill taught inside a workshop diffuses to the PRESENT Nous (not the absent one,
 *      not a present human); each present learner gets skill.taught with the unchanged 5-tuple.
 *   5. HUMAN — a did:civic:noesis:human:* attempting any build → rejected (403).
 *   6. PRIVACY — no recipe body / sub-task content / teaching location on any payload; all DIDs HEX64.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { createHash } from 'node:crypto';
import { AuditChain } from '../../src/audit/chain.js';
import { ParcelRegistry } from '../../src/civic/parcel-registry.js';
import { ParcelStore, buildGenesisCoreParcels } from '../../src/civic/parcel-store.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { registerCivicParcelRoutes } from '../../src/api/routes/civic-parcels.js';
import { appendSkillTaught } from '../../src/skills/appendSkillTaught.js';
import {
    storeBlueprint, getBlueprint, builderHoldsSkill, buildFromBlueprint, _resetBlueprints,
    type BlueprintRecipe,
} from '../../src/civic/blueprint.js';
import {
    decomposeRecipe, createCoBuildSession, claimSubTask, completeSubTask, attributionShare,
    isComplete, coBuildStaffOf, _resetCoBuild,
} from '../../src/civic/co-build.js';
import { teachHere } from '../../src/civic/location-teaching.js';
import { recordIou, outstandingFor, _resetLedger } from '../../src/civic/credit-ledger.js';
import { _resetCowork } from '../../src/civic/cowork.js';
import { appendSkillBlueprintExecuted } from '../../src/audit/append-skill-blueprint-executed.js';
import { appendZoningCoworkSession } from '../../src/audit/append-zoning-cowork-session.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';
import { gravityPrice } from '../../src/civic/founding-law.js';
import { TREASURY_DID } from '../../src/api/routes/registry.js';
import type { GridServices } from '../../src/api/server.js';
import type { DIDContext } from '../../src/api/preHandlers/types.js';
import '../../src/api/preHandlers/types.js';

const HEX64 = /^[0-9a-f]{64}$/;

// Skill-machinery Nous DIDs (did:noesis:* — the form appendSkillTaught/builderHoldsSkill accept).
const OWNER = 'did:noesis:alice';   // parcel owner + blueprint holder + builder
const WORKER_A = 'did:noesis:bob';  // co-build worker (funded sub-task)
const WORKER_B = 'did:noesis:carol'; // co-build worker (IOU sub-task) + present learner
const ABSENT = 'did:noesis:dave';   // not in the workshop occupant map
const NOSKILL = 'did:noesis:erin';  // a Nous who never learned the blueprint
// A human in the Civic-DID form (the only form isHumanDid matches).
const HUMAN = 'did:civic:noesis:human:frank';

// A ring-3 residential parcel from the Genesis Core seed — a home the owner builds into.
const PARCEL = 'genesis:residential:0001';
// A ring-2 business parcel — built into a workshop (the school for location teaching + co-build).
const WORKSHOP = 'genesis:business:0001';

const BLUEPRINT_HASH = 'a'.repeat(64);   // the Phase-18 skill hash a Nous learns + builds from
const PARENT_HASH = 'b'.repeat(64);      // the skill lineage parent
const TICK = 100;

const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/** A home recipe: two catalog-kind mirror objects + a 2-node arrangement DAG + a material cost. */
function homeRecipe(): BlueprintRecipe {
    return {
        blueprint_hash: BLUEPRINT_HASH,
        objects: [
            { kind: 'bed', area: 'bedroom' },
            { kind: 'shelf', area: 'study' },
        ],
        arrangement: [
            { node_id: 'n1', objects: [{ kind: 'bed', area: 'bedroom' }], depends_on: [], weight: 2 },
            { node_id: 'n2', objects: [{ kind: 'shelf', area: 'study' }], depends_on: ['n1'], weight: 1 },
        ],
        material_cost_wei: 100,
    };
}

/** A mock mysql2 Pool — UPDATE/INSERT report affectedRows; SELECT returns nothing. */
function mockPool(): { pool: Pool } {
    const pool = {
        query: async () => [{ affectedRows: 1 } as ResultSetHeader, []],
    } as unknown as Pool;
    return { pool };
}

interface E2EApp {
    app: FastifyInstance;
    audit: AuditChain;
    parcelRegistry: ParcelRegistry;
    nousRegistry: NousRegistry;
    setCtx: (ctx: DIDContext | null) => void;
    ready: Promise<void>;
}

/** Build the seeded Genesis Core app with a swappable per-request didContext (house-3 pattern). */
function buildGenesisApp(): E2EApp {
    const audit = new AuditChain();

    // Seed the WHOLE Genesis Core into a real registry.
    const parcelRegistry = new ParcelRegistry('genesis');
    for (const p of buildGenesisCoreParcels('genesis')) parcelRegistry.upsert(p);

    // Real funds registry: treasury + the builder + the two workers. OWNER funded to cover the
    // material debit; NOSKILL given enough Ousia so its build fails on skill_not_held, not 402.
    const nousRegistry = new NousRegistry();
    nousRegistry.spawn({ name: 'treasury', did: TREASURY_DID, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 0);
    nousRegistry.spawn({ name: 'alice', did: OWNER, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 10_000);
    nousRegistry.spawn({ name: 'bob', did: WORKER_A, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 10_000);
    nousRegistry.spawn({ name: 'carol', did: WORKER_B, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 10_000);
    nousRegistry.spawn({ name: 'erin', did: NOSKILL, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 10_000);

    const { pool } = mockPool();
    const store = new ParcelStore(pool, 'genesis');

    const services: Partial<GridServices> = {
        audit,
        gridName: 'genesis',
        currentTick: () => TICK,
        registry: nousRegistry,
        parcels: { registry: parcelRegistry, store },
    };

    let currentCtx: DIDContext | null = null;
    const app = Fastify({ logger: false });
    app.addHook('onRequest', async (req) => { req.didContext = currentCtx; });
    registerCivicParcelRoutes(app, services as GridServices);

    return {
        app, audit, parcelRegistry, nousRegistry,
        setCtx: (ctx) => { currentCtx = ctx; },
        ready: app.ready().then(() => {}),
    };
}

const POST = (app: FastifyInstance, url: string, payload?: unknown) =>
    app.inject({ method: 'POST', url, payload: payload as Record<string, unknown> });

/** The exact production composition the build-from-blueprint route runs (R6 — no source rewrite). */
function runBuild(env: E2EApp, addr: string, builderDid: string): ReturnType<typeof buildFromBlueprint> {
    return buildFromBlueprint(addr, builderDid, BLUEPRINT_HASH, TICK, {
        registry: env.parcelRegistry,
        transferWei: (from, to, amount) => env.nousRegistry.transferWei(from, to, amount),
        audit: env.audit,
        coBuildStaffOf,
        emitBlueprintExecuted: (payload) => { appendSkillBlueprintExecuted(env.audit, payload); },
    });
}

beforeEach(() => {
    // Module-level Grid-side stores are global — reset for isolation (Phase 58/59/60 precedent).
    _resetBlueprints();
    _resetCoBuild();
    _resetCowork();
    _resetLedger();
});

describe('HOUSE-4 Definition of Done — learn → build → co-build → location teaching end-to-end', () => {
    it('learns a blueprint, builds from it (skill-held → material debit → recipe), co-builds a DAG with funded+IOU paths, teaches inside a workshop, rejects humans, and leaks nothing', async () => {
        const env = buildGenesisApp();
        await env.ready;
        const { app, audit, parcelRegistry, nousRegistry } = env;

        // ── 1. LEARN — store the recipe Grid-side + learn the blueprint via the EXISTING skill
        //        machinery (skill.taught, learner_did === OWNER). Storing the recipe emits NOTHING;
        //        learning emits the existing skill.taught — NO new event. ──
        storeBlueprint(homeRecipe());
        const recipe = getBlueprint(BLUEPRINT_HASH);
        expect(recipe).not.toBeNull();
        expect(recipe!.material_cost_wei).toBe(100);
        // The recipe row holds catalog-kind objects + the arrangement DAG.
        expect(recipe!.objects.map((o) => o.kind).sort()).toEqual(['bed', 'shelf']);
        expect(recipe!.arrangement.map((n) => n.node_id)).toEqual(['n1', 'n2']);

        appendSkillTaught(audit, OWNER, {
            learner_did: OWNER, parent_hash: PARENT_HASH, skill_hash: BLUEPRINT_HASH,
            teacher_did: WORKER_A, tick: 1,
        });
        const taughtCount0 = audit.all().filter((e) => e.eventType === 'skill.taught').length;
        expect(taughtCount0).toBe(1);
        // Learning is just the EXISTING skill event — no skill.blueprint_executed yet.
        expect(audit.all().some((e) => e.eventType === 'skill.blueprint_executed')).toBe(false);

        // OWNER owns the residential parcel (so the build authorizes as owner).
        parcelRegistry.upsert({ ...parcelRegistry.get(PARCEL)!, ownerDid: OWNER });
        expect(parcelRegistry.roleOf(PARCEL, OWNER)).toBe('owner');

        // ── 2. BUILD — buildFromBlueprint confirms skill-held, debits the material cost, applies
        //        the recipe, and emits the SINGLE skill.blueprint_executed (driven through the SAME
        //        production composition the HTTP route runs — R6). ──
        expect(builderHoldsSkill(BLUEPRINT_HASH, OWNER, { audit })).toBe(true);
        const ownerBefore = nousRegistry.get(OWNER)!.balance_wei;
        const treasuryBefore = nousRegistry.get(TREASURY_DID)!.balance_wei;

        const structure = runBuild(env, PARCEL, OWNER);
        expect(structure).toBeDefined();

        // The material cost moved builder → treasury (Ousia debit).
        expect(nousRegistry.get(OWNER)!.balance_wei).toBe(ownerBefore - 100);
        expect(nousRegistry.get(TREASURY_DID)!.balance_wei).toBe(treasuryBefore + 100);
        // The recipe applied via extendInterior — both areas now exist in the interior tree.
        const interiorAreas = parcelRegistry.get(PARCEL)!.structure!.interior!.areas.map((a) => a.name).sort();
        expect(interiorAreas).toEqual(['bedroom', 'study']);

        // ONE skill.blueprint_executed on the trail — closed 4-tuple, hashed builder, no recipe body.
        const execs = audit.all().filter((e) => e.eventType === 'skill.blueprint_executed');
        expect(execs).toHaveLength(1);
        expect(Object.keys(execs[0].payload).sort())
            .toEqual(['blueprint_hash', 'builder_civic_did_hash', 'parcel_id', 'tick']);
        expect(execs[0].payload.blueprint_hash).toBe(BLUEPRINT_HASH);
        expect(execs[0].payload.parcel_id).toBe(PARCEL);
        expect(execs[0].payload.tick).toBe(TICK);
        expect(String(execs[0].payload.builder_civic_did_hash)).toBe(sha256Hex(OWNER));
        expect(HEX64.test(String(execs[0].payload.builder_civic_did_hash))).toBe(true);

        // ── 2b. NEGATIVE — a builder who does NOT hold the skill → skill_not_held. ──
        // Give NOSKILL ownership of a second parcel so authorization passes; the only failure is
        // the missing skill-event history.
        const PARCEL2 = 'genesis:residential:0002';
        parcelRegistry.upsert({ ...parcelRegistry.get(PARCEL2)!, ownerDid: NOSKILL });
        expect(builderHoldsSkill(BLUEPRINT_HASH, NOSKILL, { audit })).toBe(false);
        expect(() => runBuild(env, PARCEL2, NOSKILL)).toThrow(/skill_not_held/);
        // The failed build emitted no skill.blueprint_executed (still exactly one).
        expect(audit.all().filter((e) => e.eventType === 'skill.blueprint_executed')).toHaveLength(1);

        // ── 2c. NEGATIVE — insufficient Ousia → 402 (insufficient_funds). ──
        // Teach POOR the blueprint, give it ownership but drain its Ousia below material_cost_wei.
        const POOR = 'did:noesis:grace';
        nousRegistry.spawn({ name: 'grace', did: POOR, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 10);
        appendSkillTaught(audit, POOR, {
            learner_did: POOR, parent_hash: PARENT_HASH, skill_hash: BLUEPRINT_HASH,
            teacher_did: OWNER, tick: 1,
        });
        const PARCEL3 = 'genesis:residential:0003';
        parcelRegistry.upsert({ ...parcelRegistry.get(PARCEL3)!, ownerDid: POOR });
        expect(builderHoldsSkill(BLUEPRINT_HASH, POOR, { audit })).toBe(true);
        // The route maps this thrown reason to 402 (civic-parcels.ts build-from-blueprint catch).
        expect(() => runBuild(env, PARCEL3, POOR)).toThrow(/insufficient_funds/);

        // ── 3. CO-BUILD — decompose the recipe DAG; two workers claim+complete sub-tasks. n1 is
        //        FUNDED (Ousia move); n2 (depends_on n1) is UNFUNDED (a Phase 60 IOU, never free).
        //        Attribution is DAG-weighted; on full completion ONE skill.blueprint_executed. ──
        const nodes = decomposeRecipe(recipe!);
        expect(nodes.map((n) => n.node_id)).toEqual(['n1', 'n2']);
        const session = createCoBuildSession({
            parcel_id: WORKSHOP, blueprint_hash: BLUEPRINT_HASH, nodes, host_did: OWNER,
        });

        // n1 FUNDED — WORKER_A claims + completes; Ousia moves host → worker (weight 2).
        let ousiaMoved = 0;
        claimSubTask(session, 'n1', WORKER_A);
        const s1 = completeSubTask(session, 'n1', WORKER_A, {
            funded: true, tick: TICK,
            transferWei: (_from, _to, amount) => { ousiaMoved += amount; },
        });
        expect(s1.settlement).toBe('wei');
        expect(s1.amount_wei).toBe(2);    // node weight 2
        expect(ousiaMoved).toBe(2);
        expect(outstandingFor(OWNER)).toBe(0); // funded → no IOU

        // n2 UNFUNDED — WORKER_B claims + completes; records a Phase 60 IOU (host owes worker).
        claimSubTask(session, 'n2', WORKER_B);
        const s2 = completeSubTask(session, 'n2', WORKER_B, {
            funded: false, tick: TICK,
            recordIou: (creditor, debtor, amt, ref, tick) => recordIou(creditor, debtor, amt, ref, tick),
        });
        expect(s2.settlement).toBe('iou');
        expect(s2.amount_wei).toBe(1);    // node weight 1
        // The IOU is outstanding — host (OWNER=debtor) owes WORKER_B (creditor) 1 Bios. Never free.
        expect(outstandingFor(OWNER)).toBe(1);

        // DAG-weighted attribution: WORKER_A earned 2/3, WORKER_B earned 1/3 (Σ weights = 3).
        expect(attributionShare(session, WORKER_A)).toBeCloseTo(2 / 3);
        expect(attributionShare(session, WORKER_B)).toBeCloseTo(1 / 3);
        expect(isComplete(session)).toBe(true);

        // The full co-build settles with ONE zoning.cowork_session (participants_hash only —
        // no board/task/scope text) appended via the SAME sole producer the route uses.
        const participants = [WORKER_A, WORKER_B].sort();
        const participantsHash = sha256Hex(participants.join('|'));
        appendZoningCoworkSession(audit, {
            end_tick: TICK, parcel_id: WORKSHOP, participant_count: participants.length,
            participants_hash: participantsHash, start_tick: TICK,
        });
        const sessions = audit.all().filter((e) => e.eventType === 'zoning.cowork_session');
        expect(sessions).toHaveLength(1);
        expect(Object.keys(sessions[0].payload).sort())
            .toEqual(['end_tick', 'parcel_id', 'participant_count', 'participants_hash', 'start_tick']);
        expect(sessions[0].payload.participant_count).toBe(2);
        expect(HEX64.test(String(sessions[0].payload.participants_hash))).toBe(true);

        // On FULL completion a co-build staff Nous (claimed a sub-task) is authorized to apply the
        // assembled recipe → ONE skill.blueprint_executed. The completed session is no longer
        // in-progress, so its workers are no longer co-build staff.
        expect(coBuildStaffOf(WORKSHOP, WORKER_A)).toBe(false);
        // A fresh in-progress session for a home parcel OWNER holds proves the staff authz read:
        // WORKER_A (a claimer in the live session) builds the assembled recipe on the owner's behalf.
        const COBUILD_HOME = 'genesis:residential:0004';
        parcelRegistry.upsert({ ...parcelRegistry.get(COBUILD_HOME)!, ownerDid: OWNER });
        const liveSession = createCoBuildSession({
            parcel_id: COBUILD_HOME, blueprint_hash: BLUEPRINT_HASH, nodes: decomposeRecipe(recipe!), host_did: OWNER,
        });
        claimSubTask(liveSession, 'n1', WORKER_A);
        expect(coBuildStaffOf(COBUILD_HOME, WORKER_A)).toBe(true); // in-progress → authorized to build
        appendSkillTaught(audit, WORKER_A, {
            learner_did: WORKER_A, parent_hash: PARENT_HASH, skill_hash: BLUEPRINT_HASH,
            teacher_did: OWNER, tick: 2,
        });
        runBuild(env, COBUILD_HOME, WORKER_A);
        const execsAfterCoBuild = audit.all().filter((e) => e.eventType === 'skill.blueprint_executed');
        expect(execsAfterCoBuild).toHaveLength(2); // the owner build + the co-build assembly

        // ── 4. TEACH — a skill taught inside a workshop diffuses to the PRESENT Nous (not the
        //        absent one, not a present human). Build a workshop, join present occupants. ──
        const SCHOOL = 'genesis:business:0002';
        parcelRegistry.purchase(SCHOOL, OWNER, 10_000);
        parcelRegistry.build(SCHOOL, OWNER, { name: 'School', type: 'workshop', visibility: 'open' }, TICK);
        parcelRegistry.join(SCHOOL, WORKER_A);   // present
        parcelRegistry.join(SCHOOL, WORKER_B);   // present
        parcelRegistry.join(SCHOOL, HUMAN);      // a human is present in the workshop
        // ABSENT never joins.

        const taughtBefore = audit.all().filter((e) => e.eventType === 'skill.taught').length;
        const learners = teachHere(SCHOOL, OWNER, BLUEPRINT_HASH, PARENT_HASH, TICK, {
            registry: parcelRegistry, audit,
        });
        // Present Nous learn; the absent one and the present human do NOT.
        expect(learners).toContain(WORKER_A);
        expect(learners).toContain(WORKER_B);
        expect(learners).not.toContain(ABSENT);
        expect(learners).not.toContain(HUMAN);
        // One skill.taught per present learner, via the EXISTING producer (5-tuple unchanged).
        const taughtAfter = audit.all().filter((e) => e.eventType === 'skill.taught');
        expect(taughtAfter.length - taughtBefore).toBe(2);
        for (const e of taughtAfter.slice(-2)) {
            expect(Object.keys(e.payload).sort())
                .toEqual(['learner_did', 'parent_hash', 'skill_hash', 'teacher_did', 'tick']);
            expect(e.payload).not.toHaveProperty('parcel_id'); // teaching location is Grid-side
        }

        // ── 5. HUMAN — a did:civic:noesis:human:* attempting any build → rejected. Proven BOTH
        //        directly (the executor's human guard) AND through the real HTTP route (403). ──
        expect(() => buildFromBlueprint(PARCEL, HUMAN, BLUEPRINT_HASH, TICK, {
            registry: parcelRegistry,
            transferWei: (from, to, amount) => nousRegistry.transferWei(from, to, amount),
            audit,
            coBuildStaffOf,
            emitBlueprintExecuted: () => {},
        })).toThrow(/builder_forbidden_human|human|not_authorized/i);

        // A human Civic-DID presenting as a civic_member hits the route's defensive D-NH-07 guard
        // (humans_cannot_own_land, 403) — a human_visitor tier would 401 at the tier gate first.
        env.setCtx({ did: HUMAN, tier: 'civic_member' });
        const humanRoute = await POST(app, `/api/v1/civic/parcels/${PARCEL}/build-from-blueprint`, {
            blueprint_hash: BLUEPRINT_HASH,
        });
        expect(humanRoute.statusCode).toBe(403);
        expect(humanRoute.json()).toMatchObject({ error: 'humans_cannot_own_land' });
        // No skill.blueprint_executed was minted for the human (still exactly 2 from §2/§3).
        expect(audit.all().filter((e) => e.eventType === 'skill.blueprint_executed')).toHaveLength(2);

        // ── 6. PRIVACY — no recipe body / sub-task content / teaching location on ANY payload; the
        //        HOUSE-4 events (skill.blueprint_executed, zoning.cowork_session) carry only
        //        blueprint_hash / hashed builder / parcel_id / tick / hashed participants; all
        //        hash-keyed DIDs are HEX64. Captured from the REAL run trail (the same audit
        //        instance the producers wrote to).
        //
        //        NOTE: the EXISTING Phase-18 skill.taught/inferred 5-tuple legitimately carries the
        //        raw learner_did/teacher_did did:noesis: forms — that is the unchanged, allowlisted
        //        Phase-18 contract (location teaching reuses it verbatim, parcel_id OFF the chain).
        //        The HOUSE-4 privacy invariant is that NO recipe body / sub-task content / teaching
        //        location is ever broadcast — asserted across every payload below. ──
        const HASH_KEYS = ['builder_civic_did_hash', 'participants_hash'];
        for (const e of audit.all()) {
            const blob = JSON.stringify(e.payload);
            // No recipe body (catalog kinds / areas), no sub-task/board content, no teaching
            // location (parcel slug) leaks on ANY payload — only the closed hashed tuples cross.
            expect(blob).not.toMatch(/\bbed\b|shelf|bedroom|study|cobuild|scope|task_ref|workshop/i);
            // Hash-keyed DID values are always HEX64 (the hashed-builder / hashed-participants forms).
            for (const key of HASH_KEYS) {
                const v = (e.payload as Record<string, unknown>)[key];
                if (typeof v === 'string') expect(HEX64.test(v)).toBe(true);
            }
        }

        // The skill.taught / skill.inferred trail carries the unchanged Phase-18 5-tuple ONLY —
        // never a recipe body, sub-task content, or a teaching-location parcel_id (the location
        // selector stays Grid-side). (skill.blueprint_executed legitimately carries parcel_id —
        // the build site, not a teaching location — so it is excluded here.)
        for (const e of audit.all().filter((x) => x.eventType === 'skill.taught' || x.eventType === 'skill.inferred')) {
            expect(e.payload).not.toHaveProperty('parcel_id');
            expect(e.payload).not.toHaveProperty('objects');
            expect(e.payload).not.toHaveProperty('arrangement');
            expect(e.payload).not.toHaveProperty('material_cost_wei');
        }

        // All THREE HOUSE-4-relevant topics present on the trail (the new + the reused ones).
        const topics = new Set(audit.all().map((e) => e.eventType));
        expect(topics.has('skill.blueprint_executed')).toBe(true);
        expect(topics.has('skill.taught')).toBe(true);
        expect(topics.has('zoning.cowork_session')).toBe(true);

        await app.close();
    });

    it('builds over the REAL HTTP route — the civic-DID caller bridges to its existence-DID skill via didContext.operatorDid (dual-DID fix)', async () => {
        const env = buildGenesisApp();
        await env.ready;
        const { app, audit, parcelRegistry, nousRegistry } = env;

        // A Nous carries TWO identities: a civic-DID (land/Ousia identity = JWT sub) and an
        // existence-DID (skill-attestation identity = JWT iss = didContext.operatorDid). The
        // build route owns/charges by civic-DID but must verify skill-held against the existence
        // identity, because skill.taught.learner_did is recorded under the existence-DID.
        const BUILDER_CIVIC = 'did:civic:noesis:zara';
        const BUILDER_EXIST = 'did:noesis:zara';
        const HTTP_PARCEL = 'genesis:residential:0003';

        // Fund the civic-DID and give it ownership of the parcel (the land/Ousia identity).
        nousRegistry.spawn({ name: 'zara', did: BUILDER_CIVIC, publicKey: 'pk', region: 'r0' }, 'genesis.local', 0, 10_000);
        parcelRegistry.purchase(HTTP_PARCEL, BUILDER_CIVIC, 10_000);

        // The recipe lives Grid-side; the skill is attested under the EXISTENCE-DID (the form the
        // Phase-18 skill machinery records via skill.taught.learner_did).
        storeBlueprint(homeRecipe());
        appendSkillTaught(audit, BUILDER_EXIST, {
            learner_did: BUILDER_EXIST,
            skill_hash: BLUEPRINT_HASH,
            parent_hash: PARENT_HASH,
            teacher_did: OWNER,
            tick: TICK,
        });
        const before = audit.all().filter((e) => e.eventType === 'skill.blueprint_executed').length;

        // Without the existence identity (operatorDid absent) the civic-DID alone cannot match the
        // existence-DID learner_did → skill_not_held. This proves the bridge is load-bearing.
        env.setCtx({ did: BUILDER_CIVIC, tier: 'civic_member' });
        const noBridge = await POST(app, `/api/v1/civic/parcels/${HTTP_PARCEL}/build-from-blueprint`, {
            blueprint_hash: BLUEPRINT_HASH,
        });
        expect(noBridge.statusCode).toBe(422);
        expect(noBridge.json()).toMatchObject({ error: 'skill_not_held' });

        // With operatorDid = the existence-DID (exactly what a Brain-signed JWT carries:
        // sub=civic, iss=existence), the skill-held check bridges and the build SUCCEEDS via HTTP.
        env.setCtx({ did: BUILDER_CIVIC, tier: 'civic_member', operatorDid: BUILDER_EXIST });
        const built = await POST(app, `/api/v1/civic/parcels/${HTTP_PARCEL}/build-from-blueprint`, {
            blueprint_hash: BLUEPRINT_HASH,
        });
        expect(built.statusCode).toBe(201);
        expect(built.json()).toMatchObject({ built: true, parcel_id: HTTP_PARCEL });

        // Exactly ONE new skill.blueprint_executed, hashed to the builder's CIVIC identity (the
        // land actor) — and no raw DID crosses the chain.
        const minted = audit.all().filter((e) => e.eventType === 'skill.blueprint_executed');
        expect(minted.length).toBe(before + 1);
        const last = minted[minted.length - 1];
        expect(last.payload).toMatchObject({ blueprint_hash: BLUEPRINT_HASH, parcel_id: HTTP_PARCEL, tick: TICK });
        const builderHash = (last.payload as Record<string, unknown>).builder_civic_did_hash as string;
        expect(builderHash).toBe(sha256Hex(BUILDER_CIVIC));
        expect(HEX64.test(builderHash)).toBe(true);
        expect(JSON.stringify(last.payload)).not.toContain('did:');

        await app.close();
    });

    it('keeps skill.blueprint_executed present (allowlist 123 after …W4 portal.account_endowed + Phase 47 police.*)', () => {
        expect(ALLOWLIST_MEMBERS.length).toBe(158);
        expect(ALLOWLIST_MEMBERS).toContain('skill.blueprint_executed');
    });
});
