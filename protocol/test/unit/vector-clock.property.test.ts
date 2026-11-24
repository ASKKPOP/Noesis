/**
 * Vector clock properties — the code leg of the Triple Verification Rule.
 *
 * Model legs: verification/tla/VectorClock.tla, verification/lean/Verification/VectorClock.lean.
 * Registry:   verification/PROPERTIES.md.
 *
 * Inputs are generated. Set PBT_SEED to replay a run, PBT_RUNS to change the case count.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
    compareVectorClocks,
    isValidVectorClock,
    mergeVectorClocks,
    KnowledgePool,
    type KnowledgeCard,
} from '../../src/knowledge.js';
import { Storage } from '../../src/storage.js';
import { generateIdentity } from '../../src/identity.js';

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

// Clocks from the network: what a hostile or broken peer can put in a count.
const arbBadCount: fc.Arbitrary<unknown> = fc.oneof(
    fc.constantFrom(-1, -0.5, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, null, true, '3', '', {}, []),
    fc.integer({ max: -1 }),
    fc.double({ noInteger: true }),
    fc.string(),
);
/** A clock with at least one bad count among otherwise valid entries. */
const arbInvalidClock: fc.Arbitrary<unknown> = fc
    .tuple(arbClock, arbNode, arbBadCount)
    .map(([clock, node, bad]) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(clock)) Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
        Object.defineProperty(out, node, { value: bad, enumerable: true, writable: true, configurable: true });
        return out;
    });
/** Values that are not a clock at all. */
const arbNotAClock: fc.Arbitrary<unknown> = fc.oneof(
    fc.constantFrom(null, undefined, 0, 1, NaN, '', 'clock', true, [], [1, 2]),
    fc.array(fc.nat()),
    fc.string(),
);

describe('vector clocks from the network', () => {
    it('P-VCLOCK-07: a clock of whole counts >= 0 is valid, and so is a merge of two', () => {
        fc.assert(
            fc.property(arbClock, arbClock, (a, b) => {
                expect(isValidVectorClock(a)).toBe(true);
                expect(isValidVectorClock(b)).toBe(true);
                expect(isValidVectorClock(mergeVectorClocks(a, b))).toBe(true);
            }),
            params,
        );
    });

    it('P-VCLOCK-07: a clock with any count that is not a whole number >= 0 is not valid', () => {
        fc.assert(
            fc.property(arbInvalidClock, (clock) => {
                expect(isValidVectorClock(clock)).toBe(false);
            }),
            params,
        );
    });

    it('P-VCLOCK-07: a value that is not an object of counts is not valid', () => {
        fc.assert(
            fc.property(arbNotAClock, (value) => {
                expect(isValidVectorClock(value)).toBe(false);
            }),
            params,
        );
    });
});

// Stateful test on a real KnowledgePool: valid and invalid cards arrive in any order.
describe('cards from the network (Deliver in VectorClock.tla)', () => {
    let dir: string;
    let n = 0;

    beforeAll(() => {
        dir = join(tmpdir(), `vclock-prop-${Date.now()}`);
        mkdirSync(dir, { recursive: true });
    });
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    function newPool(): KnowledgePool {
        const identity = generateIdentity('prop');
        const storage = new Storage({ dbPath: join(dir, `p-${n++}.db`) });
        storage.saveIdentity(
            identity.did,
            Buffer.from(identity.privateKey).toString('hex'),
            Buffer.from(identity.publicKey).toString('hex'),
            identity.displayName,
        );
        return new KnowledgePool(storage, identity);
    }

    function card(id: string, vectorClock: unknown, wallTime: number): KnowledgeCard {
        return {
            id,
            spaceId: 'space',
            type: 'fact',
            title: id,
            summary: id,
            content: id,
            contentFormat: 'plain',
            author: 'did:test:peer',
            createdAt: 1,
            updatedAt: 1,
            version: 1,
            tags: [],
            domain: [],
            entities: [],
            confidence: 0.8,
            verificationStatus: 'unverified',
            verifications: [],
            usage: { views: 0, citations: 0, applications: 0, lastAccessed: 1 },
            privacy: 'public',
            crdt: { hlc: { wallTime, logical: 0, nodeId: 'did:test:peer' }, vectorClock, tombstone: false },
        } as unknown as KnowledgeCard;
    }

    const snapshot = (pool: KnowledgePool): string =>
        JSON.stringify([...(pool as any).cards.entries()].map(([id, c]: [string, KnowledgeCard]) => [id, c.crdt.vectorClock, c.title]));

    const arbDelivery = fc.record({
        id: fc.constantFrom('c1', 'c2', 'c3'),
        clock: fc.oneof(arbClock as fc.Arbitrary<unknown>, arbInvalidClock, arbNotAClock),
        viaNetwork: fc.boolean(),
    });

    it('P-VCLOCK-07 and P-VCLOCK-08 hold after every delivery of any sequence', () => {
        fc.assert(
            fc.property(fc.array(arbDelivery, { maxLength: 12 }), (deliveries) => {
                const pool = newPool();
                const errors: unknown[] = [];
                pool.on('sync:error', (e: unknown) => errors.push(e));
                let wallTime = Date.now() + 100_000;

                for (const d of deliveries) {
                    const remote = card(d.id, d.clock, wallTime++);
                    const valid = isValidVectorClock(d.clock);
                    const before = snapshot(pool);
                    const errorsBefore = errors.length;

                    if (d.viaNetwork) {
                        // The real wire path: JSON bytes in. JSON cannot carry NaN or undefined,
                        // so judge validity on what actually arrives.
                        const bytes = new TextEncoder().encode(JSON.stringify(remote));
                        const arrived = JSON.parse(new TextDecoder().decode(bytes)).crdt?.vectorClock;
                        pool.handleSyncMessage(bytes, 'did:test:peer');
                        if (!isValidVectorClock(arrived)) {
                            // P-VCLOCK-08: rejected, reported, nothing changed.
                            expect(errors.length).toBe(errorsBefore + 1);
                            expect(snapshot(pool)).toBe(before);
                        }
                    } else if (valid) {
                        pool.mergeCard(remote);
                    } else {
                        // P-VCLOCK-08: rejected, nothing changed.
                        expect(() => pool.mergeCard(remote)).toThrow(/vector clock/i);
                        expect(snapshot(pool)).toBe(before);
                    }

                    // P-VCLOCK-07: every stored count is a whole number >= 0.
                    for (const stored of (pool as any).cards.values()) {
                        expect(isValidVectorClock(stored.crdt.vectorClock)).toBe(true);
                    }
                }
            }),
            params,
        );
    });
});
