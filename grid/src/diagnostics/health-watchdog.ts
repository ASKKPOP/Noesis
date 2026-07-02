/**
 * HealthWatchdog — pure-pull health snapshot computer (Phase 32 OBS-07).
 *
 * Pure-pull design (D-32-B1): no timer, no clock subscription.
 * `snapshot()` is invoked synchronously by the /health/detailed route handler
 * per request. R-32-02 (interval lifecycle) is trivially satisfied because
 * no interval exists.
 *
 * Logging discipline (D-32-B3): state-transition events only. WARN on
 * ok→degraded/critical, INFO on degrading→ok. Never log every snapshot call.
 *
 * Cold-start grace (D-32-B4): clock.state.tick < 60 returns status='ok' with
 * audit timestamps null. Avoids paging on a fresh boot for the first ≈30s.
 *
 * Threshold values (D-32-C1) are FROZEN module-level export; not
 * deployment-tunable. Changing them requires a CONTEXT.md update.
 *
 * Cross-phase API contract: snapshot() return shape is FROZEN at Phase 32 close.
 * Phase 34 (Steward /system) consumes this payload via /health/detailed.
 */

import type { AuditReconcile } from '../db/audit-reconcile.js';
import type { FirehoseStats } from '../audit/firehose-hub.js';
import { logger as baseLogger } from '../util/logger.js';

const log = baseLogger.child({ module: 'health-watchdog' });

// ── Frozen thresholds (D-32-C1) ───────────────────────────────────────────

/**
 * Phase 32 OBS-07 (D-32-C1): frozen thresholds. NOT deployment-tunable —
 * values are policy locked at CONTEXT.md, change requires a SPEC change.
 *
 * - DIVERGENCE_DEGRADED: audit.divergence > 10 → status='degraded'
 * - DIVERGENCE_CRITICAL: audit.divergence > 100 → status='critical'
 * - STALE_FRAME_MS: (now - last_frame_at) > 60_000 AND client_count > 0 → degraded
 * - RECONCILE_STALE_MULTIPLIER: (now - last_reconcile_at) > (5 × snapshotCadenceMs) → degraded
 */
export const HEALTH_THRESHOLDS = Object.freeze({
    DIVERGENCE_DEGRADED: 10,
    DIVERGENCE_CRITICAL: 100,
    STALE_FRAME_MS: 60_000,
    RECONCILE_STALE_MULTIPLIER: 5,
} as const);

// ── Payload shape (D-32-C3, OBS-06 contract) ──────────────────────────────

export type HealthStatus = 'ok' | 'degraded' | 'critical';

/**
 * Minimal clock shape HealthWatchdog reads at snapshot time.
 * Only `tick` and `running` are consumed — avoids pulling the full
 * ClockState surface (which lives in clock/types.ts and does not expose `running`
 * as a field — `running` is a getter on WorldClock itself).
 */
export interface ClockSnapshot {
    readonly tick: number;
    readonly running: boolean;
}

/**
 * The /health/detailed payload (OBS-06 contract). FROZEN at Phase 32 close —
 * additive changes only after that point.
 */
export interface HealthDetailedPayload {
    readonly status: HealthStatus;
    readonly reasons: readonly string[];
    readonly timestamp: number;
    readonly audit: {
        readonly in_memory_length: number | null;
        readonly persisted_max_id: number | null;
        readonly divergence: number | null;
        readonly divergence_threshold: number;
        readonly last_persist_attempt_at: number | null;
        readonly last_persist_error: { readonly code: string; readonly at: number } | null;
    };
    readonly firehose: FirehoseStats;
    readonly clock: {
        readonly tick: number;
        readonly running: boolean;
        readonly last_tick_at: number | null;
    };
}

// ── Pure status helper (D-32-C2) ──────────────────────────────────────────

interface ComputeStatusInput {
    auditDivergence: number | null;
    auditLastPersistError: { code: string; at: number } | null;
    firehoseLastFrameAt: number | null;
    firehoseClientCount: number;
    reconcileStaleMs: number | null;
    now: number;
    snapshotCadenceMs: number;
    gracePeriodActive: boolean;
}

interface ComputeStatusResult {
    status: HealthStatus;
    reasons: string[];
}

/**
 * Pure status decision. Evaluation order: grace → critical → degraded → ok.
 * `reasons` array exposes which conditions triggered (consumed by the warn log,
 * NOT exposed in the route payload — that stays per the OBS-06 shape).
 */
export function computeStatus(input: ComputeStatusInput): ComputeStatusResult {
    const reasons: string[] = [];

    // 1. Grace period — fresh boot, no reconcile cycle has run yet.
    if (input.gracePeriodActive) {
        return { status: 'ok', reasons: ['grace_period'] };
    }

    // 2. Critical conditions.
    if (input.auditDivergence !== null && input.auditDivergence > HEALTH_THRESHOLDS.DIVERGENCE_CRITICAL) {
        reasons.push('divergence_above_critical');
    }
    if (
        input.auditLastPersistError !== null &&
        input.auditDivergence !== null &&
        input.auditDivergence > 0
    ) {
        reasons.push('persist_error_with_divergence');
    }
    if (reasons.length > 0) {
        return { status: 'critical', reasons };
    }

    // 3. Degraded conditions.
    if (input.auditDivergence !== null && input.auditDivergence > HEALTH_THRESHOLDS.DIVERGENCE_DEGRADED) {
        reasons.push('divergence_above_degraded');
    }
    if (input.firehoseClientCount > 0 && input.firehoseLastFrameAt === null) {
        reasons.push('no_frames_with_clients');
    }
    if (
        input.firehoseClientCount > 0 &&
        input.firehoseLastFrameAt !== null &&
        input.now - input.firehoseLastFrameAt > HEALTH_THRESHOLDS.STALE_FRAME_MS
    ) {
        reasons.push('stale_frames');
    }
    if (
        input.reconcileStaleMs !== null &&
        input.reconcileStaleMs > HEALTH_THRESHOLDS.RECONCILE_STALE_MULTIPLIER * input.snapshotCadenceMs
    ) {
        reasons.push('reconcile_stale');
    }
    if (reasons.length > 0) {
        return { status: 'degraded', reasons };
    }

    return { status: 'ok', reasons: [] };
}

// ── HealthWatchdog class (D-32-B1, D-32-B2, D-32-B3, D-32-B5, D-32-E2, D-32-F1) ──

interface HealthWatchdogDeps {
    auditReconcile: AuditReconcile | undefined;
    clockState: () => ClockSnapshot;
    /**
     * Phase 34.1 FOLLOWUP-34-01 + FOLLOWUP-34-02:
     * Optional live AuditChain reference. When present:
     *   - `chain.length` is the source of truth for in_memory_length (replaces the
     *     Phase 32 fallback `inMemoryLength = persistedMaxId`, which made divergence
     *     permanently 0 by construction).
     *   - `chain.lastPersistError` (only present on PersistentAuditChain) is merged
     *     with AuditReconcile.lastPersistError, taking the most recent by `.at`
     *     timestamp. This surfaces tick-time persist failures in /health/detailed
     *     even before the reconcile loop has run a cycle (Phase 31 fires Pino logs
     *     on every persist failure; Phase 34.1 fixes the gap that hid them from
     *     /health/detailed).
     * When absent (legacy tests, no-DB launchers): falls back to Phase 32 behavior.
     */
    auditChain?: {
        readonly length: number;
        readonly lastPersistError?: { code: string; at: number } | null;
        /**
         * Phase 34.2 FOLLOWUP-34-04: live watermark of highest id successfully
         * written to the store. Only present on PersistentAuditChain (not plain
         * AuditChain). Merged with AuditReconcile.persistedMaxId via Math.max
         * to give /health/detailed a live persistence view between reconcile
         * cycles (60-tick cadence ≈ 17 min would otherwise leave the cached
         * value stale despite sub-cadence writes succeeding).
         */
        readonly lastPersistedId?: number | null;
    };
}

interface HealthWatchdogOpts {
    now?: () => number;
    snapshotCadenceMs?: number;
    /**
     * W-D3 alert hook: Grid name included in the webhook payload.
     * Defaults to env GRID_NAME, then 'genesis'.
     */
    gridName?: string;
    /**
     * W-D3 alert hook: webhook URL POSTed on transitions to degraded/critical.
     * Defaults to env ALERT_WEBHOOK_URL. Unset → alerting is a no-op.
     */
    alertWebhookUrl?: string;
}

/**
 * Pure-pull health snapshot computer. No timer. No subscriptions.
 * Stored as a one-shot-settable field on GenesisLauncher (Plan 04, D-32-G2).
 * Wired into /health/detailed route by Plan 04.
 */
export class HealthWatchdog {
    private lastStatus: HealthStatus | null = null;
    private _firehoseStatsFn: (() => FirehoseStats) | null = null;
    private readonly nowFn: () => number;
    private readonly snapshotCadenceMs: number;
    private readonly gridName: string;
    private readonly alertWebhookUrl: string | undefined;

    constructor(
        private readonly deps: HealthWatchdogDeps,
        opts: HealthWatchdogOpts = {},
    ) {
        this.nowFn = opts.now ?? Date.now;
        this.snapshotCadenceMs = opts.snapshotCadenceMs ?? 30_000;
        this.gridName = opts.gridName ?? process.env['GRID_NAME'] ?? 'genesis';
        this.alertWebhookUrl = opts.alertWebhookUrl ?? process.env['ALERT_WEBHOOK_URL'];
    }

    /**
     * W-D3 alert hook: POST {grid, status, reason, tick} to ALERT_WEBHOOK_URL on
     * a state TRANSITION to degraded/critical. Fire-and-forget — a failed or slow
     * webhook (5s abort) only Pino-warns; it never throws and never blocks the
     * health loop. No-op when the URL is unset (default).
     */
    private postAlert(status: HealthStatus, reasons: readonly string[], tick: number): void {
        if (this.alertWebhookUrl === undefined || this.alertWebhookUrl === '') return;
        fetch(this.alertWebhookUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                grid: this.gridName,
                status,
                reason: reasons.join(','),
                tick,
            }),
            signal: AbortSignal.timeout(5_000),
        }).catch((err: unknown) => {
            log.warn(
                {
                    event: 'health_alert_webhook_failed',
                    status,
                    error: err instanceof Error ? err.message : String(err),
                },
                'alert webhook POST failed',
            );
        });
    }

    /**
     * Idempotent attach (D-32-E2). Wires the FirehoseStats getter lazily because
     * the firehose hub is constructed AFTER the watchdog in buildServerWithHub
     * (D-32-G1 ordering).
     */
    attachFirehoseStats(fn: () => FirehoseStats): void {
        if (this._firehoseStatsFn !== null) {
            throw new Error('HealthWatchdog.attachFirehoseStats already attached');
        }
        this._firehoseStatsFn = fn;
    }

    /**
     * Compute the full payload. Pure-pull — invoked per request.
     * State-transition logs fire as a side effect when status changes.
     */
    snapshot(): HealthDetailedPayload {
        const now = this.nowFn();
        const clock = this.deps.clockState();
        const reconcile = this.deps.auditReconcile;
        const auditChain = this.deps.auditChain;

        // Cold-start grace (D-32-B4): no reconcile cycle has yet had a chance to run.
        const gracePeriodActive = clock.tick < 60;

        // Phase 34.1 FOLLOWUP-34-02: merge persist errors from both sources, prefer most
        // recent by .at timestamp. PersistentAuditChain.lastPersistError fires on every
        // tick failure (sub-cadence visibility); AuditReconcile.lastPersistError fires
        // on replay failure (per-reconcile-cycle visibility). Phase 32 only consumed
        // reconcile's getter, which masked tick-time failures from /health/detailed.
        const reconcileError = reconcile?.lastPersistError ?? null;
        const chainError = auditChain?.lastPersistError ?? null;
        const auditPersistError = ((): { code: string; at: number } | null => {
            if (reconcileError === null) return chainError;
            if (chainError === null) return reconcileError;
            return chainError.at >= reconcileError.at ? chainError : reconcileError;
        })();
        // Phase 34.2 FOLLOWUP-34-04: merge persistedMaxId from both sources via Math.max.
        // reconcile.persistedMaxId is only refreshed per reconcile cycle (60-tick cadence ≈ 17 min);
        // auditChain.lastPersistedId is the live watermark advanced on every successful
        // PersistentAuditChain.append store write. Taking max gives a live view between
        // reconcile cycles — divergence visualization no longer lags during normal operation.
        const reconcilePersistedMaxId = reconcile?.persistedMaxId ?? null;
        const chainLastPersistedId = auditChain?.lastPersistedId ?? null;
        const persistedMaxId = ((): number | null => {
            if (reconcilePersistedMaxId === null) return chainLastPersistedId;
            if (chainLastPersistedId === null) return reconcilePersistedMaxId;
            return Math.max(reconcilePersistedMaxId, chainLastPersistedId);
        })();
        const lastReconcileAt = reconcile?.lastReconcileAt ?? 0;

        // Phase 34.1 FOLLOWUP-34-01: read in_memory_length from the live AuditChain when
        // injected. Phase 32 fell back to `inMemoryLength = persistedMaxId` because the
        // chain reference wasn't plumbed through; that fallback made divergence permanently
        // 0 by construction and broke the Steward Audit Pipeline Health amber/red band.
        // When auditChain is absent (legacy tests, no-DB launchers): preserve Phase 32
        // fallback (in_memory_length === persisted_max_id → divergence === 0).
        const inMemoryLength: number | null = auditChain !== undefined
            ? auditChain.length
            : persistedMaxId;
        const divergence: number | null = gracePeriodActive
            ? null
            : inMemoryLength !== null && persistedMaxId !== null
                ? Math.max(0, inMemoryLength - persistedMaxId)
                : null;

        const reconcileStaleMs: number | null =
            !gracePeriodActive && lastReconcileAt > 0 ? now - lastReconcileAt : null;

        // Firehose block — all-zeros sentinel before attachFirehoseStats.
        const firehose: FirehoseStats = this._firehoseStatsFn
            ? this._firehoseStatsFn()
            : {
                  client_count: 0,
                  frames_sent_total: 0,
                  frames_dropped_total: 0,
                  last_frame_at: null,
                  watermark_bytes: 0,
              };

        const { status, reasons } = computeStatus({
            auditDivergence: divergence,
            auditLastPersistError: auditPersistError,
            firehoseLastFrameAt: firehose.last_frame_at,
            firehoseClientCount: firehose.client_count,
            reconcileStaleMs,
            now,
            snapshotCadenceMs: this.snapshotCadenceMs,
            gracePeriodActive,
        });

        // State-transition log (D-32-B3) — fires only when status changes.
        if (this.lastStatus !== null && this.lastStatus !== status) {
            const payload = {
                event: 'health_status_changed',
                from: this.lastStatus,
                to: status,
                reasons,
            };
            if (status === 'ok') {
                log.info(payload, 'health recovered');
            } else {
                log.warn(payload, 'health degraded');
                // W-D3: webhook alert on the transition only (never on repeat checks).
                this.postAlert(status, reasons, clock.tick);
            }
        }
        this.lastStatus = status;

        return {
            status,
            reasons,
            timestamp: now,
            audit: {
                in_memory_length: gracePeriodActive ? null : inMemoryLength,
                persisted_max_id: persistedMaxId,
                divergence,
                divergence_threshold: HEALTH_THRESHOLDS.DIVERGENCE_DEGRADED,
                last_persist_attempt_at: gracePeriodActive ? null : (lastReconcileAt || null),
                last_persist_error: auditPersistError,
            },
            firehose,
            clock: {
                tick: clock.tick,
                running: clock.running,
                last_tick_at: null, // Refined in Phase 34 if Steward needs it; null is the v2.6 minimum.
            },
        };
    }
}
