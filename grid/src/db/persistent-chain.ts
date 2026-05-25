/**
 * PersistentAuditChain — extends AuditChain with live DB persistence.
 *
 * Every append() is mirrored to the store asynchronously (fire-and-forget).
 * The in-memory chain remains the authoritative source of truth for reads
 * and hash-chain verification.
 *
 * Phase 31 OBS-01/OBS-03 (D-31-B3, D-31-C3):
 *   - Store failures emit a structured Pino log entry (event='audit_persist_failed')
 *     — never silent `.catch(err => console.warn(...))`. CI gate
 *     `scripts/check-no-silent-catch.mjs` enforces this in grid/src/db/ and grid/src/audit/.
 *   - Last persist error is recorded in `_lastPersistError` and exposed via the
 *     `lastPersistError` getter. Phase 32's /health/detailed reads this getter to
 *     surface degraded state to operators.
 *
 * Zero-diff invariant (R-31-01): super.append() MUST be called FIRST so the
 * in-memory commit + listener fan-out (chain.ts:44-58) sees a consistent chain.
 * The fire-and-forget DB write happens AFTER, so listener observation order is
 * byte-identical with vs without DB attached. Regression test pinned in
 * grid/test/audit-persistence-wiring.test.ts.
 */

import { AuditChain } from '../audit/chain.js';
import type { IAuditStore } from './types.js';
import type { AuditEntry } from '../audit/types.js';
import { logger as baseLogger } from '../util/logger.js';

const log = baseLogger.child({ module: 'persistent-chain' });

export class PersistentAuditChain extends AuditChain {
    private _lastPersistError: { code: string; at: number } | null = null;
    private _lastPersistedId: number | null = null;

    constructor(
        private readonly store: IAuditStore,
        private readonly gridName: string,
    ) {
        super();
    }

    /**
     * Last DB persist failure record. Null until the first failure.
     * Set by the .catch() in append(); never cleared by successful writes
     * (operators read this to know "did we EVER fail recently?").
     * Phase 32's /health/detailed surfaces this in the audit block.
     */
    get lastPersistError(): { code: string; at: number } | null {
        return this._lastPersistError;
    }

    /**
     * Highest id known to have been successfully written to the store.
     * Null until the first successful write.
     *
     * Phase 34.2 FOLLOWUP-34-04: HealthWatchdog reads this in addition to
     * AuditReconcile.persistedMaxId (which only refreshes per reconcile cycle,
     * causing /health/detailed.audit.persisted_max_id to lag between cycles
     * even when sub-cadence PersistentAuditChain.append writes are succeeding).
     * Merging via Math.max gives operators a live view: divergence stays small
     * when persistence is healthy, only growing during real outages.
     *
     * Watermark semantics: only advances (entry.id > current) to tolerate
     * out-of-order Promise resolution from concurrent appends.
     */
    get lastPersistedId(): number | null {
        return this._lastPersistedId;
    }

    override append(
        eventType: string,
        actorDid: string,
        payload: Record<string, unknown>,
        targetDid?: string,
    ): AuditEntry {
        // Write to in-memory chain first (synchronous, source of truth).
        // Listener fan-out happens INSIDE super.append() before control returns.
        // R-31-01: DO NOT reorder — see grid/src/audit/chain.ts:44-58.
        const entry = super.append(eventType, actorDid, payload, targetDid);

        // Mirror to store asynchronously (fire-and-forget). On success: advance
        // lastPersistedId watermark. On failure: structured Pino log + record
        // lastPersistError for /health/detailed (Phase 32).
        this.store.append(this.gridName, entry).then(
            () => {
                // Watermark advance — tolerate out-of-order Promise resolution.
                if (entry.id !== undefined && (this._lastPersistedId === null || entry.id > this._lastPersistedId)) {
                    this._lastPersistedId = entry.id;
                }
            },
            (err: unknown) => {
                const code = (err as { code?: string })?.code ?? 'UNKNOWN';
                this._lastPersistError = { code, at: Date.now() };
                log.warn({
                    event: 'audit_persist_failed',
                    entry_id: entry.id,
                    event_type: eventType,
                    error_message: err instanceof Error ? err.message : String(err),
                    error_code: code,
                }, 'failed to persist audit entry');
            },
        );

        return entry;
    }
}
