import { describe, it, expect, afterEach, vi } from 'vitest';
import { GenesisLauncher } from '../../src/genesis/launcher.js';
import { TEST_CONFIG } from '../../src/genesis/presets.js';
import { payloadPrivacyCheck } from '../../src/audit/broadcast-allowlist.js';
import type { AuditEntry } from '../../src/audit/types.js';

function makeLauncher(overrides: Partial<typeof TEST_CONFIG> = {}): GenesisLauncher {
    return new GenesisLauncher({
        ...TEST_CONFIG,
        tickRateMs: 10,
        ticksPerEpoch: 1000,
        ...overrides,
    });
}

describe('GenesisLauncher — tick audit emission', () => {
    let launcher: GenesisLauncher | undefined;

    afterEach(() => {
        launcher?.stop();
        launcher = undefined;
        vi.useRealTimers();
    });

    it('appends exactly one tick audit entry per clock advance (manual ticks)', () => {
        launcher = makeLauncher();
        launcher.bootstrap();

        const preTickEntries = launcher.audit.query({ eventType: 'tick' }).length;
        const preLength = launcher.audit.length;

        // Manually advance 3 times — the cleanest way to assert exact count.
        launcher.clock.advance();
        launcher.clock.advance();
        launcher.clock.advance();

        const tickEntries = launcher.audit.query({ eventType: 'tick' });
        expect(tickEntries.length - preTickEntries).toBe(3);
        // Total chain growth must equal the tick entries (no other appends triggered by onTick).
        expect(launcher.audit.length - preLength).toBe(3);
    });

    it('tick payload shape is stable and contains only {tick, epoch, tickRateMs, timestamp}', () => {
        launcher = makeLauncher({ tickRateMs: 10 });
        launcher.bootstrap();

        launcher.clock.advance();

        const tickEntries = launcher.audit.query({ eventType: 'tick' });
        expect(tickEntries).toHaveLength(1);

        const entry = tickEntries[0];
        expect(entry.actorDid).toBe('system');
        expect(Object.keys(entry.payload).sort()).toEqual(
            ['epoch', 'tick', 'tickRateMs', 'timestamp'].sort(),
        );
        expect(typeof entry.payload.tick).toBe('number');
        expect(typeof entry.payload.epoch).toBe('number');
        expect(typeof entry.payload.tickRateMs).toBe('number');
        expect(entry.payload.tickRateMs).toBe(10);
        expect(typeof entry.payload.timestamp).toBe('number');
        expect(Math.abs((entry.payload.timestamp as number) - Date.now())).toBeLessThan(1000);
    });

    it('tick audit payload respects privacy allowlist', () => {
        launcher = makeLauncher();
        launcher.bootstrap();
        launcher.clock.advance();

        const tickEntries = launcher.audit.query({ eventType: 'tick' });
        expect(tickEntries).toHaveLength(1);
        const result = payloadPrivacyCheck(tickEntries[0].payload);
        expect(result.ok).toBe(true);
    });

    it('is idempotent against observer listener count (hash chain unchanged)', () => {
        // Run A: no extra listeners.
        const launcherA = makeLauncher();
        launcherA.bootstrap();
        for (let i = 0; i < 100; i++) launcherA.clock.advance();
        const headA = launcherA.audit.head;
        const lengthA = launcherA.audit.length;
        launcherA.stop();

        // Run B: 3 no-op onAppend listeners attached before ticks.
        const launcherB = makeLauncher();
        launcherB.bootstrap();
        const noop = (_e: AuditEntry): void => { /* no-op observer */ };
        launcherB.audit.onAppend(noop);
        launcherB.audit.onAppend(noop);
        launcherB.audit.onAppend(noop);
        for (let i = 0; i < 100; i++) launcherB.clock.advance();
        const headB = launcherB.audit.head;
        const lengthB = launcherB.audit.length;
        launcherB.stop();

        expect(lengthB).toBe(lengthA);
        expect(headB).toBe(headA);
    });

    it('timer-driven ticks also produce audit entries', () => {
        vi.useFakeTimers();
        launcher = makeLauncher({ tickRateMs: 10 });
        launcher.bootstrap();
        launcher.start();

        const preTicks = launcher.audit.query({ eventType: 'tick' }).length;

        vi.advanceTimersByTime(35);

        const postTicks = launcher.audit.query({ eventType: 'tick' }).length;
        // setInterval at 10ms advanced through 35ms — expect 3 ticks.
        expect(postTicks - preTicks).toBe(3);

        launcher.stop();
    });
});
