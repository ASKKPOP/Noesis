/**
 * Integration layer types — local definitions for the Grid ↔ Brain bridge.
 *
 * Deliberately NOT imported from @noesis/protocol so the integration layer
 * has no build-time dependency on the protocol package.
 */

import type { DialogueContext } from '../dialogue/index.js';
import type { AnankeDriveName, AnankeDriveLevel, AnankeDirection } from '../ananke/types.js';

export interface SpeakAction {
    action_type: 'speak';
    channel: string;
    text: string;
    metadata: Record<string, unknown>;
}

export interface DirectMessageAction {
    action_type: 'direct_message';
    channel: string;
    text: string;
    metadata: Record<string, unknown>;
}

export interface MoveAction {
    action_type: 'move';
    channel: string;
    text: string;
    metadata: Record<string, unknown>;
}

export interface NoopAction {
    action_type: 'noop';
    channel: string;
    text: string;
    metadata: Record<string, unknown>;
}

/**
 * Brain-initiated bilateral trade proposal.
 *
 * Per Phase 4 D8, `metadata` carries EXACTLY the transfer primitives —
 * no free-text memo, no names, no prompts. `text` and `channel` are kept
 * on the shape for protocol uniformity with other BrainAction variants
 * but are ignored by the grid's trade handler.
 */
export interface TradeRequestAction {
    action_type: 'trade_request';
    channel: string;
    text: string;
    metadata: {
        counterparty: string;
        amount: number;
        nonce: string;
        memoryRefs: string[];    // Phase 5 (D-05): pre-resolved memory IDs, each `mem:<int>` per RQ3.
        telosHash: string;       // Phase 5 (D-05): 64-hex SHA-256 of the proposer's currently active Telos.
        [key: string]: unknown;
    };
}

/**
 * Phase 7 DIALOG-01: Brain-returned telos refinement initiated by a peer
 * dialogue. The variant is declared here so the BrainAction union is
 * exhaustive, but the `case 'telos_refined'` handler in NousRunner is
 * DELIBERATELY DEFERRED to Plan 03 (handler + appendTelosRefined producer
 * boundary ship atomically per 07-CONTEXT.md D-18).
 *
 * `new_goals` may appear on the wire but MUST be dropped by Plan 03's case
 * handler before crossing the producer boundary (D-18, Pitfall 5).
 */
export interface TelosRefinedAction {
    action_type: 'telos_refined';
    channel: string;
    text: string;
    metadata: {
        before_goal_hash: string;            // 64-hex; validated in Plan 03 handler
        after_goal_hash: string;             // 64-hex; validated in Plan 03 handler
        triggered_by_dialogue_id: string;    // 16-hex; validated in Plan 03 handler
        [key: string]: unknown;
    };
}

/**
 * Phase 10a DRIVE-03: Brain-returned ananke drive threshold-crossing action.
 *
 * `metadata` carries EXACTLY 3 keys — {drive, level, direction} — sourced
 * from the Brain's closed-enum domain (see grid/src/ananke/types.ts). The
 * Grid injects the authoritative `did` (from runner context) and `tick`
 * (from the executeActions tick parameter, sourced upstream from the
 * world-clock tick passed into NousRunner.tick) at dispatch time to form
 * the 5-key payload consumed by `appendAnankeDriveCrossed`.
 *
 * `channel` and `text` are kept on the shape for protocol uniformity with
 * the other BrainAction variants but MUST be empty strings for
 * DRIVE_CROSSED — the event is Nous-internal, not a spoken utterance.
 *
 * The 3-keys-not-5 invariant (10a-CONTEXT.md D-10a-04) is structural:
 * because `BrainActionDriveCrossed.metadata` has no `did` / `tick` slots,
 * the Brain cannot forge them. The dispatcher in nous-runner.ts MUST NOT
 * read `did` or `tick` from action.metadata.
 */
export interface BrainActionDriveCrossed {
    readonly action_type: 'drive_crossed';
    readonly channel: '';
    readonly text: '';
    readonly metadata: {
        readonly drive: AnankeDriveName;
        readonly level: AnankeDriveLevel;
        readonly direction: AnankeDirection;
    };
}

export type BrainAction =
    | SpeakAction
    | DirectMessageAction
    | MoveAction
    | NoopAction
    | TradeRequestAction
    | TelosRefinedAction
    | BrainActionDriveCrossed;

export interface MessageParams {
    sender_name: string;
    sender_did: string;
    channel: string;
    text: string;
}

export interface TickParams {
    tick: number;
    epoch: number;
    /**
     * Phase 7 DIALOG-01 (D-10): additive — present on the tick where a
     * bidirectional peer dialogue crosses the aggregator threshold and the
     * coordinator drains it for this runner. Existing callers that omit
     * this field continue to work unchanged.
     */
    dialogue_context?: DialogueContext;
}

export interface EventParams {
    event_type: string;
    data: Record<string, unknown>;
}

/**
 * Phase 6 AGENCY-02: normalized memory entry shape surfaced to H2 Reviewer.
 *
 * Mirrors `MemoryEntry` in @noesis/protocol — redefined locally so the
 * integration layer has no compile-time dependency on the protocol package
 * (see file header). Full memory stays in Brain (PHILOSOPHY §1); only
 * {timestamp, kind, summary} crosses the RPC boundary.
 */
export interface MemoryEntry {
    timestamp: string;
    kind: string;
    summary: string;
}

/**
 * Minimal interface any brain bridge must satisfy.
 * Implemented by @noesis/protocol BrainBridge in production.
 * Can be mocked in tests.
 */
export interface IBrainBridge {
    readonly connected: boolean;
    sendTick(params: TickParams): Promise<BrainAction[]>;
    sendMessage(params: MessageParams): Promise<BrainAction[]>;
    sendEvent(params: EventParams): void;
    getState(): Promise<Record<string, unknown>>;

    /**
     * H2 Reviewer memory query (Phase 6 AGENCY-02).
     * Returns normalized entries only — no raw content, no reflections.
     */
    queryMemory(
        params: { query: string; limit?: number },
    ): Promise<{ entries: MemoryEntry[] }>;

    /**
     * H4 Driver force-Telos (Phase 6 AGENCY-02).
     * Returns ONLY the SHA-256 hashes before/after (D-19 hash-only invariant).
     * Goal contents never cross this boundary.
     */
    forceTelos(
        newTelos: Record<string, unknown>,
    ): Promise<{ telos_hash_before: string; telos_hash_after: string }>;
}
