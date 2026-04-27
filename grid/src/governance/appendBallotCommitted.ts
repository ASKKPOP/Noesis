/**
 * SOLE PRODUCER for `ballot.committed` audit event. Per D-12-01 / VOTE-02:
 *   This is the ONLY file in grid/src/** that may call `audit.append('ballot.committed', ...)`.
 *   The grep gate `grid/test/governance/governance-producer-boundary.test.ts` enforces this contract.
 *
 * Forbidden siblings: see governance-producer-boundary.test.ts for the full list.
 *
 * One-Nous-one-vote enforcement (D-12-06):
 *   Duplicate (proposal_id, voter_did) rejected BEFORE any DB write or audit.append.
 *
 * Wall-clock ban: no Date.now / Math.random in this file. Tick is provided by caller.
 *
 * Phase 12 Wave 2 — VOTE-02 / D-12-01 / D-12-06 / T-09-14 / CONTEXT-12.
 */

import type { AuditChain } from '../audit/chain.js';
import {
    BALLOT_COMMITTED_KEYS,
    GOVERNANCE_FORBIDDEN_KEYS,
    type BallotCommittedPayload,
} from './types.js';
import { GovernanceError } from './errors.js';
import type { GovernanceStore } from './store.js';

const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;

export interface AppendBallotCommittedInput {
    proposal_id: string;
    voter_did: string;
    commit_hash: string;          // sha256 hex (64 chars) of choice|nonce|voter_did
    currentTick: number;
    store: GovernanceStore;
}

export async function appendBallotCommitted(
    audit: AuditChain,
    input: AppendBallotCommittedInput,
): Promise<void> {
    // 1. Validate voter_did via DID_RE
    if (!DID_RE.test(input.voter_did)) {
        throw new Error('ballot.committed: voter_did fails DID_RE');
    }

    // 2. Validate commit_hash is 64-char hex
    if (typeof input.commit_hash !== 'string' || !/^[0-9a-f]{64}$/i.test(input.commit_hash)) {
        throw new Error('ballot.committed: commit_hash must be 64-char hex string');
    }

    // 3. Validate proposal_id non-empty
    if (typeof input.proposal_id !== 'string' || input.proposal_id.length === 0) {
        throw new Error('ballot.committed: proposal_id must be non-empty string');
    }

    // 4. One-Nous-one-vote: pre-emit duplicate guard (D-12-06)
    if (await input.store.ballotExists(input.proposal_id, input.voter_did)) {
        throw new GovernanceError('duplicate_ballot', 409);
    }

    // 5. Build closed payload
    const payload: BallotCommittedPayload = {
        commit_hash: input.commit_hash,
        proposal_id: input.proposal_id,
        voter_did: input.voter_did,
    };

    // 6. Closed-tuple shape check
    const actualKeys = Object.keys(payload).sort();
    const expectedKeys = [...BALLOT_COMMITTED_KEYS].sort();
    if (actualKeys.length !== expectedKeys.length || !actualKeys.every((k, i) => k === expectedKeys[i])) {
        throw new Error(`ballot.committed: payload keys ${JSON.stringify(actualKeys)} != ${JSON.stringify(expectedKeys)}`);
    }

    // 7. Forbidden-key check
    const forbiddenSet = new Set<string>(GOVERNANCE_FORBIDDEN_KEYS as readonly string[]);
    for (const k of actualKeys) {
        if (forbiddenSet.has(k)) {
            throw new Error(`ballot.committed: forbidden key "${k}" in payload`);
        }
    }

    // 8. DB write FIRST
    await input.store.insertBallotCommit({
        proposal_id: input.proposal_id,
        voter_did: input.voter_did,
        commit_hash: input.commit_hash,
        committed_tick: input.currentTick,
    });

    // 9. Audit append (sole-producer line)
    audit.append('ballot.committed', input.voter_did, payload as unknown as Record<string, unknown>);
}
