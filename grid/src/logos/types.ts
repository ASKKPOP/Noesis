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

// ── law.triggered payload ──────────────────────────────────────────────────────

/**
 * Closed payload for the `law.triggered` audit event.
 *
 * Phase 12 (D-12-10 / VOTE-04): additive widening adds `enacted_by` to distinguish
 * collective governance-driven law promotion from operator-driven law promotion.
 * This is the T-09-15 forensic defence — a future query on `law.triggered` entries
 * can filter by `enacted_by: 'collective'` to find all Nous-enacted laws.
 *
 * Keys (alphabetical — LAW_TRIGGERED_KEYS tuple enforces this at the sole-producer boundary):
 *   enacted_by   : 'collective' | 'operator'  ← NEW Phase 12
 *   law_hash     : string (sha256 of canonical law JSON, 64 hex chars)
 *   law_id       : string (the Law.id from grid/src/logos/types.ts)
 *   triggered_at_tick: number
 */
export interface LawTriggeredPayload {
    readonly enacted_by: 'collective' | 'operator';
    readonly law_hash: string;           // sha256 hex (64 chars) of canonical law JSON
    readonly law_id: string;             // Law.id
    readonly triggered_at_tick: number;
}

/**
 * Alphabetical tuple of LawTriggeredPayload keys.
 * Used at the sole-producer boundary (appendLawTriggered.ts) for
 * Object.keys(payload).sort() strict-equality enforcement.
 */
export const LAW_TRIGGERED_KEYS = [
    'enacted_by',
    'law_hash',
    'law_id',
    'triggered_at_tick',
] as const;
