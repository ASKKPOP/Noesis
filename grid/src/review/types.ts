// grid/src/review/types.ts — Phase 5 REV-01/REV-02/REV-04 closed contract surface.

/**
 * REV-02 closed enum — every reviewer failure MUST resolve to one of these 5 codes.
 * TypeScript compile-time gate; `VALID_REVIEW_FAILURE_CODES` is the runtime JSON-boundary backstop.
 * Adding a new code requires: (1) extend this union, (2) extend VALID_REVIEW_FAILURE_CODES,
 * (3) add the check handler + registerCheck call, (4) add a test case — contract.test.ts will red
 * until all four are aligned.
 */
export type ReviewFailureCode =
    | 'insufficient_balance'
    | 'invalid_counterparty_did'
    | 'non_positive_amount'
    | 'malformed_memory_refs'
    | 'malformed_telos_hash';

/**
 * REV-01 check names — 1:1 with failure codes by construction (enforced by contract.test.ts).
 */
export type ReviewCheckName = ReviewFailureCode;

/**
 * Per-trade review input. Proposer balance is pre-resolved at emit site (NousRegistry.get(proposerDid).ousia ?? 0).
 * memoryRefs + telosHash are brain self-attestation (D-05) — reviewer verifies structural shape only in Phase 5.
 */
export interface ReviewContext {
    readonly proposerDid: string;
    readonly proposerBalance: number;
    readonly counterparty: string;
    readonly amount: number;
    readonly memoryRefs: readonly string[];
    readonly telosHash: string;
}

export type ReviewResult =
    | { readonly verdict: 'pass' }
    | { readonly verdict: 'fail'; readonly failed_check: ReviewCheckName; readonly failure_reason: ReviewFailureCode };

export type Check = (ctx: ReviewContext) =>
    | { readonly ok: true }
    | { readonly ok: false; readonly code: ReviewFailureCode };

/**
 * Runtime backstop for the TS union. Used by the reviewer emit site and contract.test.ts to
 * prove size parity with the registry (no ghost checks, no missing codes).
 * Mirrors grid/src/audit/broadcast-allowlist.ts line 59 ReadonlySet-from-tuple pattern.
 */
export const VALID_REVIEW_FAILURE_CODES: ReadonlySet<ReviewFailureCode> = new Set<ReviewFailureCode>([
    'insufficient_balance',
    'invalid_counterparty_did',
    'non_positive_amount',
    'malformed_memory_refs',
    'malformed_telos_hash',
] as const);
