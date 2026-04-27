/**
 * SOLE PRODUCER for `proposal.tallied` audit event. Per D-12-01 / VOTE-04:
 *   This is the ONLY file in grid/src/** that may call `audit.append('proposal.tallied', ...)`.
 *   The grep gate `grid/test/governance/governance-producer-boundary.test.ts` enforces this contract.
 *
 * Forbidden siblings: see governance-producer-boundary.test.ts for the full list.
 *
 * On outcome === 'passed':
 *   - Fetches body_text from store
 *   - Parses it as a Law object (JSON — D-12-10 "proposal body is a JSON-stringified Law")
 *   - Calls appendLawTriggered with enacted_by: 'collective'
 *
 * Wall-clock ban: no Date.now / Math.random in this file. Tick is provided by caller.
 *
 * Phase 12 Wave 2 — VOTE-04 / D-12-01 / D-12-03 / D-12-10 / T-09-15 / CONTEXT-12.
 */

import type { AuditChain } from '../audit/chain.js';
import type { LogosEngine } from '../logos/engine.js';
import type { Law } from '../logos/types.js';
import {
    PROPOSAL_TALLIED_KEYS,
    GOVERNANCE_FORBIDDEN_KEYS,
    type ProposalTalliedPayload,
} from './types.js';
import { computeTally } from './tally.js';
import { appendLawTriggered } from './appendLawTriggered.js';
import type { GovernanceStore } from './store.js';
import { GovernanceError } from './errors.js';
import type { NousRegistry } from '../registry/registry.js';

export interface AppendProposalTalliedInput {
    proposal_id: string;
    currentTick: number;
    store: GovernanceStore;
    registry: NousRegistry;
    logos: LogosEngine;
}

export async function appendProposalTallied(
    audit: AuditChain,
    input: AppendProposalTalliedInput,
): Promise<void> {
    // 1. Fetch proposal record (deadline_tick, quorum_pct, supermajority_pct, body_text)
    const proposal = await input.store.getProposal(input.proposal_id);
    if (!proposal) {
        throw new GovernanceError('proposal_not_found', 404);
    }

    // 2. Fetch revealed ballots
    const revealRows = await input.store.getRevealsForProposal(input.proposal_id);
    const reveals = revealRows.map(r => ({
        choice: r.choice as 'yes' | 'no' | 'abstain',
        voter_did: r.voter_did,
    }));

    // 3. Fetch all committed DIDs (revealed + unrevealed)
    const committedDids = await input.store.getCommittedDidsForProposal(input.proposal_id);
    const unrevealedCommittedCount = committedDids.length - reveals.length;

    // 4. Get totalNousCount from NousRegistry
    const totalNousCount = input.registry.count;

    // 5. Call computeTally (pure function)
    const tally = computeTally(
        reveals,
        unrevealedCommittedCount < 0 ? 0 : unrevealedCommittedCount,
        proposal.quorum_pct,
        proposal.supermajority_pct,
        totalNousCount,
    );

    // 6. Build closed 6-tuple payload
    const payload: ProposalTalliedPayload = {
        abstain_count: tally.abstain_count,
        no_count: tally.no_count,
        outcome: tally.outcome,
        proposal_id: input.proposal_id,
        quorum_met: tally.quorum_met,
        yes_count: tally.yes_count,
    };

    // 7. Closed-tuple shape check
    const actualKeys = Object.keys(payload).sort();
    const expectedKeys = [...PROPOSAL_TALLIED_KEYS].sort();
    if (actualKeys.length !== expectedKeys.length || !actualKeys.every((k, i) => k === expectedKeys[i])) {
        throw new Error(`proposal.tallied: payload keys ${JSON.stringify(actualKeys)} != ${JSON.stringify(expectedKeys)}`);
    }

    // 8. Forbidden-key check
    const forbiddenSet = new Set<string>(GOVERNANCE_FORBIDDEN_KEYS as readonly string[]);
    for (const k of actualKeys) {
        if (forbiddenSet.has(k)) {
            throw new Error(`proposal.tallied: forbidden key "${k}" in payload`);
        }
    }

    // 9. DB write: UPDATE proposal to tallied status
    await input.store.updateProposalTallied({
        proposal_id: input.proposal_id,
        outcome: tally.outcome,
        tallied_at_tick: input.currentTick,
    });

    // 10. Audit append (sole-producer line)
    audit.append('proposal.tallied', input.proposal_id, payload as unknown as Record<string, unknown>);

    // 11. On outcome === 'passed': parse body_text as Law and trigger law.triggered
    if (tally.outcome === 'passed') {
        let law: Law;
        try {
            law = JSON.parse(proposal.body_text) as Law;
        } catch {
            throw new Error(`proposal.tallied: body_text is not valid JSON Law for proposal ${input.proposal_id}`);
        }
        await appendLawTriggered(audit, {
            law,
            enacted_by: 'collective',
            currentTick: input.currentTick,
            logos: input.logos,
        });
    }
}
