import { describe, it, expect, vi } from 'vitest';
import { GridCoordinator } from '../../src/integration/grid-coordinator.js';

/** Minimal stub matching the launcher surface awaitTick uses. */
function makeFakeLauncher() {
    return {
        clock: { onTick: vi.fn() },                              // unused by awaitTick
        aggregator: { drainPending: vi.fn().mockReturnValue([]) },
        space: { getPosition: vi.fn() },
    };
}

function makeFakeRunner(name: string, tickImpl: () => Promise<void>) {
    return {
        nousDid: `did:noesis:${name}`,
        nousName: name,
        tick: vi.fn(tickImpl),
        onSpeak: vi.fn(),
        receiveMessage: vi.fn(),
    };
}

describe('GridCoordinator.awaitTick (RIG-04, resolves Open Question A4)', () => {
    it('does not return until every runner.tick promise settles', async () => {
        const launcher = makeFakeLauncher();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coord = new GridCoordinator(launcher as any);
        const settled: string[] = [];
        const slow = makeFakeRunner('slow', async () => {
            await new Promise((r) => setTimeout(r, 30));
            settled.push('slow');
        });
        const fast = makeFakeRunner('fast', async () => {
            await new Promise((r) => setTimeout(r, 5));
            settled.push('fast');
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        coord.addRunner(slow as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        coord.addRunner(fast as any);
        await coord.awaitTick(1, 0);
        expect(settled.sort()).toEqual(['fast', 'slow']);
    });

    it('does not regress start() — start path is independent', () => {
        const launcher = makeFakeLauncher();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coord = new GridCoordinator(launcher as any);
        coord.start();
        expect(launcher.clock.onTick).toHaveBeenCalledTimes(1);
    });

    it('catches per-runner errors without rejecting the awaitTick promise', async () => {
        const launcher = makeFakeLauncher();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coord = new GridCoordinator(launcher as any);
        const bad = makeFakeRunner('bad', async () => { throw new Error('boom'); });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        coord.addRunner(bad as any);
        // Suppress console noise
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        await expect(coord.awaitTick(1, 0)).resolves.toBeUndefined();
        errSpy.mockRestore();
    });
});
