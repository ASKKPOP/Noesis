// grid/src/review/registry.ts — self-registering check map (D-10).
// Each check file under ./checks/ calls registerCheck(name, handler) at module load.
// Mirrors grid/src/audit/chain.ts:17,76-79 Set self-registration pattern, adapted to module-level Map.

import type { Check, ReviewCheckName } from './types.js';

export const CHECKS: Map<ReviewCheckName, Check> = new Map();
export const CHECK_ORDER: ReviewCheckName[] = [];

/**
 * Self-registration API. Called at module load by each grid/src/review/checks/*.ts file.
 * Throws on duplicate name to prevent silent override.
 */
export function registerCheck(name: ReviewCheckName, handler: Check): void {
    if (CHECKS.has(name)) {
        throw new Error(`Check '${name}' already registered — duplicate registration disallowed.`);
    }
    CHECKS.set(name, handler);
    CHECK_ORDER.push(name);
}

/**
 * @internal TEST-ONLY — clears the registry. NEVER call from production code.
 * Required because check files register at module load; tests that want a clean registry
 * must call this BEFORE dynamically re-importing checks.
 */
export function clearRegistryForTesting(): void {
    CHECKS.clear();
    CHECK_ORDER.length = 0;
}
