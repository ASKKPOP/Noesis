/**
 * BrainBridge — connects protocol layer events to the Python brain.
 *
 * Translates P2P messages into brain.onMessage RPC calls,
 * and brain actions back into P2P messages.
 */

import { RPCClient, type RPCClientConfig } from './rpc-client.js';
import type { BrainAction, MessageParams, TickParams, EventParams, MemoryEntry } from './types.js';

export interface BrainBridgeConfig {
    socketPath: string;
    nousName: string;
    timeoutMs?: number;
}

export class BrainBridge {
    private readonly client: RPCClient;
    private readonly nousName: string;

    constructor(config: BrainBridgeConfig) {
        this.nousName = config.nousName;
        this.client = new RPCClient({
            socketPath: config.socketPath,
            timeoutMs: config.timeoutMs ?? 30000,
        });
    }

    async connect(): Promise<void> {
        await this.client.connect();
    }

    /**
     * Send a P2P message to the brain for processing.
     * Returns a list of actions the brain wants to execute.
     */
    async sendMessage(params: MessageParams): Promise<BrainAction[]> {
        const result = await this.client.call('brain.onMessage', params as any);
        return (result as BrainAction[]) || [];
    }

    /**
     * Notify the brain of a world clock tick.
     * Returns actions the brain wants to execute autonomously.
     */
    async sendTick(params: TickParams): Promise<BrainAction[]> {
        const result = await this.client.call('brain.onTick', params as any);
        return (result as BrainAction[]) || [];
    }

    /**
     * Notify the brain of a grid event (fire-and-forget).
     */
    sendEvent(params: EventParams): void {
        this.client.notify('brain.onEvent', params as any);
    }

    /**
     * Get current brain state (for Human Channel).
     */
    async getState(): Promise<Record<string, unknown>> {
        const result = await this.client.call('brain.getState', {});
        return (result as Record<string, unknown>) || {};
    }

    /**
     * H2 Reviewer memory query.
     *
     * Returns normalized memory entries — each entry carries only
     * {timestamp, kind, summary}. Full memory (importance, source_did,
     * location, tick, raw content) is deliberately dropped at the RPC
     * boundary per PHILOSOPHY §1 (sovereignty) and D-11 (no prompts / raw
     * thoughts cross the Brain boundary).
     */
    async queryMemory(
        params: { query: string; limit?: number },
    ): Promise<{ entries: MemoryEntry[] }> {
        const result = await this.client.call(
            'brain.queryMemory',
            params as unknown as Record<string, unknown>,
        );
        return (result as { entries: MemoryEntry[] }) ?? { entries: [] };
    }

    /**
     * H4 Driver force-Telos.
     *
     * Submits a new Telos to the Brain, which rebuilds its active Telos
     * from the payload and returns ONLY the SHA-256 hashes before/after.
     * Goal contents (descriptions, priorities, progress) NEVER cross this
     * boundary — the grid-side audit event (operator.telos_forced) must
     * therefore log only the hash diff (D-19 hash-only invariant).
     */
    async forceTelos(
        newTelos: Record<string, unknown>,
    ): Promise<{ telos_hash_before: string; telos_hash_after: string }> {
        const result = await this.client.call('brain.forceTelos', { new_telos: newTelos });
        return result as { telos_hash_before: string; telos_hash_after: string };
    }

    get connected(): boolean {
        return this.client.connected;
    }

    disconnect(): void {
        this.client.disconnect();
    }
}
