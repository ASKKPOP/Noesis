/**
 * replay.ts — Deterministic governance replay harness for zero-diff regression tests.
 *
 * Exports `runFixtureReplay(fixtureId, revealCount)` which:
 *   1. Loads a named fixture (fixture-A built-in) defining a governance scenario
 *   2. Creates an in-memory store + fresh AuditChain
 *   3. Runs the four-emitter pipeline deterministically
 *   4. Returns the chain-tail (head) hash for byte-stable comparison
 *
 * Determinism guarantees:
 *   - No wall-clock reads (D-12-11 / D-11-13)
 *   - No Math.random — nonces are derived from voter index
 *   - Same (fixtureId, revealCount) → same chain-tail hash across runs
 *
 * The chain-tail hash covers ALL appended audit entries in order. Any change to
 * event ordering, payload shape, or serialization breaks the zero-diff test —
 * which is the intent (T-09-13 tamper-evident regression guard).
 *
 * Phase 12 Wave 2 — T-09-13 / D-12-03 / CONTEXT-12.
 */

import { AuditChain } from '../audit/chain.js';
import { LogosEngine } from '../logos/engine.js';
import { NousRegistry } from '../registry/registry.js';
import { appendProposalOpened } from './appendProposalOpened.js';
import { appendBallotCommitted } from './appendBallotCommitted.js';
import { appendBallotRevealed } from './appendBallotRevealed.js';
import { appendProposalTallied } from './appendProposalTallied.js';
import { computeCommitHash } from './commit-reveal.js';
import { createInMemoryStore } from './store.js';

// ── Fixture definitions ────────────────────────────────────────────────────────

interface FixtureDefinition {
    totalNousCount: number;
    proposer_did: string;
    body_text: string;
    quorum_pct: number;
    supermajority_pct: number;
    deadline_tick: number;
    startTick: number;
    /** 10 voters — all commit; only the first `revealCount` reveal */
    voters: Array<{
        voter_did: string;
        choice: 'yes' | 'no' | 'abstain';
        nonce: string;  // 32 hex chars — deterministic per voter index
    }>;
}

/**
 * fixture-A: 10 voters, 10 Nous total, quorum=50%, supermajority=67%.
 * First 8 voters choose 'yes', last 2 choose 'no'.
 * With ≥7 reveals (7/10 ≥ 50% quorum AND 7/(7+0..2) ≥ 67%) → passed.
 * With 0 reveals → quorum_fail (0/10 < 50%).
 * With 1..4 reveals → quorum_fail if unrevealed brings participation < 5.
 *
 * NOTE: All 10 commit (participation = 10 from the committed side).
 * quorum = ceil(50/100 * 10) = 5 → met whenever participation ≥ 5.
 * Since all 10 commit, quorum is ALWAYS met (pessimistic quorum = 10).
 * With 0 reveals: 10 committed → 10 participants → quorum met; 0 decisive → rejected.
 * With 1 reveal (yes): quorum met; 1/(1+0)=100% ≥ 67% → passed.
 * With 5 reveals (5 yes): quorum met; 5/(5+0)=100% ≥ 67% → passed.
 * With 10 reveals (8 yes + 2 no): quorum met; 8/(8+2)=80% ≥ 67% → passed.
 */
function buildFixtureA(): FixtureDefinition {
    const voters = Array.from({ length: 10 }, (_, i) => ({
        voter_did: `did:noesis:v${String(i).padStart(2, '0')}`,
        choice: (i < 8 ? 'yes' : 'no') as 'yes' | 'no' | 'abstain',
        // Deterministic nonce: pad index to 32 hex chars (32 zeros + last 2 chars = index in hex)
        nonce: String(i + 1).padStart(32, '0').slice(-32) + ''.padEnd(32 - String(i + 1).padStart(32, '0').slice(-32).length, '0'),
    }));

    // Simpler: nonce[i] = (i+1) expressed as 32 hex chars (big-endian, zero-padded)
    const nonces = Array.from({ length: 10 }, (_, i) =>
        (i + 1).toString(16).padStart(32, '0'),
    );

    return {
        totalNousCount: 10,
        proposer_did: 'did:noesis:proposer',
        body_text: JSON.stringify({
            id: 'law-fixture-a',
            title: 'Fixture A Law',
            description: 'Phase 12 fixture law — do not modify',
            ruleLogic: {
                condition: { type: 'true' },
                action: 'allow',
                sanction_on_violation: 'none',
            },
            severity: 'info',
            status: 'active',
        }),
        quorum_pct: 50,
        supermajority_pct: 67,
        deadline_tick: 100,
        startTick: 1,
        voters: voters.map((v, i) => ({ ...v, nonce: nonces[i] })),
    };
}

const FIXTURES: Record<string, () => FixtureDefinition> = {
    'fixture-A': buildFixtureA,
};

// ── Minimal NousRegistry adapter for replay ───────────────────────────────────

/**
 * Creates a minimal NousRegistry with a fixed count for replay purposes.
 * Avoids needing SpatialMap or other dependencies.
 */
function createReplayRegistry(totalNousCount: number): NousRegistry {
    // Create a minimal registry with the right count
    const registry = new NousRegistry();
    // We need to register exactly totalNousCount Nous
    // Use minimal spawn requests with fake DIDs for the count
    for (let i = 0; i < totalNousCount; i++) {
        try {
            registry.spawn(
                {
                    did: `did:noesis:replay-nous-${i}`,
                    name: `replay-nous-${i}`,
                    publicKey: 'replay-key',
                    region: 'genesis',
                },
                'replay.grid',
                0,
                0,
            );
        } catch {
            // Ignore — if already registered
        }
    }
    return registry;
}

// ── Main replay function ───────────────────────────────────────────────────────

/**
 * Run a deterministic governance fixture replay and return the chain-tail hash.
 *
 * @param fixtureId - Name of the built-in fixture (e.g. 'fixture-A')
 * @param revealCount - Number of voters who reveal (0..n voters.length)
 * @returns The chain `head` hash (64-char hex) after all events are appended
 *
 * @throws Error if fixtureId is unknown or revealCount > voters.length
 */
export async function runFixtureReplay(fixtureId: string, revealCount: number): Promise<string> {
    const fixtureFn = FIXTURES[fixtureId];
    if (!fixtureFn) {
        throw new Error(`runFixtureReplay: unknown fixtureId "${fixtureId}"`);
    }
    const fixture = fixtureFn();
    if (revealCount < 0 || revealCount > fixture.voters.length) {
        throw new Error(
            `runFixtureReplay: revealCount ${revealCount} out of range [0, ${fixture.voters.length}]`,
        );
    }

    // Fresh audit chain (empty, deterministic starting hash)
    const audit = new AuditChain();

    // In-memory store (no MySQL)
    const store = createInMemoryStore('replay-grid');

    // Registry with fixed totalNousCount
    const registry = createReplayRegistry(fixture.totalNousCount);

    // LogosEngine (in-memory)
    const logos = new LogosEngine();

    // 1. Open proposal — use fixtureId as deterministic proposal_id for zero-diff stability
    let tick = fixture.startTick;
    const { proposal_id } = await appendProposalOpened(audit, {
        proposer_did: fixture.proposer_did,
        body_text: fixture.body_text,
        quorum_pct: fixture.quorum_pct,
        supermajority_pct: fixture.supermajority_pct,
        deadline_tick: fixture.deadline_tick,
        currentTick: tick,
        store,
        _proposalIdOverride: fixtureId,
    });
    tick++;

    // 2. All voters commit
    for (const voter of fixture.voters) {
        const commit_hash = computeCommitHash(voter.choice, voter.nonce, voter.voter_did);
        await appendBallotCommitted(audit, {
            proposal_id,
            voter_did: voter.voter_did,
            commit_hash,
            currentTick: tick,
            store,
        });
        tick++;
    }

    // 3. First `revealCount` voters reveal
    for (let i = 0; i < revealCount; i++) {
        const voter = fixture.voters[i];
        await appendBallotRevealed(audit, {
            proposal_id,
            voter_did: voter.voter_did,
            choice: voter.choice,
            nonce: voter.nonce,
            currentTick: tick,
            store,
        });
        tick++;
    }

    // 4. Trigger tally at deadline
    await appendProposalTallied(audit, {
        proposal_id,
        currentTick: fixture.deadline_tick,
        store,
        registry,
        logos,
    });

    return audit.head;
}
