import { describe, it, expect, beforeEach } from 'vitest';
import { LogosEngine } from '../src/logos/engine.js';
import type { Law, ActionContext, RuleCondition } from '../src/logos/types.js';

function makeLaw(id: string, condition: RuleCondition, action: 'allow' | 'deny' | 'warn' | 'require_vote' = 'deny'): Law {
    return {
        id,
        title: `Law ${id}`,
        description: `Test law ${id}`,
        ruleLogic: { condition, action, sanction_on_violation: 'warning' },
        severity: 'minor',
        status: 'active',
    };
}

function makeContext(overrides: Partial<ActionContext> = {}): ActionContext {
    return {
        action_type: 'speak',
        actor_did: 'did:noesis:sophia',
        actor_role: 'citizen',
        actor_region: 'agora',
        actor_reputation_tier: 'silver',
        ...overrides,
    };
}

describe('LogosEngine', () => {
    let engine: LogosEngine;

    beforeEach(() => {
        engine = new LogosEngine();
    });

    describe('law management', () => {
        it('adds and retrieves laws', () => {
            const law = makeLaw('l1', { type: 'true' });
            engine.addLaw(law);
            expect(engine.getLaw('l1')).toEqual(law);
        });

        it('removes laws', () => {
            engine.addLaw(makeLaw('l1', { type: 'true' }));
            expect(engine.removeLaw('l1')).toBe(true);
            expect(engine.getLaw('l1')).toBeUndefined();
        });

        it('removeLaw returns false for missing id', () => {
            expect(engine.removeLaw('nope')).toBe(false);
        });

        it('activeLaws filters by status', () => {
            engine.addLaw(makeLaw('l1', { type: 'true' }));
            const proposed: Law = { ...makeLaw('l2', { type: 'true' }), status: 'proposed' };
            engine.addLaw(proposed);
            expect(engine.activeLaws()).toHaveLength(1);
            expect(engine.activeLaws()[0].id).toBe('l1');
        });
    });

    describe('condition evaluation', () => {
        const ctx = makeContext();

        it('compare == matches', () => {
            const cond: RuleCondition = { type: 'compare', field: 'action_type', op: '==', value: 'speak' };
            expect(engine.evaluateCondition(cond, ctx)).toBe(true);
        });

        it('compare != matches', () => {
            const cond: RuleCondition = { type: 'compare', field: 'action_type', op: '!=', value: 'trade' };
            expect(engine.evaluateCondition(cond, ctx)).toBe(true);
        });

        it('compare > with numeric field', () => {
            const ctx2 = makeContext({ ousia_amount: 600 });
            const cond: RuleCondition = { type: 'compare', field: 'ousia_amount', op: '>', value: 500 };
            expect(engine.evaluateCondition(cond, ctx2)).toBe(true);
        });

        it('compare <= with numeric field', () => {
            const ctx2 = makeContext({ ousia_amount: 500 });
            const cond: RuleCondition = { type: 'compare', field: 'ousia_amount', op: '<=', value: 500 };
            expect(engine.evaluateCondition(cond, ctx2)).toBe(true);
        });

        it('compare contains', () => {
            const ctx2 = makeContext({ action_type: 'trade_request' });
            const cond: RuleCondition = { type: 'compare', field: 'action_type', op: 'contains', value: 'trade' };
            expect(engine.evaluateCondition(cond, ctx2)).toBe(true);
        });

        it('compare starts_with', () => {
            const cond: RuleCondition = { type: 'compare', field: 'action_type', op: 'starts_with', value: 'sp' };
            expect(engine.evaluateCondition(cond, ctx)).toBe(true);
        });

        it('and requires all conditions', () => {
            const cond: RuleCondition = {
                type: 'and',
                conditions: [
                    { type: 'compare', field: 'action_type', op: '==', value: 'speak' },
                    { type: 'has_role', role: 'citizen' },
                ],
            };
            expect(engine.evaluateCondition(cond, ctx)).toBe(true);
        });

        it('and fails if any condition false', () => {
            const cond: RuleCondition = {
                type: 'and',
                conditions: [
                    { type: 'compare', field: 'action_type', op: '==', value: 'speak' },
                    { type: 'has_role', role: 'visitor' },
                ],
            };
            expect(engine.evaluateCondition(cond, ctx)).toBe(false);
        });

        it('or passes if any condition true', () => {
            const cond: RuleCondition = {
                type: 'or',
                conditions: [
                    { type: 'has_role', role: 'visitor' },
                    { type: 'has_role', role: 'citizen' },
                ],
            };
            expect(engine.evaluateCondition(cond, ctx)).toBe(true);
        });

        it('not inverts', () => {
            const cond: RuleCondition = {
                type: 'not',
                condition: { type: 'has_role', role: 'visitor' },
            };
            expect(engine.evaluateCondition(cond, ctx)).toBe(true);
        });

        it('has_role matches actor_role', () => {
            expect(engine.evaluateCondition({ type: 'has_role', role: 'citizen' }, ctx)).toBe(true);
            expect(engine.evaluateCondition({ type: 'has_role', role: 'admin' }, ctx)).toBe(false);
        });

        it('in_region matches actor_region', () => {
            expect(engine.evaluateCondition({ type: 'in_region', region: 'agora' }, ctx)).toBe(true);
            expect(engine.evaluateCondition({ type: 'in_region', region: 'market' }, ctx)).toBe(false);
        });

        it('reputation_above checks tier ordering', () => {
            expect(engine.evaluateCondition(
                { type: 'reputation_above', tier: 'bronze' }, ctx,
            )).toBe(true); // silver >= bronze
            expect(engine.evaluateCondition(
                { type: 'reputation_above', tier: 'gold' }, ctx,
            )).toBe(false); // silver < gold
        });

        it('lifecycle_phase matches', () => {
            const ctx2 = makeContext({ actor_lifecycle_phase: 'maturity' });
            expect(engine.evaluateCondition(
                { type: 'lifecycle_phase', phase: 'maturity' }, ctx2,
            )).toBe(true);
        });

        it('true always matches', () => {
            expect(engine.evaluateCondition({ type: 'true' }, ctx)).toBe(true);
        });

        it('unknown type returns false', () => {
            expect(engine.evaluateCondition({ type: 'unknown' as any }, ctx)).toBe(false);
        });
    });

    describe('evaluate (full law evaluation)', () => {
        it('allows when no laws match', () => {
            engine.addLaw(makeLaw('l1', { type: 'has_role', role: 'visitor' }, 'deny'));
            const result = engine.evaluate(makeContext({ actor_role: 'citizen' }));
            expect(result.allowed).toBe(true);
            expect(result.violations).toHaveLength(0);
        });

        it('deny law blocks action', () => {
            engine.addLaw(makeLaw('l1', { type: 'true' }, 'deny'));
            const result = engine.evaluate(makeContext());
            expect(result.allowed).toBe(false);
            expect(result.violations).toHaveLength(1);
            expect(result.violations[0].action).toBe('deny');
        });

        it('warn law allows but adds warning', () => {
            engine.addLaw(makeLaw('l1', { type: 'true' }, 'warn'));
            const result = engine.evaluate(makeContext());
            expect(result.allowed).toBe(true);
            expect(result.warnings).toHaveLength(1);
        });

        it('require_vote blocks action', () => {
            engine.addLaw(makeLaw('l1', { type: 'true' }, 'require_vote'));
            const result = engine.evaluate(makeContext());
            expect(result.allowed).toBe(false);
            expect(result.violations[0].action).toBe('require_vote');
        });

        it('allow law is no-op', () => {
            engine.addLaw(makeLaw('l1', { type: 'true' }, 'allow'));
            const result = engine.evaluate(makeContext());
            expect(result.allowed).toBe(true);
            expect(result.violations).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        it('multiple laws combine (deny + warn)', () => {
            engine.addLaw(makeLaw('deny-law', { type: 'true' }, 'deny'));
            engine.addLaw(makeLaw('warn-law', { type: 'true' }, 'warn'));
            const result = engine.evaluate(makeContext());
            expect(result.allowed).toBe(false);
            expect(result.violations).toHaveLength(1);
            expect(result.warnings).toHaveLength(1);
        });

        it('complex law: visitors cannot trade above 500', () => {
            engine.addLaw(makeLaw('trade-limit', {
                type: 'and',
                conditions: [
                    { type: 'has_role', role: 'visitor' },
                    { type: 'compare', field: 'action_type', op: '==', value: 'trade' },
                    { type: 'compare', field: 'ousia_amount', op: '>', value: 500 },
                ],
            }, 'deny'));

            // Citizen trading 600 → allowed
            const r1 = engine.evaluate(makeContext({ actor_role: 'citizen', action_type: 'trade', ousia_amount: 600 }));
            expect(r1.allowed).toBe(true);

            // Visitor trading 300 → allowed
            const r2 = engine.evaluate(makeContext({ actor_role: 'visitor', action_type: 'trade', ousia_amount: 300 }));
            expect(r2.allowed).toBe(true);

            // Visitor trading 600 → denied
            const r3 = engine.evaluate(makeContext({ actor_role: 'visitor', action_type: 'trade', ousia_amount: 600 }));
            expect(r3.allowed).toBe(false);
        });
    });
});
