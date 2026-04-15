/**
 * Brain Bridge — Public API
 */

export { RPCClient, type RPCClientConfig } from './rpc-client.js';
export { BrainBridge, type BrainBridgeConfig } from './brain-bridge.js';
export type {
    RPCRequest,
    RPCResponse,
    RPCError,
    BrainAction,
    MessageParams,
    TickParams,
    EventParams,
} from './types.js';
