/**
 * Phase 32 OBS-07 HealthWatchdog transitions + grace + idempotency.
 *
 * Spy strategy: vi.spyOn(logger, 'warn') / vi.spyOn(logger, 'info') with
 * try/finally restoreAllMocks. Pino child loggers share the prototype warn/info
 * reference with the base logger, so the spy intercepts calls from inside
 * health-watchdog.ts without source-file modification. Pattern proven by
 * grid/test/audit-reconcile.test.ts (Phase 31).
 */

import { describe, it, expect, vi } from 'vitest';
import { logger } from '../src/util/logger.js';
import {
    HealthWatchdog,
    HEALTH_THRESHOLDS,
    computeStatus,
} from '../src/diagnostics/health-watchdog.js';
import type { AuditReconcile } from '../src/db/audit-reconcile.js';

// ── Fakes ────────────────────────────────────────────────────────────────

function makeFakeReconcile(opts: {
    lastReconcileAt?: number;
    persistedMaxId?: number | null;
    lastPersistError?: { code: string; at: number } | null;
}): AuditReconcile {
    return {
        get lastReconcileAt() {
            return opts.lastReconcileAt ?? 0;
        },
        get persistedMaxId() {
            return opts.persistedMaxId ?? null;
        },
        get lastPersistError() {
            return opts.lastPersistError ?? null;
        },
    } as unknown as AuditReconcile;
}

// ── HEALTH_THRESHOLDS (D-32-C1) ──────────────────────────────────────────

describe('HEALTH_THRESHOLDS (D-32-C1)', () => {
    it('constants have the locked values', () => {
        expect(HEALTH_THRESHOLDS.DIVERGENCE_DEGRADED).toBe(10);
        expect(HEALTH_THRESHOLDS.DIVERGENCE_CRITICAL).toBe(100);
        expect(HEALTH_THRESHOLDS.STALE_FRAME_MS).toBe(60_000);
        expect(HEALTH_THRESHOLDS.RECONCILE_STALE_MULTIPLIER).toBe(5);
    });

    it('is frozen — mutation attempts are rejected (strict mode throws)', () => {
        expect(Object.isFrozen(HEALTH_THRESHOLDS)).toBe(true);
    });
});

// ── computeStatus (D-32-C2) ──────────────────────────────────────────────

describe('computeStatus (D-32-C2)', () => {
    const baseInput = {
        auditDivergence: 0,
        auditLastPersistError: null,
        firehoseLastFrameAt: null,
        firehoseClientCount: 0,
        reconcileStaleMs: null,
        now: 1_000_000,
        snapshotCadenceMs: 30_000,
        gracePeriodActive: false,
    };

    it('grace period returns ok regardless of other inputs', () => {
        const r = computeStatus({
            ...baseInput,
            gracePeriodActive: true,
            auditDivergence: 5000, // would normally be critical
            auditLastPersistError: { code: 'BOOM', at: 0 },
        });
        expect(r.status).toBe('ok');
        expect(r.reasons).toEqual(['grace_period']);
    });

    it('divergence > DIVERGENCE_CRITICAL (100) → critical', () => {
        const r = computeStatus({ ...baseInput, auditDivergence: 200 });
        expect(r.status).toBe('critical');
        expect(r.reasons).toContain('divergence_above_critical');
    });

    it('persistError AND divergence>0 → critical (D-32-C2 second critical clause)', () => {
        const r = computeStatus({
            ...baseInput,
            auditDivergence: 5,
            auditLastPersistError: { code: 'ECONNREFUSED', at: 1 },
        });
        expect(r.status).toBe('critical');
        expect(r.reasons).toContain('persist_error_with_divergence');
    });

    it('divergence > DIVERGENCE_DEGRADED (10) → degraded', () => {
        const r = computeStatus({ ...baseInput, auditDivergence: 50 });
        expect(r.status).toBe('degraded');
        expect(r.reasons).toContain('divergence_above_degraded');
    });

    it('client_count > 0 AND last_frame_at null → degraded (no_frames_with_clients)', () => {
        const r = computeStatus({
            ...baseInput,
            firehoseClientCount: 1,
            firehoseLastFrameAt: null,
        });
        expect(r.status).toBe('degraded');
        expect(r.reasons).toContain('no_frames_with_clients');
    });

    it('stale frames with clients → degraded (now - last_frame_at > STALE_FRAME_MS)', () => {
        const r = computeStatus({
            ...baseInput,
            firehoseClientCount: 1,
            firehoseLastFrameAt: 1_000_000 - 120_000, // 120s ago > 60s
        });
        expect(r.status).toBe('degraded');
        expect(r.reasons).toContain('stale_frames');
    });

    it('reconcile stale beyond multiplier → degraded', () => {
        const r = computeStatus({
            ...baseInput,
            reconcileStaleMs: 6 * 30_000, // 6x cadence > 5x threshold
        });
        expect(r.status).toBe('degraded');
        expect(r.reasons).toContain('reconcile_stale');
    });

    it('all-clean → ok with empty reasons', () => {
        const r = computeStatus(baseInput);
        expect(r.status).toBe('ok');
        expect(r.reasons).toEqual([]);
    });
});

// ── HealthWatchdog snapshot + transitions (D-32-B3, D-32-B4, D-32-E2) ────

describe('HealthWatchdog snapshot + transition logging (D-32-B3, D-32-B4)', () => {
    it('cold-start grace: tick<60 returns ok with audit timestamps null', () => {
        const wd = new HealthWatchdog(
            {
                auditReconcile: makeFakeReconcile({
                    lastReconcileAt: 0,
                    persistedMaxId: null,
                }),
                clockState: () => ({ tick: 5, running: true }),
            },
            { now: () => 1_000_000, snapshotCadenceMs: 30_000 },
        );
        const snap = wd.snapshot();
        expect(snap.status).toBe('ok');
        expect(snap.audit.last_persist_attempt_at).toBeNull();
        expect(snap.audit.divergence).toBeNull();
        expect(snap.clock.tick).toBe(5);
    });

    it('warn fires on ok→degraded transition', () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        try {
            let now = 2_000_000;
            const wd = new HealthWatchdog(
                {
                    auditReconcile: makeFakeReconcile({
                        lastReconcileAt: now - 1000,
                        persistedMaxId: 10,
                    }),
                    clockState: () => ({ tick: 200, running: true }),
                },
                { now: () => now, snapshotCadenceMs: 30_000 },
            );
            // 1st snapshot: ok (no clients, no divergence).
            wd.attachFirehoseStats(() => ({
                client_count: 0,
                frames_sent_total: 0,
                frames_dropped_total: 0,
                last_frame_at: null,
                watermark_bytes: 0,
            }));
            wd.snapshot();
            expect(warnSpy).not.toHaveBeenCalled();

            // 2nd snapshot: degrade via reconcile stale (now jumps forward).
            now = 2_000_000 + 6 * 30_000 + 1; // > 5x cadence stale
            wd.snapshot();
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'health_status_changed',
                    from: 'ok',
                    to: 'degraded',
                }),
                expect.any(String),
            );
            expect(infoSpy).not.toHaveBeenCalled();
        } finally {
            vi.restoreAllMocks();
        }
    });

    it('info (not warn) fires on degraded→ok recovery', () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        try {
            const now = 3_000_000;
            const dynamicReconcile = {
                _t: 1,
                get lastReconcileAt() { return this._t; },
                get persistedMaxId() { return 10; },
                get lastPersistError() { return null; },
            };
            const wd2 = new HealthWatchdog(
                {
                    auditReconcile: dynamicReconcile as unknown as AuditReconcile,
                    clockState: () => ({ tick: 200, running: true }),
                },
                { now: () => now, snapshotCadenceMs: 30_000 },
            );
            // snapshot 1: degraded (lastReconcileAt = 1, very stale).
            wd2.snapshot();
            // snapshot 2: ok (bump lastReconcileAt to now-1000).
            dynamicReconcile._t = now - 1000;
            wd2.snapshot();

            expect(infoSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'health_status_changed',
                    from: 'degraded',
                    to: 'ok',
                }),
                expect.any(String),
            );
        } finally {
            vi.restoreAllMocks();
        }
    });

    it('does NOT log on consecutive ok→ok snapshots', () => {
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        try {
            const now = 4_000_000;
            const wd = new HealthWatchdog(
                {
                    auditReconcile: makeFakeReconcile({ lastReconcileAt: now - 1000, persistedMaxId: 10 }),
                    clockState: () => ({ tick: 200, running: true }),
                },
                { now: () => now, snapshotCadenceMs: 30_000 },
            );
            wd.snapshot();
            wd.snapshot();
            wd.snapshot();
            expect(warnSpy).not.toHaveBeenCalled();
            expect(infoSpy).not.toHaveBeenCalled();
        } finally {
            vi.restoreAllMocks();
        }
    });
});

// ── Idempotent attach (D-32-E2) ──────────────────────────────────────────

describe('HealthWatchdog.attachFirehoseStats idempotency (D-32-E2)', () => {
    it('returns all-zeros firehose block before attach', () => {
        const wd = new HealthWatchdog(
            {
                auditReconcile: undefined,
                clockState: () => ({ tick: 200, running: true }),
            },
            { now: () => 5_000_000, snapshotCadenceMs: 30_000 },
        );
        const snap = wd.snapshot();
        expect(snap.firehose).toEqual({
            client_count: 0,
            frames_sent_total: 0,
            frames_dropped_total: 0,
            last_frame_at: null,
            watermark_bytes: 0,
        });
    });

    it('throws on second attach', () => {
        const wd = new HealthWatchdog(
            {
                auditReconcile: undefined,
                clockState: () => ({ tick: 200, running: true }),
            },
        );
        wd.attachFirehoseStats(() => ({
            client_count: 1,
            frames_sent_total: 1,
            frames_dropped_total: 0,
            last_frame_at: 1,
            watermark_bytes: 1,
        }));
        expect(() => wd.attachFirehoseStats(() => ({
            client_count: 0,
            frames_sent_total: 0,
            frames_dropped_total: 0,
            last_frame_at: null,
            watermark_bytes: 0,
        }))).toThrow(/already attached/);
    });
});
