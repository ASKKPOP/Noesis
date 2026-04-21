/**
 * Logos Engine — evaluates Grid laws against actions.
 *
 * Processes a DSL of conditions (compare, and/or/not, context checks)
 * and determines whether an action is allowed, denied, or warned.
 */

import type {
    Law, ActionContext, EvaluationResult, RuleCondition,
    CompareCondition, LogicalCondition, NotCondition, ContextCondition,
} from './types.js';

export class LogosEngine {
    private readonly laws: Map<string, Law> = new Map();

    addLaw(law: Law): void {
        this.laws.set(law.id, law);
    }

    removeLaw(id: string): boolean {
        return this.laws.delete(id);
    }

    /**
     * Phase 6 / D-18: replace-in-place amendment. Returns the amended law
     * or undefined if the id is unknown. Identity (`id`) is preserved — the
     * type `Partial<Omit<Law, 'id'>>` guarantees this at compile time, and
     * the spread re-sets `id: id` at runtime to defend against casts.
     */
    amendLaw(id: string, updates: Partial<Omit<Law, 'id'>>): Law | undefined {
        const existing = this.laws.get(id);
        if (!existing) return undefined;
        const amended: Law = { ...existing, ...updates, id };
        this.laws.set(id, amended);
        return amended;
    }

    getLaw(id: string): Law | undefined {
        return this.laws.get(id);
    }

    activeLaws(): Law[] {
        return [...this.laws.values()].filter(l => l.status === 'active');
    }

    /** Evaluate all active laws against an action context. */
    evaluate(context: ActionContext): EvaluationResult {
        const result: EvaluationResult = {
            allowed: true,
            violations: [],
            warnings: [],
        };

        for (const law of this.activeLaws()) {
            const matches = this.evaluateCondition(law.ruleLogic.condition, context);
            if (!matches) continue;

            const action = law.ruleLogic.action;

            if (action === 'deny') {
                result.allowed = false;
                result.violations.push({
                    law,
                    action: 'deny',
                    sanction: law.ruleLogic.sanction_on_violation,
                });
            } else if (action === 'warn') {
                result.warnings.push({
                    law,
                    message: `Warning: ${law.title}`,
                });
            } else if (action === 'require_vote') {
                result.allowed = false;
                result.violations.push({
                    law,
                    action: 'require_vote',
                    sanction: law.ruleLogic.sanction_on_violation,
                });
            }
            // 'allow' is a no-op (default behavior)
        }

        return result;
    }

    /** Recursively evaluate a rule condition tree. */
    evaluateCondition(condition: RuleCondition, context: ActionContext): boolean {
        switch (condition.type) {
            case 'compare':
                return this.evalCompare(condition, context);
            case 'and':
                return (condition as LogicalCondition).conditions.every(
                    c => this.evaluateCondition(c, context)
                );
            case 'or':
                return (condition as LogicalCondition).conditions.some(
                    c => this.evaluateCondition(c, context)
                );
            case 'not':
                return !this.evaluateCondition((condition as NotCondition).condition, context);
            case 'has_role':
                return context.actor_role === (condition as ContextCondition).role;
            case 'in_region':
                return context.actor_region === (condition as ContextCondition).region;
            case 'reputation_above': {
                const tiers = ['unverified', 'bronze', 'silver', 'gold', 'platinum'];
                const actorIdx = tiers.indexOf(context.actor_reputation_tier || 'unverified');
                const reqIdx = tiers.indexOf((condition as ContextCondition).tier || 'unverified');
                return actorIdx >= reqIdx;
            }
            case 'lifecycle_phase':
                return context.actor_lifecycle_phase === (condition as ContextCondition).phase;
            case 'true':
                return true;
            default:
                return false;
        }
    }

    private evalCompare(cond: CompareCondition, context: ActionContext): boolean {
        const fieldValue = context[cond.field];
        const target = cond.value;

        switch (cond.op) {
            case '==': return fieldValue === target;
            case '!=': return fieldValue !== target;
            case '>': return (fieldValue as number) > (target as number);
            case '<': return (fieldValue as number) < (target as number);
            case '>=': return (fieldValue as number) >= (target as number);
            case '<=': return (fieldValue as number) <= (target as number);
            case 'contains':
                return typeof fieldValue === 'string' && fieldValue.includes(target as string);
            case 'starts_with':
                return typeof fieldValue === 'string' && fieldValue.startsWith(target as string);
            default:
                return false;
        }
    }
}
