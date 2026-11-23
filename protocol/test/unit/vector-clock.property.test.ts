/**
 * Vector clock properties — the code leg of the Triple Verification Rule.
 *
 * Model legs: verification/tla/VectorClock.tla, verification/lean/Verification/VectorClock.lean.
 * Registry:   verification/PROPERTIES.md.
 *
 * Inputs are generated. Set PBT_SEED to replay a run, PBT_RUNS to change the case count.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { compareVectorClocks, mergeVectorClocks } from '../../src/knowledge.js';

const seed = process.env.PBT_SEED ? Number(process.env.PBT_SEED) : Date.now() | 0;
const numRuns = process.env.PBT_RUNS ? Number(process.env.PBT_RUNS) : 1000;
console.log(`[vector-clock.property] seed=${seed} numRuns=${numRuns}`);
const params = { seed, numRuns };

type Clock = Record<string, number>;

// Few node ids, so generated clocks overlap; unicode and prototype-like names included.
const arbNode = fc.constantFrom('A', 'B', 'C', 'D', 'did:noesis:é', 'toString', 'constructor', '__proto__');
// Counts: 0, 1, small, and the largest safe integer.
const arbCount = fc.oneof(
    fc.constantFrom(0, 1, Number.MAX_SAFE_INTEGER),
    fc.nat({ max: 5 }),
    fc.nat(),
);
const arbClock: fc.Arbitrary<Clock> = fc.dictionary(arbNode, arbCount, { maxKeys: 6 });

const at = (c: Clock, n: string): number => (Object.hasOwn(c, n) ? c[n] : 0);
const nodesOf = (...cs: Clock[]): string[] => [...new Set(cs.flatMap((c) => Object.keys(c)))];
/** Same count at every node, a missing entry reading as 0. */
const same = (a: Clock, b: Clock): boolean => nodesOf(a, b).every((n) => at(a, n) === at(b, n));
const leq = (a: Clock, b: Clock): boolean => nodesOf(a, b).every((n) => at(a, n) <= at(b, n));

describe('vector clock merge laws', () => {
    it('P-VCLOCK-01: merging two clocks gives the same result in either order', () => {
        fc.assert(
            fc.property(arbClock, arbClock, (a, b) => {
                expect(same(mergeVectorClocks(a, b), mergeVectorClocks(b, a))).toBe(true);
                expect(compareVectorClocks(mergeVectorClocks(a, b), mergeVectorClocks(b, a))).toBe('equal');
            }),
            params,
        );
    });

    it('P-VCLOCK-02: merging three clocks gives the same result however they are grouped', () => {
        fc.assert(
            fc.property(arbClock, arbClock, arbClock, (a, b, c) => {
                const left = mergeVectorClocks(mergeVectorClocks(a, b), c);
                const right = mergeVectorClocks(a, mergeVectorClocks(b, c));
                expect(same(left, right)).toBe(true);
            }),
            params,
        );
    });

    it('P-VCLOCK-03: merging a clock with itself changes nothing', () => {
        fc.assert(
            fc.property(arbClock, (a) => {
                expect(same(mergeVectorClocks(a, a), a)).toBe(true);
            }),
            params,
        );
    });

    it('P-VCLOCK-04: a merge is at least as large as both inputs, and no larger than needed', () => {
        fc.assert(
            fc.property(arbClock, arbClock, (a, b) => {
                const m = mergeVectorClocks(a, b);
                expect(leq(a, m)).toBe(true);
                expect(leq(b, m)).toBe(true);
                for (const n of nodesOf(a, b, m)) {
                    expect(at(m, n)).toBe(Math.max(at(a, n), at(b, n)));
                }
            }),
            params,
        );
    });

    it('merge does not change its inputs', () => {
        fc.assert(
            fc.property(arbClock, arbClock, (a, b) => {
                const a0 = structuredClone(a);
                const b0 = structuredClone(b);
                mergeVectorClocks(a, b);
                expect(a).toEqual(a0);
                expect(b).toEqual(b0);
            }),
            params,
        );
    });
});

// Counterexamples found by the properties above, kept as fixed cases.
describe('vector clock regressions', () => {
    // 2026-11-23, seed 175445488, P-VCLOCK-01 shrunk to [{"toString":0},{}]:
    // `merged[node] || 0` read Object.prototype.toString, so the merge gave NaN.
    it('a node id that names an Object.prototype member is an ordinary entry', () => {
        for (const name of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
            expect(at(mergeVectorClocks({}, { [name]: 0 }), name)).toBe(0);
            expect(at(mergeVectorClocks({ [name]: 2 }, { [name]: 5 }), name)).toBe(5);
            expect(compareVectorClocks({}, { [name]: 1 })).toBe('before');
            expect(compareVectorClocks({ [name]: 1 }, {})).toBe('after');
        }
    });

    // Found when "__proto__" was added to the generator: assigning merged["__proto__"] drops the entry.
    it('a node id of "__proto__" survives a merge', () => {
        const remote = JSON.parse('{"__proto__": 4}') as Clock;
        expect(at(mergeVectorClocks({}, remote), '__proto__')).toBe(4);
        expect(at(mergeVectorClocks(remote, { A: 1 }), '__proto__')).toBe(4);
        expect(compareVectorClocks({}, remote)).toBe('before');
    });
});

// Stateful test: random sequences of the TLA+ actions, run on the real merge.
const REPLICAS = ['A', 'B', 'C', 'D'] as const;
type Action =
    | { kind: 'tick'; r: string }
    | { kind: 'receive'; r: string; from: string };

const arbReplica = fc.constantFrom(...REPLICAS);
const arbAction: fc.Arbitrary<Action> = fc.oneof(
    fc.record({ kind: fc.constant('tick' as const), r: arbReplica }),
    fc.record({ kind: fc.constant('receive' as const), r: arbReplica, from: arbReplica }),
);

describe('vector clocks across replicas (actions of VectorClock.tla)', () => {
    it('P-VCLOCK-05 and P-VCLOCK-06 hold after every step of any action sequence', () => {
        fc.assert(
            fc.property(fc.array(arbAction, { maxLength: 60 }), (actions) => {
                const clock: Record<string, Clock> = Object.fromEntries(REPLICAS.map((r) => [r, {}]));

                for (const action of actions) {
                    const before = clock[action.r];
                    if (action.kind === 'tick') {
                        // knowledge.ts: vectorClock[did] = (vectorClock[did] || 0) + 1
                        clock[action.r] = { ...before, [action.r]: (before[action.r] || 0) + 1 };
                    } else {
                        clock[action.r] = mergeVectorClocks(before, clock[action.from]);
                    }

                    // P-VCLOCK-06: a replica's clock never goes backward.
                    expect(leq(before, clock[action.r])).toBe(true);
                    expect(['before', 'equal']).toContain(compareVectorClocks(before, clock[action.r]));

                    // P-VCLOCK-05: no replica knows a higher count for r than r itself holds.
                    for (const r of REPLICAS) {
                        for (const s of REPLICAS) {
                            expect(at(clock[s], r)).toBeLessThanOrEqual(at(clock[r], r));
                        }
                    }
                }
            }),
            params,
        );
    });
});
