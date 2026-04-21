// grid/src/review/index.ts — Public API surface for the review module.
// Mirrors grid/src/audit/index.ts shape.
//
// DELIBERATELY NOT EXPORTED (T-5-03 mitigation — second-reviewer prevention):
//   • Reviewer.resetForTesting  — production callers must not reset the singleton flag
//   • clearRegistryForTesting   — production callers must not clear the check registry
//   • registerCheck / CHECKS    — production callers must not register new checks at runtime
//                                 (all registration happens at module load via side-effect imports)

export { Reviewer } from './Reviewer.js';
export type {
    ReviewFailureCode,
    ReviewCheckName,
    ReviewContext,
    ReviewResult,
    Check,
} from './types.js';
