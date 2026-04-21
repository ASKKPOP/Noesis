/**
 * Integration layer types — local definitions for the Grid ↔ Brain bridge.
 *
 * Deliberately NOT imported from @noesis/protocol so the integration layer
 * has no build-time dependency on the protocol package.
 */

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

export type BrainAction =
    | SpeakAction
    | DirectMessageAction
    | MoveAction
    | NoopAction
    | TradeRequestAction;

export interface MessageParams {
    sender_name: string;
    sender_did: string;
    channel: string;
    text: string;
}

export interface TickParams {
    tick: number;
    epoch: number;
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
