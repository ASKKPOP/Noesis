/**
 * Logos types — law definitions, conditions, sanctions.
 */

export type ConditionOp = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'starts_with';

export interface CompareCondition {
    type: 'compare';
    field: string;
    op: ConditionOp;
    value: string | number | boolean;
}

export interface LogicalCondition {
    type: 'and' | 'or';
    conditions: RuleCondition[];
}

export interface NotCondition {
    type: 'not';
    condition: RuleCondition;
}

export interface ContextCondition {
    type: 'has_role' | 'in_region' | 'reputation_above' | 'lifecycle_phase' | 'true';
    role?: string;
    region?: string;
    tier?: string;
    phase?: string;
}

export type RuleCondition = CompareCondition | LogicalCondition | NotCondition | ContextCondition;

export type LawAction = 'allow' | 'deny' | 'warn' | 'require_vote';
export type SanctionType = 'warning' | 'rate_limit' | 'suspend' | 'exile' | 'none';
export type LawSeverity = 'info' | 'warning' | 'minor' | 'major' | 'critical';
export type LawStatus = 'proposed' | 'active' | 'repealed';

export interface RuleLogic {
    condition: RuleCondition;
    action: LawAction;
    sanction_on_violation: SanctionType;
}

export interface Law {
    id: string;
    title: string;
    description: string;
    ruleLogic: RuleLogic;
    severity: LawSeverity;
    status: LawStatus;
    proposedBy?: string;
}

export interface ActionContext {
    action_type: string;
    actor_did: string;
    actor_role?: string;
    actor_region?: string;
    actor_reputation_tier?: string;
    actor_lifecycle_phase?: string;
    ousia_amount?: number;
    target_did?: string;
    message_length?: number;
    [key: string]: unknown;
}

export interface EvaluationResult {
    allowed: boolean;
    violations: Array<{
        law: Law;
        action: LawAction;
        sanction: SanctionType;
    }>;
    warnings: Array<{
        law: Law;
        message: string;
    }>;
}
