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
