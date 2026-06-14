/**
 * governance-engine.test.ts
 *
 * Phase 12 Wave 2 — Task 12-W2-03.
 *
 * Tests for GovernanceEngine.onTickClosed — the tick-driven tally trigger.
 *
 * Scenarios:
 *   1. Proposal still open (currentTick < deadline_tick) → no tally emitted
 *   2. Proposal at deadline (currentTick >= deadline_tick) → proposal.tallied emitted
 *   3. Proposal already tallied (status = 'tallied') → skipped (no double-tally)
 *   4. Multiple proposals — only expired ones get tallied
 *
 * Per VOTE-04 / D-12-03 / CONTEXT-12.
 */

import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { LogosEngine } from '../../src/logos/engine.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { GovernanceEngine } from '../../src/governance/engine.js';
import { createInMemoryStore } from '../../src/governance/store.js';
import { appendProposalOpened } from '../../src/governance/appendProposalOpened.js';
import {
    getZoneTaxBps,
    recordPolisOverride,
    _resetPolisOverrides,
    ZONE_TAX_BPS,
} from '../../src/civic/founding-law.js';

// ── helpers ────────────────────────────────────────────────────────────────────

function freshDeps() {
    const audit = new AuditChain();
    const store = createInMemoryStore('test-grid');
    const registry = new NousRegistry();
    // Register 5 Nous so quorum can be met
    for (let i = 0; i < 5; i++) {
        try {
            registry.spawn(
                { did: `did:noesis:eng-${i}`, name: `eng-${i}`, publicKey: 'pk', region: 'genesis' },
                'test.grid', 0, 0,
            );
        } catch { /* ignore */ }
    }
    const logos = new LogosEngine();
    const engine = new GovernanceEngine(audit, store, registry, logos);
    return { audit, store, registry, logos, engine };
}

const PROPOSER = 'did:noesis:proposer';
const BODY_TEXT = JSON.stringify({
    id: 'law-engine-test',
    title: 'Engine Test Law',
    description: 'Test',
    ruleLogic: { condition: { type: 'true' }, action: 'allow', sanction_on_violation: 'none' },
    severity: 'info',
    status: 'active',
});

// ── tests ──────────────────────────────────────────────────────────────────────

describe('GovernanceEngine.onTickClosed — proposal lifecycle', () => {
    it('does NOT tally a proposal before its deadline_tick', async () => {
        const { audit, store, engine } = freshDeps();

        await appendProposalOpened(audit, {
            proposer_did: PROPOSER,
            body_text: BODY_TEXT,
            deadline_tick: 100,
            currentTick: 1,
            store,
        });

        // Tick 50 — before deadline 100
        await engine.onTickClosed(50);

        expect(audit.query({ eventType: 'proposal.tallied' })).toHaveLength(0);
    });

    it('tallies a proposal exactly at its deadline_tick', async () => {
        const { audit, store, engine } = freshDeps();

        await appendProposalOpened(audit, {
            proposer_did: PROPOSER,
            body_text: BODY_TEXT,
            deadline_tick: 100,
            currentTick: 1,
            store,
        });

        await engine.onTickClosed(100);

        const tallied = audit.query({ eventType: 'proposal.tallied' });
        expect(tallied).toHaveLength(1);
    });

    it('tallies a proposal after its deadline_tick (late tally)', async () => {
        const { audit, store, engine } = freshDeps();

        await appendProposalOpened(audit, {
            proposer_did: PROPOSER,
            body_text: BODY_TEXT,
            deadline_tick: 100,
            currentTick: 1,
            store,
        });

        await engine.onTickClosed(150);

        expect(audit.query({ eventType: 'proposal.tallied' })).toHaveLength(1);
    });

    it('does NOT double-tally an already-tallied proposal', async () => {
        const { audit, store, engine } = freshDeps();

        await appendProposalOpened(audit, {
            proposer_did: PROPOSER,
            body_text: BODY_TEXT,
            deadline_tick: 100,
            currentTick: 1,
            store,
        });

        // First tally
        await engine.onTickClosed(100);
        expect(audit.query({ eventType: 'proposal.tallied' })).toHaveLength(1);

        // Second tick — proposal is now status='tallied', getOpenProposals excludes it
        await engine.onTickClosed(101);
        expect(audit.query({ eventType: 'proposal.tallied' })).toHaveLength(1);
    });

    it('only tallies expired proposals — leaves open ones untouched', async () => {
        const { audit, store, engine } = freshDeps();

        // Proposal A expires at tick 50
        await appendProposalOpened(audit, {
            proposer_did: PROPOSER,
            body_text: BODY_TEXT,
            deadline_tick: 50,
            currentTick: 1,
            store,
            _proposalIdOverride: 'prop-a',
        });

        // Proposal B expires at tick 200
        await appendProposalOpened(audit, {
            proposer_did: PROPOSER,
            body_text: BODY_TEXT,
            deadline_tick: 200,
            currentTick: 2,
            store,
            _proposalIdOverride: 'prop-b',
        });

        // At tick 100 — A is past deadline, B is still open
        await engine.onTickClosed(100);

        const tallied = audit.query({ eventType: 'proposal.tallied' });
        expect(tallied).toHaveLength(1);
        expect(tallied[0].payload.proposal_id).toBe('prop-a');
    });

    it('handles zero open proposals gracefully (no-op)', async () => {
        const { engine } = freshDeps();
        // Should not throw
        await expect(engine.onTickClosed(999)).resolves.toBeUndefined();
    });
});

// ── Phase 60 HOUSE-3 (D-60-08 / R-60-10) — ring-expansion template fires from the dispatch ──
//
// These tests prove the template is invoked from the GENUINE enactment site (onTickClosed →
// appendProposalTallied passed-branch via the late-wired ringDeps), NOT just in isolation: an
// actually-enacted seed_ring/amend_law bill drives seedZone / a Polis override end-to-end.

/**
 * A bill body that is BOTH a valid JSON Law (appendLawTriggered reads it) AND carries the
 * ring-expansion template fields (the template re-parses the same body_text). Extra fields are
 * harmless to both parsers.
 */
function billBody(extra: Record<string, unknown>): string {
    return JSON.stringify({
        id: 'law-ring-test',
        title: 'Ring Expansion Bill',
        description: 'Test',
        ruleLogic: { condition: { type: 'true' }, action: 'allow', sanction_on_violation: 'none' },
        severity: 'info',
        status: 'active',
        ...extra,
    });
}

/** Commit + reveal `yes` for the first N registered Nous so the proposal passes (quorum+SM). */
async function enactYes(
    store: ReturnType<typeof createInMemoryStore>,
    proposalId: string,
    count: number,
) {
    for (let i = 0; i < count; i++) {
        const voter = `did:noesis:eng-${i}`;
        await store.insertBallotCommit({
            proposal_id: proposalId,
            voter_did: voter,
            commit_hash: `hash-${i}`,
            committed_tick: 2,
        });
        await store.updateBallotReveal({
            proposal_id: proposalId,
            voter_did: voter,
            choice: 'yes',
            nonce: `nonce-${i}`,
            revealed_tick: 3,
        });
    }
}

describe('GovernanceEngine — ring-expansion template fires from the enactment dispatch', () => {
    it('an enacted {action:seed_ring} bill calls seedZone via onTickClosed (not in isolation)', async () => {
        const { audit, store, engine } = freshDeps();
        const seeded: number[] = [];
        engine.attachRingExpansion({
            seedZone: (ring) => { seeded.push(ring); },
            alreadySeeded: () => false,
        });

        await appendProposalOpened(audit, {
            proposer_did: PROPOSER,
            body_text: billBody({ action: 'seed_ring', ring: 4 }),
            deadline_tick: 100,
            currentTick: 1,
            store,
            _proposalIdOverride: 'prop-seed-ring',
        });
        // 4 of 5 Nous vote yes → quorum (>=3) + supermajority (>=67%) met → 'passed'.
        await enactYes(store, 'prop-seed-ring', 4);

        await engine.onTickClosed(100);

        const tallied = audit.query({ eventType: 'proposal.tallied' });
        expect(tallied).toHaveLength(1);
        expect(tallied[0].payload.outcome).toBe('passed');
        // The template fired FROM the dispatch — seedZone was driven by the enacted bill.
        expect(seeded).toEqual([4]);
    });

    it('an enacted {action:amend_law} bill records a Polis override picked up by getZoneTaxBps', async () => {
        _resetPolisOverrides();
        const { audit, store, engine } = freshDeps();
        // Wire the REAL founding-law read-through (recordPolisOverride) as amendConstant.
        engine.attachRingExpansion({
            amendConstant: (key, value) => { recordPolisOverride(key, value); },
        });

        // Default before enactment.
        expect(getZoneTaxBps('business')).toBe(ZONE_TAX_BPS.business);

        await appendProposalOpened(audit, {
            proposer_did: PROPOSER,
            body_text: billBody({ action: 'amend_law', key: 'ZONE_TAX_BPS.business', value: 1300 }),
            deadline_tick: 100,
            currentTick: 1,
            store,
            _proposalIdOverride: 'prop-amend-law',
        });
        await enactYes(store, 'prop-amend-law', 4);

        await engine.onTickClosed(100);

        expect(audit.query({ eventType: 'proposal.tallied' })[0].payload.outcome).toBe('passed');
        // The Polis override took effect through the read-through indirection.
        expect(getZoneTaxBps('business')).toBe(1300);
        _resetPolisOverrides();
    });

    it('a REJECTED bill never fires the template (only enacted laws reach the hook)', async () => {
        const { audit, store, engine } = freshDeps();
        const seeded: number[] = [];
        engine.attachRingExpansion({ seedZone: (ring) => { seeded.push(ring); } });

        await appendProposalOpened(audit, {
            proposer_did: PROPOSER,
            body_text: billBody({ action: 'seed_ring', ring: 4 }),
            deadline_tick: 100,
            currentTick: 1,
            store,
        });
        // No reveals → quorum fails → not 'passed' → template must NOT fire.
        await engine.onTickClosed(100);

        expect(audit.query({ eventType: 'proposal.tallied' })[0].payload.outcome).not.toBe('passed');
        expect(seeded).toEqual([]);
    });
});
