/**
 * Human Observer Adapter — translates Brain events into human-readable activity stream.
 *
 * Sits between the Brain's action output and the Human Gateway,
 * converting internal actions into ActivityEvents for the dashboard.
 */

import type { ActivityEvent } from './types.js';

export type ActionInput = {
    actionType: string;
    content?: string;
    target?: string;
    location?: string;
    amount?: number;
    [key: string]: unknown;
};

export class HumanObserver {
    private readonly nousDid: string;
    private readonly listeners: Set<(event: ActivityEvent) => void> = new Set();

    constructor(nousDid: string) {
        this.nousDid = nousDid;
    }

    /** Convert a Brain action into an ActivityEvent and broadcast. */
    observe(action: ActionInput, tick: number): ActivityEvent {
        const event = this.toActivity(action, tick);
        for (const listener of this.listeners) {
            try { listener(event); } catch { /* don't crash */ }
        }
        return event;
    }

    /** Subscribe to activity events. */
    onActivity(listener: (event: ActivityEvent) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** Map action types to activity event kinds and summaries. */
    private toActivity(action: ActionInput, tick: number): ActivityEvent {
        const base = {
            type: 'activity' as const,
            nousDid: this.nousDid,
            tick,
            timestamp: Date.now(),
            details: { ...action },
        };

        switch (action.actionType) {
            case 'speak':
                return {
                    ...base,
                    eventKind: 'spoke',
                    summary: `Said: "${truncate(action.content ?? '', 80)}"`,
                };

            case 'direct_message':
                return {
                    ...base,
                    eventKind: 'spoke',
                    summary: `DM to ${action.target ?? 'unknown'}: "${truncate(action.content ?? '', 60)}"`,
                };

            case 'move':
                return {
                    ...base,
                    eventKind: 'moved',
                    summary: `Moved to ${action.location ?? 'unknown region'}`,
                };

            case 'trade_request':
                return {
                    ...base,
                    eventKind: 'traded',
                    summary: `Trade ${action.amount ?? '?'} Ousia with ${action.target ?? 'unknown'}`,
                };

            case 'reflect':
                return {
                    ...base,
                    eventKind: 'reflected',
                    summary: `Reflected: "${truncate(action.content ?? '', 80)}"`,
                };

            case 'wiki_update':
                return {
                    ...base,
                    eventKind: 'learned',
                    summary: `Updated wiki: ${action.content ?? 'unknown page'}`,
                };

            default:
                return {
                    ...base,
                    eventKind: 'spoke',
                    summary: `Action: ${action.actionType}`,
                };
        }
    }
}

function truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max - 3) + '...' : s;
}
