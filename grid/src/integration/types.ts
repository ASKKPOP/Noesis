/**
 * Integration layer types — local definitions for the Grid ↔ Brain bridge.
 *
 * Deliberately NOT imported from @noesis/protocol so the integration layer
 * has no build-time dependency on the protocol package.
 */

export interface BrainAction {
    action_type: 'speak' | 'direct_message' | 'move' | 'noop';
    channel: string;
    text: string;
    metadata: Record<string, unknown>;
}

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
