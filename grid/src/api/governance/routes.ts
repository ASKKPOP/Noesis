/**
 * Governance Fastify plugin — five tier-gated routes for the commit-reveal
 * governance lifecycle.
 *
 * Routes:
 *   POST /api/v1/governance/proposals             — open a proposal (Nous only)
 *   POST /api/v1/governance/proposals/:id/ballots/commit  — commit blind ballot
 *   POST /api/v1/governance/proposals/:id/ballots/reveal  — reveal nonce + choice
 *   GET  /api/v1/governance/proposals             — list proposals (H1+, aggregate only)
 *   GET  /api/v1/governance/proposals/:id/body    — full body text (H2+)
 *   GET  /api/v1/governance/proposals/:id/ballots/history — ballot list (H5 only)
 *
 * Privacy invariants (T-09-12 / D-12-04):
 *   - body_text NEVER appears in audit payload — only in MySQL + H2+ HTTP body.
 *   - ballot choices only appear in H5 history endpoint.
 *   - voter DIDs only appear in H5 history endpoint.
 *   - GET /proposals list is aggregate-only: no body_text, no voter_did breakdown.
 *
 * Sole-producer contract (D-12-08 / VOTE-05):
 *   This file MUST NOT call audit.append('proposal.opened' | 'ballot.committed' |
 *   'ballot.revealed') directly. All governance events are emitted exclusively via
 *   the sole-producer functions from grid/src/governance/.
 *   CI gate `check-governance-isolation.mjs` (Wave 4) enforces this.
 *   NO operator.* audit emit in this file. NO import from operator-events.ts.
 *
 * Wall-clock ban: no Date.now, no Math.random (tick comes from request body).
 *
 * Phase 12 Wave 3 — VOTE-01..05 / D-12-04 / D-12-05 / D-12-06 / D-12-09 / T-09-12.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuditChain } from '../../audit/chain.js';
import type { GovernanceStore } from '../../governance/store.js';
import type { LogosEngine } from '../../logos/engine.js';
import { appendProposalOpened } from '../../governance/appendProposalOpened.js';
import { appendBallotCommitted } from '../../governance/appendBallotCommitted.js';
import { appendBallotRevealed } from '../../governance/appendBallotRevealed.js';
import { GovernanceError } from '../../governance/errors.js';
import {
    DID_REGEX,
    COMMIT_HASH_RE,
    NONCE_RE,
    validateProposerDid,
    validateVoterDid,
    validateTierAtLeast,
    validatePctRange,
    type GovernanceRegistry,
} from './_validation.js';

const MAX_BODY_TEXT_BYTES = 32 * 1024; // 32 KiB
const VALID_CHOICES = new Set(['yes', 'no', 'abstain']);

export interface GovernanceRouteDeps {
    readonly audit: AuditChain;
    readonly store: GovernanceStore;
    readonly registry: GovernanceRegistry;
    readonly logos: LogosEngine | { addLaw(): void; activeLaws(): unknown[] };
}

/**
 * Register all five governance routes on the Fastify instance.
 * Called from index.ts and from server.ts via the plugin pattern.
 */
export async function registerGovernanceRoutes(
    fastify: FastifyInstance,
    deps: GovernanceRouteDeps,
): Promise<void> {
    const { audit, store, registry } = deps;

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/governance/proposals — open a proposal
    // ─────────────────────────────────────────────────────────────────────────
    fastify.post<{
        Body: {
            proposer_did?: unknown;
            body_text?: unknown;
            quorum_pct?: unknown;
            supermajority_pct?: unknown;
            deadline_tick?: unknown;
            opened_at_tick?: unknown;
        };
    }>(
        '/api/v1/governance/proposals',
        async (
            req: FastifyRequest<{
                Body: {
                    proposer_did?: unknown;
                    body_text?: unknown;
                    quorum_pct?: unknown;
                    supermajority_pct?: unknown;
                    deadline_tick?: unknown;
                    opened_at_tick?: unknown;
                };
            }>,
            reply: FastifyReply,
        ) => {
            const body = (req.body ?? {}) as Record<string, unknown>;

            // 1. Validate DID shape + registry + tombstone
            const proposerDid = body['proposer_did'];
            if (typeof proposerDid !== 'string') {
                reply.code(400);
                return { error: 'invalid_did' };
            }
            const didResult = validateProposerDid(proposerDid, registry);
            if (!didResult.ok) {
                reply.code(didResult.status);
                return { error: didResult.error };
            }

            // 2. Validate body_text
            const bodyText = body['body_text'];
            if (typeof bodyText !== 'string' || bodyText.length === 0) {
                reply.code(400);
                return { error: 'body_text_required' };
            }
            if (Buffer.byteLength(bodyText, 'utf8') > MAX_BODY_TEXT_BYTES) {
                reply.code(400);
                return { error: 'body_text_too_large' };
            }

            // 3. Validate deadline_tick and opened_at_tick
            const deadlineTick = body['deadline_tick'];
            const openedAtTick = body['opened_at_tick'];
            if (typeof deadlineTick !== 'number' || !Number.isInteger(deadlineTick) || deadlineTick <= 0) {
                reply.code(400);
                return { error: 'invalid_deadline_tick' };
            }
            if (typeof openedAtTick !== 'number' || !Number.isInteger(openedAtTick) || openedAtTick < 0) {
                reply.code(400);
                return { error: 'invalid_opened_at_tick' };
            }
            if (deadlineTick <= openedAtTick) {
                reply.code(400);
                return { error: 'deadline_before_open' };
            }

            // 4. Validate optional quorum/supermajority
            let quorumPct: number | undefined;
            let supermajorityPct: number | undefined;
            if (body['quorum_pct'] !== undefined) {
                const pctResult = validatePctRange(body['quorum_pct'], 'quorum_pct');
                if (!pctResult.ok) {
                    reply.code(400);
                    return { error: pctResult.error };
                }
                quorumPct = body['quorum_pct'] as number;
            }
            if (body['supermajority_pct'] !== undefined) {
                const pctResult = validatePctRange(body['supermajority_pct'], 'supermajority_pct');
                if (!pctResult.ok) {
                    reply.code(400);
                    return { error: pctResult.error };
                }
                supermajorityPct = body['supermajority_pct'] as number;
            }

            // 5. Call sole-producer (this is the ONLY caller of appendProposalOpened in this file)
            try {
                const result = await appendProposalOpened(audit, {
                    proposer_did: proposerDid,
                    body_text: bodyText,
                    quorum_pct: quorumPct,
                    supermajority_pct: supermajorityPct,
                    deadline_tick: deadlineTick,
                    currentTick: openedAtTick,
                    store,
                });
                reply.code(201);
                return {
                    proposal_id: result.proposal_id,
                    title_hash: result.title_hash,
                    deadline_tick: deadlineTick,
                };
            } catch (err) {
                if (err instanceof GovernanceError) {
                    reply.code(err.httpStatus);
                    return { error: err.code };
                }
                throw err;
            }
        },
    );

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/governance/proposals/:id/ballots/commit
    // ─────────────────────────────────────────────────────────────────────────
    fastify.post<{
        Params: { id: string };
        Body: {
            voter_did?: unknown;
            commit_hash?: unknown;
            committed_at_tick?: unknown;
        };
    }>(
        '/api/v1/governance/proposals/:id/ballots/commit',
        async (req, reply) => {
            const proposalId = req.params.id;
            const body = (req.body ?? {}) as Record<string, unknown>;

            // 1. Validate voter DID
            const voterDid = body['voter_did'];
            if (typeof voterDid !== 'string') {
                reply.code(400);
                return { error: 'invalid_did' };
            }
            if (!DID_REGEX.test(voterDid)) {
                reply.code(400);
                return { error: 'invalid_did' };
            }
            // Tombstone check (registry membership check is optional for voters — they may be any active Nous)
            if (registry.isTombstoned(voterDid)) {
                reply.code(410);
                return { error: 'tombstoned' };
            }

            // 2. Validate commit_hash (64 hex chars)
            const commitHash = body['commit_hash'];
            if (typeof commitHash !== 'string' || !COMMIT_HASH_RE.test(commitHash)) {
                reply.code(400);
                return { error: 'invalid_commit_hash' };
            }

            // 3. Validate committed_at_tick
            const committedAtTick = body['committed_at_tick'];
            if (typeof committedAtTick !== 'number' || !Number.isInteger(committedAtTick)) {
                reply.code(400);
                return { error: 'invalid_committed_at_tick' };
            }

            // 4. Check proposal exists
            const proposal = await store.getProposal(proposalId);
            if (!proposal) {
                reply.code(404);
                return { error: 'proposal_not_found' };
            }

            // 5. Check deadline not passed
            if (committedAtTick > proposal.deadline_tick) {
                reply.code(422);
                return { error: 'deadline_passed' };
            }

            // 6. Call sole-producer
            try {
                await appendBallotCommitted(audit, {
                    proposal_id: proposalId,
                    voter_did: voterDid,
                    commit_hash: commitHash,
                    currentTick: committedAtTick,
                    store,
                });
                reply.code(201);
                return { proposal_id: proposalId, voter_did: voterDid };
            } catch (err) {
                if (err instanceof GovernanceError) {
                    if (err.httpStatus === 409) {
                        reply.code(409);
                        return { error: 'duplicate_ballot' };
                    }
                    reply.code(err.httpStatus);
                    return { error: err.code };
                }
                throw err;
            }
        },
    );

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/governance/proposals/:id/ballots/reveal
    // ─────────────────────────────────────────────────────────────────────────
    fastify.post<{
        Params: { id: string };
        Body: {
            voter_did?: unknown;
            choice?: unknown;
            nonce?: unknown;
            revealed_at_tick?: unknown;
        };
    }>(
        '/api/v1/governance/proposals/:id/ballots/reveal',
        async (req, reply) => {
            const proposalId = req.params.id;
            const body = (req.body ?? {}) as Record<string, unknown>;

            // 1. Validate voter DID
            const voterDid = body['voter_did'];
            if (typeof voterDid !== 'string' || !DID_REGEX.test(voterDid)) {
                reply.code(400);
                return { error: 'invalid_did' };
            }
            if (registry.isTombstoned(voterDid)) {
                reply.code(410);
                return { error: 'tombstoned' };
            }

            // 2. Validate choice
            const choice = body['choice'];
            if (typeof choice !== 'string' || !VALID_CHOICES.has(choice)) {
                reply.code(400);
                return { error: 'invalid_choice' };
            }

            // 3. Validate nonce (32 lowercase hex chars)
            const nonce = body['nonce'];
            if (typeof nonce !== 'string' || !NONCE_RE.test(nonce)) {
                reply.code(400);
                return { error: 'invalid_nonce' };
            }

            // 4. Validate revealed_at_tick
            const revealedAtTick = body['revealed_at_tick'];
            if (typeof revealedAtTick !== 'number' || !Number.isInteger(revealedAtTick)) {
                reply.code(400);
                return { error: 'invalid_revealed_at_tick' };
            }

            // 5. Call sole-producer — catches HashMismatchError → 422
            try {
                await appendBallotRevealed(audit, {
                    proposal_id: proposalId,
                    voter_did: voterDid,
                    choice: choice as 'yes' | 'no' | 'abstain',
                    nonce,
                    currentTick: revealedAtTick,
                    store,
                });
                reply.code(201);
                return { proposal_id: proposalId, voter_did: voterDid, choice };
            } catch (err) {
                if (err instanceof GovernanceError) {
                    if (err.httpStatus === 422) {
                        // D-12-02: log ballot_reveal_mismatch to server log; return 422; NO audit emit
                        req.log.warn(
                            { proposal_id: proposalId },
                            'ballot_reveal_mismatch',
                        );
                        reply.code(422);
                        return { error: 'reveal_hash_mismatch' };
                    }
                    reply.code(err.httpStatus);
                    return { error: err.code };
                }
                throw err;
            }
        },
    );

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/governance/proposals — list proposals (H1+, aggregate only)
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get('/api/v1/governance/proposals', async (_req, reply) => {
        const openProposals = await store.getOpenProposals();

        const proposals = await Promise.all(
            openProposals.map(async (p) => {
                const allBallots = await store.getCommittedDidsForProposal(p.proposal_id);
                const reveals = await store.getRevealsForProposal(p.proposal_id);
                return {
                    proposal_id: p.proposal_id,
                    status: p.status,
                    opened_at_tick: p.opened_at_tick,
                    deadline_tick: p.deadline_tick,
                    commit_count: allBallots.length,
                    reveal_count: reveals.length,
                    outcome: p.outcome ?? null,
                };
                // NOTE: body_text intentionally EXCLUDED from response (T-09-12)
            }),
        );

        reply.code(200);
        return { proposals };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/governance/proposals/:id/body — full body text (H2+)
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get<{ Params: { id: string } }>(
        '/api/v1/governance/proposals/:id/body',
        async (req, reply) => {
            const tierResult = validateTierAtLeast(req, 2);
            if (!tierResult.ok) {
                reply.code(tierResult.status);
                return { error: tierResult.error };
            }

            const proposal = await store.getProposal(req.params.id);
            if (!proposal) {
                reply.code(404);
                return { error: 'proposal_not_found' };
            }

            reply.code(200);
            return {
                proposal_id: proposal.proposal_id,
                body_text: proposal.body_text,
                title_hash: proposal.title_hash,
                proposer_did: proposal.proposer_did,
                quorum_pct: proposal.quorum_pct,
                supermajority_pct: proposal.supermajority_pct,
                deadline_tick: proposal.deadline_tick,
            };
        },
    );

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/governance/proposals/:id/ballots/history — H5 only
    // ─────────────────────────────────────────────────────────────────────────
    fastify.get<{ Params: { id: string } }>(
        '/api/v1/governance/proposals/:id/ballots/history',
        async (req, reply) => {
            const tierResult = validateTierAtLeast(req, 5);
            if (!tierResult.ok) {
                reply.code(tierResult.status);
                return { error: tierResult.error };
            }

            const proposal = await store.getProposal(req.params.id);
            if (!proposal) {
                reply.code(404);
                return { error: 'proposal_not_found' };
            }

            // Get all committed ballot DIDs and all revealed ballots
            const committedDids = await store.getCommittedDidsForProposal(req.params.id);
            const reveals = await store.getRevealsForProposal(req.params.id);
            const revealMap = new Map(reveals.map(r => [r.voter_did, r]));

            // For each committed DID, project to history shape
            // committed-but-not-revealed: choice=null, revealed_at_tick=null
            const allBallots = await Promise.all(
                committedDids.map(async (voter_did) => {
                    const revealed = revealMap.get(voter_did);
                    // Get committed_tick from store
                    const ballotRow = await store.getBallot(req.params.id, voter_did);
                    return {
                        voter_did,
                        committed_at_tick: ballotRow?.committed_tick ?? null,
                        revealed_at_tick: revealed?.revealed_tick ?? null,
                        choice: revealed?.choice ?? null,
                    };
                }),
            );

            reply.code(200);
            return { ballots: allBallots };
        },
    );
}
