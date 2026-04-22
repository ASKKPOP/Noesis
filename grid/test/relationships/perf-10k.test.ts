/**
 * Phase 9 Plan 06 Task 1 — REL-04 p95 latency gate.
 *
 * Proves getTopNFor stays under 100ms p95 with 10K edges and 1000 iterations.
 * Uses process.hrtime.bigint() — performance.now / Date.now are banned inside
 * grid/src/relationships/** (D-9-12) but test code may use hrtime.
 *
 * Seeded PRNG (xoshiro-style mulberry32) ensures fully deterministic fixtures.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { RelationshipListener } from '../../src/relationships/listener.js';
import { DEFAULT_RELATIONSHIP_CONFIG } from '../../src/relationships/config.js';

// ─── Deterministic seeded PRNG (mulberry32) — test-only ─────────────────────

function makeSeededRNG(seed: number): () => number {
    let s = seed >>> 0;
    return function () {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
        return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
}

// ─── Fixture builders ────────────────────────────────────────────────────────

function buildDid(index: number): string {
    return `did:noesis:grid:${String(index).padStart(4, '0')}`;
}

// ─── REL-04 performance benchmark ────────────────────────────────────────────

describe('REL-04 10K-edge perf bench', () => {
    const TAU = 1000;
    const N = 5;
    const NODE_COUNT = 200;     // 200 nodes → up to 200*199/2 = 19900 distinct edges
    const EDGE_COUNT = 10_000;
    const ITERATIONS = 1_000;

    let listener: RelationshipListener;

    beforeAll(() => {
        // Freeze Date.now so AuditChain hashing is deterministic across runs.
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => (fakeNow += 1, fakeNow));

        const audit = new AuditChain();
        listener = new RelationshipListener(audit, { ...DEFAULT_RELATIONSHIP_CONFIG, tau: TAU });

        // Seed 10K edges via synthesized audit events.
        // Self-loops are silently rejected by listener per D-9-11.
        const rng = makeSeededRNG(42);
        let appended = 0;
        let attempts = 0;
        while (appended < EDGE_COUNT && attempts < EDGE_COUNT * 3) {
            attempts++;
            const idxA = Math.floor(rng() * NODE_COUNT);
            const idxB = Math.floor(rng() * NODE_COUNT);
            if (idxA === idxB) continue;  // skip self-loops (D-9-11)

            const fromDid = buildDid(idxA);
            const toDid   = buildDid(idxB);
            audit.append('nous.spoke', fromDid, {
                name: `node-${idxA}`,
                channel: 'agora',
                text: `utterance-${appended}`,
                tick: appended + 1,
                to_did: toDid,
            });
            appended++;
        }

        nowSpy.mockRestore();
    });

    it('getTopNFor p95 < 100ms over 1000 iterations at tick 2000', () => {
        const currentTick = 2000;
        const timings: number[] = [];

        // Cycle through ~200 DIDs so we don't always hit the same cache line.
        for (let i = 0; i < ITERATIONS; i++) {
            const did = buildDid(i % NODE_COUNT);
            const start = process.hrtime.bigint();
            listener.getTopNFor(did, N, currentTick);
            const end = process.hrtime.bigint();
            timings.push(Number(end - start) / 1_000_000);  // ns → ms
        }

        timings.sort((a, b) => a - b);
        const p50 = timings[Math.floor(ITERATIONS * 0.50)];
        const p95 = timings[Math.floor(ITERATIONS * 0.95)];
        const p99 = timings[Math.floor(ITERATIONS * 0.99)];

        // Log for visibility even on pass (captured in 09-06-SUMMARY.md per plan output spec).
        console.log(
            `perf-10k: p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms p99=${p99.toFixed(2)}ms`
        );

        expect(p95).toBeLessThan(100);
    });
});
