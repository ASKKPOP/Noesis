// grid/src/review/Reviewer.ts — Phase 5 singleton reviewer (D-02, D-06, D-07, D-08).
//
// Design invariants:
//   • Singleton per process: second construction throws. Enforced via static `constructed` flag.
//   • Stable DID `did:noesis:reviewer` — grid-agnostic, passes Phase 1 DID regex /^did:noesis:[a-z0-9_\-]+$/i.
//     DO NOT introduce grid-scoped DIDs (e.g. `did:noesis:reviewer.gridX`); the dot fails the regex.
//   • First-fail-wins dispatch: iterate CHECK_ORDER, return immediately on first handler failure.
//   • No async, no I/O, no RPC in review() — determinism required for zero-diff invariant (D-13).
//   • Phase 7 watchpoint: telos-hash check is structural-only in Phase 5; Phase 7 TelosRegistry
//     will upgrade the handler to a registry lookup. DO NOT add state to Reviewer for that now.

import type { AuditChain } from '../audit/chain.js';
import type { NousRegistry } from '../registry/registry.js';
import { CHECKS, CHECK_ORDER } from './registry.js';
import type { ReviewContext, ReviewResult } from './types.js';

// Side-effect imports — each check file calls registerCheck() at module load.
// Order here controls first-fail order (insufficient_balance checked first).
import './checks/balance.js';
import './checks/counterparty-did.js';
import './checks/amount.js';
import './checks/memory-refs.js';
import './checks/telos-hash.js';

export class Reviewer {
    static readonly DID = 'did:noesis:reviewer';
    private static constructed = false;

    constructor(
        private readonly audit: AuditChain,
        private readonly registry: NousRegistry,
    ) {
        if (Reviewer.constructed) {
            throw new Error('ReviewerNous is a singleton — already constructed for this Grid.');
        }
        Reviewer.constructed = true;
    }

    /**
     * Synchronous, deterministic, first-fail-wins. Returns pass/fail verdict.
     * Does NOT emit audit events — the caller (nous-runner.ts) owns the emit site (privacy-at-producer).
     */
    review(ctx: ReviewContext): ReviewResult {
        for (const name of CHECK_ORDER) {
            const handler = CHECKS.get(name);
            if (!handler) {
                // registry invariant violation — checks.test.ts proves this cannot happen in prod
                throw new Error(`Reviewer: registered check name '${name}' has no handler.`);
            }
            const result = handler(ctx);
            if (!result.ok) {
                return { verdict: 'fail', failed_check: name, failure_reason: result.code };
            }
        }
        return { verdict: 'pass' };
    }

    /**
     * @internal TEST-ONLY — resets the singleton flag so tests can construct fresh reviewers.
     * This symbol is INTENTIONALLY NOT exported from grid/src/review/index.ts, so production
     * callers cannot import it.
     */
    static resetForTesting(): void {
        Reviewer.constructed = false;
    }
}
