/**
 * Card merge properties — the code leg of the Triple Verification Rule.
 *
 * Model legs: verification/tla/CardMerge.tla, verification/lean/Verification/CardMerge.lean.
 * Registry:   verification/PROPERTIES.md.
 *
 * Three real KnowledgePools replicate one card. A generated sequence of the actions of
 * CardMerge.tla runs against them, and every property is checked after every step against
 * a plain record of which writes each replica has seen.
 *
 * Injected I/O only: the physical clock (Date.now) is set by every step, and the pools get
 * an empty store. Set PBT_SEED to replay a run, PBT_RUNS to change the case count.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fc from 'fast-check';
import {
    compareHLC,
    compareVectorClocks,
    isValidHybridClock,
    isValidVectorClock,
    KnowledgePool,
    type HybridLogicalClock,
    type KnowledgeCard,
} from '../../src/knowledge.js';
import type { Storage } from '../../src/storage.js';
import { generateIdentity } from '../../src/identity.js';

const seed = process.env.PBT_SEED ? Number(process.env.PBT_SEED) : Date.now() | 0;
const numRuns = process.env.PBT_RUNS ? Number(process.env.PBT_RUNS) : 1000;
console.log(`[card-merge.property] seed=${seed} numRuns=${numRuns}`);
const params = { seed, numRuns };

// The physical clock, set by each step.
let now = 0;
beforeAll(() => {
    vi.spyOn(Date, 'now').mockImplementation(() => now);
});
afterAll(() => {
    vi.restoreAllMocks();
});

const REPLICAS = 3;
const identities = Array.from({ length: REPLICAS }, (_, i) => generateIdentity(`replica-${i}`));
const dids = identities.map((identity) => identity.did);

type Op =
    | { kind: 'update'; now: number; title: string }
    | { kind: 'confirm'; r: number; now: number }
    | { kind: 'delete'; r: number; now: number }
    | { kind: 'deliver'; to: number; msg: number; recent?: boolean; viaNetwork: boolean }
    | { kind: 'deliverBad'; to: number; msg: number; bad: Bad; viaNetwork: boolean };
type Bad = { field: 'crdt' | 'hlc' | 'wallTime' | 'logical' | 'nodeId'; value: unknown };

const arbReplica = fc.nat({ max: REPLICAS - 1 });
// Clocks that disagree and go backward: any small reading at every write, sometimes a large one.
const arbReading = fc.oneof(fc.nat({ max: 3 }), fc.nat({ max: 3 }), fc.nat({ max: 1_000_000 }));
const arbBadNumber: fc.Arbitrary<unknown> = fc.oneof(
    fc.constantFrom(-1, -0.5, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, undefined, true, '3', '', {}, []),
    fc.integer({ max: -1 }),
    fc.double({ noInteger: true }),
    fc.string(),
);
const arbBad: fc.Arbitrary<Bad> = fc.oneof(
    fc.record({ field: fc.constant('crdt' as const), value: fc.constantFrom(undefined, null, 0, '', 'x', true, [], {}) }),
    fc.record({ field: fc.constant('hlc' as const), value: fc.constantFrom(undefined, null, 0, 7, 'x', true, [], {}) }),
    fc.record({ field: fc.constant('wallTime' as const), value: arbBadNumber }),
    fc.record({ field: fc.constant('logical' as const), value: arbBadNumber }),
    fc.record({ field: fc.constant('nodeId' as const), value: fc.constantFrom(undefined, null, 0, 5, true, {}, []) }),
);
const arbOp: fc.Arbitrary<Op> = fc.oneof(
    { weight: 3, arbitrary: fc.record({ kind: fc.constant('update' as const), now: arbReading, title: fc.string({ minLength: 1, maxLength: 6 }) }) },
    { weight: 5, arbitrary: fc.record({ kind: fc.constant('confirm' as const), r: arbReplica, now: arbReading }) },
    { weight: 1, arbitrary: fc.record({ kind: fc.constant('delete' as const), r: arbReplica, now: arbReading }) },
    // `recent` picks among the latest four card states, so replicas often exchange fresh,
    // concurrent states; otherwise any state ever held, however old, is delivered.
    { weight: 10, arbitrary: fc.record({ kind: fc.constant('deliver' as const), to: arbReplica, msg: fc.nat(), recent: fc.boolean(), viaNetwork: fc.boolean() }) },
    { weight: 2, arbitrary: fc.record({ kind: fc.constant('deliverBad' as const), to: arbReplica, msg: fc.nat(), bad: arbBad, viaNetwork: fc.boolean() }) },
);

/** One write, as the test recorded it when it was made. */
interface WriteRecord {
    stamp: HybridLogicalClock;
    del: boolean;
    view: unknown;
    version: number;
    verifications: string[];
}
/** A card state some replica held, and the writes that replica had seen. All stay deliverable. */
interface Message {
    bytes: Uint8Array;
    seen: Set<string>;
}

const verificationKey = (v: { verifier: string; timestamp: number }): string => `${v.verifier}:${v.timestamp}`;
/** The card's content: everything the winning write carries whole. */
function view(card: KnowledgeCard): unknown {
    const { crdt: _crdt, version: _version, usage: _usage, verifications: _verifications, ...rest } = card;
    return JSON.parse(JSON.stringify(rest));
}
/** The whole card, with the verification list in a fixed order. */
function normalized(card: KnowledgeCard): unknown {
    const copy = JSON.parse(JSON.stringify(card)) as KnowledgeCard;
    copy.verifications.sort((a, b) => (verificationKey(a) < verificationKey(b) ? -1 : 1));
    return copy;
}
const subset = (a: Set<string>, b: Set<string>): boolean => [...a].every((k) => b.has(k));
const vcLeq = (a: Record<string, number>, b: Record<string, number>): boolean =>
    ['before', 'equal'].includes(compareVectorClocks(a, b));

/** How often each merge outcome happened over a whole run: the generator must reach them all. */
const outcomes: Record<string, number> = {};

/** The first card state reaches the other two replicas before anything else happens. */
const SPREAD: Op[] = [
    { kind: 'deliver', to: 1, msg: 0, viaNetwork: true },
    { kind: 'deliver', to: 2, msg: 0, viaNetwork: true },
];

async function run(createNow: number, ops: Op[]): Promise<void> {
    const pools = identities.map((identity) => new KnowledgePool({} as Storage, identity));
    const errors = pools.map(() => 0);
    pools.forEach((pool, i) => pool.on('sync:error', () => errors[i]++));
    pools.forEach((pool) =>
        pool.on('card:merged', ({ action }: { action: string }) => {
            outcomes[action] = (outcomes[action] ?? 0) + 1;
        }),
    );

    now = createNow;
    const space = await pools[0].createSpace('space', 'space');
    const id = (await pools[0].createCard(space.id, 'fact', 'first', 'first content')).id;

    const held = (i: number): KnowledgeCard | undefined => (pools[i] as any).cards.get(id);
    const writes = new Map<string, WriteRecord>();
    const seen: Set<string>[] = pools.map(() => new Set<string>());
    const msgs: Message[] = [];
    const capture = (i: number): void => {
        msgs.push({ bytes: pools[i].serializeCard(held(i)!), seen: new Set(seen[i]) });
    };

    /** Record the write replica i has just made, and check its stamp (P-HLC-05). */
    const recordWrite = (i: number, del: boolean): void => {
        const card = held(i)!;
        const key = `${dids[i]}#${card.crdt.vectorClock[dids[i]]}`;
        expect(writes.has(key)).toBe(false);
        for (const [otherKey, other] of writes) {
            // No two writes share a stamp.
            expect(compareHLC(other.stamp, card.crdt.hlc)).not.toBe(0);
            // A write's stamp is larger than the stamp of every write its replica had seen.
            if (seen[i].has(otherKey)) expect(compareHLC(other.stamp, card.crdt.hlc)).toBeLessThan(0);
        }
        writes.set(key, {
            stamp: { ...card.crdt.hlc },
            del,
            view: view(card),
            version: card.version,
            verifications: card.verifications.map(verificationKey),
        });
        seen[i].add(key);
        capture(i);
    };

    /** Every state property, at every replica that holds the card. */
    const check = (): void => {
        for (let i = 0; i < REPLICAS; i++) {
            const card = held(i);
            if (!card) {
                expect(seen[i].size).toBe(0);
                continue;
            }
            const mine = [...seen[i]].map((key) => writes.get(key)!);
            const top = mine.reduce((a, b) => (compareHLC(a.stamp, b.stamp) >= 0 ? a : b));

            // P-CARD-02: the replica shows the write with the largest stamp among those it has seen.
            expect(card.crdt.hlc).toEqual(top.stamp);
            expect(view(card)).toEqual(top.view);
            // P-CARD-04: deleted exactly when a delete has been seen.
            expect(card.crdt.tombstone).toBe(mine.some((w) => w.del));
            // The vector clock counts exactly the writes seen.
            for (let n = 0; n < REPLICAS; n++) {
                const count = [...seen[i]].filter((key) => key.startsWith(`${dids[n]}#`)).length;
                expect(card.crdt.vectorClock[dids[n]] ?? 0).toBe(count);
            }
            // The joined fields are those of all the writes seen.
            expect(card.version).toBe(Math.max(...mine.map((w) => w.version)));
            expect(card.verifications.map(verificationKey).sort()).toEqual(
                [...new Set(mine.flatMap((w) => w.verifications))].sort(),
            );
            // P-CARD-06 and P-VCLOCK-07: stored clocks are valid.
            expect(isValidHybridClock(card.crdt.hlc)).toBe(true);
            expect(isValidVectorClock(card.crdt.vectorClock)).toBe(true);
        }
        // P-CARD-01: replicas that have seen the same writes hold the same card.
        for (let i = 0; i < REPLICAS; i++) {
            for (let j = i + 1; j < REPLICAS; j++) {
                const a = held(i);
                const b = held(j);
                if (a && b && compareVectorClocks(a.crdt.vectorClock, b.crdt.vectorClock) === 'equal') {
                    expect(normalized(a)).toEqual(normalized(b));
                }
            }
        }
    };

    recordWrite(0, false);
    check();

    for (const op of ops) {
        const r = op.kind === 'update' ? 0 : op.kind === 'deliver' || op.kind === 'deliverBad' ? op.to : op.r;
        const before = held(r) ? (JSON.parse(JSON.stringify(held(r))) as KnowledgeCard) : undefined;
        const beforeText = JSON.stringify(held(r));
        const errorsBefore = errors[r];

        if (op.kind === 'update') {
            // Only the author may update; replica 0 is the author.
            now = op.now;
            await pools[0].updateCard(id, { title: op.title });
            recordWrite(0, false);
        } else if (op.kind === 'confirm') {
            if (!before) continue;
            now = op.now;
            // A node confirms as itself. Returns null, and writes nothing, on a deleted card.
            if (pools[r].confirmKnowledge(id, dids[r]) !== null) recordWrite(r, false);
            else expect(JSON.stringify(held(r))).toBe(beforeText);
        } else if (op.kind === 'delete') {
            if (!before) continue;
            now = op.now;
            await pools[r].deleteCard(id);
            recordWrite(r, true);
        } else if (op.kind === 'deliver') {
            const m = op.recent
                ? msgs[msgs.length - 1 - (op.msg % Math.min(4, msgs.length))]
                : msgs[op.msg % msgs.length];
            const stale = before !== undefined && subset(m.seen, seen[r]);
            if (op.viaNetwork) pools[r].handleSyncMessage(m.bytes, 'did:test:peer');
            else pools[r].mergeCard(pools[r].deserializeCard(m.bytes));
            expect(errors[r]).toBe(errorsBefore);
            // P-CARD-03: a card the replica has already seen changes nothing.
            if (stale) expect(JSON.stringify(held(r))).toBe(beforeText);
            const grew = !subset(m.seen, seen[r]);
            for (const key of m.seen) seen[r].add(key);
            if (grew) capture(r);
        } else {
            // P-CARD-06: a card whose stamp is not valid is rejected and changes nothing.
            const m = msgs[op.msg % msgs.length];
            const remote = JSON.parse(new TextDecoder().decode(m.bytes));
            if (op.bad.field === 'crdt') remote.crdt = op.bad.value;
            else if (op.bad.field === 'hlc') remote.crdt.hlc = op.bad.value;
            else remote.crdt.hlc[op.bad.field] = op.bad.value;
            if (op.viaNetwork) {
                // JSON cannot carry NaN or undefined, so judge validity on what actually arrives.
                const bytes = new TextEncoder().encode(JSON.stringify(remote));
                const arrived = JSON.parse(new TextDecoder().decode(bytes));
                if (isValidHybridClock(arrived.crdt?.hlc)) continue;
                pools[r].handleSyncMessage(bytes, 'did:test:peer');
                expect(errors[r]).toBe(errorsBefore + 1);
            } else {
                if (isValidHybridClock(remote.crdt?.hlc)) continue;
                expect(() => pools[r].mergeCard(remote)).toThrow(/clock/i);
            }
            expect(JSON.stringify(held(r))).toBe(beforeText);
        }

        // P-CARD-05: the replica's card never goes backward: clock, stamp, deleted flag.
        if (before) {
            const after = held(r)!;
            expect(after).toBeDefined();
            expect(vcLeq(before.crdt.vectorClock, after.crdt.vectorClock)).toBe(true);
            expect(compareHLC(before.crdt.hlc, after.crdt.hlc)).toBeLessThanOrEqual(0);
            if (before.crdt.tombstone) expect(after.crdt.tombstone).toBe(true);
        }
        check();
    }
}

describe('one card across three replicas (actions of CardMerge.tla)', () => {
    it('P-CARD-01 to P-CARD-06 and P-HLC-05 hold after every step of any action sequence', async () => {
        await fc.assert(
            // Most cases start with the card on all three replicas, so concurrent writes are common;
            // the rest start with it on one, so first deliveries are covered too.
            fc.asyncProperty(
                arbReading,
                fc.oneof({ weight: 3, arbitrary: fc.constant(true) }, { weight: 1, arbitrary: fc.constant(false) }),
                fc.array(arbOp, { maxLength: 40, size: 'max' }),
                async (createNow, spread, ops) => {
                    await run(createNow, spread ? [...SPREAD, ...ops] : ops);
                },
            ),
            params,
        );
        // The sequences must have reached every branch of mergeCard, not only the easy ones.
        console.log(`[card-merge.property] merge outcomes: ${JSON.stringify(outcomes)}`);
        if (numRuns >= 1000) {
            for (const action of ['new', 'remote-wins', 'local-wins-concurrent', 'remote-wins-concurrent']) {
                expect(outcomes[action] ?? 0, `merge outcome "${action}" never happened`).toBeGreaterThan(numRuns / 2);
            }
        }
    }, 120_000);
});

// Counterexamples found by the property above on the code as it was, kept as fixed cases.
// All found 2026-11-24 with seed 1, shrunk by fast-check.
describe('card merge regressions', () => {
    // mergeCard accepted any stamp. A NaN or negative wall time can never be ordered or advanced.
    it('a card with wall time -1 is rejected', async () => {
        await run(0, [{ kind: 'deliverBad', to: 0, msg: 0, bad: { field: 'wallTime', value: -1 }, viaNetwork: false }]);
    });

    // mergeCard replaced the card's stamp with the receiver's own clock and node id, so the stamp
    // stopped being the stamp of a write and replicas compared different stamps for the same card.
    it('receiving a card keeps the stamp of the write that made it', async () => {
        await run(0, [{ kind: 'deliver', to: 1, msg: 0, viaNetwork: false }]);
    });

    // A write kept the node id already on the stamp, so two nodes could stamp two different
    // writes identically; each replica then kept its own and they never agreed.
    it('two nodes writing at the same clock reading get different stamps', async () => {
        await run(0, [
            { kind: 'deliver', to: 1, msg: 0, viaNetwork: false },
            { kind: 'confirm', r: 1, now: 0 },
            { kind: 'update', now: 0, title: ' ' },
        ]);
    });

    // deleteCard did not advance the clocks, so peers saw an equal vector clock and discarded it.
    it('a delete advances the clocks', async () => {
        await run(0, [{ kind: 'delete', r: 0, now: 0 }]);
    });
    it('a delete reaches a replica that held the card', async () => {
        await run(0, [
            { kind: 'deliver', to: 1, msg: 0, viaNetwork: true }, // msgs[1]: replica 1 holds the card
            { kind: 'delete', r: 1, now: 0 }, // msgs[2]: replica 1 deleted it
            { kind: 'deliver', to: 0, msg: 2, viaNetwork: true }, // replica 0 must now show it deleted
        ]);
    });

    // deserializeCard gave a card with no `crdt` fresh local clocks, so it was accepted.
    it('a card from the network with no clocks is rejected', async () => {
        await run(0, [{ kind: 'deliverBad', to: 0, msg: 0, bad: { field: 'crdt', value: undefined }, viaNetwork: true }]);
    });

    // Three replicas, two concurrent confirmations, delivered in different orders (the case the
    // old stamp handling split): every replica that has seen both must show the same one.
    it('three replicas that see two concurrent writes in different orders agree', async () => {
        await run(5, [
            { kind: 'deliver', to: 1, msg: 0, viaNetwork: true }, // msgs[1]
            { kind: 'deliver', to: 2, msg: 0, viaNetwork: true }, // msgs[2]
            { kind: 'confirm', r: 1, now: 10 }, // msgs[3]
            { kind: 'confirm', r: 2, now: 20 }, // msgs[4]
            { kind: 'deliver', to: 0, msg: 3, viaNetwork: true }, // replica 0 sees 1's, then 2's
            { kind: 'deliver', to: 0, msg: 4, viaNetwork: true },
            { kind: 'deliver', to: 1, msg: 4, viaNetwork: true }, // replica 1 sees 2's
            { kind: 'deliver', to: 2, msg: 3, viaNetwork: true }, // replica 2 sees 1's
        ]);
    });
});
