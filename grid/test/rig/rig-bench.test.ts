import { describe, it, expect, beforeAll } from 'vitest';
import { runRigBench } from '../../../scripts/rig-bench-runner.mjs';

/**
 * RIG-04 / RIG-05 nightly smoke test — 50 Nous × 10000 ticks.
 *
 * Gated behind NOESIS_RUN_NIGHTLY=1 so per-commit Vitest runs SKIP this entire
 * describe block (feedback latency <90s per 14-VALIDATION.md).
 *
 * The nightly workflow sets NOESIS_RUN_NIGHTLY=1 and provides a MySQL 8 service
 * container before invoking: cd grid && npx vitest run test/rig/rig-bench.test.ts
 *
 * Assertions:
 *   - Wall-clock < 60 minutes (RIG-04 budget on researcher laptop)
 *   - exit_reason === 'tick_budget_exhausted' (Nous must not die before tick 10000)
 *   - chronos.rig_closed 5-key tuple is present and valid (RIG-05)
 *   - chain_tail_hash matches SHA-256 hex pattern
 *
 * The bench is run ONCE in beforeAll and the result is shared across all three
 * it() blocks — avoids running the 50×10k invocation three times.
 */

// Per-commit skip gate: entire describe is a no-op unless NOESIS_RUN_NIGHTLY=1.
describe.skipIf(!process.env.NOESIS_RUN_NIGHTLY)('RIG-04 nightly smoke: 50 Nous × 10000 ticks', () => {
    let result: Awaited<ReturnType<typeof runRigBench>>;

    // Shared beforeAll — runs the 50×10k bench once for the whole describe block.
    // CI-side timeout is 95 min to absorb cold-start; RIG-04 contract is 60 min wall-clock.
    beforeAll(async () => {
        result = await runRigBench('config/rigs/bench-50.toml', {
            timeoutMs: 90 * 60 * 1000,          // 90 min subprocess timeout (CI cold-start margin)
            expectExitReason: 'tick_budget_exhausted',
        });
    }, 95 * 60 * 1000);                          // 95 min Vitest beforeAll timeout

    it('completes within 60-minute wall-clock budget (RIG-04)', () => {
        // result.passed checks: exit code 0 + valid payload + correct exit_reason.
        expect(result.passed).toBe(true);

        // RIG-04 contract: <60 min on researcher laptop.
        // CI assertion enforces the 60 min budget; CI-side job timeout is 90 min.
        expect(result.wallClockMs).toBeLessThan(60 * 60 * 1000);
    }, 95 * 60 * 1000);

    it('closes with tick_budget_exhausted — Nous must not die prematurely (RIG-04)', () => {
        // If Nous die before tick 10000 (all_nous_dead), the fixture file is insufficient
        // and needs to be extended. This test surfaces that fixture gap as a real failure.
        expect(result.exitReason).toBe('tick_budget_exhausted');
    }, 95 * 60 * 1000);

    it('emits canonical chronos.rig_closed 5-key tuple (RIG-05)', () => {
        // chain_entry_count > 0 — the rig appended at least one audit entry.
        expect(result.chainEntryCount).toBeGreaterThan(0);

        // chain_tail_hash must be a 64-char lowercase hex string (SHA-256).
        expect(result.chainTailHash).toMatch(/^[a-f0-9]{64}$/);

        // The 5-key tuple shape is already validated inside runRigBench (throws if wrong).
        // Asserting chainEntryCount and chainTailHash here confirms extraction succeeded.
        expect(result.chainEntryCount).toBeTypeOf('number');
        expect(result.chainTailHash).toBeTypeOf('string');
    }, 95 * 60 * 1000);
});
