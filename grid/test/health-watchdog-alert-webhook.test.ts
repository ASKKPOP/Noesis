/**
 * W-D3 (Substrate Trust) — HealthWatchdog webhook alerting.
 *
 * The watchdog POSTs {grid, status, reason, tick} to ALERT_WEBHOOK_URL when the
 * overall status TRANSITIONS to degraded/critical — state change only, never on
 * repeat checks, no-op when the env/opt is unset, fire-and-forget (a rejected
 * fetch only Pino-warns), and recovery back to ok is still Pino-logged.
 *
 * Spy strategy mirrors grid/test/health-watchdog-transitions.test.ts:
 * vi.spyOn(logger, ...) intercepts the pino child logger; global fetch is
 * replaced via vi.stubGlobal with restore in finally.
 */

import { describe, it, expect, vi } from 'vitest';
import { logger } from '../src/util/logger.js';
import { HealthWatchdog } from '../src/diagnostics/health-watchdog.js';
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

/**
 * Watchdog whose divergence is driven by a mutable auditChain.length:
 * persistedMaxId is pinned at 10, so chain.length = 10 → divergence 0 (ok)
 * and chain.length = 400 → divergence 390 > 100 (critical).
 */
function makeWatchdog(opts: { alertWebhookUrl?: string; gridName?: string } = {}): {
    wd: HealthWatchdog;
    chain: { length: number };
} {
    const now = 2_000_000;
    const chain = { length: 10 };
    const wd = new HealthWatchdog(
        {
            auditReconcile: makeFakeReconcile({
                lastReconcileAt: now - 1000,
                persistedMaxId: 10,
            }),
            clockState: () => ({ tick: 200, running: true }),
            auditChain: chain,
        },
        { now: () => now, snapshotCadenceMs: 30_000, ...opts },
    );
    return { wd, chain };
}

// ── Alert webhook (W-D3) ─────────────────────────────────────────────────

describe('HealthWatchdog alert webhook (W-D3)', () => {
    it('fires exactly once on ok→critical transition, not on repeat critical checks', () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(logger, 'warn').mockImplementation(() => {});
        try {
            const { wd, chain } = makeWatchdog({
                alertWebhookUrl: 'http://alerts.test/hook',
                gridName: 'genesis',
            });

            // snapshot 1: ok — no alert.
            expect(wd.snapshot().status).toBe('ok');
            expect(fetchMock).not.toHaveBeenCalled();

            // snapshot 2: ok→critical — alert fires once.
            chain.length = 400;
            expect(wd.snapshot().status).toBe('critical');
            expect(fetchMock).toHaveBeenCalledTimes(1);

            const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('http://alerts.test/hook');
            expect(init.method).toBe('POST');
            expect(init.signal).toBeInstanceOf(AbortSignal);
            expect(JSON.parse(init.body as string)).toEqual({
                grid: 'genesis',
                status: 'critical',
                reason: 'divergence_above_critical',
                tick: 200,
            });

            // snapshots 3+4: still critical — no re-fire.
            wd.snapshot();
            wd.snapshot();
            expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
        }
    });

    it('does not fire when ALERT_WEBHOOK_URL is unset (default no-op)', () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(logger, 'warn').mockImplementation(() => {});
        try {
            delete process.env['ALERT_WEBHOOK_URL'];
            const { wd, chain } = makeWatchdog(); // no alertWebhookUrl opt, no env
            wd.snapshot();                        // ok
            chain.length = 400;
            expect(wd.snapshot().status).toBe('critical'); // ok→critical transition
            expect(fetchMock).not.toHaveBeenCalled();
        } finally {
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
        }
    });

    it('reads the URL from env ALERT_WEBHOOK_URL when no opt is given', () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('ALERT_WEBHOOK_URL', 'http://alerts.test/from-env');
        vi.spyOn(logger, 'warn').mockImplementation(() => {});
        try {
            const { wd, chain } = makeWatchdog();
            wd.snapshot();
            chain.length = 400;
            wd.snapshot();
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0]![0]).toBe('http://alerts.test/from-env');
        } finally {
            vi.unstubAllGlobals();
            vi.unstubAllEnvs();
            vi.restoreAllMocks();
        }
    });

    it('recovery critical→ok is Pino-logged (info) and sends no webhook', () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
        try {
            const { wd, chain } = makeWatchdog({ alertWebhookUrl: 'http://alerts.test/hook' });
            wd.snapshot();                 // ok
            chain.length = 400;
            wd.snapshot();                 // ok→critical: 1 webhook
            chain.length = 10;
            expect(wd.snapshot().status).toBe('ok'); // critical→ok: recovery
            expect(fetchMock).toHaveBeenCalledTimes(1); // no webhook for recovery
            expect(infoSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'health_status_changed',
                    from: 'critical',
                    to: 'ok',
                }),
                expect.any(String),
            );
        } finally {
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
        }
    });

    it('a rejected fetch is swallowed with a Pino warn — never throws', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
        vi.stubGlobal('fetch', fetchMock);
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        try {
            const { wd, chain } = makeWatchdog({ alertWebhookUrl: 'http://alerts.test/hook' });
            wd.snapshot();
            chain.length = 400;
            expect(() => wd.snapshot()).not.toThrow();
            await new Promise((r) => setTimeout(r, 0)); // let the .catch settle
            expect(warnSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'health_alert_webhook_failed',
                    error: 'ECONNREFUSED',
                }),
                expect.any(String),
            );
        } finally {
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
        }
    });
});
