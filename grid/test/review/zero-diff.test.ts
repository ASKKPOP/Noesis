// grid/test/review/zero-diff.test.ts — Phase 5 D-13 / SC #5 regression.
//
// Invariant (RESEARCH §RQ5): adding ReviewerNous introduces EXACTLY `trade.reviewed`
// entries into the AuditChain — and NOTHING else. Every non-reviewer event's type,
// actor, payload, and timestamp is byte-identical between a reviewer-enabled and a
// reviewer-bypassed run of the SAME scripted trade sequence.
//
// Why not compare chain hashes directly? Removing entries from a hash chain shifts
// every downstream `prevHash` pointer — the hashes legitimately differ. The test is
// about semantic non-regression of every non-reviewer event, not about byte-identical
// Merkle root (see RESEARCH §RQ5 Option 2).
//
// Why fake timers? `AuditChain.computeHash` incorporates `Date.now()` (chain.ts:26).
// Without `vi.useFakeTimers() + vi.setSystemTime()` the timestamps — and thus the
// comparison — become nondeterministic. Non-negotiable per plan.
//
// Why is `reviewer` optional in NousRunnerConfig? The zero-diff contract requires
// running the SAME runner code path both with and without the reviewer, to prove
// reviewer wiring doesn't perturb any upstream/downstream event. See nous-runner.ts
// `reviewer?: Reviewer` JSDoc — production callers MUST pass a reviewer; the opt-out
// exists solely to enable this regression.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { EconomyManager } from '../../src/economy/config.js';
import { SpatialMap } from '../../src/space/map.js';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { Reviewer } from '../../src/review/index.js';
import type { AuditEntry } from '../../src/audit/types.js';
import type {
    BrainAction,
    IBrainBridge,
    TickParams,
    MessageParams,
    EventParams,
} from '../../src/integration/types.js';

const BUYER_DID = 'did:noesis:alpha';
const SELLER_DID = 'did:noesis:beta';
const TELOS_HASH = 'a'.repeat(64);
const FIXED_TIME = new Date('2026-01-01T00:00:00.000Z');
const TICK_COUNT = 100;

/**
 * Deterministic trade-action bridge: emits one pass-path trade_request on tick 1
 * per scheduled trade, otherwise noop. Same sequence produces identical actions
 * in both runs (A: reviewer on, B: reviewer bypassed).
 *
 * Pass-path only — the invariant we're proving is "reviewer adds exactly
 * trade.reviewed entries and nothing else". Mixing fails complicates the
 * comparison (fails skip settled in Run A, but Run B has no reviewer to
 * reject them → extra settled entries in B). The pure pass-path sequence
 * produces proposed → reviewed{pass} → settled in A vs. proposed → settled
 * in B, a clean 1:1 with only trade.reviewed removed.
 */
function scriptedBridge(trades: ReadonlyArray<BrainAction>): IBrainBridge {
    let pointer = 0;
    return {
        connected: true,
        sendTick: (_p: TickParams) => {
            if (pointer < trades.length) {
                const action = trades[pointer++];
                return Promise.resolve([action]);
            }
            return Promise.resolve([]);
        },
        sendMessage: (_p: MessageParams) => Promise.resolve([]),
        sendEvent: (_p: EventParams) => { /* no-op */ },
        getState: () => Promise.resolve({}),
    };
}

function makeTradeAction(nonce: string, amount: number): BrainAction {
    return {
        action_type: 'trade_request',
        channel: '',
        text: '',
        metadata: {
            counterparty: SELLER_DID,
            amount,
            nonce,
            memoryRefs: ['mem:1', 'mem:2'],
            telosHash: TELOS_HASH,
        },
    };
}

/** Build a fresh deterministic environment. Separate instances per run. */
function makeEnv(): {
    audit: AuditChain;
    registry: NousRegistry;
    space: SpatialMap;
    economy: EconomyManager;
} {
    const audit = new AuditChain();
    const registry = new NousRegistry();
    const space = new SpatialMap();
    const economy = new EconomyManager({
        initialSupply: 100, minTransfer: 1, maxTransfer: 1_000,
    });
    space.addRegion({
        id: 'agora', name: 'Agora', description: 'market',
        regionType: 'public', capacity: 10, properties: {},
    });
    registry.spawn(
        { name: 'Alpha', did: BUYER_DID, publicKey: 'pk-a', region: 'agora' },
        'test.noesis', 0, 100,
    );
    registry.spawn(
        { name: 'Beta', did: SELLER_DID, publicKey: 'pk-b', region: 'agora' },
        'test.noesis', 0, 50,
    );
    return { audit, registry, space, economy };
}

async function runSim(withReviewer: boolean): Promise<AuditEntry[]> {
    // Repin fake-clock baseline — ensures both Run A and Run B start from the
    // identical wall-clock and advance identically.
    vi.setSystemTime(FIXED_TIME);
    Reviewer.resetForTesting();

    const env = makeEnv();
    const reviewer = withReviewer ? new Reviewer(env.audit, env.registry) : undefined;

    // Deterministic trade schedule: 5 pass-path trades at small amounts
    // (buyer has 100 ousia, 5*1=5 spent total → well within bounds).
    // Trades only fire on early ticks; remaining ticks are no-op brain actions.
    const trades: BrainAction[] = [
        makeTradeAction('nonce-A-1', 1),
        makeTradeAction('nonce-A-2', 1),
        makeTradeAction('nonce-A-3', 1),
        makeTradeAction('nonce-A-4', 1),
        makeTradeAction('nonce-A-5', 1),
    ];

    const runner = new NousRunner({
        nousDid: BUYER_DID,
        nousName: 'Alpha',
        bridge: scriptedBridge(trades),
        space: env.space,
        audit: env.audit,
        registry: env.registry,
        economy: env.economy,
        ...(reviewer ? { reviewer } : {}),
    });

    for (let tick = 0; tick < TICK_COUNT; tick++) {
        await runner.tick(tick, 0);
        // Advance fake time by 1ms per tick so consecutive appends do not share
        // Date.now() — this keeps hash-chain semantics realistic without adding
        // nondeterminism (both runs advance identically).
        vi.advanceTimersByTime(1);
    }

    return env.audit.all();
}

describe('D-13 / SC #5: Reviewer path preserves zero-diff invariant', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_TIME);
        Reviewer.resetForTesting();
    });

    afterEach(() => {
        Reviewer.resetForTesting();
        vi.useRealTimers();
    });

    it('reviewer-enabled and reviewer-bypassed runs differ ONLY in trade.reviewed entries', async () => {
        const entriesA = await runSim(true);
        const entriesB = await runSim(false);

        // Sanity: Run A has trade.reviewed entries, Run B has none.
        const reviewedA = entriesA.filter((e) => e.eventType === 'trade.reviewed');
        const reviewedB = entriesB.filter((e) => e.eventType === 'trade.reviewed');
        expect(reviewedA.length).toBeGreaterThan(0);
        expect(reviewedB.length).toBe(0);

        // Every reviewed entry is authored by Reviewer.DID with verdict=pass.
        for (const e of reviewedA) {
            expect(e.actorDid).toBe(Reviewer.DID);
            expect((e.payload as Record<string, unknown>)['verdict']).toBe('pass');
        }

        // trade.proposed and trade.settled counts match between runs.
        const proposedA = entriesA.filter((e) => e.eventType === 'trade.proposed').length;
        const proposedB = entriesB.filter((e) => e.eventType === 'trade.proposed').length;
        const settledA = entriesA.filter((e) => e.eventType === 'trade.settled').length;
        const settledB = entriesB.filter((e) => e.eventType === 'trade.settled').length;
        expect(proposedA).toBe(proposedB);
        expect(settledA).toBe(settledB);
        // And greater than zero — sanity that the sim actually ran.
        expect(proposedA).toBeGreaterThan(0);
        expect(settledA).toBeGreaterThan(0);

        // Filter trade.reviewed out of Run A and compare field-by-field to Run B.
        const filteredA = entriesA.filter((e) => e.eventType !== 'trade.reviewed');
        expect(filteredA).toHaveLength(entriesB.length);

        for (let i = 0; i < filteredA.length; i++) {
            expect(filteredA[i].eventType).toBe(entriesB[i].eventType);
            expect(filteredA[i].actorDid).toBe(entriesB[i].actorDid);
            expect(filteredA[i].targetDid).toBe(entriesB[i].targetDid);
            expect(filteredA[i].payload).toEqual(entriesB[i].payload);
            // Timestamp identity — this is the deepest invariant; Date.now() is
            // mocked via vi.setSystemTime so every non-reviewer entry was appended
            // at the same wall-clock offset in both runs. Reviewer entries in Run A
            // DO advance Date.now (because we advance 1ms per tick), but between
            // non-reviewer events the advance count is identical.
            expect(filteredA[i].createdAt).toBe(entriesB[i].createdAt);
            // id, prevHash, eventHash INTENTIONALLY NOT compared — those diverge
            // legitimately because Run A's chain has extra entries shifting
            // id/hash alignment (RESEARCH §RQ5 Option 2).
        }

        // Both chains verify internally — zero-diff is about semantic equivalence,
        // not about chain-integrity regression.
        // (Verify Run A's chain with its own reviewer entries in place.)
        const envReplay = new AuditChain();
        envReplay.loadEntries(entriesA);
        expect(envReplay.verify().valid).toBe(true);

        const envReplayB = new AuditChain();
        envReplayB.loadEntries(entriesB);
        expect(envReplayB.verify().valid).toBe(true);
    });

    it('repeated runs are deterministic (no flakiness)', async () => {
        const run1 = await runSim(true);
        const run2 = await runSim(true);

        expect(run1).toHaveLength(run2.length);
        for (let i = 0; i < run1.length; i++) {
            expect(run1[i].eventType).toBe(run2[i].eventType);
            expect(run1[i].actorDid).toBe(run2[i].actorDid);
            expect(run1[i].payload).toEqual(run2[i].payload);
            expect(run1[i].createdAt).toBe(run2[i].createdAt);
            expect(run1[i].eventHash).toBe(run2[i].eventHash);
        }
    });
});
