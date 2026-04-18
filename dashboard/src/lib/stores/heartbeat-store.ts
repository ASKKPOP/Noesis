/**
 * HeartbeatStore — tracks tick progression and derives a live/stale status
 * for the dashboard heartbeat widget. Driven primarily by 'tick' audit
 * entries, but ANY audit entry advances lastEventAt so "last event N seconds
 * ago" remains accurate even when ticks are absent (e.g., inter-tick
 * activity floods the stream).
 *
 * Staleness rule (03-UI-SPEC.md §Heartbeat Widget + 03-RESEARCH.md
 * §Heartbeat staleness): the dashboard is "stale" when
 *   now - lastEventAt > 2 * tickRateMs
 * i.e. two tick cycles of silence. Below that threshold it is "live".
 * Before the first tick is observed, status is "unknown" because we cannot
 * evaluate the threshold without a tickRateMs.
 *
 * Monotonicity: entries with id ≤ lastEventId are silently dropped. The
 * WsClient advances lastSeenId monotonically so normal operation never
 * emits a stale id, but REST refill or reconnect replay might. Using the
 * entry id as the authority protects against both.
 *
 * Snapshot stability: getSnapshot returns the SAME reference until a
 * mutating ingest. Framework-agnostic: no React imports.
 */

import type { AuditEntry } from '@/lib/protocol/audit-types';

export type HeartbeatStatus = 'unknown' | 'live' | 'stale';

export interface HeartbeatSnapshot {
    readonly lastTick: number | null;
    readonly lastEpoch: number | null;
    readonly tickRateMs: number | null;
    readonly lastEventAt: number | null;
    readonly lastEventId: number | null;
}

export interface DerivedHeartbeat extends HeartbeatSnapshot {
    readonly status: HeartbeatStatus;
    readonly secondsSinceLastEvent: number | null;
}

const INITIAL_SNAPSHOT: HeartbeatSnapshot = Object.freeze({
    lastTick: null,
    lastEpoch: null,
    tickRateMs: null,
    lastEventAt: null,
    lastEventId: null,
});

export class HeartbeatStore {
    private snap: HeartbeatSnapshot = INITIAL_SNAPSHOT;
    private readonly listeners = new Set<() => void>();

    ingest(entry: AuditEntry): void {
        if (this.applyOne(entry)) this.notify();
    }

    ingestBatch(entries: readonly AuditEntry[]): void {
        let changed = false;
        for (const e of entries) {
            if (this.applyOne(e)) changed = true;
        }
        if (changed) this.notify();
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return (): void => {
            this.listeners.delete(listener);
        };
    }

    getSnapshot(): Readonly<HeartbeatSnapshot> {
        return this.snap;
    }

    /**
     * Derive live/stale status against a caller-supplied wall-clock time.
     * The caller (typically a component rAF loop) owns the clock so the
     * store stays deterministic and testable without jsdom timers.
     */
    deriveStatus(nowMs: number): DerivedHeartbeat {
        const { lastEventAt, tickRateMs } = this.snap;
        let status: HeartbeatStatus = 'unknown';
        let secondsSinceLastEvent: number | null = null;

        if (lastEventAt !== null) {
            const elapsed = nowMs - lastEventAt;
            secondsSinceLastEvent = Math.floor(elapsed / 1000);
            if (tickRateMs !== null) {
                status = elapsed > 2 * tickRateMs ? 'stale' : 'live';
            }
        }

        return { ...this.snap, status, secondsSinceLastEvent };
    }

    /**
     * @returns true iff store state changed.
     */
    private applyOne(entry: AuditEntry): boolean {
        // Monotonicity guard — stale ids never affect state.
        if (
            entry.id !== undefined &&
            this.snap.lastEventId !== null &&
            entry.id <= this.snap.lastEventId
        ) {
            return false;
        }

        // Mutable accumulator — writes into a fresh object, then frozen as
        // the new snapshot if anything actually changed.
        const next: {
            lastTick: number | null;
            lastEpoch: number | null;
            tickRateMs: number | null;
            lastEventAt: number | null;
            lastEventId: number | null;
        } = {
            lastTick: this.snap.lastTick,
            lastEpoch: this.snap.lastEpoch,
            tickRateMs: this.snap.tickRateMs,
            lastEventAt: this.snap.lastEventAt,
            lastEventId: this.snap.lastEventId,
        };
        let changed = false;

        // Always record arrival time + id for ANY accepted event.
        if (entry.createdAt !== this.snap.lastEventAt) {
            next.lastEventAt = entry.createdAt;
            changed = true;
        }
        if (entry.id !== undefined && entry.id !== this.snap.lastEventId) {
            next.lastEventId = entry.id;
            changed = true;
        }

        // Tick-specific fields.
        if (entry.eventType === 'tick') {
            const p = entry.payload;
            const tick = p['tick'];
            const epoch = p['epoch'];
            const tickRateMs = p['tickRateMs'];
            if (typeof tick === 'number' && tick !== this.snap.lastTick) {
                next.lastTick = tick;
                changed = true;
            }
            if (typeof epoch === 'number' && epoch !== this.snap.lastEpoch) {
                next.lastEpoch = epoch;
                changed = true;
            }
            if (typeof tickRateMs === 'number' && tickRateMs !== this.snap.tickRateMs) {
                next.tickRateMs = tickRateMs;
                changed = true;
            }
        }

        if (changed) {
            this.snap = Object.freeze(next);
        }
        return changed;
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}
