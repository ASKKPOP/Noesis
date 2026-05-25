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
}

interface HealthWatchdogOpts {
    now?: () => number;
    snapshotCadenceMs?: number;
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

    constructor(
        private readonly deps: HealthWatchdogDeps,
        opts: HealthWatchdogOpts = {},
    ) {
        this.nowFn = opts.now ?? Date.now;
        this.snapshotCadenceMs = opts.snapshotCadenceMs ?? 30_000;
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

        // Cold-start grace (D-32-B4): no reconcile cycle has yet had a chance to run.
        const gracePeriodActive = clock.tick < 60;

        // Audit block — null fields when reconcile is absent (no DB) or grace active.
        const auditPersistError = reconcile?.lastPersistError ?? null;
        const persistedMaxId = reconcile?.persistedMaxId ?? null;
        const lastReconcileAt = reconcile?.lastReconcileAt ?? 0;

        // in_memory_length: the AuditReconcile contract does not expose this directly
        // in Phase 31 (see D-31-C3); deriving it here would require a chain reference.
        // For Phase 32 the field is exposed as null when reconcile is absent and as
        // persistedMaxId when present (best-effort cached value). Refinement to a
        // live chain.length read is deferred to Phase 34 if the Steward card needs it.
        const inMemoryLength: number | null = persistedMaxId;
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
            }
        }
        this.lastStatus = status;

        return {
            status,
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
