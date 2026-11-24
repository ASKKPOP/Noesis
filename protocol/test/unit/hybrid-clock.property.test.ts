/**
 * Hybrid clock properties — the code leg of the Triple Verification Rule.
 *
 * Model legs: verification/tla/HybridClock.tla, verification/lean/Verification/HybridClock.lean.
 * Registry:   verification/PROPERTIES.md.
 *
 * Inputs are generated. The physical clock (Date.now) is injected: every case sets it.
 * Set PBT_SEED to replay a run, PBT_RUNS to change the case count.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fc from 'fast-check';
import {
    compareHLC,
    isValidHybridClock,
    mergeVectorClocks,
    receiveHLC,
    tickHLC,
    type HybridLogicalClock,
} from '../../src/knowledge.js';

const seed = process.env.PBT_SEED ? Number(process.env.PBT_SEED) : Date.now() | 0;
const numRuns = process.env.PBT_RUNS ? Number(process.env.PBT_RUNS) : 1000;
console.log(`[hybrid-clock.property] seed=${seed} numRuns=${numRuns}`);
const params = { seed, numRuns };

const MAX = Number.MAX_SAFE_INTEGER;

// The physical clock, set by each case.
let now = 0;
beforeAll(() => {
    vi.spyOn(Date, 'now').mockImplementation(() => now);
});
afterAll(() => {
    vi.restoreAllMocks();
});

// Few distinct values per field, so generated stamps tie often; boundaries included.
const arbWall = fc.oneof(fc.constantFrom(0, 1, MAX - 1, MAX), fc.nat({ max: 4 }), fc.nat());
// The logical counter stops one short of the largest safe integer: tick and receive add 1.
const arbLogical = fc.oneof(fc.constantFrom(0, 1, MAX - 1), fc.nat({ max: 4 }), fc.nat());
const arbNodeId = fc.constantFrom('', 'A', 'B', 'a', 'AA', 'did:noesis:é', '😀', 'toString', '__proto__');
const arbStamp: fc.Arbitrary<HybridLogicalClock> = fc.record({
    wallTime: arbWall,
    logical: arbLogical,
    nodeId: arbNodeId,
});
// Physical clock readings: behind, equal to and ahead of the stamps above.
const arbNow = arbWall;

const same = (a: HybridLogicalClock, b: HybridLogicalClock): boolean =>
    a.wallTime === b.wallTime && a.logical === b.logical && a.nodeId === b.nodeId;
/** Smaller by wall time and logical counter alone. */
const lessWL = (a: HybridLogicalClock, b: HybridLogicalClock): boolean =>
    a.wallTime < b.wallTime || (a.wallTime === b.wallTime && a.logical < b.logical);

describe('hybrid clock order', () => {
    it('P-HLC-01: of any two stamps exactly one is smaller, or they are the same stamp', () => {
        fc.assert(
            fc.property(arbStamp, arbStamp, (a, b) => {
                const ab = compareHLC(a, b);
                const ba = compareHLC(b, a);
                expect(Number.isNaN(ab)).toBe(false);
                expect(Math.sign(ab)).toBe(-Math.sign(ba) + 0);
                expect(ab === 0).toBe(same(a, b));
                expect(compareHLC(a, a)).toBe(0);
            }),
            params,
        );
    });

    it('P-HLC-01: the order is transitive', () => {
        fc.assert(
            fc.property(arbStamp, arbStamp, arbStamp, (a, b, c) => {
                if (compareHLC(a, b) < 0 && compareHLC(b, c) < 0) expect(compareHLC(a, c)).toBeLessThan(0);
                if (compareHLC(a, b) <= 0 && compareHLC(b, c) <= 0) expect(compareHLC(a, c)).toBeLessThanOrEqual(0);
            }),
            params,
        );
    });
});

describe('hybrid clock steps', () => {
    it('P-HLC-02: a local tick gives a strictly larger, valid stamp', () => {
        fc.assert(
            fc.property(arbStamp, arbNow, (current, pt) => {
                now = pt;
                const before = { ...current };
                const ticked = tickHLC(current);
                expect(compareHLC(current, ticked)).toBeLessThan(0);
                expect(lessWL(current, ticked)).toBe(true);
                expect(ticked.nodeId).toBe(current.nodeId);
                expect(isValidHybridClock(ticked)).toBe(true);
                expect(current).toEqual(before); // input not changed
            }),
            params,
        );
    });

    it('P-HLC-03: a receive gives a valid stamp strictly larger than the local and the remote stamp', () => {
        fc.assert(
            fc.property(arbStamp, arbStamp, arbNow, (local, remote, pt) => {
                now = pt;
                const received = receiveHLC(local, remote);
                expect(compareHLC(local, received)).toBeLessThan(0);
                expect(lessWL(remote, received)).toBe(true);
                expect(received.nodeId).toBe(local.nodeId);
                expect(isValidHybridClock(received)).toBe(true);
            }),
            params,
        );
    });

    it('P-HLC-04: a stamp is never behind the physical clock, and its wall time is never invented', () => {
        fc.assert(
            fc.property(arbStamp, arbStamp, arbNow, (local, remote, pt) => {
                now = pt;
                const ticked = tickHLC(local);
                expect(ticked.wallTime).toBeGreaterThanOrEqual(pt);
                expect([pt, local.wallTime]).toContain(ticked.wallTime);

                const received = receiveHLC(local, remote);
                expect(received.wallTime).toBeGreaterThanOrEqual(pt);
                expect([pt, local.wallTime, remote.wallTime]).toContain(received.wallTime);
                expect(received.wallTime).toBe(Math.max(pt, local.wallTime, remote.wallTime));
            }),
            params,
        );
    });
});

// Stateful test: random sequences of the actions of HybridClock.tla, on the real functions.
const REPLICAS = ['A', 'B', 'C', 'D'] as const;
type Clock = Record<string, number>;
type Action =
    | { kind: 'local'; r: string; pt: number }
    | { kind: 'receive'; r: string; from: number; pt: number };

const arbReplica = fc.constantFrom(...REPLICAS);
// Clocks that disagree and go backward: any small reading at every step, sometimes a large one.
const arbReading = fc.oneof(fc.nat({ max: 3 }), fc.nat({ max: 3 }), fc.nat({ max: 1_000_000 }));
const arbAction: fc.Arbitrary<Action> = fc.oneof(
    fc.record({ kind: fc.constant('local' as const), r: arbReplica, pt: arbReading }),
    fc.record({ kind: fc.constant('receive' as const), r: arbReplica, from: fc.nat(), pt: arbReading }),
);
const leq = (a: Clock, b: Clock): boolean => Object.keys(a).every((n) => a[n] <= (b[n] ?? 0));

describe('hybrid clocks across replicas (actions of HybridClock.tla)', () => {
    it('P-HLC-05, with P-HLC-02 and P-HLC-03, holds after every step of any action sequence', () => {
        fc.assert(
            fc.property(fc.array(arbAction, { maxLength: 40 }), (actions) => {
                const hlc: Record<string, HybridLogicalClock> = Object.fromEntries(
                    REPLICAS.map((r) => [r, { wallTime: 0, logical: 0, nodeId: r }]),
                );
                const vc: Record<string, Clock> = Object.fromEntries(REPLICAS.map((r) => [r, {}]));
                const events: { stamp: HybridLogicalClock; vc: Clock }[] = [];

                for (const action of actions) {
                    const r = action.r;
                    now = action.pt;
                    const before = hlc[r];
                    if (action.kind === 'local' || events.length === 0) {
                        hlc[r] = tickHLC(before);
                    } else {
                        const m = events[action.from % events.length];
                        hlc[r] = receiveHLC(before, m.stamp);
                        vc[r] = mergeVectorClocks(vc[r], m.vc);
                        expect(lessWL(m.stamp, hlc[r])).toBe(true); // P-HLC-03
                    }
                    vc[r] = { ...vc[r], [r]: (vc[r][r] ?? 0) + 1 };

                    expect(compareHLC(before, hlc[r])).toBeLessThan(0); // P-HLC-02, P-HLC-03
                    expect(isValidHybridClock(hlc[r])).toBe(true);
                    expect(hlc[r].wallTime).toBeGreaterThanOrEqual(action.pt); // P-HLC-04

                    // P-HLC-05: every event that happened before this one has a smaller stamp,
                    // and no earlier event has the same stamp.
                    for (const x of events) {
                        expect(compareHLC(x.stamp, hlc[r])).not.toBe(0);
                        if (leq(x.vc, vc[r])) expect(compareHLC(x.stamp, hlc[r])).toBeLessThan(0);
                    }
                    events.push({ stamp: hlc[r], vc: vc[r] });
                }
            }),
            params,
        );
    });
});

// Stamps from the network: what a hostile or broken peer can send.
const arbBadNumber: fc.Arbitrary<unknown> = fc.oneof(
    fc.constantFrom(-1, -0.5, 0.5, NaN, Infinity, -Infinity, MAX + 1, 1e308, null, undefined, true, '3', '', {}, []),
    fc.integer({ max: -1 }),
    fc.double({ noInteger: true }),
    fc.string(),
);
const arbBadNodeId: fc.Arbitrary<unknown> = fc.constantFrom(null, undefined, 0, 5, true, {}, [], ['A']);
/** A stamp with exactly one field that is not valid. */
const arbInvalidStamp: fc.Arbitrary<unknown> = fc.oneof(
    fc.tuple(arbStamp, arbBadNumber).map(([s, bad]) => ({ ...s, wallTime: bad })),
    fc.tuple(arbStamp, arbBadNumber).map(([s, bad]) => ({ ...s, logical: bad })),
    fc.tuple(arbStamp, arbBadNodeId).map(([s, bad]) => ({ ...s, nodeId: bad })),
);
const arbNotAStamp: fc.Arbitrary<unknown> = fc.oneof(
    fc.constantFrom(null, undefined, 0, 1, NaN, '', 'stamp', true, [], [1, 2, 'A'], {}),
    fc.string(),
    fc.array(fc.nat()),
);

describe('hybrid clock stamps from the network', () => {
    it('P-CARD-06: a stamp of whole numbers >= 0 and a string node id is valid', () => {
        fc.assert(
            fc.property(arbStamp, (s) => {
                expect(isValidHybridClock(s)).toBe(true);
            }),
            params,
        );
    });

    it('P-CARD-06: a stamp with one field that is not valid is not valid', () => {
        fc.assert(
            fc.property(arbInvalidStamp, (s) => {
                expect(isValidHybridClock(s)).toBe(false);
            }),
            params,
        );
    });

    it('P-CARD-06: a value that is not a stamp is not valid', () => {
        fc.assert(
            fc.property(arbNotAStamp, (s) => {
                expect(isValidHybridClock(s)).toBe(false);
            }),
            params,
        );
    });
});
