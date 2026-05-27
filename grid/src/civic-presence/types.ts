/**
 * Phase 41 — Civic presence types.
 * 4-state model: awake (process running) → away (grace timer expired)
 *               → absent (>30d) → presumed_departed (>1y, Civic-DID frozen).
 */

export type PresenceStatus = 'awake' | 'away' | 'absent' | 'presumed_departed';

export interface PresenceRecord {
    readonly gridName: string;
    readonly civicDid: string;
    readonly presenceStatus: PresenceStatus;
    readonly lastSeenAt: Date | null;
    readonly lastSeenTick: number | null;
    readonly awayGraceExpiresAt: Date | null;
    readonly frozen: boolean;
}

export interface QueuedMessage {
    readonly id: number;
    readonly gridName: string;
    readonly recipientCivicDid: string;
    readonly senderCivicDid: string;
    readonly messageJson: unknown;
    readonly sentAtTick: number;
    readonly sentAt: Date;
    readonly status: 'pending' | 'delivered';
}

export const GRACE_TIMER_MS = 5 * 60 * 1000;                          // 5 minutes (D-41-01)
export const ABSENT_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;         // 30 days (D-41-07)
export const PRESUMED_DEPARTED_THRESHOLD_MS = 365 * 24 * 60 * 60 * 1000; // 1 year (D-41-07)
export const QUEUE_DEPTH_MAX = 1000;                                   // T-41-02 mitigation
export const ESCALATION_INTERVAL_MS = 24 * 60 * 60 * 1000;            // 24 hours (D-41-07)
