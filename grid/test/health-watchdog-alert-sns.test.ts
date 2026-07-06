/**
 * Q3 (availability) — HealthWatchdog SNS alerting (email + SMS via AWS SNS).
 *
 * On a state TRANSITION to degraded/critical the watchdog publishes
 * {grid, status, reason, tick} to ALERT_SNS_TOPIC_ARN; the topic fans out to
 * email + SMS subscribers. The AWS SDK is dynamically imported ONLY when a topic
 * ARN is configured. Fire-and-forget: a rejected publish only Pino-warns; no-op
 * when the ARN is unset. Mirrors the W-D3 webhook test.
 */
import { describe, it, expect, vi } from 'vitest';
import { HealthWatchdog } from '../src/diagnostics/health-watchdog.js';
import type { AuditReconcile } from '../src/db/audit-reconcile.js';

// Hoisted spies shared with the mocked SDK module.
const h = vi.hoisted(() => ({
    send: vi.fn().mockResolvedValue({}),
    ctorArg: undefined as unknown,
}));

vi.mock('@aws-sdk/client-sns', () => ({
    SNSClient: vi.fn().mockImplementation((arg: unknown) => { h.ctorArg = arg; return { send: h.send }; }),
    PublishCommand: vi.fn().mockImplementation((input: unknown) => ({ input })),
}));

function makeFakeReconcile(): AuditReconcile {
    return { get lastReconcileAt() { return 1_999_000; }, get persistedMaxId() { return 10; }, get lastPersistError() { return null; } } as unknown as AuditReconcile;
}

function makeWatchdog(opts: { alertSnsTopicArn?: string; alertSnsRegion?: string } = {}): { wd: HealthWatchdog; chain: { length: number } } {
    const now = 2_000_000;
    const chain = { length: 10 };
    const wd = new HealthWatchdog(
        { auditReconcile: makeFakeReconcile(), clockState: () => ({ tick: 200, running: true }), auditChain: chain },
        { now: () => now, snapshotCadenceMs: 30_000, ...opts },
    );
    return { wd, chain };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('HealthWatchdog SNS alerting (Q3)', () => {
    it('publishes to the SNS topic once on ok→critical transition (not on repeat checks)', async () => {
        h.send.mockClear();
        const { wd, chain } = makeWatchdog({ alertSnsTopicArn: 'arn:aws:sns:us-east-1:1:noesis-alerts', alertSnsRegion: 'us-east-1' });

        expect(wd.snapshot().status).toBe('ok');
        chain.length = 400;                 // divergence 390 → critical
        expect(wd.snapshot().status).toBe('critical');
        await flush();

        expect(h.send).toHaveBeenCalledTimes(1);
        const cmd = h.send.mock.calls[0][0] as { input: { TopicArn: string; Message: string; Subject: string } };
        expect(cmd.input.TopicArn).toBe('arn:aws:sns:us-east-1:1:noesis-alerts');
        const msg = JSON.parse(cmd.input.Message) as { status: string; reason: string };
        expect(msg.status).toBe('critical');
        expect(msg.reason).toContain('divergence_above_critical');
        expect(h.ctorArg).toMatchObject({ region: 'us-east-1' });

        // repeat critical check → no second publish
        wd.snapshot();
        await flush();
        expect(h.send).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when no SNS topic is configured', async () => {
        h.send.mockClear();
        const { wd, chain } = makeWatchdog();   // no topic
        wd.snapshot();
        chain.length = 400;
        wd.snapshot();
        await flush();
        expect(h.send).not.toHaveBeenCalled();
    });
});
