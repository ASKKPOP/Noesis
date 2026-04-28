import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';

/**
 * T-10-15 producer-boundary microbenchmark.
 *
 * Measures p99 latency of audit.append() with realistic listener fan-out registered.
 * If p99 ≥ 1ms, the rig must reduce per-tick audit volume or batch listener notification
 * BEFORE Wave 3's 50×10k smoke (otherwise 500k+ entries × >1ms = >8 minutes of pure
 * append overhead).
 */
function quantile(sortedAsc: number[], q: number): number {
    const idx = Math.min(sortedAsc.length - 1, Math.floor(sortedAsc.length * q));
    return sortedAsc[idx];
}

describe('Producer-boundary p99 latency (T-10-15, RIG-04)', () => {
    it('audit.append() p99 < 1ms over 10000 iterations with 5 realistic listeners', async () => {
        const chain = new AuditChain();

        // Register 5 listeners via AuditChain.onAppend() — emulates production fan-out
        // (DialogueAggregator, RelationshipListener, GovernanceEngine, AnankeListener,
        // ChronosListener). Each listener does ~50 iterations of work to model realistic
        // per-listener cost without being trivially zero.
        for (let i = 0; i < 5; i++) {
            chain.onAppend((_entry) => {
                let acc = 0;
                for (let k = 0; k < 50; k++) acc += k;
                return acc as unknown as void;
            });
        }

        const N = 10_000;
        const samples: number[] = new Array(N);
        const payload = { region: 'agora', tick: 0 };

        // Warm up to amortize JIT
        for (let i = 0; i < 200; i++) {
            chain.append('test.warmup', 'system', { ...payload, tick: -i });
        }

        for (let i = 0; i < N; i++) {
            const start = process.hrtime.bigint();
            chain.append('test.event', 'system', { ...payload, tick: i });
            const end = process.hrtime.bigint();
            samples[i] = Number(end - start) / 1_000_000;  // ns → ms
        }

        samples.sort((a, b) => a - b);
        const p50 = quantile(samples, 0.50);
        const p99 = quantile(samples, 0.99);
        const p999 = quantile(samples, 0.999);

        // Diagnostic output for triage if it ever fails
        console.log(`[producer-bench] N=${N} p50=${p50.toFixed(3)}ms p99=${p99.toFixed(3)}ms p999=${p999.toFixed(3)}ms`);

        expect(p99).toBeLessThan(1.0);
    }, 30_000);
});
