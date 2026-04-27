/**
 * Governance voting defaults — statically frozen (no env-override at MVP).
 *
 * Per CONTEXT-12 / D-12-01 / D-12-03 / VOTE-01:
 *   The defaults are the contract. Env-overrides deferred to v2.3+.
 *   Proposer may set quorum_pct and supermajority_pct at proposal-open time;
 *   these defaults are used when no override is supplied.
 *
 * NO Date.now, NO Math.random — wall-clock ban per D-12-11 and
 * scripts/check-wallclock-forbidden.mjs (TIER_B_TS_ROOTS includes grid/src/governance).
 */

export const GOVERNANCE_CONFIG = Object.freeze({
    /** Default quorum percentage (1..100). Majority of Nous must participate. */
    quorumPctDefault: 50,
    /** Default supermajority percentage (1..100). Threshold for 'passed' outcome. */
    supermajorityPctDefault: 67,
    /** Required nonce length in hex characters (16 bytes = 32 hex chars). D-12-02. */
    nonceHexLen: 32,
    /** Valid ballot choices. closed-enum enforced at reveal boundary. D-12-02. */
    choiceValues: ['yes', 'no', 'abstain'] as const,
} as const);

/** Type helper — exported for type-safe consumers. */
export type GovernanceConfig = typeof GOVERNANCE_CONFIG;
