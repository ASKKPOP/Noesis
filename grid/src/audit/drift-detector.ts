/**
 * DriftDetector — runtime defense-in-depth layer against allowlist violations.
 *
 * Subscribes to AuditChain.onAppend and records a DriftAlert for every event
 * whose eventType is NOT in the broadcast allowlist. Complements the CI grep
 * gate (check-cognitive-snapshot-plaintext.mjs) with live monitoring.
 *
 * Design decisions (D-25a-16):
 *  - Observer-only: NEVER calls audit.append() — zero recursive risk.
 *  - Ring buffer capacity 256 with drop-oldest eviction (D-25a-17).
 *  - snapshot() uses non-destructive peek() — polling is idempotent.
 *  - Listener body wrapped in try/catch (defense-in-depth — AuditChain
 *    already swallows listener exceptions, but we add our own guard).
 *  - loadEntries() does NOT fire onAppend listeners; drift detection is live-only.
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry, Unsubscribe } from './types.js';
import { isAllowlisted } from './broadcast-allowlist.js';
import { RingBuffer } from '../util/ring-buffer.js';

// ── Public types ──────────────────────────────────────────────────────────

export interface DriftAlert {
    /** The non-allowlisted event type that was detected. */
    event_type: string;
    /** DID of the actor who emitted the event. */
    actor_did: string;
    /**
     * Simulation tick extracted from entry.payload['tick'].
     * Falls back to 0 if absent or non-numeric.
     */
    tick: number;
    /** AuditEntry.createdAt (Unix ms) of the offending entry. */
    detected_at: number;
}

// ── DriftDetector ─────────────────────────────────────────────────────────

export class DriftDetector {
    private readonly buffer: RingBuffer<DriftAlert>;
    private readonly unsubscribe: Unsubscribe;

    /**
     * @param audit    AuditChain to observe.
     * @param capacity Ring buffer capacity (default 256, D-25a-17).
     */
    constructor(audit: AuditChain, capacity = 256) {
        this.buffer = new RingBuffer<DriftAlert>(capacity);
        this.unsubscribe = audit.onAppend((entry: AuditEntry) => {
            try {
                if (isAllowlisted(entry.eventType)) return;
                const rawTick = (entry.payload as Record<string, unknown>)['tick'];
                const tick = typeof rawTick === 'number' && Number.isFinite(rawTick) ? rawTick : 0;
                this.buffer.push({
                    event_type: entry.eventType,
                    actor_did: entry.actorDid,
                    tick,
                    detected_at: entry.createdAt,
                });
            } catch {
                // Swallow — listener must never propagate into AuditChain.append().
            }
        });
    }

    /**
     * Non-destructive snapshot of buffered drift alerts in FIFO order.
     * Safe to call repeatedly — does not empty the buffer.
     */
    snapshot(): readonly DriftAlert[] {
        return this.buffer.peek();
    }

    /**
     * Unsubscribe from the audit chain. Idempotent — safe to call multiple times.
     * After close(), no new alerts are recorded regardless of subsequent appends.
     */
    close(): void {
        try {
            this.unsubscribe();
        } catch {
            /* swallow */
        }
    }
}
