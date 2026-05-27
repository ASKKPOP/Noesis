/**
 * Phase 41 — PresenceService facade.
 *
 * Composes PresenceStore + MessageQueueStore + GraceTimerRegistry + CivicDidStore +
 * BusinessDidStore + AuditChain into a single dependency-injection surface for routes
 * and lifecycle hooks (firehose-hub, launcher).
 */

import type { AuditChain } from '../audit/chain.js';
import type { CivicDidStore } from '../civic-registry/civic-did-store.js';
import type { BusinessDidStore } from '../civic-registry/business-did-store.js';
import { GRACE_TIMER_MS } from './types.js';
import type { PresenceStatus, PresenceRecord, QueuedMessage } from './types.js';
import type { GraceTimerRegistry } from './grace-timer-registry.js';
import type { PresenceStore } from './presence-store.js';
import type { MessageQueueStore } from './message-queue-store.js';
import { runEscalationCheck } from './escalation-check.js';

export interface PresenceServiceDeps {
    readonly gridName: string;
    readonly presenceStore: PresenceStore;
    readonly messageQueueStore: MessageQueueStore;
    readonly graceTimerRegistry: GraceTimerRegistry;
    readonly civicDidStore: CivicDidStore;
    readonly businessDidStore?: BusinessDidStore;
    readonly audit: AuditChain;
    readonly currentTick: () => number;
}

export class PresenceService {
    constructor(private readonly deps: PresenceServiceDeps) {}

    onWsConnect(civicDid: string): void {
        this.deps.graceTimerRegistry.incrementConnection(civicDid);
    }

    onWsDisconnect(civicDid: string): void {
        const tick = this.deps.currentTick();
        this.deps.graceTimerRegistry.decrementConnection(
            civicDid,
            () => {
                void this.deps.presenceStore
                    .updatePresence(this.deps.gridName, civicDid, 'away', tick)
                    .catch(() => {});
            },
            GRACE_TIMER_MS,
        );
    }

    async onHeartbeat(civicDid: string, tick: number): Promise<PresenceRecord | null> {
        this.deps.graceTimerRegistry.heartbeat(civicDid);
        await this.deps.presenceStore.updatePresence(this.deps.gridName, civicDid, 'awake', tick);
        return this.deps.presenceStore.getPresence(this.deps.gridName, civicDid);
    }

    async sendDirectMessage(
        recipientCivicDid: string,
        senderCivicDid: string,
        messageJson: unknown,
    ): Promise<{ queued: boolean; messageId: number | null; queueFull: boolean }> {
        const recipientPresence = await this.deps.presenceStore.getPresence(
            this.deps.gridName, recipientCivicDid,
        );
        if (!recipientPresence) {
            return { queued: false, messageId: null, queueFull: false };
        }
        const tick = this.deps.currentTick();
        const messageId = await this.deps.messageQueueStore.enqueue(
            this.deps.gridName, recipientCivicDid, senderCivicDid, messageJson, tick,
        );
        if (messageId === null) {
            return { queued: false, messageId: null, queueFull: true };
        }
        return { queued: true, messageId, queueFull: false };
    }

    async listInbox(civicDid: string, sinceTick: number | undefined): Promise<{
        messages: QueuedMessage[];
        queueDepth: number;
    }> {
        const [messages, queueDepth] = await Promise.all([
            this.deps.messageQueueStore.listPending(this.deps.gridName, civicDid, sinceTick),
            this.deps.messageQueueStore.depth(this.deps.gridName, civicDid),
        ]);
        return { messages, queueDepth };
    }

    async ackMessages(civicDid: string, messageIds: number[]): Promise<number> {
        return this.deps.messageQueueStore.markDelivered(this.deps.gridName, civicDid, messageIds);
    }

    async isFrozen(civicDid: string): Promise<boolean> {
        return this.deps.presenceStore.isFrozen(this.deps.gridName, civicDid);
    }

    async listAllPresence(): Promise<PresenceRecord[]> {
        return this.deps.presenceStore.listAll(this.deps.gridName);
    }

    async getPresence(civicDid: string): Promise<PresenceRecord | null> {
        return this.deps.presenceStore.getPresence(this.deps.gridName, civicDid);
    }

    async runEscalationCheck(now: Date, tick: number): Promise<{
        absentCount: number;
        presumedDepartedCount: number;
    }> {
        return runEscalationCheck({
            gridName: this.deps.gridName,
            presenceStore: this.deps.presenceStore,
            messageQueueStore: this.deps.messageQueueStore,
            civicDidStore: this.deps.civicDidStore,
            businessDidStore: this.deps.businessDidStore,
            audit: this.deps.audit,
            now,
            tick,
        });
    }

    /** OBS-R-32-02 — called by launcher.stop() to clear all pending grace timers. */
    shutdown(): void {
        this.deps.graceTimerRegistry.clear();
    }
}
