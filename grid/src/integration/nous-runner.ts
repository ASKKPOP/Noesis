/**
 * NousRunner — connects a single Nous's brain to the Grid.
 *
 * Bridges the WorldClock (ticks) and grid state (spatial, audit, registry)
 * to a Python brain via JSON-RPC over Unix socket.
 *
 * Lifecycle:
 *   1. On tick → sendTick to brain → handle actions
 *   2. On incoming message → forward to brain → handle actions
 *   3. Actions: speak (emit), move (spatial), noop (nothing)
 */

import type { SpatialMap } from '../space/map.js';
import type { AuditChain } from '../audit/chain.js';
import type { NousRegistry } from '../registry/registry.js';
import type { EconomyManager } from '../economy/config.js';
import type { BrainAction, IBrainBridge, MemoryEntry, TickParams } from './types.js';
import { RingBuffer } from '../util/ring-buffer.js';
import type { DialogueContext } from '../dialogue/index.js';
import { Reviewer } from '../review/index.js';
import { VALID_REVIEW_FAILURE_CODES } from '../review/types.js';
import { appendTelosRefined } from '../audit/append-telos-refined.js';
import { appendAnankeDriveCrossed } from '../ananke/index.js';
import type { WhisperRouter } from '../whisper/router.js';
import { appendProposalOpened } from '../governance/appendProposalOpened.js';
import { appendBallotCommitted } from '../governance/appendBallotCommitted.js';
import { appendBallotRevealed } from '../governance/appendBallotRevealed.js';
import { GovernanceError } from '../governance/errors.js';
import type { GovernanceStore } from '../governance/store.js';
import type { BallotChoice } from '../governance/types.js';
import {
    appendIrisBeliefRevised,
    appendIrisContextInvoked,
    appendIrisContradictionDetected,
    appendIrisPriorSeeded,
} from '../iris/index.js';
import {
    appendSkillTaught,
    appendSkillInferred,
    appendSkillRejected,
} from '../skills/index.js';
import { appendLoreContributed } from '../lore/appendLoreContributed.js';
import { appendLoreCited } from '../lore/appendLoreCited.js';
import { LoreQuotaTracker } from '../lore/LoreQuotaTracker.js';

export interface NousRunnerConfig {
    nousDid: string;
    nousName: string;
    bridge: IBrainBridge;
    space: SpatialMap;
    audit: AuditChain;
    registry: NousRegistry;
    economy: EconomyManager;
    /**
     * Phase 5 (D-02): synchronous pre-commit reviewer, singleton-per-Grid.
     *
     * Production callers (main.ts / launcher) MUST pass a Reviewer instance —
     * omission would bypass the REV-02 gate and is a policy bug. This field is
     * typed optional ONLY to support the D-13 zero-diff regression test
     * (`grid/test/review/zero-diff.test.ts`, Phase 5 Plan 05-04), which runs
     * the SAME scripted trade sequence twice — once with reviewer enabled,
     * once with reviewer bypassed — and proves reviewer-bypass affects NOTHING
     * beyond the absence of `trade.reviewed` entries. Without this opt-out the
     * invariant cannot be asserted without duplicating NousRunner internals.
     *
     * If `reviewer` is undefined at runtime, the trade_request handler skips
     * BOTH the `reviewer.review()` call AND the `trade.reviewed` emit, but
     * leaves the `trade.proposed` and `trade.settled` emit sites untouched.
     */
    reviewer?: Reviewer;
    /**
     * Phase 11 (WHISPER-03 / D-11-05): shared WhisperRouter instance.
     *
     * Constructed at Grid bootstrap with injected {audit, registry,
     * rateLimiter, pendingStore} and shared with routes.ts (Wave 3).
     * Optional here — if absent the whisper_send action is silently
     * skipped (mirrors reviewer optional pattern for test isolation).
     */
    whisperRouter?: WhisperRouter;
    /**
     * Phase 12 Wave 3 — D-12-07 / VOTE-05: governance sole-producer dependencies.
     *
     * Optional — if absent the propose/vote_commit/vote_reveal actions are
     * silently dropped with a console.warn (mirrors whisperRouter pattern).
     * Production wiring passes { audit, store } from GenesisLauncher so Nous
     * can drive the governance lifecycle in-process without an HTTP hop.
     *
     * NOTE: `audit` here is the same AuditChain instance as NousRunnerConfig.audit.
     * It is kept explicit in the sub-interface to preserve the sole-producer
     * contract: the emitters require audit as a parameter and this runner
     * passes it directly, matching the test-harness pattern in governance tests.
     */
    governanceDeps?: {
        audit: AuditChain;
        store: GovernanceStore;
    };
    /**
     * Phase 20 LORE-03: lore contribution quota tracker.
     * Optional — if absent the lore_contribute quota check is skipped (mirrors governanceDeps pattern).
     * Production wiring passes { quotaTracker } from GenesisLauncher to enforce K=3 per epoch.
     */
    loreDeps?: {
        quotaTracker: LoreQuotaTracker;
    };
    /**
     * Phase 25b SANCTION-04 / D-25b-NEW-3: force-sleep trigger.
     *
     * Invoked by POST /api/v1/operator/nous/:did/force-sleep AFTER emitting operator.forced_sleep.
     * Production wiring invokes the Hypnos sleep entry path (Brain sends nous.sleep.entered after
     * receiving the sleep signal). When absent, force-sleep route still emits operator.forced_sleep
     * but no sleep machinery is triggered (tests inject a mock that emits nous.sleep.entered directly).
     *
     * The audit ordering invariant (D-25b-NEW-3): operator.forced_sleep precedes nous.sleep.entered.
     * This is guaranteed because the route emits operator.forced_sleep synchronously before calling
     * this trigger.
     */
    sleepTrigger?: () => void | Promise<void>;
}

export type SpeakHandler = (runner: NousRunner, channel: string, text: string, tick: number) => void;

export class NousRunner {
    readonly nousDid: string;
    readonly nousName: string;

    private readonly bridge: IBrainBridge;
    private readonly space: SpatialMap;
    private readonly audit: AuditChain;
    private readonly registry: NousRegistry;
    private readonly economy: EconomyManager;
    private readonly reviewer: Reviewer | undefined;
    private readonly whisperRouter: WhisperRouter | undefined;
    private readonly governanceDeps: { audit: AuditChain; store: GovernanceStore } | undefined;
    private readonly loreDeps: { quotaTracker: LoreQuotaTracker } | undefined;
    private readonly sleepTrigger: (() => void | Promise<void>) | undefined;

    private speakHandler: SpeakHandler | null = null;

    /**
     * Phase 25b SANCTION-01 / D-25b-NEW-3: mute flag set by the operator mute-broadcast route.
     *
     * When true, all broadcast-emitting actions (speak, direct_message, whisper_send, skill_taught)
     * are suppressed at this runner's emit boundary. The Nous continues to think and tick —
     * only the audit emissions are withheld. The Nous "shouts into the void".
     *
     * Set via `runner.muteFlag = true` by the POST /api/v1/operator/nous/:did/mute route.
     *
     * WR-04 NOTE — IN-MEMORY ONLY: this flag is NOT persisted. On any Grid restart all mute
     * sanctions are silently lost. The operator audit trail records the original sanction event
     * but there is no startup replay. Operators must re-apply mute after any restart.
     * A future phase should add a sanctions table and replay it on startup.
     */
    muteFlag: boolean = false;

    /**
     * Phase 25a OBS-BRAIN-HEALTH: per-instance tick-latency ring buffer (capacity 100).
     * Records the wall-clock duration of each bridge.sendTick() call in milliseconds.
     * Non-persistent: reset on runner restart. Used by getTickMetrics().
     */
    private readonly tickLatencyBuffer = new RingBuffer<number>(100);

    /**
     * Phase 7 DIALOG-01 (D-16 authority-check seam): tracks dialogue_ids
     * recently delivered to THIS Nous. Populated by tick() when
     * dialogue_context is present; consumed by Plan 03's `case 'telos_refined'`
     * branch to reject forged dialogue_ids. Rolling insertion-ordered cap.
     */
    private readonly recentDialogueIds: Set<string> = new Set();
    private static readonly RECENT_DIALOGUE_CAP = 100;

    constructor(config: NousRunnerConfig) {
        this.nousDid = config.nousDid;
        this.nousName = config.nousName;
        this.bridge = config.bridge;
        this.space = config.space;
        this.audit = config.audit;
        this.registry = config.registry;
        this.economy = config.economy;
        this.reviewer = config.reviewer;
        this.whisperRouter = config.whisperRouter;
        this.governanceDeps = config.governanceDeps;
        this.loreDeps = config.loreDeps;
        this.sleepTrigger = config.sleepTrigger;
    }

    /** Register handler called when this Nous speaks (for message routing). */
    onSpeak(handler: SpeakHandler): void {
        this.speakHandler = handler;
    }

    /**
     * Deliver a world clock tick to the brain.
     *
     * Phase 7 DIALOG-01: `dialogueContext` is additive. When present, the
     * runner records the dialogue_id in its rolling `recentDialogueIds` set
     * (authority-check seam for Plan 03) and plumbs the context through
     * TickParams.dialogue_context on the RPC to Brain. Existing callers that
     * pass only `(tick, epoch)` continue to work unchanged (D-10).
     */
    async tick(tick: number, epoch: number, dialogueContext?: DialogueContext): Promise<void> {
        if (!this.bridge.connected) return;

        // SC#3 tick-skip guard (Phase 8 AGENCY-05): if this Nous has been
        // tombstoned (status='deleted'), skip the tick entirely. The coordinator
        // removes the runner via despawnNous(), but a tick may have already been
        // dispatched concurrently. Early-return prevents post-tombstone Brain RPCs.
        const record = this.registry.get(this.nousDid);
        if (record?.status === 'deleted') return;

        if (dialogueContext) {
            this.recordDialogueDelivery(dialogueContext.dialogue_id);
        }

        const params: TickParams = dialogueContext
            ? { tick, epoch, dialogue_context: dialogueContext }
            : { tick, epoch };

        // Phase 25a OBS-BRAIN-HEALTH: measure tick RPC latency for getTickMetrics().
        const t0 = performance.now();
        let actions: BrainAction[];
        try {
            actions = await this.bridge.sendTick(params);
        } finally {
            this.tickLatencyBuffer.push(performance.now() - t0);
        }
        this.registry.touch(this.nousDid, tick);
        await this.executeActions(actions!, tick);
    }

    /**
     * Rolling insertion-ordered set. On overflow, evict the oldest inserted
     * dialogue_id (JS Set preserves insertion order).
     */
    private recordDialogueDelivery(id: string): void {
        if (this.recentDialogueIds.size >= NousRunner.RECENT_DIALOGUE_CAP) {
            const oldest = this.recentDialogueIds.values().next().value;
            if (oldest !== undefined) this.recentDialogueIds.delete(oldest);
        }
        this.recentDialogueIds.add(id);
    }

    /**
     * Read-only accessor for the rolling dialogue-id set. Exists so the
     * Plan 03 `case 'telos_refined'` handler + future introspection probes
     * can check membership without mutating state. Returns the live set —
     * callers must NOT mutate it.
     */
    get _recentDialogueIdsForTest(): ReadonlySet<string> {
        return this.recentDialogueIds;
    }

    /**
     * Deliver an incoming message to this Nous's brain.
     * Called by the GridCoordinator when another Nous speaks.
     */
    async receiveMessage(
        senderName: string,
        senderDid: string,
        channel: string,
        text: string,
        tick: number,
    ): Promise<void> {
        if (!this.bridge.connected) return;

        const actions = await this.bridge.sendMessage({
            sender_name: senderName,
            sender_did: senderDid,
            channel,
            text,
        });
        await this.executeActions(actions, tick);
    }

    /** Execute a list of actions returned by the brain. */
    private async executeActions(actions: BrainAction[], tick: number): Promise<void> {
        for (const action of actions) {
            switch (action.action_type) {
                case 'speak':
                    await this.handleSpeak(action.channel, action.text, tick);
                    break;

                case 'move': {
                    const targetRegion = action.metadata?.['region'] as string | undefined;
                    if (targetRegion) {
                        this.handleMove(targetRegion, tick);
                    }
                    break;
                }

                case 'direct_message': {
                    // Phase 25b SANCTION-01 / D-25b-NEW-3: muteFlag suppression.
                    if (this.muteFlag) {
                        break;
                    }
                    // Direct messages are logged but routing is handled by coordinator
                    const targetDid = action.metadata?.['target_did'] as string | undefined;
                    this.audit.append('nous.direct_message', this.nousDid, {
                        targetDid,
                        channel: action.channel,
                        text: action.text.slice(0, 100),
                        tick,
                    });
                    break;
                }

                case 'trade_request': {
                    // Phase 5 (REV-01, REV-02) — 3-event flow:
                    //     trade.proposed → reviewer.review() → trade.reviewed → [trade.settled | break]
                    // Privacy-first: explicit keys only, no spread of raw metadata (T-5-04 mitigation).
                    // T-5-06 mitigation: trade.proposed is appended to AuditChain BEFORE reviewer runs.
                    //   AuditChain.append is synchronous → proposed is durably in the chain before
                    //   reviewer.review() is called. Integration tests assert proposed.id < reviewed.id.
                    // T-5-02 mitigation: before emitting trade.reviewed{fail}, assert
                    //   VALID_REVIEW_FAILURE_CODES.has(verdict.failure_reason) — runtime backstop
                    //   at the JSON boundary for the closed-enum contract.
                    const md = action.metadata ?? {};
                    const counterpartyRaw = md['counterparty'];
                    const amountRaw = md['amount'];
                    const nonceRaw = md['nonce'];
                    const memoryRefsRaw = md['memoryRefs'];
                    const telosHashRaw = md['telosHash'];

                    const counterparty = typeof counterpartyRaw === 'string' ? counterpartyRaw : null;
                    const amount = typeof amountRaw === 'number' && Number.isFinite(amountRaw) ? amountRaw : null;
                    const nonce = typeof nonceRaw === 'string' ? nonceRaw : null;
                    const memoryRefs = Array.isArray(memoryRefsRaw) && memoryRefsRaw.every(r => typeof r === 'string')
                        ? (memoryRefsRaw as string[])
                        : null;
                    const telosHash = typeof telosHashRaw === 'string' ? telosHashRaw : null;

                    if (
                        counterparty === null ||
                        amount === null ||
                        nonce === null ||
                        memoryRefs === null ||
                        telosHash === null
                    ) {
                        // Transport-layer error — do NOT emit trade.proposed or trade.reviewed.
                        this.audit.append('trade.rejected', this.nousDid, {
                            reason: 'malformed_metadata',
                            nonce: nonce ?? null,
                        });
                        break;
                    }

                    // ─ T-5-06: proposed MUST land on chain before reviewer runs.
                    this.audit.append('trade.proposed', this.nousDid, {
                        counterparty,
                        amount,
                        nonce,
                        memoryRefs,
                        telosHash,
                    });

                    // ─ Synchronous review (D-02). No RPC, no async, no I/O — determinism invariant (D-13).
                    // T-5-05 reminder: telosHash is a structural-attest only in Phase 5; Phase 7
                    // TelosRegistry will upgrade this to a registry-backed identity binding. DO NOT
                    // treat telosHash as an auth token here.
                    //
                    // Reviewer-bypass branch (D-13 regression affordance, Plan 05-04): when
                    // `this.reviewer` is undefined, skip BOTH the review() call AND the
                    // trade.reviewed emit. Production wiring ALWAYS passes a reviewer — this
                    // branch exists solely for the zero-diff regression test. See the NousRunnerConfig
                    // `reviewer?` field JSDoc for the contract.
                    if (this.reviewer) {
                        const proposer = this.registry.get(this.nousDid);
                        const proposerBalance = proposer?.ousia ?? 0;
                        const verdict = this.reviewer.review({
                            proposerDid: this.nousDid,
                            proposerBalance,
                            counterparty,
                            amount,
                            memoryRefs,
                            telosHash,
                        });

                        if (verdict.verdict === 'fail') {
                            // T-5-02 runtime backstop — closed enum at JSON emit boundary.
                            if (!VALID_REVIEW_FAILURE_CODES.has(verdict.failure_reason)) {
                                throw new Error(
                                    `Reviewer returned unknown failure_reason '${verdict.failure_reason}' — ` +
                                    `not in VALID_REVIEW_FAILURE_CODES.`,
                                );
                            }
                            this.audit.append('trade.reviewed', Reviewer.DID, {
                                trade_id: nonce,
                                reviewer_did: Reviewer.DID,
                                verdict: 'fail',
                                failed_check: verdict.failed_check,
                                failure_reason: verdict.failure_reason,
                            });
                            // NO transferOusia, NO trade.settled, NO trade.rejected on reviewer fail.
                            break;
                        }

                        // Pass path — emit trade.reviewed{pass}, then proceed with existing bounds +
                        // transferOusia + trade.settled.
                        this.audit.append('trade.reviewed', Reviewer.DID, {
                            trade_id: nonce,
                            reviewer_did: Reviewer.DID,
                            verdict: 'pass',
                        });
                    }

                    // Existing policy check — bounds is Grid-level min/max transfer (NOT a reviewer
                    // invariant; reviewer owns positive-amount, bounds owns min/max range).
                    const bounds = this.economy.validateTransfer(amount);
                    if (!bounds.valid) {
                        this.audit.append('trade.rejected', this.nousDid, {
                            reason: 'bounds',
                            nonce,
                        });
                        break;
                    }

                    // Defensive library-level guard — reviewer invariants make 'insufficient',
                    // 'invalid_amount', 'self_transfer' unreachable in Phase 5. 'not_found' remains
                    // reachable when the counterparty DID parses but isn't registered — reviewer
                    // checks DID format, not registry membership (intentional — registry lookup
                    // would break Phase 5's no-RPC/no-state-read-beyond-ctx invariant at check time).
                    const result = this.registry.transferOusia(this.nousDid, counterparty, amount);
                    if (!result.success) {
                        this.audit.append('trade.rejected', this.nousDid, {
                            reason: result.error,
                            nonce,
                        });
                        break;
                    }

                    this.audit.append('trade.settled', this.nousDid, {
                        counterparty,
                        amount,
                        nonce,
                    });
                    break;
                }

                case 'telos_refined': {
                    // Phase 7 DIALOG-02 (D-16 validation, D-17 sole producer path,
                    // D-31 self-report invariant).
                    //
                    // The Brain metadata carries exactly 3 keys; the runner
                    // injects `did = this.nousDid` (self-report per D-31) and
                    // passes the 4-key closed tuple to `appendTelosRefined`.
                    //
                    // Authority check FIRST: reject any `triggered_by_dialogue_id`
                    // not in `this.recentDialogueIds` (forgery guard, T-07-20).
                    // Producer-boundary exceptions (malformed hashes, extra keys,
                    // privacy leaks) are caught and silently dropped — mirrors
                    // the Phase 6 malformed-brain-response discipline.
                    const md = (action.metadata ?? {}) as Record<string, unknown>;
                    const dialogueId = typeof md['triggered_by_dialogue_id'] === 'string'
                        ? (md['triggered_by_dialogue_id'] as string)
                        : '';
                    const beforeHash = typeof md['before_goal_hash'] === 'string'
                        ? (md['before_goal_hash'] as string)
                        : '';
                    const afterHash = typeof md['after_goal_hash'] === 'string'
                        ? (md['after_goal_hash'] as string)
                        : '';

                    if (!this.recentDialogueIds.has(dialogueId)) {
                        // D-16: a Brain cannot claim participation in a dialogue
                        // its runner never delivered. Unknown ids drop silently.
                        break;
                    }

                    try {
                        appendTelosRefined(this.audit, this.nousDid, {
                            did: this.nousDid,           // self-report — matches actorDid per D-31
                            before_goal_hash: beforeHash,
                            after_goal_hash: afterHash,
                            triggered_by_dialogue_id: dialogueId,
                        });
                    } catch {
                        // Producer-boundary rejection (D-16 step 4): any assertion
                        // fail → drop. Mirrors Phase 6 malformed-brain-response.
                    }
                    break;
                }

                case 'drive_crossed': {
                    // Phase 10a DRIVE-03 / D-10a-03, D-10a-04: Grid injects
                    // did+tick (3-keys-not-5 invariant). `tick` is the world-clock
                    // tick from executeActions — NEVER Date.now(). Rejections
                    // drop silently per T-10a-18 so sibling actions still dispatch.
                    try {
                        appendAnankeDriveCrossed(this.audit, this.nousDid, {
                            did: this.nousDid,
                            tick,
                            drive: action.metadata.drive,
                            level: action.metadata.level,
                            direction: action.metadata.direction,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({
                            event: 'ananke.dispatch.rejected',
                            did: this.nousDid,
                            reason: (err as Error).message,
                        }));
                    }
                    break;
                }

                case 'whisper_send': {
                    // Phase 25b SANCTION-01 / D-25b-NEW-3: muteFlag suppression.
                    if (this.muteFlag) {
                        break;
                    }
                    // Phase 11 WHISPER-03 / D-11-05: route pre-encrypted envelope
                    // through WhisperRouter (validate → tombstone → ratelimit → emit → queue).
                    // Silent drop on tombstone or rate-limit per D-11-18 / D-11-08 (return false).
                    // Throws only on validation errors (bad DID regex, bad hash) — catch and log.
                    // Transport-error fallback mirrors trade_request pattern.
                    if (this.whisperRouter) {
                        try {
                            const accepted = this.whisperRouter.route(action.envelope, tick);
                            if (!accepted) {
                                // Silent drop — tombstone or rate-limit. NO log, NO retry.
                                return;
                            }
                        } catch (err) {
                            // Validation failures (bad DID regex, bad hash, etc.) are programmer
                            // errors from the Brain side — surface for debugging.
                            console.error(JSON.stringify({
                                event: 'whisper.dispatch.validation_failed',
                                did: this.nousDid,
                                reason: (err as Error).message,
                            }));
                        }
                    }
                    break;
                }

                case 'propose': {
                    // Phase 12 Wave 3 — D-12-07 / VOTE-05.
                    // NousRunner runs in-process; no HTTP hop needed (mirrors direct_message pattern).
                    // Sole producer: appendProposalOpened. Grid injects proposer_did + currentTick.
                    // On malformed metadata: console.warn + break (no audit emit, no throw).
                    // No 27th allowlist entry added — governance_rejected uses warn-only fallback.
                    const govDeps = this.governanceDeps;
                    if (!govDeps) {
                        console.warn(JSON.stringify({
                            event: 'governance.dispatch.not_wired',
                            action_type: 'propose',
                            did: this.nousDid,
                        }));
                        break;
                    }
                    {
                        const md = (action.metadata ?? {}) as Record<string, unknown>;
                        const bodyText = typeof md['body_text'] === 'string' ? md['body_text'] : null;
                        const deadlineTick = typeof md['deadline_tick'] === 'number' && Number.isInteger(md['deadline_tick']) ? (md['deadline_tick'] as number) : null;
                        const quorumPct = typeof md['quorum_pct'] === 'number' ? (md['quorum_pct'] as number) : undefined;
                        const supermajorityPct = typeof md['supermajority_pct'] === 'number' ? (md['supermajority_pct'] as number) : undefined;

                        if (bodyText === null || deadlineTick === null) {
                            console.warn(JSON.stringify({
                                event: 'governance.propose.malformed_metadata',
                                did: this.nousDid,
                                reason: 'missing body_text or deadline_tick',
                                tick,
                            }));
                            break;
                        }

                        try {
                            await appendProposalOpened(govDeps.audit, {
                                proposer_did: this.nousDid,
                                body_text: bodyText,
                                deadline_tick: deadlineTick,
                                currentTick: tick,
                                quorum_pct: quorumPct,
                                supermajority_pct: supermajorityPct,
                                store: govDeps.store,
                            });
                        } catch (err) {
                            console.warn(JSON.stringify({
                                event: 'governance.propose.rejected',
                                did: this.nousDid,
                                reason: (err as Error).message,
                                tick,
                            }));
                        }
                    }
                    break;
                }

                case 'vote_commit': {
                    // Phase 12 Wave 3 — D-12-07 / VOTE-05.
                    // Sole producer: appendBallotCommitted. Grid injects voter_did + committed_at_tick.
                    // Catches GovernanceError(409) for duplicate ballot.
                    const govDepsC = this.governanceDeps;
                    if (!govDepsC) {
                        console.warn(JSON.stringify({
                            event: 'governance.dispatch.not_wired',
                            action_type: 'vote_commit',
                            did: this.nousDid,
                        }));
                        break;
                    }
                    {
                        const md = (action.metadata ?? {}) as Record<string, unknown>;
                        const proposalId = typeof md['proposal_id'] === 'string' ? (md['proposal_id'] as string) : null;
                        const commitHash = typeof md['commit_hash'] === 'string' ? (md['commit_hash'] as string) : null;

                        if (proposalId === null || commitHash === null) {
                            console.warn(JSON.stringify({
                                event: 'governance.vote_commit.malformed_metadata',
                                did: this.nousDid,
                                reason: 'missing proposal_id or commit_hash',
                                tick,
                            }));
                            break;
                        }

                        try {
                            await appendBallotCommitted(govDepsC.audit, {
                                proposal_id: proposalId,
                                voter_did: this.nousDid,
                                commit_hash: commitHash,
                                currentTick: tick,
                                store: govDepsC.store,
                            });
                        } catch (err) {
                            if (err instanceof GovernanceError && err.httpStatus === 409) {
                                console.warn(JSON.stringify({
                                    event: 'governance.vote_commit.duplicate_ballot',
                                    did: this.nousDid,
                                    proposal_id: proposalId,
                                    tick,
                                }));
                            } else {
                                console.warn(JSON.stringify({
                                    event: 'governance.vote_commit.rejected',
                                    did: this.nousDid,
                                    reason: (err as Error).message,
                                    tick,
                                }));
                            }
                        }
                    }
                    break;
                }

                case 'vote_reveal': {
                    // Phase 12 Wave 3 — D-12-07 / VOTE-05.
                    // Sole producer: appendBallotRevealed. Grid injects voter_did + revealed_at_tick.
                    // Catches GovernanceError(422) for hash mismatch — NO ballot.revealed emitted.
                    const govDepsR = this.governanceDeps;
                    if (!govDepsR) {
                        console.warn(JSON.stringify({
                            event: 'governance.dispatch.not_wired',
                            action_type: 'vote_reveal',
                            did: this.nousDid,
                        }));
                        break;
                    }
                    {
                        const md = (action.metadata ?? {}) as Record<string, unknown>;
                        const proposalId = typeof md['proposal_id'] === 'string' ? (md['proposal_id'] as string) : null;
                        const choice = typeof md['choice'] === 'string' ? (md['choice'] as string) : null;
                        const nonce = typeof md['nonce'] === 'string' ? (md['nonce'] as string) : null;
                        const validChoices: ReadonlySet<string> = new Set(['yes', 'no', 'abstain']);

                        if (proposalId === null || choice === null || nonce === null || !validChoices.has(choice)) {
                            console.warn(JSON.stringify({
                                event: 'governance.vote_reveal.malformed_metadata',
                                did: this.nousDid,
                                reason: 'missing or invalid proposal_id, choice, or nonce',
                                tick,
                            }));
                            break;
                        }

                        try {
                            await appendBallotRevealed(govDepsR.audit, {
                                proposal_id: proposalId,
                                voter_did: this.nousDid,
                                choice: choice as BallotChoice,
                                nonce,
                                currentTick: tick,
                                store: govDepsR.store,
                            });
                        } catch (err) {
                            if (err instanceof GovernanceError && err.httpStatus === 422) {
                                console.warn(JSON.stringify({
                                    event: 'governance.vote_reveal.hash_mismatch',
                                    did: this.nousDid,
                                    proposal_id: proposalId,
                                    tick,
                                }));
                            } else {
                                console.warn(JSON.stringify({
                                    event: 'governance.vote_reveal.rejected',
                                    did: this.nousDid,
                                    reason: (err as Error).message,
                                    tick,
                                }));
                            }
                        }
                    }
                    break;
                }

                case 'iris_belief_revised': {
                    // Phase 17 D-17-09: Grid injects nous_did+tick (3-keys-not-5).
                    // Brain sends target_did, belief_hash, dimension (3 keys).
                    // Sole producer: appendIrisBeliefRevised. Rejections drop silently.
                    try {
                        appendIrisBeliefRevised(this.audit, this.nousDid, {
                            nous_did: this.nousDid,
                            tick,
                            target_did: action.metadata['target_did'] as string,
                            belief_hash: action.metadata['belief_hash'] as string,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({
                            event: 'iris.dispatch.rejected',
                            action_type: 'iris_belief_revised',
                            did: this.nousDid,
                            reason: (err as Error).message,
                        }));
                    }
                    break;
                }

                case 'iris_context_invoked': {
                    // Phase 17 D-17-09: belief_count is total beliefs injected this tick.
                    // Sole producer: appendIrisContextInvoked.
                    try {
                        appendIrisContextInvoked(this.audit, this.nousDid, {
                            nous_did: this.nousDid,
                            tick,
                            belief_count: action.metadata['belief_count'] as number,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({
                            event: 'iris.dispatch.rejected',
                            action_type: 'iris_context_invoked',
                            did: this.nousDid,
                            reason: (err as Error).message,
                        }));
                    }
                    break;
                }

                case 'iris_contradiction_detected': {
                    // Phase 17 D-17-09: Grid injects nous_did+tick; Brain sends target_did, contradiction_hash.
                    // Sole producer: appendIrisContradictionDetected.
                    try {
                        appendIrisContradictionDetected(this.audit, this.nousDid, {
                            nous_did: this.nousDid,
                            tick,
                            target_did: action.metadata['target_did'] as string,
                            contradiction_hash: action.metadata['contradiction_hash'] as string,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({
                            event: 'iris.dispatch.rejected',
                            action_type: 'iris_contradiction_detected',
                            did: this.nousDid,
                            reason: (err as Error).message,
                        }));
                    }
                    break;
                }

                case 'iris_prior_seeded': {
                    // Phase 17 D-17-09: Grid injects nous_did+tick; Brain sends target_did, seed_event_hash.
                    // seed_event_hash is full 64-char sha256 hexdigest from elicit.py source_event_hash.
                    // Sole producer: appendIrisPriorSeeded.
                    try {
                        appendIrisPriorSeeded(this.audit, this.nousDid, {
                            nous_did: this.nousDid,
                            tick,
                            target_did: action.metadata['target_did'] as string,
                            seed_event_hash: action.metadata['seed_event_hash'] as string,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({
                            event: 'iris.dispatch.rejected',
                            action_type: 'iris_prior_seeded',
                            did: this.nousDid,
                            reason: (err as Error).message,
                        }));
                    }
                    break;
                }

                case 'skill_taught': {
                    // Phase 25b SANCTION-01 / D-25b-NEW-3: muteFlag suppression (skill teaching = broadcast).
                    if (this.muteFlag) {
                        break;
                    }
                    // Phase 18 D-18-09: Grid injects learner_did+tick (3-keys-not-5).
                    // Brain sends skill_hash, teacher_did, parent_hash (3 keys).
                    // Sole producer: appendSkillTaught — rejections logged, not re-thrown.
                    try {
                        appendSkillTaught(this.audit, this.nousDid, {
                            learner_did: this.nousDid,
                            tick,
                            skill_hash: action.metadata['skill_hash'] as string,
                            teacher_did: action.metadata['teacher_did'] as string,
                            parent_hash: action.metadata['parent_hash'] as string,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({
                            event: 'skill.dispatch.rejected',
                            action_type: 'skill_taught',
                            did: this.nousDid,
                            reason: (err as Error).message,
                        }));
                    }
                    break;
                }

                case 'skill_inferred': {
                    // Phase 18 D-18-09: Grid injects learner_did+tick.
                    // Brain sends skill_hash, source_event_hash (2 keys).
                    try {
                        appendSkillInferred(this.audit, this.nousDid, {
                            learner_did: this.nousDid,
                            tick,
                            skill_hash: action.metadata['skill_hash'] as string,
                            source_event_hash: action.metadata['source_event_hash'] as string,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({
                            event: 'skill.dispatch.rejected',
                            action_type: 'skill_inferred',
                            did: this.nousDid,
                            reason: (err as Error).message,
                        }));
                    }
                    break;
                }

                case 'skill_rejected': {
                    // Phase 18 D-18-09: Grid injects learner_did+tick.
                    // Brain sends rejection_reason (1 key). reason ∈ {low_trust, structural_invalid, quota_exceeded}.
                    try {
                        appendSkillRejected(this.audit, this.nousDid, {
                            learner_did: this.nousDid,
                            tick,
                            rejection_reason: action.metadata['rejection_reason'] as string,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({
                            event: 'skill.dispatch.rejected',
                            action_type: 'skill_rejected',
                            did: this.nousDid,
                            reason: (err as Error).message,
                        }));
                    }
                    break;
                }

                case 'lore_contribute': {
                    // Phase 20 D-20-12: Grid injects contributor_did+tick (3-keys-not-5).
                    // Brain sends content_hash, category_tag (2 keys).
                    // Quota enforcement at Grid boundary BEFORE sole-producer call (STATE.md invariant, LORE-03).
                    const md = (action.metadata ?? {}) as Record<string, unknown>;
                    const contentHash = typeof md['content_hash'] === 'string' ? md['content_hash'] : null;
                    const categoryTag = typeof md['category_tag'] === 'string' ? md['category_tag'] : null;
                    if (contentHash === null || categoryTag === null) {
                        console.warn(JSON.stringify({
                            event: 'lore.contribute.malformed_metadata',
                            did: this.nousDid,
                            tick,
                        }));
                        break;
                    }
                    // Quota check: K=3 per sleep epoch (D-20-03)
                    const quotaTracker = this.loreDeps?.quotaTracker;
                    if (quotaTracker && !quotaTracker.tryConsume(this.nousDid, tick)) {
                        console.warn(JSON.stringify({
                            event: 'lore.contribute.quota_exceeded',
                            did: this.nousDid,
                            tick,
                        }));
                        break;
                    }
                    try {
                        appendLoreContributed(this.audit, this.nousDid, {
                            contributor_did: this.nousDid,
                            tick,
                            content_hash: contentHash,
                            category_tag: categoryTag,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({
                            event: 'lore.dispatch.rejected',
                            action_type: 'lore_contribute',
                            did: this.nousDid,
                            reason: (err as Error).message,
                        }));
                    }
                    break;
                }

                case 'lore_cited': {
                    // Phase 20 D-20-12: Grid injects citing_did+tick (3-keys-not-5).
                    // Brain sends content_hash (1 key). No quota enforcement on citations.
                    const md = (action.metadata ?? {}) as Record<string, unknown>;
                    const contentHash = typeof md['content_hash'] === 'string' ? md['content_hash'] : null;
                    if (contentHash === null) {
                        console.warn(JSON.stringify({
                            event: 'lore_cited.malformed_metadata',
                            did: this.nousDid,
                            tick,
                        }));
                        break;
                    }
                    try {
                        appendLoreCited(this.audit, this.nousDid, {
                            citing_did: this.nousDid,
                            tick,
                            content_hash: contentHash,
                        });
                    } catch (err) {
                        console.warn(JSON.stringify({
                            event: 'lore.dispatch.rejected',
                            action_type: 'lore_cited',
                            did: this.nousDid,
                            reason: (err as Error).message,
                        }));
                    }
                    break;
                }

                case 'lore_request': {
                    // Phase 20: Brain queued this after discovering an unknown hash in _poll().
                    // Intent: deliver __lore_request:{content_hash} to contributor_did via direct message.
                    // WhisperRouter only handles pre-encrypted envelopes (D-11-05); plaintext lore
                    // discovery messages cannot be routed through it. Best-effort: logged only.
                    // The primary discovery path is Brain HTTP-polling GET /api/v1/grid/lore (D-20-11).
                    const md = (action.metadata ?? {}) as Record<string, unknown>;
                    const contentHash = typeof md['content_hash'] === 'string' ? md['content_hash'] : null;
                    const recipientDid = typeof md['contributor_did'] === 'string' ? md['contributor_did'] : null;
                    if (contentHash === null || recipientDid === null) { break; }
                    // Log the intent for observability; actual peer-to-peer lore retrieval is future work.
                    console.warn(JSON.stringify({
                        event: 'lore.request.dispatched',
                        did: this.nousDid,
                        recipient_did: recipientDid,
                        content_hash: contentHash,
                        tick,
                    }));
                    break;
                }

                case 'lore_response': {
                    // Phase 20: Brain queued this after receiving __lore_request: from a peer.
                    // Intent: deliver __lore_response:{hash}:{b64} back to requester via direct message.
                    // Same constraint as lore_request: WhisperRouter is pre-encrypted-only.
                    // Best-effort: logged only. Primary path is Brain's local LoreStore.
                    const md = (action.metadata ?? {}) as Record<string, unknown>;
                    const recipientDid = typeof md['recipient_did'] === 'string' ? md['recipient_did'] : null;
                    if (recipientDid === null) { break; }
                    console.warn(JSON.stringify({
                        event: 'lore.response.dispatched',
                        did: this.nousDid,
                        recipient_did: recipientDid,
                        tick,
                    }));
                    break;
                }

                case 'noop':
                    // Nothing to do
                    break;
            }
        }
    }

    private async handleSpeak(channel: string, text: string, tick: number): Promise<void> {
        // Phase 25b SANCTION-01 / D-25b-NEW-3: muteFlag suppression at sole-producer boundary.
        // Sanctioned Nous still thinks; only the broadcast emission is withheld (shouting into void).
        if (this.muteFlag) {
            return;
        }

        // 1. Audit the speech
        this.audit.append('nous.spoke', this.nousDid, {
            name: this.nousName,
            channel,
            text: text.slice(0, 200),
            tick,
        });

        // 2. Notify coordinator so it can relay to others in same region
        if (this.speakHandler) {
            this.speakHandler(this, channel, text, tick);
        }
    }

    private handleMove(targetRegion: string, tick: number): void {
        const result = this.space.moveNous(this.nousDid, targetRegion);
        if (result.success) {
            this.audit.append('nous.moved', this.nousDid, {
                name: this.nousName,
                fromRegion: result.fromRegion,
                toRegion: result.toRegion,
                travelCost: result.travelCost,
                tick,
            });
        }
    }

    /** Get current brain state (for Human Channel or debugging). */
    async getState(): Promise<Record<string, unknown>> {
        if (!this.bridge.connected) return { error: 'not connected' };
        return this.bridge.getState();
    }

    /**
     * H2 Reviewer memory query passthrough (Phase 6 AGENCY-02).
     *
     * Thin passthrough to the brain bridge — NousRunner does NOT cache, log,
     * or mutate the response. Audit writes for operator.inspected happen at
     * the Fastify handler (single producer-boundary per D-13).
     */
    async queryMemory(
        params: { query: string; limit?: number },
    ): Promise<{ entries: MemoryEntry[] }> {
        return this.bridge.queryMemory(params);
    }

    /**
     * H4 Driver force-Telos passthrough (Phase 6 AGENCY-02).
     *
     * Thin passthrough. Returns ONLY the SHA-256 hashes — goal contents
     * never touch grid-side code (D-19 hash-only invariant). Audit writes
     * for operator.telos_forced happen at the Fastify handler.
     */
    async forceTelos(
        newTelos: Record<string, unknown>,
    ): Promise<{ telos_hash_before: string; telos_hash_after: string }> {
        return this.bridge.forceTelos(newTelos);
    }

    /**
     * Phase 25b SANCTION-04 / D-25b-NEW-3: force this Nous into a Hypnos sleep cycle.
     *
     * Called by POST /api/v1/operator/nous/:did/force-sleep AFTER operator.forced_sleep
     * is emitted (guaranteeing the audit cause-effect ordering).
     *
     * Invokes the sleepTrigger injectable if present. Production wiring supplies the
     * Hypnos entry path; tests inject a mock that emits nous.sleep.entered directly.
     * When no sleepTrigger is wired, this is a no-op (operator.forced_sleep still emitted).
     */
    async triggerSleep(): Promise<void> {
        if (this.sleepTrigger) {
            await this.sleepTrigger();
        }
    }

    /**
     * Phase 25a OBS-BRAIN-HEALTH: compute p50/p95 latency percentiles from the
     * in-memory ring buffer. Returns zeros when no ticks have been recorded.
     *
     * queue_depth: 0 — NousRunner has no pending-tick queue concept; populated
     * when a pending-tick concept is introduced in a future phase.
     */
    getTickMetrics(): { p50: number; p95: number; queue_depth: number; sample_count: number } {
        const samples = [...this.tickLatencyBuffer.peek()].sort((a, b) => a - b);
        const n = samples.length;
        if (n === 0) return { p50: 0, p95: 0, queue_depth: 0, sample_count: 0 };
        const pct = (q: number): number => samples[Math.min(n - 1, Math.floor(q * n))]!;
        return {
            p50: Math.round(pct(0.5) * 100) / 100,
            p95: Math.round(pct(0.95) * 100) / 100,
            queue_depth: 0,
            sample_count: n,
        };
    }

    get connected(): boolean {
        return this.bridge.connected;
    }
}
