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
import type { DialogueContext } from '../dialogue/index.js';
import { Reviewer } from '../review/index.js';
import { VALID_REVIEW_FAILURE_CODES } from '../review/types.js';
import { appendTelosRefined } from '../audit/append-telos-refined.js';
import { appendAnankeDriveCrossed } from '../ananke/index.js';
import type { WhisperRouter } from '../whisper/router.js';

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

    private speakHandler: SpeakHandler | null = null;

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

        const actions = await this.bridge.sendTick(params);
        this.registry.touch(this.nousDid, tick);
        await this.executeActions(actions, tick);
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

                case 'noop':
                    // Nothing to do
                    break;
            }
        }
    }

    private async handleSpeak(channel: string, text: string, tick: number): Promise<void> {
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

    get connected(): boolean {
        return this.bridge.connected;
    }
}
