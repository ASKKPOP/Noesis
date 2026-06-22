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

import { randomUUID } from 'node:crypto';
import type { AuditChain } from '../audit/chain.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
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
import { onLawEnacted as ringExpansionOnLawEnacted, type RingExpansionDeps } from '../civic/ring-expansion.js';
import type { ProcurementBridgeDeps } from './engine.js';
import { ProcurementStore } from '../economy/procurement-store.js';

export interface AppendProposalTalliedInput {
    proposal_id: string;
    currentTick: number;
    store: GovernanceStore;
    registry: NousRegistry;
    logos: LogosEngine;
    /**
     * Phase 60 HOUSE-3 (D-60-08 / R-60-10) — OPTIONAL ring-expansion template deps. When
     * present, an enacted bill's body is handed to the ring-expansion template at the EXISTING
     * `gov.law_enacted` dispatch (right after appendLawTriggered). The template fires ONLY on its
     * own body shapes ({action:'seed_ring',ring} → seedZone; {action:'amend_law',key,value} →
     * Polis override) and IGNORES everything else. Absent in callers that don't wire civic land
     * (e.g. pure-governance tests). NOT a new event / governance path / clock.onTick (R-31-01,
     * VOTE-05, single-onTick preserved); side-effect-only, no append.
     */
    ringDeps?: RingExpansionDeps;
    /**
     * Governance → RFP procurement bridge deps. OPTIONAL — absent in pure-governance contexts
     * (tests / replay without pool). When present and the enacted bill carries
     * `category:'procurement'`, calls ProcurementStore.issueNotice fire-and-forget.
     * Parse-fail or missing fields → log + skip (never throws out of the enactment path).
     * VOTE-05 / D-V3-21: issuance ONLY via enacted bill — no self-issue path.
     */
    procurementDeps?: ProcurementBridgeDeps;
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

    // 9. Privacy gate — belt-and-suspenders.
    const privacy = payloadPrivacyCheck(payload as unknown as Record<string, unknown>);
    if (!privacy.ok) {
        throw new Error(`proposal.tallied: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }

    // 10. DB write: UPDATE proposal to tallied status
    await input.store.updateProposalTallied({
        proposal_id: input.proposal_id,
        outcome: tally.outcome,
        tallied_at_tick: input.currentTick,
    });

    // 11. Audit append (sole-producer line)
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
        // Phase 60 HOUSE-3 (D-60-08 / R-60-10) — fire-and-forget the ring-expansion TEMPLATE at
        // the EXISTING gov.law_enacted dispatch. It rides the SAME enacted body verbatim and
        // fires only on its own shapes (seed_ring / amend_law); ordinary laws are untouched.
        // Side-effect-only (no append, no new event, no clock.onTick): R-31-01 + VOTE-05 hold.
        if (input.ringDeps) {
            ringExpansionOnLawEnacted(proposal.body_text, input.ringDeps);
        }
        // Governance → RFP procurement bridge. Fire-and-forget, mirrors ring-expansion pattern.
        // Fires ONLY when: procurementDeps are wired AND the enacted bill carries
        // `category:'procurement'` with a valid JSON body. Parse-fail → log + skip (non-fatal).
        // VOTE-05 / D-V3-21: Polis-only issuance — no self-issue path. Allowlist +0.
        if (input.procurementDeps) {
            void onProcurementBillEnacted(proposal.body_text, proposal.proposal_id, input.currentTick, proposal.grid_name, input.procurementDeps);
        }
    }
}

/**
 * Governance → RFP bridge: parse an enacted bill body and, if it is a valid `procurement`
 * bill, call ProcurementStore.issueNotice fire-and-forget. Any failure is logged and swallowed
 * so it can never throw out of the enactment path (mirrors ring-expansion fire-and-forget).
 *
 * @param bodyText    Raw body_text from the governance_proposals row.
 * @param proposalId  Used as the polisAuthorizationRef (the legislative act that authorised it).
 * @param currentTick Current tick at enactment — deadlineTick = currentTick + deadline_offset_ticks.
 * @param gridName    Grid the proposal belongs to.
 * @param deps        Pool + optional audit (late-wired by main.ts).
 */
async function onProcurementBillEnacted(
    bodyText: string,
    proposalId: string,
    currentTick: number,
    gridName: string,
    deps: ProcurementBridgeDeps,
): Promise<void> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(bodyText);
    } catch {
        // Not valid JSON — not a procurement bill, silently ignore.
        return;
    }
    if (!parsed || typeof parsed !== 'object') return;
    const body = parsed as Record<string, unknown>;

    // Gate: must carry category:'procurement'
    if (body['category'] !== 'procurement') return;

    // Validate required fields.
    const { title, spec, budget_wei, zone, function_type, deadline_offset_ticks } = body;
    if (
        typeof title !== 'string' || title.trim() === '' ||
        typeof spec !== 'string' ||
        typeof budget_wei !== 'string' || !/^\d+$/.test(budget_wei) ||
        typeof zone !== 'string' || zone.trim() === '' ||
        typeof function_type !== 'string' || function_type.trim() === '' ||
        typeof deadline_offset_ticks !== 'number' || !Number.isInteger(deadline_offset_ticks) || deadline_offset_ticks < 0
    ) {
        console.warn(
            `[procurement-bridge] enacted bill ${proposalId} has category:procurement but invalid fields — skipping issuance`,
            { title, spec, budget_wei, zone, function_type, deadline_offset_ticks },
        );
        return;
    }

    try {
        const store = new ProcurementStore(deps.pool, deps.audit);
        await store.issueNotice({
            gridName,
            noticeId: randomUUID(),
            polisAuthorizationRef: proposalId,
            title: title.trim(),
            spec,
            budgetWei: BigInt(budget_wei),
            zone: zone.trim(),
            functionType: function_type.trim(),
            deadlineTick: currentTick + deadline_offset_ticks,
            currentTick,
        });
    } catch (err) {
        // Fire-and-forget: failure is non-fatal (log + skip). Never throws out of enactment.
        console.error(
            `[procurement-bridge] issueNotice failed for bill ${proposalId} — skipping`,
            err,
        );
    }
}
