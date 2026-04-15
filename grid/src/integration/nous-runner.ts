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
import type { BrainAction, IBrainBridge } from './types.js';

export interface NousRunnerConfig {
    nousDid: string;
    nousName: string;
    bridge: IBrainBridge;
    space: SpatialMap;
    audit: AuditChain;
    registry: NousRegistry;
}

export type SpeakHandler = (runner: NousRunner, channel: string, text: string, tick: number) => void;

export class NousRunner {
    readonly nousDid: string;
    readonly nousName: string;

    private readonly bridge: IBrainBridge;
    private readonly space: SpatialMap;
    private readonly audit: AuditChain;
    private readonly registry: NousRegistry;

    private speakHandler: SpeakHandler | null = null;

    constructor(config: NousRunnerConfig) {
        this.nousDid = config.nousDid;
        this.nousName = config.nousName;
        this.bridge = config.bridge;
        this.space = config.space;
        this.audit = config.audit;
        this.registry = config.registry;
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
