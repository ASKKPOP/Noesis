import { describe, it } from 'vitest';
import { AuditChain } from '../audit/chain.js';

/**
 * Phase 33 R-33-02 (D-33-C1) — soft-log perf benchmark.
 *
 * Populates AuditChain with 100k entries spanning multiple event types and actor DIDs,
 * runs 100 audit.query({ eventType: 'portal.auth.login', actorDid }) calls, computes
 * p95 latency, and console.log's the result.
 *
 * SOFT LOG ONLY — there is NO expect().toBeLessThan() assertion. Per D-33-C1:
 * "If p95 trends above 50ms, OBS-FUTURE-INDEX-01 triggers as v2.7 work (human-driven,
 * not CI-forced)." Trend monitoring is the operator's responsibility via CI log inspection.
 *
 * Expected runtime: roughly 5-10 seconds on a developer laptop (100k inserts + 100 queries).
 * Skip on CI by default if NOESIS_RUN_PERF is unset (matches Phase 32 rig-bench skip pattern).
 */

describe('audit.query perf benchmark — soft-log only (D-33-C1)', () => {
    it('audit.query({eventType, actorDid}) p95 perf with 100k entries', () => {
        if (!process.env['NOESIS_RUN_PERF']) {
            console.log('[perf] skipped — set NOESIS_RUN_PERF=1 to run');
            return;
        }

        const chain = new AuditChain();
        const EVENT_TYPES = [
            'portal.auth.login',
            'portal.auth.register',
            'human.identified',
            'human.joined',
            'tick',
        ];
        const ACTOR_DIDS = [
            'did:noesis:human:0xaaa',
            'did:noesis:human:0xbbb',
            'did:noesis:human:0xccc',
        ];

        // Seed 100k entries spanning the matrix.
        for (let i = 0; i < 100_000; i++) {
            chain.append(
                EVENT_TYPES[i % EVENT_TYPES.length],
                ACTOR_DIDS[i % ACTOR_DIDS.length],
                { tick: i },
            );
        }

        // Run 100 queries; measure latency.
        const testDid = ACTOR_DIDS[0];
        const latencies: number[] = [];
        for (let run = 0; run < 100; run++) {
            const t0 = performance.now();
            chain.query({ eventType: 'portal.auth.login', actorDid: testDid });
            latencies.push(performance.now() - t0);
        }

        latencies.sort((a, b) => a - b);
        const p50 = latencies[Math.floor(latencies.length * 0.50)];
        const p95 = latencies[Math.floor(latencies.length * 0.95)];
        const p99 = latencies[Math.floor(latencies.length * 0.99)];

        // SOFT LOG ONLY — no expect().toBeLessThan() per D-33-C1.
        console.log(
            `[perf] audit.query({eventType, actorDid}) at 100k entries: ` +
            `p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms p99=${p99.toFixed(2)}ms (target <50ms; ` +
            `if exceeded, OBS-FUTURE-INDEX-01 opens as v2.7 work)`,
        );
    }, 60_000); // 60s timeout to accommodate 100k inserts on slower machines
});
