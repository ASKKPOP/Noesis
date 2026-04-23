/**
 * PendingStore — in-memory per-recipient envelope queue.
 *
 * Phase 11 WHISPER-06 / D-11-05 / D-11-17 / CONTEXT-11.
 *
 * Holds pre-encrypted envelopes in a Map<recipient_did, Envelope[]>.
 * Persists nothing to disk — no fs, mysql, redis, or sqlite imports.
 * Per D-11-05: "No MySQL persistence of ciphertext."
 *
 * Lifecycle:
 *   - enqueue(env): appends to recipient's queue (creates array if missing)
 *   - drainFor(did): returns a frozen snapshot of the recipient's queue (no mutation)
 *   - ackDelete(did, envelopeIds): removes envelopes with matching envelope_id; returns count
 *   - evictDid(did): GC on bios.death — clears the recipient's entire queue AND
 *     scrubs any envelope where env.from_did === did from ALL recipient queues
 *   - size(): total envelope count across all recipients (Wave 3 metrics)
 *   - countFor(did): envelope count for a specific recipient (Wave 3 metrics)
 *   - dispose(): unsubscribes from audit.onAppend (test teardown)
 *
 * Constructor subscribes to the injected audit's onAppend hook. On receipt of
 * a 'bios.death' event, calls evictDid(payload.did) to GC tombstoned DIDs.
 * Pattern cloned from grid/src/relationships/storage.ts per-DID Map shape and
 * the audit.onAppend subscription pattern from grid/src/audit/chain.ts.
 *
 * NO fs, NO mysql, NO redis, NO sqlite imports — ephemeral by design.
 * NO Date.now, NO Math.random — wall-clock ban per D-11-13.
 *
 * See: 11-CONTEXT.md D-11-05, D-11-06, D-11-17. WHISPER-06.
 */

import type { AuditEntry } from '../audit/types.js';
import type { Envelope } from './types.js';

/**
 * Minimal interface for the injected audit hook.
 * Matches AuditChain.onAppend signature from grid/src/audit/chain.ts.
 */
export interface AuditOnAppend {
    onAppend(cb: (entry: AuditEntry) => void): () => void;
}

export class PendingStore {
    private readonly store = new Map<string, Envelope[]>();
    private readonly unsubscribe: () => void;

    /**
     * @param audit - injected audit chain; used to subscribe to bios.death events
     *   for GC of tombstoned DIDs. Pass the shared AuditChain instance.
     */
    constructor(audit: AuditOnAppend) {
        this.unsubscribe = audit.onAppend((entry: AuditEntry) => {
            if (
                entry.eventType === 'bios.death' &&
                typeof (entry.payload as Record<string, unknown>)?.['did'] === 'string'
            ) {
                const did = (entry.payload as Record<string, unknown>)['did'] as string;
                this.evictDid(did);
            }
        });
    }

    /**
     * Append envelope to the recipient's queue.
     * Creates a new array if the recipient has no queued envelopes.
     */
    enqueue(env: Envelope): void {
        const existing = this.store.get(env.to_did);
        if (existing) {
            existing.push(env);
        } else {
            this.store.set(env.to_did, [env]);
        }
    }

    /**
     * Returns a frozen snapshot of the recipient's queue.
     * Does NOT delete any envelopes — caller must ackDelete to confirm delivery.
     */
    drainFor(recipientDid: string): readonly Envelope[] {
        const envs = this.store.get(recipientDid);
        if (!envs || envs.length === 0) return Object.freeze([]);
        return Object.freeze([...envs]);
    }

    /**
     * Remove envelopes whose envelope_id is in envelopeIds.
     * @returns number of envelopes deleted
     */
    ackDelete(recipientDid: string, envelopeIds: ReadonlySet<string>): number {
        const envs = this.store.get(recipientDid);
        if (!envs) return 0;
        const before = envs.length;
        const filtered = envs.filter(e => !envelopeIds.has(e.envelope_id));
        const deleted = before - filtered.length;
        if (filtered.length === 0) {
            this.store.delete(recipientDid);
        } else {
            this.store.set(recipientDid, filtered);
        }
        return deleted;
    }

    /**
     * GC on bios.death — clears the recipient's entire queue AND scrubs
     * any envelope where env.from_did === did across ALL recipient queues.
     *
     * Called automatically by the bios.death audit listener (D-11-17).
     * Also callable directly for tests.
     */
    evictDid(did: string): void {
        // Clear the recipient queue for the tombstoned DID.
        this.store.delete(did);

        // Scrub sender-side: remove envelopes from_did === did from all queues.
        for (const [recipient, envs] of this.store) {
            const filtered = envs.filter(e => e.from_did !== did);
            if (filtered.length !== envs.length) {
                if (filtered.length === 0) {
                    this.store.delete(recipient);
                } else {
                    this.store.set(recipient, filtered);
                }
            }
        }
    }

    /**
     * Total envelope count across all recipient queues.
     * For the Wave 3 metrics endpoint GET /api/v1/operator/whisper/queues.
     */
    size(): number {
        let n = 0;
        for (const envs of this.store.values()) {
            n += envs.length;
        }
        return n;
    }

    /**
     * Envelope count for a specific recipient.
     * For the Wave 3 metrics endpoint.
     */
    countFor(did: string): number {
        return this.store.get(did)?.length ?? 0;
    }

    /**
     * Return a record of all DIDs with pending envelopes and their counts.
     * For the Wave 3 metrics endpoint GET /api/v1/whispers/metrics.
     * Returns only DIDs that have ≥1 envelope queued.
     */
    allDidsWithCounts(): Record<string, number> {
        const out: Record<string, number> = {};
        for (const [did, envs] of this.store) {
            if (envs.length > 0) {
                out[did] = envs.length;
            }
        }
        return out;
    }

    /**
     * Unsubscribe from audit.onAppend. Call in test teardown.
     */
    dispose(): void {
        this.unsubscribe();
    }
}
