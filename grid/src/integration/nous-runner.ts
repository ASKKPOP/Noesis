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
import type { BrainAction, IBrainBridge } from './types.js';
import { Reviewer } from '../review/index.js';
import { VALID_REVIEW_FAILURE_CODES } from '../review/types.js';

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

    private speakHandler: SpeakHandler | null = null;

    constructor(config: NousRunnerConfig) {
        this.nousDid = config.nousDid;
        this.nousName = config.nousName;
        this.bridge = config.bridge;
        this.space = config.space;
        this.audit = config.audit;
        this.registry = config.registry;
        this.economy = config.economy;
        this.reviewer = config.reviewer;
    }

    /** Register handler called when this Nous speaks (for message routing). */
    onSpeak(handler: SpeakHandler): void {
        this.speakHandler = handler;
    }

    /** Deliver a world clock tick to the brain. */
    async tick(tick: number, epoch: number): Promise<void> {
        if (!this.bridge.connected) return;

        const actions = await this.bridge.sendTick({ tick, epoch });
        this.registry.touch(this.nousDid, tick);
        await this.executeActions(actions, tick);
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

    get connected(): boolean {
        return this.bridge.connected;
    }
}
