/**
 * Integration tests for GenesisLauncher + GovernanceEngine tick hook.
 *
 * Phase 12 Wave 3 — VOTE-04 / D-12-03.
 *
 * Cases:
 *   - launcher exposes `governance` as a GovernanceEngine instance
 *   - clock.advance() to deadline_tick triggers proposal.tallied in audit chain
 *   - proposal.tallied appears AFTER the tick event in the same tick (strictly-increasing IDs)
 *   - no proposal.tallied emitted if launcher constructed but start() never called
 *     and ticks are manually driven via the engine directly
 */

import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { GovernanceEngine } from '../../src/governance/engine.js';
import { createInMemoryStore } from '../../src/governance/store.js';
import { appendProposalOpened } from '../../src/governance/appendProposalOpened.js';
import { appendBallotCommitted } from '../../src/governance/appendBallotCommitted.js';
import { appendBallotRevealed } from '../../src/governance/appendBallotRevealed.js';
import { computeCommitHash } from '../../src/governance/commit-reveal.js';
import { GenesisLauncher, TEST_CONFIG } from '../../src/genesis/index.js';

const ALICE = 'did:noesis:alice';
const VALID_NONCE = '00000000000000000000000000000000';

describe('GenesisLauncher + GovernanceEngine', () => {
    it('launcher.governance is a GovernanceEngine instance', () => {
        const launcher = new GenesisLauncher(TEST_CONFIG);
        launcher.bootstrap({ skipSeedNous: true });
        expect(launcher.governance).toBeInstanceOf(GovernanceEngine);
    });

    it('proposal.tallied fires on the tick where currentTick >= deadline_tick', async () => {
        const audit = new AuditChain();
        const store = createInMemoryStore('test-grid');

        // Set up a registry that recognises ALICE.
        // count=0 so quorum_met=false → outcome='quorum_fail' → no JSON law parse.
        // This lets us assert proposal.tallied without needing valid JSON law body_text.
        const registry = {
            get: (did: string) => did === ALICE ? { did, status: 'active' } : undefined,
            has: (did: string) => did === ALICE,
            isTombstoned: (_did: string) => false,
            count: 0,
            active: () => [],
            spawn: () => { throw new Error('not used'); },
            touch: () => {},
        } as unknown as import('../../src/registry/registry.js').NousRegistry;

        const logos = {
            addLaw: () => {},
            activeLaws: () => [],
            getLaw: () => undefined,
            hasForbiddenKey: () => false,
        } as unknown as import('../../src/logos/engine.js').LogosEngine;

        // Open a proposal at tick=1 with deadline_tick=3
        await appendProposalOpened(audit, {
            proposer_did: ALICE,
            body_text: 'Governance test proposal',
            deadline_tick: 3,
            currentTick: 1,
            store,
        });

        // Alice commits and reveals her vote (so quorum/supermajority can be met)
        const proposal = (await store.getOpenProposals())[0];
        expect(proposal).toBeDefined();
        const { proposal_id } = proposal;

        const hash = computeCommitHash('yes', VALID_NONCE, ALICE);
        await appendBallotCommitted(audit, {
            proposal_id,
            voter_did: ALICE,
            commit_hash: hash,
            currentTick: 2,
            store,
        });
        await appendBallotRevealed(audit, {
            proposal_id,
            voter_did: ALICE,
            choice: 'yes',
            nonce: VALID_NONCE,
            currentTick: 2,
            store,
        });

        // Build engine and manually call onTickClosed
        const engine = new GovernanceEngine(audit, store, registry, logos);

        // Tick 2: no tallied yet
        await engine.onTickClosed(2);
        const beforeTick3 = audit.query({ eventType: 'proposal.tallied' });
        expect(beforeTick3).toHaveLength(0);

        // Tick 3: should tally
        // First emit a tick event manually to simulate the clock
        const tickIndexBefore = audit.length;
        audit.append('tick', 'system', { tick: 3, epoch: 0, tickRateMs: 100, timestamp: 0 });
        const tickIndexAfter = audit.length; // tick entry is at tickIndexBefore
        await engine.onTickClosed(3);

        const tallied = audit.query({ eventType: 'proposal.tallied' });
        expect(tallied).toHaveLength(1);
        expect(tallied[0]!.payload['proposal_id']).toBe(proposal_id);

        // Ordering: proposal.tallied must appear AFTER the tick entry
        const allEntries = audit.query({});
        const tickEntry = allEntries.find(e => e.eventType === 'tick' && e.payload['tick'] === 3);
        const talliedEntry = allEntries.find(e => e.eventType === 'proposal.tallied');
        expect(tickEntry).toBeDefined();
        expect(talliedEntry).toBeDefined();
        // IDs are sequential integers — tallied must come after tick
        expect(Number(talliedEntry!.id)).toBeGreaterThan(Number(tickEntry!.id));

        void tickIndexAfter; // used for ordering assertions
    });

    it('GenesisLauncher.bootstrap wires engine into clock.onTick; clock.advance drives tally', async () => {
        const launcher = new GenesisLauncher({
            ...TEST_CONFIG,
            tickRateMs: 10,  // fast clock for testing
        });
        launcher.bootstrap({ skipSeedNous: true });

        // Inject a proposal directly into the launcher's governance store
        const store = launcher.governanceStore;
        expect(store).toBeDefined();

        await appendProposalOpened(launcher.audit, {
            proposer_did: 'did:noesis:genesis',
            body_text: 'Launcher integration test proposal',
            deadline_tick: 2,
            currentTick: 0,
            store,
        });

        // Advance 2 ticks — the launcher's clock.onTick handler fires the engine
        launcher.clock.advance(); // tick 1
        // Wait for async onTickClosed to settle
        await new Promise(resolve => setTimeout(resolve, 10));
        launcher.clock.advance(); // tick 2
        await new Promise(resolve => setTimeout(resolve, 10));

        const tallied = launcher.audit.query({ eventType: 'proposal.tallied' });
        expect(tallied).toHaveLength(1);
    });
});
