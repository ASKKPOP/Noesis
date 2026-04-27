/**
 * SOLE PRODUCER for `proposal.opened` audit event. Per D-12-01 / VOTE-01:
 *   This is the ONLY file in grid/src/** that may call `audit.append('proposal.opened', ...)`.
 *   The grep gate `grid/test/governance/governance-producer-boundary.test.ts` enforces this contract.
 *
 * Forbidden siblings: see governance-producer-boundary.test.ts for the full list.
 *
 * Privacy: body text NEVER appears in the audit payload. Only `title_hash = sha256(body)[:32]`.
 *   Forbidden keys (rejected with throw): text, body, content, description, rationale,
 *   proposal_text, law_text, body_text, weight, reputation, relationship_score, ousia_weight.
 *
 * Wall-clock ban: no Date.now / Math.random in this file. Tick is provided by caller.
 *
 * Tier: this emitter does NOT enforce tier gates — that is the API route's responsibility.
 *   Operators are forbidden from CALLING this function via grep gate `check-governance-isolation.mjs`.
 *
 * Phase 12 Wave 2 — VOTE-01 / D-12-01 / D-12-04 / T-09-12 / CONTEXT-12.
 */

import { createHash, randomUUID } from 'node:crypto';
import type { AuditChain } from '../audit/chain.js';
import {
    PROPOSAL_OPENED_KEYS,
    GOVERNANCE_FORBIDDEN_KEYS,
    type ProposalOpenedPayload,
} from './types.js';
import { GOVERNANCE_CONFIG } from './config.js';
import type { GovernanceStore } from './store.js';

const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

export interface AppendProposalOpenedInput {
    proposer_did: string;
    body_text: string;            // stored in MySQL, NEVER in audit payload
    quorum_pct?: number;          // default 50
    supermajority_pct?: number;   // default 67
    deadline_tick: number;
    currentTick: number;          // for opened_at_tick column
    store: GovernanceStore;
    /** Override for deterministic replay/tests — omit to auto-generate via randomUUID. */
    _proposalIdOverride?: string;
}

export interface AppendProposalOpenedResult {
    proposal_id: string;
    title_hash: string;
}

export async function appendProposalOpened(
    audit: AuditChain,
    input: AppendProposalOpenedInput,
): Promise<AppendProposalOpenedResult> {
    // 1. Validate inputs (DID, tick non-negative, body non-empty)
    if (!DID_RE.test(input.proposer_did)) {
        throw new Error('proposal.opened: proposer_did fails DID_RE');
    }
    if (!Number.isInteger(input.deadline_tick) || input.deadline_tick <= input.currentTick) {
        throw new Error('proposal.opened: deadline_tick must be a future integer tick');
    }
    if (typeof input.body_text !== 'string' || input.body_text.length === 0) {
        throw new Error('proposal.opened: body_text must be non-empty string');
    }

    // 2. Compute title_hash (sha256 truncated to 32 chars)
    const title_hash = createHash('sha256').update(input.body_text).digest('hex').slice(0, 32);

    // 3. Generate proposal_id (UUID v4 from node:crypto, or override for replay)
    const proposal_id = input._proposalIdOverride ?? randomUUID();

    // 4. Build closed payload — NOTE: body_text is NOT in this payload
    const quorum_pct = input.quorum_pct ?? GOVERNANCE_CONFIG.quorumPctDefault;
    const supermajority_pct = input.supermajority_pct ?? GOVERNANCE_CONFIG.supermajorityPctDefault;
    if (!Number.isInteger(quorum_pct) || quorum_pct < 1 || quorum_pct > 100) {
        throw new Error('proposal.opened: quorum_pct must be 1..100');
    }
    if (!Number.isInteger(supermajority_pct) || supermajority_pct < 1 || supermajority_pct > 100) {
        throw new Error('proposal.opened: supermajority_pct must be 1..100');
    }
    const payload: ProposalOpenedPayload = {
        deadline_tick: input.deadline_tick,
        proposal_id,
        proposer_did: input.proposer_did,
        quorum_pct,
        supermajority_pct,
        title_hash,
    };

    // 5. Closed-tuple shape check
    const actualKeys = Object.keys(payload).sort();
    const expectedKeys = [...PROPOSAL_OPENED_KEYS].sort();
    if (actualKeys.length !== expectedKeys.length || !actualKeys.every((k, i) => k === expectedKeys[i])) {
        throw new Error(`proposal.opened: payload keys ${JSON.stringify(actualKeys)} != ${JSON.stringify(expectedKeys)}`);
    }

    // 6. Forbidden-key check
    const forbiddenSet = new Set<string>(GOVERNANCE_FORBIDDEN_KEYS as readonly string[]);
    for (const k of actualKeys) {
        if (forbiddenSet.has(k)) {
            throw new Error(`proposal.opened: forbidden key "${k}" in payload`);
        }
    }

    // 7. DB write FIRST (so failed audit append leaves no orphan)
    await input.store.insertProposal({
        proposal_id,
        proposer_did: input.proposer_did,
        title_hash,
        body_text: input.body_text,
        quorum_pct,
        supermajority_pct,
        deadline_tick: input.deadline_tick,
        opened_at_tick: input.currentTick,
    });

    // 8. Audit append (sole-producer line — grep gate scans for this exact pattern)
    audit.append('proposal.opened', input.proposer_did, payload as unknown as Record<string, unknown>);

    return { proposal_id, title_hash };
}
