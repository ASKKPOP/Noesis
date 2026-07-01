/**
 * Audit Chain — append-only, hash-chained event log.
 *
 * Each entry's hash covers the previous hash, creating a tamper-evident chain.
 * If any entry is modified or deleted, the chain breaks.
 */

import { createHash } from 'node:crypto';
import type { AuditEntry, AuditQuery, AppendListener, Unsubscribe } from './types.js';

const GENESIS_HASH = '0'.repeat(64);

export class AuditChain {
    private readonly entries: AuditEntry[] = [];
    private lastHash: string = GENESIS_HASH;
    private nextId = 1;
    private readonly appendListeners: Set<AppendListener> = new Set();

    /** Append a new event to the chain. */
    append(
        eventType: string,
        actorDid: string,
        payload: Record<string, unknown>,
        targetDid?: string,
    ): AuditEntry {
        const createdAt = Date.now();
        const prevHash = this.lastHash;

        const eventHash = AuditChain.computeHash(
            prevHash, eventType, actorDid, payload, createdAt,
        );

        const entry: AuditEntry = {
            id: this.nextId++,
            eventType,
            actorDid,
            targetDid,
            payload,
            prevHash,
            eventHash,
            createdAt,
        };

        // Commit FIRST — observers see a consistent chain.
        this.entries.push(entry);
        this.lastHash = eventHash;

        // Fan-out AFTER commit. Per-listener try/catch: a broken observer
        // must never corrupt chain state nor throw out of append().
        // (Mirrors WorldClock.onTick — see grid/src/clock/ticker.ts:55-61.)
        for (const listener of this.appendListeners) {
            try {
                listener(entry);
            } catch {
                // Swallow — see PITFALLS.md C1. Observability of listener
                // errors is deferred to Phase 2+ (per 01-CONTEXT.md decisions).
            }
        }

        return entry;
    }

    /**
     * Subscribe to append events. The listener fires synchronously AFTER
     * each append has committed (entry is already in `entries` and `head`
     * already reflects the new hash).
     *
     * Listener exceptions are swallowed — a thrown listener cannot corrupt
     * chain state nor reach the caller of append(). This matches the
     * WorldClock.onTick fire-and-forget contract.
     *
     * Returns an unsubscribe closure.
     *
     * NOTE: loadEntries() (restore path) does NOT fire listeners.
     */
    onAppend(listener: AppendListener): Unsubscribe {
        this.appendListeners.add(listener);
        return () => this.appendListeners.delete(listener);
    }

    /** Verify the integrity of the entire chain. */
    verify(): { valid: boolean; brokenAt?: number } {
        let expectedPrev = GENESIS_HASH;

        for (let i = 0; i < this.entries.length; i++) {
            const entry = this.entries[i];

            // Check prev_hash links correctly
            if (entry.prevHash !== expectedPrev) {
                return { valid: false, brokenAt: i };
            }

            // Recompute and verify event hash
            const recomputed = AuditChain.computeHash(
                entry.prevHash,
                entry.eventType,
                entry.actorDid,
                entry.payload,
                entry.createdAt,
            );

            if (entry.eventHash !== recomputed) {
                return { valid: false, brokenAt: i };
            }

            expectedPrev = entry.eventHash;
        }

        return { valid: true };
    }

    /** Query entries with optional filters. */
    query(q: AuditQuery = {}): AuditEntry[] {
        let results = this.entries;

        if (q.eventType) {
            results = results.filter(e => e.eventType === q.eventType);
        }
        if (q.actorDid) {
            results = results.filter(e => e.actorDid === q.actorDid);
        }
        if (q.targetDid) {
            results = results.filter(e => e.targetDid === q.targetDid);
        }

        const offset = q.offset ?? 0;
        const limit = q.limit ?? results.length;

        return results.slice(offset, offset + limit);
    }

    /** Get the last hash in the chain. */
    get head(): string {
        return this.lastHash;
    }

    /** Total entries in the chain. */
    get length(): number {
        return this.entries.length;
    }

    /** Get entry by index. */
    at(index: number): AuditEntry | undefined {
        return this.entries[index];
    }

    /** Return copies of all entries (used by GridStore.snapshot). */
    all(): AuditEntry[] {
        return this.entries.map(e => ({ ...e }));
    }

    /**
     * Load a pre-existing ordered set of entries into a fresh (empty) chain.
     * Restores lastHash and nextId so subsequent appends continue correctly.
     * Throws if the chain already contains entries — use only for restore.
     *
     * Does NOT fire append listeners — restore path is silent by design.
     */
    loadEntries(entries: AuditEntry[]): void {
        if (this.entries.length > 0) {
            throw new Error('Cannot loadEntries into a non-empty AuditChain');
        }
        for (const entry of entries) {
            this.entries.push({ ...entry });
        }
        if (entries.length > 0) {
            const last = entries[entries.length - 1];
            this.lastHash = last.eventHash;
            this.nextId   = (last.id ?? entries.length) + 1;
        }
    }

    /**
     * Order-independent JSON serialization for hashing.
     *
     * Object keys are sorted recursively so the output is byte-identical
     * regardless of key insertion order. This is REQUIRED for R-31-01: the
     * audit `payload` is persisted to a MySQL `JSON` column (see
     * grid/src/db/schema.ts), which normalizes (reorders) object keys on
     * storage. A plain JSON.stringify() over the reordered object read back on
     * restore (grid/src/db/stores/audit-store.ts:loadAll) would recompute a
     * different hash than the one stored at append time, so verify() would
     * report the chain broken after every container restart. Sorting keys makes
     * the hash survive the JSON round-trip.
     *
     * Arrays keep their order (order is semantically meaningful). A value change
     * anywhere still changes the output, so tamper-detection is preserved.
     */
    static stableStringify(value: unknown): string {
        if (value === null || typeof value !== 'object') {
            return JSON.stringify(value) ?? 'null';
        }
        if (Array.isArray(value)) {
            return '[' + value.map(v => AuditChain.stableStringify(v)).join(',') + ']';
        }
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        return '{' + keys.map(k => JSON.stringify(k) + ':' + AuditChain.stableStringify(obj[k])).join(',') + '}';
    }

    /** Compute SHA-256 hash for an entry. */
    static computeHash(
        prevHash: string,
        eventType: string,
        actorDid: string,
        payload: Record<string, unknown>,
        timestamp: number,
    ): string {
        const data = `${prevHash}|${eventType}|${actorDid}|${AuditChain.stableStringify(payload)}|${timestamp}`;
        return createHash('sha256').update(data).digest('hex');
    }
}
