/**
 * The Work Card — one record of a goal on its way to a result, read by people and by
 * Nous alike. This file is the whole rule set of the nine-stage loop, as pure functions:
 * `createWork` (a member states a goal) and `applyWorkOp` (every later step). Nothing
 * here reads a clock, a database or the network.
 *
 *   1 Enter    holding a Civic-DID in this Grid (checked by WorkService, not here)
 *   2 Goal     createWork · answer      a goal; the asked Nous accepts or declines
 *   3 Define   define                   for what, how, which, and the checks
 *   4 Plan     set_plan · approve_plan  ordered steps; the owner approves once
 *   5 Build    complete_step            the builder does the steps in order
 *   6 Test     record_check             each check passed or failed, with evidence
 *   7 Verify   verify                   a Nous that is not the builder confirms or refuses
 *   8 Deploy   deploy                   where the result lives, and its provenance
 *   9 Notice   announce                 goal information, a guide, a presentation
 *
 * A person sets a Work up: states the goal, defines it, plans and approves the plan
 * (stages 2 to 4). From there the Work belongs to Nous: the builder, always a Nous,
 * builds, tests, deploys and announces, and another Nous verifies (stages 5 to 9).
 *
 * Verified under the Triple Verification Rule as P-WORK-01..09
 * (verification/PROPERTIES.md).
 */

export const WORK_STAGES = [
    'goal', 'define', 'plan', 'build', 'test', 'verify', 'deploy', 'notice', 'done', 'declined',
] as const;
export type WorkStage = (typeof WORK_STAGES)[number];

/** The only moves a stage may make. `done` and `declined` never move. */
export const STAGE_EDGES: Readonly<Record<WorkStage, readonly WorkStage[]>> = Object.freeze({
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
});

/** Longest text and longest list of each kind, in UTF-16 code units and in items. */
export const WORK_LIMITS = Object.freeze({
    goal: 500,
    forWhom: 200,
    field: 1000,
    whichItem: 120,
    which: 20,
    check: 300,
    checks: 20,
    steps: 50,
    notice: 4000,
});

export type MemberKind = 'person' | 'nous';

/** A current member of the Grid, as the caller of an operation. */
export interface WorkActor { did: string; kind: MemberKind }

export interface PlanStep {
    step: number;
    do: string;
    by_tick: number;
    done: boolean;
    done_tick: number | null;
    note: string;
}

export interface CheckResult {
    passed: boolean;
    evidence: string;
    tick: number;
}

/** The card. Stored once, as this JSON; the page a person sees is drawn from it. */
export interface WorkCard {
    work_id: string;
    grid: string;
    stage: WorkStage;
    /** Counts applied writes. A write must name the version it was based on. */
    version: number;
    goal: string;
    for_whom: string;
    owner: string;
    owner_kind: MemberKind;
    /** Always a Nous. */
    builder: string;
    /** The asked builder's answer; null while unanswered or when the owner builds. */
    answer: { accepted: boolean; reason: string; tick: number } | null;
    for_what: string;
    how: string;
    which: string[];
    checks: string[];
    plan: PlanStep[];
    plan_approved: boolean;
    /** One slot per check: null until recorded. */
    results: Array<CheckResult | null>;
    /** How often a verifier sent the Work back to Test, and the latest time. */
    refusals: number;
    last_refusal: { by: string; reason: string; tick: number } | null;
    verified: { by: string; reason: string; tick: number } | null;
    result: {
        where: string; changed: string; built_by: string; verified_by: string; built_from: string[]; tick: number;
    } | null;
    notice: { goal_info: string; guide: string; presentation: string; by: string; tick: number } | null;
    created_tick: number;
    updated_tick: number;
}

export type WorkError =
    | 'invalid_tick'
    | 'invalid_operation'
    | 'unknown_operation'
    | 'wrong_stage'
    | 'not_allowed'
    | 'builder_must_be_nous'
    | `invalid_${string}`;

export type WorkResult = { ok: true; card: WorkCard } | { ok: false; error: WorkError };

const refuse = (error: WorkError): WorkResult => ({ ok: false, error });

/** A text of 1..max code units that is not only whitespace, trimmed; or null. */
function text(value: unknown, max: number): string | null {
    if (typeof value !== 'string' || value.length > max) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}

/** Like `text`, but empty (or left out) is allowed and gives ''. */
function optionalText(value: unknown, max: number): string | null {
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > max) return null;
    return value.trim();
}

/** A list of `min`..`max` texts, each within `itemMax`; or null. */
function textList(value: unknown, min: number, max: number, itemMax: number): string[] | null {
    if (!Array.isArray(value) || value.length < min || value.length > max) return null;
    const out: string[] = [];
    for (const item of value) {
        const t = text(item, itemMax);
        if (t === null) return null;
        out.push(t);
    }
    return out;
}

const isTick = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

function fields(op: unknown): Record<string, unknown> | null {
    return op !== null && typeof op === 'object' && !Array.isArray(op) ? op as Record<string, unknown> : null;
}

/** The builder a new Work names: the one given, or the member itself when none is. */
export function builderOf(input: unknown, actorDid: string): unknown {
    const f = fields(input);
    return f === null || f.builder === undefined ? actorDid : f.builder;
}

/**
 * Stage 2 — a member states a goal. `builderKind` is what the Grid knows of
 * `builderOf(input, actor)`: a person, a Nous, or null when it is no member.
 * The builder must be a Nous. A member who names another Nous is asking: the Work waits
 * in `goal` for that Nous's answer. A Nous that builds its own goal goes straight to
 * `define`.
 */
export function createWork(
    workId: string, grid: string, actor: WorkActor,
    input: unknown, builderKind: MemberKind | null, tick: number,
): WorkResult {
    if (!isTick(tick)) return refuse('invalid_tick');
    const f = fields(input);
    if (f === null) return refuse('invalid_operation');
    const builder = builderOf(input, actor.did);
    if (typeof builder !== 'string' || builderKind !== 'nous') return refuse('builder_must_be_nous');
    const goal = text(f.goal, WORK_LIMITS.goal);
    if (goal === null) return refuse('invalid_goal');
    const forWhom = text(f.for_whom, WORK_LIMITS.forWhom);
    if (forWhom === null) return refuse('invalid_for_whom');
    return {
        ok: true,
        card: {
            work_id: workId, grid, stage: builder === actor.did ? 'define' : 'goal', version: 1,
            goal, for_whom: forWhom, owner: actor.did, owner_kind: actor.kind, builder, answer: null,
            for_what: '', how: '', which: [], checks: [], plan: [], plan_approved: false, results: [],
            refusals: 0, last_refusal: null, verified: null, result: null, notice: null,
            created_tick: tick, updated_tick: tick,
        },
    };
}

export const WORK_OPS = [
    'answer', 'define', 'set_plan', 'approve_plan', 'complete_step', 'record_check', 'verify', 'deploy', 'announce',
] as const;
export type WorkOpName = (typeof WORK_OPS)[number];

const OP_STAGE: Readonly<Record<WorkOpName, WorkStage>> = Object.freeze({
    answer: 'goal', define: 'define', set_plan: 'plan', approve_plan: 'plan', complete_step: 'build',
    record_check: 'test', verify: 'verify', deploy: 'deploy', announce: 'notice',
});

/**
 * The operations `applyWorkOp` would take from this member on this card, going by stage
 * and role alone (the input must still be well-formed). The page uses it to offer a
 * member the right step; it grants nothing — `applyWorkOp` decides.
 */
export function allowedOps(card: WorkCard, actor: WorkActor): WorkOpName[] {
    const isOwner = actor.did === card.owner;
    const isBuilder = actor.did === card.builder;
    return WORK_OPS.filter((op) => {
        if (OP_STAGE[op] !== card.stage) return false;
        switch (op) {
            case 'answer': case 'complete_step': case 'record_check': case 'deploy': case 'announce': return isBuilder;
            case 'define': case 'set_plan': return isOwner || isBuilder;
            case 'approve_plan': return isOwner;
            case 'verify': return !isBuilder && actor.kind === 'nous';
        }
    });
}

/**
 * Every step after the goal. `actor` is a current member of the Grid (checked by the
 * caller). `op` is whatever arrived: `{ op: <name>, …fields }`. Each operation is
 * taken only in its stage, only from its role, and only when well-formed; anything else
 * is refused and the card given is left as it was.
 */
export function applyWorkOp(card: WorkCard, actor: WorkActor, op: unknown, tick: number): WorkResult {
    const actorDid = actor.did;
    if (!isTick(tick)) return refuse('invalid_tick');
    const f = fields(op);
    if (f === null || typeof f.op !== 'string') return refuse('invalid_operation');
    const isOwner = actorDid === card.owner;
    const isBuilder = actorDid === card.builder;
    const next = (changes: Partial<WorkCard>): WorkResult => ({
        ok: true,
        card: { ...card, ...changes, version: card.version + 1, updated_tick: tick },
    });

    switch (f.op) {
        case 'answer': {
            if (card.stage !== 'goal') return refuse('wrong_stage');
            if (!isBuilder) return refuse('not_allowed');
            if (typeof f.accept !== 'boolean') return refuse('invalid_accept');
            // A Nous that declines says why; one that accepts may.
            const reason = f.accept ? optionalText(f.reason, WORK_LIMITS.field) : text(f.reason, WORK_LIMITS.field);
            if (reason === null) return refuse('invalid_reason');
            return next({ stage: f.accept ? 'define' : 'declined', answer: { accepted: f.accept, reason, tick } });
        }
        case 'define': {
            if (card.stage !== 'define') return refuse('wrong_stage');
            if (!isOwner && !isBuilder) return refuse('not_allowed');
            const forWhat = text(f.for_what, WORK_LIMITS.field);
            if (forWhat === null) return refuse('invalid_for_what');
            const how = text(f.how, WORK_LIMITS.field);
            if (how === null) return refuse('invalid_how');
            const which = textList(f.which, 0, WORK_LIMITS.which, WORK_LIMITS.whichItem);
            if (which === null) return refuse('invalid_which');
            // No Work is built before its checks are written.
            const checks = textList(f.checks, 1, WORK_LIMITS.checks, WORK_LIMITS.check);
            if (checks === null) return refuse('invalid_checks');
            return next({ stage: 'plan', for_what: forWhat, how, which, checks, results: checks.map(() => null) });
        }
        case 'set_plan': {
            if (card.stage !== 'plan') return refuse('wrong_stage');
            if (!isOwner && !isBuilder) return refuse('not_allowed');
            if (!Array.isArray(f.steps) || f.steps.length < 1 || f.steps.length > WORK_LIMITS.steps) return refuse('invalid_steps');
            const plan: PlanStep[] = [];
            for (const raw of f.steps) {
                const s = fields(raw);
                const todo = s === null ? null : text(s.do, WORK_LIMITS.field);
                if (s === null || todo === null || !isTick(s.by_tick)) return refuse('invalid_steps');
                plan.push({ step: plan.length + 1, do: todo, by_tick: s.by_tick, done: false, done_tick: null, note: '' });
            }
            // A changed plan needs approving again.
            return next({ plan, plan_approved: false });
        }
        case 'approve_plan': {
            if (card.stage !== 'plan') return refuse('wrong_stage');
            if (!isOwner) return refuse('not_allowed');
            if (card.plan.length === 0) return refuse('invalid_plan');
            return next({ stage: 'build', plan_approved: true });
        }
        case 'complete_step': {
            if (card.stage !== 'build') return refuse('wrong_stage');
            if (!isBuilder) return refuse('not_allowed');
            const done = card.plan.filter((s) => s.done).length;
            // Steps are done in order: only the next one can be marked.
            if (f.step !== done + 1) return refuse('invalid_step');
            const note = optionalText(f.note, WORK_LIMITS.field);
            if (note === null) return refuse('invalid_note');
            const plan = card.plan.map((s) => (s.step === done + 1 ? { ...s, done: true, done_tick: tick, note } : s));
            return next({ stage: done + 1 === card.plan.length ? 'test' : 'build', plan });
        }
        case 'record_check': {
            if (card.stage !== 'test') return refuse('wrong_stage');
            if (!isBuilder) return refuse('not_allowed');
            const check = f.check;
            if (typeof check !== 'number' || !Number.isInteger(check) || check < 1 || check > card.results.length) return refuse('invalid_check');
            if (typeof f.passed !== 'boolean') return refuse('invalid_passed');
            const evidence = text(f.evidence, WORK_LIMITS.field);
            if (evidence === null) return refuse('invalid_evidence');
            const results = card.results.map((r, i) => (i === check - 1 ? { passed: f.passed as boolean, evidence, tick } : r));
            // A failed or missing check keeps the Work in Test.
            return next({ stage: results.every((r) => r !== null && r.passed) ? 'verify' : 'test', results });
        }
        case 'verify': {
            if (card.stage !== 'verify') return refuse('wrong_stage');
            // A Nous other than the builder: nobody verifies their own work, and from
            // Build on a Work is in the hands of Nous.
            if (isBuilder || actor.kind !== 'nous') return refuse('not_allowed');
            if (typeof f.confirm !== 'boolean') return refuse('invalid_confirm');
            const reason = text(f.reason, WORK_LIMITS.field);
            if (reason === null) return refuse('invalid_reason');
            if (f.confirm) return next({ stage: 'deploy', verified: { by: actorDid, reason, tick } });
            // Refused: back to Test, every result cleared, so the checks are run again.
            return next({
                stage: 'test', results: card.results.map(() => null),
                refusals: card.refusals + 1, last_refusal: { by: actorDid, reason, tick },
            });
        }
        case 'deploy': {
            if (card.stage !== 'deploy') return refuse('wrong_stage');
            if (!isBuilder) return refuse('not_allowed');
            const where = text(f.where, WORK_LIMITS.field);
            if (where === null) return refuse('invalid_where');
            const changed = text(f.changed, WORK_LIMITS.field);
            if (changed === null) return refuse('invalid_changed');
            if (card.verified === null) return refuse('wrong_stage');
            return next({
                stage: 'notice',
                result: { where, changed, built_by: card.builder, verified_by: card.verified.by, built_from: [...card.which], tick },
            });
        }
        case 'announce': {
            if (card.stage !== 'notice') return refuse('wrong_stage');
            if (!isBuilder) return refuse('not_allowed');
            const goalInfo = text(f.goal_info, WORK_LIMITS.notice);
            if (goalInfo === null) return refuse('invalid_goal_info');
            const guide = text(f.guide, WORK_LIMITS.notice);
            if (guide === null) return refuse('invalid_guide');
            const presentation = text(f.presentation, WORK_LIMITS.notice);
            if (presentation === null) return refuse('invalid_presentation');
            return next({ stage: 'done', notice: { goal_info: goalInfo, guide, presentation, by: actorDid, tick } });
        }
        default:
            return refuse('unknown_operation');
    }
}
