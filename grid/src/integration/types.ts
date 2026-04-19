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
}
