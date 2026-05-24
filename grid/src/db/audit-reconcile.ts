/**
 * AuditReconcile — Phase 31 OBS-02 (D-31-C1..C4).
 *
 * Tick-cadenced belt-and-suspenders for PersistentAuditChain. Every 60 ticks
 * (≈30s at default tickRateMs):
 *   1. Queries SELECT MAX(id) FROM audit_trail WHERE grid_name = ?.
 *   2. Compares against chain.length.
 *   3. Replays any missing tail entries via store.append (INSERT IGNORE idempotent).
 *   4. Emits a structured Pino heartbeat — event 'audit_reconcile_ok' on every cycle
 *      (silence is itself a signal of pipeline stall, D-31-C1).
 *
 * Design invariants:
 *   - Always reconciles every cycle. The divergence > 10 threshold is alert-signal
 *     ONLY (changes log level from info to warn) — does NOT gate the work (D-31-C1).
 *   - Replay batch capped at REPLAY_BATCH_CAP per cycle (D-31-C2, R-31-02 mitigation).
 *     INSERT IGNORE makes subsequent cycles' catch-up safe.
 *   - run() never throws. Outer try/catch wraps the body (mirrors firehose-hub.ts
 *     onAuditEvent defense-in-depth). Inner try/catch around each store.append so
 *     one failed entry does not abort the remaining batch.
 *   - Tick-based cadence (D-31-C4) — if the clock is paused, reconcile pauses with
 *     it. Defensible: no new entries are appended while clock is paused either.
 *
 * Phase 32 will read launcher.auditReconcile.lastReconcileAt for /health/detailed.
 */

import type { AuditChain } from '../audit/chain.js';
import type { IAuditStore } from './types.js';
import type { DatabaseConnection } from './connection.js';
import { logger as baseLogger } from '../util/logger.js';

const log = baseLogger.child({ module: 'audit-reconcile' });

/** Per-cycle replay cap. Protects MySQL from a burst after a long outage (D-31-C2). */
export const REPLAY_BATCH_CAP = 500;

/** Divergence threshold above which heartbeat log level escalates info -> warn (D-31-C1). */
export const DIVERGENCE_WARN_THRESHOLD = 10;

export class AuditReconcile {
    private _lastReconcileAt = 0;
    private _persistedMaxId: number | null = null;
    private _lastPersistError: { code: string; at: number } | null = null;

    constructor(
        private readonly chain: AuditChain,
        private readonly store: IAuditStore,
        private readonly db: DatabaseConnection,
        private readonly gridName: string,
    ) {}

    /** Epoch ms of the last completed reconcile cycle. 0 until the first run. */
    get lastReconcileAt(): number {
        return this._lastReconcileAt;
    }

    /** Highest persisted id seen on the last successful MAX(id) query. Null until first run. */
    get persistedMaxId(): number | null {
        return this._persistedMaxId;
    }

    /**
     * Most recent replay-time persist failure. Sticky — does NOT clear on success
     * (D-31-C3 parallel to PersistentAuditChain.lastPersistError).
     */
    get lastPersistError(): { code: string; at: number } | null {
        return this._lastPersistError;
    }

    /**
     * Run one reconcile cycle. Idempotent. Fire-and-forget from the caller's
     * perspective — never throws.
     */
    async run(): Promise<void> {
        try {
            // 1. Query persisted MAX(id) — uses db.query (SELECT) not db.execute (DML/DDL).
            const rows = await this.db.query<{ max_id: number | string | bigint }>(
                'SELECT COALESCE(MAX(id), 0) AS max_id FROM audit_trail WHERE grid_name = ?',
                [this.gridName],
            );
            const dbMaxId = rows.length > 0 ? Number(rows[0].max_id) : 0;
            this._persistedMaxId = dbMaxId;

            const inMemoryLength = this.chain.length;
            // chain.length is monotonic and matches the max id (ids start at 1).
            const divergence = Math.max(0, inMemoryLength - dbMaxId);

            // 2. No-op fast path. Still log the heartbeat — silence is the alarm.
            if (divergence === 0) {
                this._lastReconcileAt = Date.now();
                log.info(
                    { event: 'audit_reconcile_ok', divergence: 0, replayed: 0, remaining: 0 },
                    'reconcile cycle complete',
                );
                return;
            }

            // 3. Replay missing tail. Cap at REPLAY_BATCH_CAP (D-31-C2).
            const allEntries = this.chain.all();
            const missing = allEntries
                .filter(e => (e.id ?? 0) > dbMaxId)
                .slice(0, REPLAY_BATCH_CAP);

            let replayed = 0;
            let failed = 0;
            for (const entry of missing) {
                try {
                    await this.store.append(this.gridName, entry);
                    replayed++;
                } catch (err: unknown) {
                    failed++;
                    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
                    this._lastPersistError = { code, at: Date.now() };
                    // Per-entry failure log at warn — replay continues for remaining entries.
                    log.warn(
                        {
                            event: 'audit_persist_failed',
                            entry_id: entry.id,
                            event_type: entry.eventType,
                            error_message: err instanceof Error ? err.message : String(err),
                            error_code: code,
                        },
                        'reconcile replay: failed to persist entry',
                    );
                }
            }

            const remaining = Math.max(0, divergence - replayed);
            this._lastReconcileAt = Date.now();

            // 4. Heartbeat: info if low divergence, warn if above threshold.
            const payload = {
                event: replayed > 0 ? 'audit_reconcile_replay' : 'audit_reconcile_ok',
                divergence,
                replayed,
                remaining,
                failed,
            };
            if (divergence > DIVERGENCE_WARN_THRESHOLD) {
                log.warn(payload, 'reconcile cycle: divergence above threshold');
            } else {
                log.info(payload, 'reconcile cycle complete');
            }
        } catch (err: unknown) {
            // Outermost defense-in-depth: a thrown reconcile must never crash the tick.
            // (Mirrors firehose-hub.ts onAuditEvent swallow.)
            this._lastReconcileAt = Date.now();
            const code = (err as { code?: string })?.code ?? 'UNKNOWN';
            this._lastPersistError = { code, at: Date.now() };
            log.error(
                {
                    event: 'audit_reconcile_failed',
                    error_message: err instanceof Error ? err.message : String(err),
                    error_code: code,
                },
                'reconcile body threw — recovered, will retry next cycle',
            );
        }
    }
}
