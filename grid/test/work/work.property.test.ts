/**
 * Work Card properties — the code leg of the Triple Verification Rule for P-WORK-01..09.
 *
 * Model legs: verification/tla/Work.tla, verification/lean/Verification/Work.lean.
 * Registry:   verification/PROPERTIES.md.
 *
 * Inputs are generated. Set PBT_SEED to replay a run, PBT_RUNS to change the case count.
 *
 * What runs for real: createWork and applyWorkOp (work-logic.ts), WorkService, the
 * work.stage_changed producer and AuditChain. The database is replaced by
 * InMemoryWorkStore; who is a member is a map in this file.
 *
 * The stage edges, the role table and the card invariants below are written out apart
 * from the code under test.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createHash } from 'node:crypto';
import { AuditChain } from '../../src/audit/chain.js';
import { payloadPrivacyCheck } from '../../src/audit/broadcast-allowlist.js';
import { allowedOps, applyWorkOp, WORK_LIMITS, WORK_OPS, type MemberKind, type WorkCard } from '../../src/work/work-logic.js';
import { WorkService, type WorkRow } from '../../src/work/work-service.js';
import { InMemoryWorkStore } from '../helpers/in-memory-work-store.js';

const seed = process.env.PBT_SEED ? Number(process.env.PBT_SEED) : Date.now() | 0;
const numRuns = process.env.PBT_RUNS ? Number(process.env.PBT_RUNS) : 1000;
console.log(`[work.property] seed=${seed} numRuns=${numRuns}`);
const params = { seed, numRuns };

const GRID = 'genesis';
const PERSONS = ['did:civic:noesis:human:p1', 'did:civic:noesis:human:p2'];
const NOUS = ['did:civic:noesis:n1', 'did:civic:noesis:n2', 'did:civic:noesis:n3'];
const OUTSIDER = 'did:civic:noesis:x';
const EVERYONE = [...PERSONS, ...NOUS, OUTSIDER];
const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

// ── The oracle: written apart from work-logic.ts ───────────────────────────────────────
const EDGES: Record<string, string[]> = {
    enter: ['goal', 'define'],
    goal: ['define', 'declined'],
    define: ['plan'],
    plan: ['build'],
    build: ['test'],
    test: ['verify'],
    verify: ['deploy', 'test'],
    deploy: ['notice'],
    notice: ['done'],
    done: [],
    declined: [],
};
const ORDER = ['goal', 'define', 'plan', 'build', 'test', 'verify', 'deploy', 'notice', 'done'];
const atOrAfter = (c: WorkCard, s: string): boolean => c.stage !== 'declined' && ORDER.indexOf(c.stage) >= ORDER.indexOf(s);
const OP_STAGE: Record<string, string> = {
    answer: 'goal', define: 'define', set_plan: 'plan', approve_plan: 'plan', complete_step: 'build',
    record_check: 'test', verify: 'verify', deploy: 'deploy', announce: 'notice',
};
const OPS = Object.keys(OP_STAGE);
/** Stages 2 to 4 are set up by the owner (or the builder); 5 to 9 belong to Nous. */
function roleAllows(op: string, c: WorkCard, actor: string): boolean {
    switch (op) {
        case 'answer': case 'complete_step': case 'record_check': case 'deploy': case 'announce': return actor === c.builder;
        case 'define': case 'set_plan': return actor === c.owner || actor === c.builder;
        case 'approve_plan': return actor === c.owner;
        case 'verify': return actor !== c.builder && NOUS.includes(actor);
        default: return false;
    }
}

/** P-WORK-02, 03, 04, 05, 09 and the card's own shape. */
function checkCard(row: WorkRow, kinds: ReadonlyMap<string, MemberKind>): void {
    const c = row.card;
    expect(JSON.parse(row.json)).toEqual(c);
    expect(row.hash).toBe(sha(row.json));
    expect(Object.keys(EDGES)).toContain(c.stage);
    // P-WORK-05: the builder is a Nous, never a person.
    expect(NOUS).toContain(c.builder);
    expect(kinds.get(c.builder) ?? 'nous').toBe('nous');
    expect(c.results.length).toBe(c.checks.length);
    const done = c.plan.filter((s) => s.done).length;
    // Steps are done in order.
    c.plan.forEach((s, i) => { expect(s.step).toBe(i + 1); expect(s.done).toBe(i < done); });
    // P-WORK-02: no building before the checks are written and the plan is approved.
    if (atOrAfter(c, 'build')) {
        expect(c.checks.length).toBeGreaterThan(0);
        expect(c.plan_approved).toBe(true);
        expect(c.plan.length).toBeGreaterThan(0);
    } else {
        expect(done).toBe(0);
    }
    if (c.stage === 'build') expect(done).toBeLessThan(c.plan.length);
    // P-WORK-03: no verifying before every step is done and every check has passed, with evidence.
    if (atOrAfter(c, 'test')) expect(done).toBe(c.plan.length);
    if (atOrAfter(c, 'verify')) {
        for (const r of c.results) {
            expect(r?.passed).toBe(true);
            expect(r!.evidence.trim().length).toBeGreaterThan(0);
        }
    }
    // P-WORK-04: the verifier is a Nous other than the builder; a deployed Work has one.
    if (c.verified) {
        expect(c.verified.by).not.toBe(c.builder);
        expect(NOUS).toContain(c.verified.by);
        expect(c.verified.reason.trim().length).toBeGreaterThan(0);
    }
    if (atOrAfter(c, 'deploy')) expect(c.verified).not.toBeNull();
    // P-WORK-09: a Work past Deploy has its result record with its provenance; a done Work its notice.
    if (atOrAfter(c, 'notice')) {
        expect(c.result).not.toBeNull();
        expect(c.result!.built_by).toBe(c.builder);
        expect(c.result!.verified_by).toBe(c.verified!.by);
        expect(c.result!.built_from).toEqual(c.which);
        expect(c.result!.where.trim().length).toBeGreaterThan(0);
    } else {
        expect(c.result).toBeNull();
    }
    if (c.stage === 'done') {
        expect(c.notice).not.toBeNull();
        for (const part of [c.notice!.goal_info, c.notice!.guide, c.notice!.presentation]) {
            expect(part.trim().length).toBeGreaterThan(0);
        }
    } else {
        expect(c.notice).toBeNull();
    }
    // The limits on text hold for everything stored.
    expect(c.goal.length).toBeLessThanOrEqual(WORK_LIMITS.goal);
    expect(c.checks.length).toBeLessThanOrEqual(WORK_LIMITS.checks);
    expect(c.plan.length).toBeLessThanOrEqual(WORK_LIMITS.steps);
    expect(row.json.length).toBeLessThan(400_000);
}

/** P-WORK-07: the audit records of one Work, checked against the stored card. */
function stageRecords(audit: AuditChain, workId: string) {
    return audit.all().filter((e) => e.eventType === 'work.stage_changed' && (e.payload as { work_id: string }).work_id === workId);
}
function checkAuditRecord(entry: { actorDid: string; payload: unknown }, from: string, to: string, actor: string, row: WorkRow, tick: number): void {
    const p = entry.payload as Record<string, unknown>;
    expect(Object.keys(p).sort()).toEqual(['actor_did_hash', 'card_hash', 'from_stage', 'tick', 'to_stage', 'work_id']);
    expect(p.actor_did_hash).toBe(sha(actor));
    expect(entry.actorDid).toBe(sha(actor));
    expect(p.card_hash).toBe(sha(row.json));
    expect(p.from_stage).toBe(from);
    expect(p.to_stage).toBe(to);
    expect(p.tick).toBe(tick);
    expect(p.work_id).toBe(row.card.work_id);
    expect(EDGES[from]).toContain(to);
    expect(payloadPrivacyCheck(p).ok).toBe(true);
    // Never the card's wording: every value is a hash, a stage name, the id or the tick.
    for (const v of Object.values(p)) {
        expect(typeof v === 'number' || /^[0-9a-f]{64}$/.test(String(v)) || Object.keys(EDGES).includes(String(v)) || v === row.card.work_id).toBe(true);
    }
}

// ── Generators ─────────────────────────────────────────────────────────────────────────
const okText = (max: number): fc.Arbitrary<string> => fc.oneof(
    { weight: 5, arbitrary: fc.string({ minLength: 1, maxLength: Math.min(max, 24) }).filter((s) => s.trim().length > 0) },
    { weight: 2, arbitrary: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 8 }).filter((s) => s.trim().length > 0) },
    { weight: 1, arbitrary: fc.constantFrom('읽을 곳 🌍', 'x'.repeat(max), '<script>alert(1)</script>', '{"stage":"done"}') },
);
const badText = (max: number): fc.Arbitrary<unknown> => fc.oneof(
    fc.constantFrom('', '   ', '\n\t', 'x'.repeat(max + 1), null, undefined, 0, 1, -1, true, [], {}, ['a'], { length: 3 }),
    // Anything at all, except what would pass as a valid text.
    fc.anything().filter((v) => !(typeof v === 'string' && v.trim().length > 0 && v.length <= max)),
);
/** Mostly well-formed, sometimes hostile. `clean` says whether the generator meant it to be valid. */
function field<T>(good: fc.Arbitrary<T>, bad: fc.Arbitrary<unknown>): fc.Arbitrary<{ v: unknown; clean: boolean }> {
    return fc.oneof(
        { weight: 19, arbitrary: good.map((v) => ({ v: v as unknown, clean: true })) },
        { weight: 1, arbitrary: bad.map((v) => ({ v, clean: false })) },
    );
}
const text = (max: number) => field(okText(max), badText(max));
const optionalText = (max: number) => field(fc.oneof(okText(max), fc.constant('')), fc.oneof(fc.constantFrom('x'.repeat(max + 1), null, 7, {}), fc.anything().filter((v) => typeof v !== 'string')));
const bool = field(fc.oneof({ weight: 4, arbitrary: fc.constant(true) }, { weight: 1, arbitrary: fc.constant(false) }), fc.constantFrom('true', 1, 0, null, undefined, 'yes', {}));
const L = WORK_LIMITS;
const arbList = (item: fc.Arbitrary<string>, min: number, max: number) => field(
    fc.oneof(
        { weight: 8, arbitrary: fc.array(item, { minLength: min, maxLength: Math.min(max, 3) }) },
        { weight: 1, arbitrary: fc.array(item, { minLength: max, maxLength: max }) },
    ),
    fc.oneof(
        fc.array(item, { minLength: max + 1, maxLength: max + 1 }),
        min > 0 ? fc.constant([]) : fc.constant('not a list'),
        fc.constantFrom(null, 'a', 5, { 0: 'a', length: 1 }, [''], [null], [['a']]),
    ),
);
const arbByTick = field(fc.oneof(fc.nat(100_000), fc.constantFrom(0, 1, Number.MAX_SAFE_INTEGER)), fc.constantFrom(-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, '5', null));
const arbSteps = fc.oneof(
    { weight: 9, arbitrary: fc.array(fc.record({ do: text(L.field), by_tick: arbByTick }), { minLength: 1, maxLength: 3 }) },
    { weight: 1, arbitrary: fc.array(fc.record({ do: text(L.field), by_tick: arbByTick }), { minLength: L.steps, maxLength: L.steps }) },
).map((steps) => ({
    v: steps.map((s) => ({ do: s.do.v, by_tick: s.by_tick.v })) as unknown,
    clean: steps.every((s) => s.do.clean && s.by_tick.clean),
}));
const arbStepsField = fc.oneof(
    { weight: 9, arbitrary: arbSteps },
    { weight: 1, arbitrary: fc.oneof(fc.constantFrom([], null, 'steps', [null], [{}], [{ do: 'a' }], Array(L.steps + 1).fill({ do: 'a', by_tick: 1 })), fc.anything()).map((v) => ({ v: v as unknown, clean: false })) },
);
/** Which step or check to name: the right one, or some other number. */
const arbIndex = fc.oneof(
    { weight: 9, arbitrary: fc.constant({ mode: 'right' as const, n: 0 }) },
    { weight: 1, arbitrary: fc.oneof(fc.integer({ min: -2, max: 60 }), fc.constantFrom(0, 1.5, NaN)).map((n) => ({ mode: 'num' as const, n })) },
    { weight: 1, arbitrary: fc.constantFrom('1', null, undefined, {}).map((n) => ({ mode: 'raw' as const, n: n as unknown as number })) },
);

const arbPayload = fc.record({
    accept: bool, confirm: bool, passed: bool,
    reason: text(L.field), note: optionalText(L.field), evidence: text(L.field),
    for_what: text(L.field), how: text(L.field),
    which: arbList(okText(L.whichItem), 0, L.which),
    checks: arbList(okText(L.check), 1, L.checks),
    steps: arbStepsField, step: arbIndex, check: arbIndex,
    where: text(L.field), changed: text(L.field),
    goal_info: text(L.notice), guide: text(L.notice), presentation: text(L.notice),
});
type Payload = typeof arbPayload extends fc.Arbitrary<infer T> ? T : never;

const arbStep = fc.record({
    // Who writes: someone the operation allows, or anyone at all.
    who: fc.oneof({ weight: 8, arbitrary: fc.constant(-1) }, { weight: 2, arbitrary: fc.nat(EVERYONE.length - 1) }),
    pick: fc.nat(1000),
    // Which operation: one that fits the stage, any named one, or junk.
    op: fc.oneof(
        { weight: 16, arbitrary: fc.constant('fit') },
        { weight: 3, arbitrary: fc.constantFrom(...OPS) },
        { weight: 1, arbitrary: fc.constantFrom('junk', 'create', '__proto__', '') },
    ),
    payload: arbPayload,
    base: fc.oneof(
        { weight: 12, arbitrary: fc.constant('current' as const) },
        { weight: 1, arbitrary: fc.constantFrom('older' as const, 'newer' as const, 'string' as const, 'missing' as const) },
    ),
    // Someone stops being a member first.
    leaves: fc.oneof({ weight: 150, arbitrary: fc.constant(-1) }, { weight: 1, arbitrary: fc.nat(EVERYONE.length - 2) }),
    junk: fc.anything(),
    tickStep: fc.nat(50),
});

const arbCreate = fc.record({
    actor: fc.oneof({ weight: 8, arbitrary: fc.nat(PERSONS.length + NOUS.length - 1) }, { weight: 1, arbitrary: fc.constant(EVERYONE.length - 1) }),
    // The builder: left out, the actor itself, or any DID.
    builder: fc.oneof(
        { weight: 3, arbitrary: fc.constant('omit' as const) },
        { weight: 1, arbitrary: fc.constant('self' as const) },
        { weight: 6, arbitrary: fc.nat(EVERYONE.length - 1) },
        { weight: 1, arbitrary: fc.constantFrom('', 'did:civic:noesis:ghost', 5, null, {}).map((v) => ({ raw: v as unknown })) },
    ),
    goal: text(L.goal),
    for_whom: text(L.forWhom),
    // If that goal is refused, the run goes on with this one: any member, any Nous.
    fallbackOwner: fc.nat(PERSONS.length + NOUS.length - 1),
    fallbackBuilder: fc.nat(NOUS.length - 1),
});

// ── What an operation needs to be accepted, for the "must be accepted" half ────────────
function build(op: string, p: Payload, c: WorkCard): { body: Record<string, unknown>; clean: boolean } {
    const idx = (i: Payload['step'], right: number) => (i.mode === 'right' ? { v: right as unknown, clean: true } : { v: i.n as unknown, clean: i.n === right });
    switch (op) {
        case 'answer': {
            // A reason is needed only to decline.
            const declining = p.accept.clean && p.accept.v === false;
            return { body: { accept: p.accept.v, reason: p.reason.v }, clean: p.accept.clean && (p.reason.clean || (!declining && p.reason.v === '')) };
        }
        case 'define': return { body: { for_what: p.for_what.v, how: p.how.v, which: p.which.v, checks: p.checks.v }, clean: p.for_what.clean && p.how.clean && p.which.clean && p.checks.clean };
        case 'set_plan': return { body: { steps: p.steps.v }, clean: p.steps.clean };
        case 'approve_plan': return { body: {}, clean: c.plan.length > 0 };
        case 'complete_step': { const s = idx(p.step, c.plan.filter((x) => x.done).length + 1); return { body: { step: s.v, note: p.note.v }, clean: s.clean && p.note.clean }; }
        case 'record_check': {
            const open = c.results.findIndex((r) => r === null || !r.passed);
            const s = idx(p.check, (open < 0 ? 0 : open) + 1);
            const inRange = typeof s.v === 'number' && Number.isInteger(s.v) && s.v >= 1 && s.v <= c.checks.length;
            return { body: { check: s.v, passed: p.passed.v, evidence: p.evidence.v }, clean: inRange && p.passed.clean && p.evidence.clean };
        }
        case 'verify': return { body: { confirm: p.confirm.v, reason: p.reason.v }, clean: p.confirm.clean && p.reason.clean };
        case 'deploy': return { body: { where: p.where.v, changed: p.changed.v }, clean: p.where.clean && p.changed.clean };
        case 'announce': return { body: { goal_info: p.goal_info.v, guide: p.guide.v, presentation: p.presentation.v }, clean: p.goal_info.clean && p.guide.clean && p.presentation.clean };
        default: return { body: {}, clean: false };
    }
}
function fitOp(c: WorkCard, pick: number): string {
    switch (c.stage) {
        case 'goal': return 'answer';
        case 'define': return 'define';
        case 'plan': return c.plan.length === 0 || pick % 5 === 0 ? 'set_plan' : 'approve_plan';
        case 'build': return 'complete_step';
        case 'test': return 'record_check';
        case 'verify': return 'verify';
        case 'deploy': return 'deploy';
        case 'notice': return 'announce';
        default: return OPS[pick % OPS.length]!;
    }
}

function makeWorld() {
    const kinds = new Map<string, MemberKind>([
        ...PERSONS.map((d) => [d, 'person'] as const),
        ...NOUS.map((d) => [d, 'nous'] as const),
    ]);
    const store = new InMemoryWorkStore();
    const audit = new AuditChain();
    let n = 0;
    const service = new WorkService({
        gridName: GRID, store, audit,
        memberKind: async (did) => kinds.get(did) ?? null,
        newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    });
    return { kinds, store, audit, service };
}

const reached = { done: 0, declined: 0, refusedByVerifier: 0, runs: 0, accepted: 0, refused: 0 };

describe('Work Card — generated sequences against WorkService', () => {
    it('P-WORK-01..09: every write keeps every invariant; a refused write changes nothing', async () => {
        await fc.assert(fc.asyncProperty(arbCreate, fc.array(arbStep, { minLength: 0, maxLength: 60, size: 'max' }), async (create, steps) => {
            const w = makeWorld();
            let tick = 5;
            reached.runs++;

            // ── Create (stages 1 and 2: a member states a goal) ──
            const actor = EVERYONE[create.actor]!;
            const body: Record<string, unknown> = { goal: create.goal.v, for_whom: create.for_whom.v };
            let builder: unknown;
            if (create.builder === 'omit') builder = undefined;
            else if (create.builder === 'self') builder = actor;
            else if (typeof create.builder === 'number') builder = EVERYONE[create.builder]!;
            else builder = create.builder.raw;
            if (builder !== undefined) body.builder = builder;
            const effectiveBuilder = builder === undefined ? actor : builder;
            let created = await w.service.create(actor, body, tick);
            const shouldCreate = w.kinds.has(actor) && create.goal.clean && create.for_whom.clean
                && typeof effectiveBuilder === 'string' && w.kinds.get(effectiveBuilder) === 'nous';
            // P-WORK-05, P-WORK-06: a goal is taken only from a member, and only with a Nous member as builder.
            expect(created.ok).toBe(shouldCreate);
            let owner = actor;
            let namedBuilder = effectiveBuilder;
            if (!created.ok) {
                expect(w.store.rows.size).toBe(0);
                expect(w.audit.all().length).toBe(0);
                owner = EVERYONE[create.fallbackOwner]!;
                namedBuilder = NOUS[create.fallbackBuilder]!;
                created = await w.service.create(owner, { goal: 'a reading room', for_whom: 'new residents', builder: namedBuilder }, tick);
                if (!created.ok) throw new Error(`a well-formed goal was refused: ${created.error}`);
            }
            const id = created.card.work_id;
            let row = (await w.store.get(GRID, id))!;
            expect(row.card).toEqual(created.card);
            expect(row.card.owner).toBe(owner);
            expect(row.card.builder).toBe(namedBuilder);
            expect(row.card.version).toBe(1);
            expect(row.card.stage).toBe(namedBuilder === owner ? 'define' : 'goal');
            checkCard(row, w.kinds);
            let records = stageRecords(w.audit, id);
            expect(records.length).toBe(1);
            checkAuditRecord(records[0]!, 'enter', row.card.stage, owner, row, tick);

            for (const s of steps) {
                tick += s.tickStep;
                if (s.leaves >= 0) w.kinds.delete(EVERYONE[s.leaves]!);
                const before = row;
                const c = before.card;
                const opName = s.op === 'fit' ? fitOp(c, s.pick) : s.op;
                let who: string;
                if (s.who >= 0) who = EVERYONE[s.who]!;
                else {
                    const allowed = EVERYONE.filter((d) => d !== OUTSIDER && roleAllows(opName, c, d));
                    who = allowed.length ? allowed[s.pick % allowed.length]! : EVERYONE[s.pick % EVERYONE.length]!;
                }
                const built = OPS.includes(opName) ? build(opName, s.payload, c) : { body: {}, clean: false };
                const op: unknown = s.op === 'junk' ? s.junk : { op: opName, ...built.body };
                const base: unknown = s.base === 'current' ? c.version : s.base === 'older' ? c.version - 1
                    : s.base === 'newer' ? c.version + 1 : s.base === 'string' ? String(c.version) : undefined;

                // P-WORK-06: what the card offers a member is exactly the stage-and-role table.
                expect([...WORK_OPS]).toEqual(OPS);
                for (const d of [...PERSONS, ...NOUS]) {
                    const kind: MemberKind = PERSONS.includes(d) ? 'person' : 'nous';
                    expect(allowedOps(c, { did: d, kind })).toEqual(OPS.filter((o) => OP_STAGE[o] === c.stage && roleAllows(o, c, d)));
                }
                const res = await w.service.write(who, id, base, op, tick);
                row = (await w.store.get(GRID, id))!;
                const recordsNow = stageRecords(w.audit, id);
                const mayWrite = w.kinds.has(who) && base === c.version && OP_STAGE[opName] === c.stage && roleAllows(opName, c, who);

                if (!res.ok) {
                    reached.refused++;
                    // P-WORK-06: a refused write changes nothing, and leaves no audit record.
                    expect(row.json).toBe(before.json);
                    expect(recordsNow.length).toBe(records.length);
                    // …and a well-formed write from the right member, on the current version, is never refused.
                    expect(mayWrite && built.clean && s.op !== 'junk').toBe(false);
                } else {
                    reached.accepted++;
                    // P-WORK-06: applied only from a current member, in the operation's stage and role.
                    expect(mayWrite).toBe(true);
                    expect(res.card).toEqual(row.card);
                    // P-WORK-08: exactly one version up, and only on the version the author named.
                    expect(row.card.version).toBe(c.version + 1);
                    expect(row.card.updated_tick).toBe(tick);
                    // P-WORK-01: the stage stays or moves along an edge.
                    if (row.card.stage !== c.stage) expect(EDGES[c.stage]).toContain(row.card.stage);
                    // What a write may never touch.
                    expect([row.card.work_id, row.card.grid, row.card.owner, row.card.builder, row.card.goal, row.card.created_tick])
                        .toEqual([c.work_id, c.grid, c.owner, c.builder, c.goal, c.created_tick]);
                    // P-WORK-07: one audit record exactly when the stage moved, carrying the stored card's hash.
                    if (row.card.stage !== c.stage) {
                        expect(recordsNow.length).toBe(records.length + 1);
                        checkAuditRecord(recordsNow[recordsNow.length - 1]!, c.stage, row.card.stage, who, row, tick);
                    } else {
                        expect(recordsNow.length).toBe(records.length);
                    }
                    if (c.stage === 'verify' && row.card.stage === 'test') {
                        reached.refusedByVerifier++;
                        expect(row.card.results.every((r) => r === null)).toBe(true);
                    }
                }
                records = recordsNow;
                checkCard(row, w.kinds);
                // P-WORK-01: done and declined never move.
                if (c.stage === 'done' || c.stage === 'declined') expect(res.ok).toBe(false);
            }
            // P-WORK-07: the records, in order, are the path the stage took.
            const path = records.map((e) => e.payload as { from_stage: string; to_stage: string });
            path.forEach((p, i) => { if (i > 0) expect(p.from_stage).toBe(path[i - 1]!.to_stage); });
            expect(path[path.length - 1]!.to_stage).toBe(row.card.stage);
            expect(w.audit.verify().valid).toBe(true);
            if (row.card.stage === 'done') reached.done++;
            if (row.card.stage === 'declined') reached.declined++;
        }), params);

        // The generator must reach the far end of the loop, or the properties above say little.
        console.log(`[work.property] runs=${reached.runs} done=${reached.done} declined=${reached.declined} `
            + `verifier refusals=${reached.refusedByVerifier} accepted=${reached.accepted} refused=${reached.refused}`);
        expect(reached.done).toBeGreaterThan(numRuns * 0.2);
        expect(reached.declined).toBeGreaterThan(0);
        expect(reached.refusedByVerifier).toBeGreaterThan(0);
        expect(reached.refused).toBeGreaterThan(numRuns);
    }, 600_000);

    it('P-WORK-08: of several writes sent on the same version, at most one is applied', async () => {
        await fc.assert(fc.asyncProperty(
            fc.array(fc.record({ who: fc.nat(EVERYONE.length - 1), payload: arbPayload, opPick: fc.nat(1000) }), { minLength: 2, maxLength: 6 }),
            fc.nat(8),
            async (writers, prefix) => {
                const w = makeWorld();
                const created = await w.service.create(NOUS[0]!, { goal: 'g', for_whom: 'w', builder: NOUS[1]! }, 1);
                if (!created.ok) throw new Error('setup');
                const id = created.card.work_id;
                // Walk a good prefix so the race happens at different stages.
                const good: Array<[string, Record<string, unknown>]> = [
                    [NOUS[1]!, { op: 'answer', accept: true, reason: '' }],
                    [NOUS[0]!, { op: 'define', for_what: 'a', how: 'b', which: [], checks: ['c1'] }],
                    [NOUS[1]!, { op: 'set_plan', steps: [{ do: 's', by_tick: 9 }] }],
                    [NOUS[0]!, { op: 'approve_plan' }],
                    [NOUS[1]!, { op: 'complete_step', step: 1, note: '' }],
                    [NOUS[1]!, { op: 'record_check', check: 1, passed: true, evidence: 'e' }],
                    [NOUS[2]!, { op: 'verify', confirm: true, reason: 'r' }],
                    [NOUS[1]!, { op: 'deploy', where: 'here', changed: 'that' }],
                ];
                let version = 1;
                for (const [who, op] of good.slice(0, prefix)) {
                    const r = await w.service.write(who, id, version, op, 2);
                    if (!r.ok) throw new Error(`setup ${String(op.op)}`);
                    version = r.card.version;
                }
                const before = (await w.store.get(GRID, id))!;
                const auditBefore = stageRecords(w.audit, id).length;
                const results = await Promise.all(writers.map((x) => {
                    const opName = x.opPick % 3 === 0 ? OPS[x.opPick % OPS.length]! : fitOp(before.card, x.opPick);
                    return w.service.write(EVERYONE[x.who]!, id, version, { op: opName, ...build(opName, x.payload, before.card).body }, 3);
                }));
                const applied = results.filter((r) => r.ok).length;
                const after = (await w.store.get(GRID, id))!;
                expect(applied).toBeLessThanOrEqual(1);
                expect(after.card.version).toBe(version + applied);
                if (applied === 0) expect(after.json).toBe(before.json);
                // The one applied write is the card that is stored; no other write left a trace.
                for (const r of results) if (r.ok) expect(r.card).toEqual(after.card);
                expect(stageRecords(w.audit, id).length).toBe(auditBefore + (after.card.stage !== before.card.stage ? 1 : 0));
                checkCard(after, w.kinds);
            },
        ), params);
    }, 600_000);
});

describe('Work Card — applyWorkOp alone', () => {
    const card = (): WorkCard => ({
        work_id: '00000000-0000-4000-8000-000000000001', grid: GRID, stage: 'define', version: 1,
        goal: 'g', for_whom: 'w', owner: NOUS[0]!, owner_kind: 'nous', builder: NOUS[0]!, answer: null,
        for_what: '', how: '', which: [], checks: [], plan: [], plan_approved: false, results: [],
        refusals: 0, last_refusal: null, verified: null, result: null, notice: null, created_tick: 1, updated_tick: 1,
    });

    it('P-WORK-06: anything at all as an operation is refused or applied, never thrown, and never changes the card it was given', () => {
        fc.assert(fc.property(fc.anything(), fc.constantFrom(...EVERYONE), fc.oneof(fc.nat(), fc.constantFrom(-1, 1.5, NaN)), (op, who, tick) => {
            const c = card();
            const frozen = JSON.stringify(c);
            const r = applyWorkOp(c, { did: who, kind: PERSONS.includes(who) ? 'person' : 'nous' }, op, tick);
            expect(JSON.stringify(c)).toBe(frozen);
            if (r.ok) expect(r.card.version).toBe(2); else expect(typeof r.error).toBe('string');
        }), params);
    });

    it('P-WORK-06: an operation carrying extra or inherited fields stores only its own', () => {
        fc.assert(fc.property(fc.dictionary(fc.string(), fc.anything()), (extra) => {
            const op = { ...extra, op: 'define', for_what: 'a', how: 'b', which: ['w'], checks: ['c'] };
            const r = applyWorkOp(card(), { did: NOUS[0]!, kind: 'nous' }, op, 2);
            expect(r.ok).toBe(true);
            if (r.ok) {
                expect(Object.keys(r.card)).toEqual(Object.keys(card()));
                expect(r.card.stage).toBe('plan');
            }
        }), params);
    });
});
