/**
 * Bridge types — JSON-RPC communication between protocol and brain.
 */

export interface RPCRequest {
    jsonrpc: '2.0';
    method: string;
    params?: Record<string, unknown>;
    id?: number | string;
}

export interface RPCResponse {
    jsonrpc: '2.0';
    id?: number | string | null;
    result?: unknown;
    error?: RPCError;
}

export interface RPCError {
    code: number;
    message: string;
    data?: unknown;
}

export interface BrainAction {
    action_type: 'speak' | 'direct_message' | 'move' | 'trade_request' | 'noop';
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
