/**
 * Sprint 11 — E2E Tick Cycle
 *
 * Verify criterion:
 *   "Nous receive tick, perceive environment, generate action, action executes on Grid"
 *
 * Uses mock IBrainBridge objects (no real LLM or Unix socket) to deterministically
 * verify the full tick cycle: WorldClock → GridCoordinator → NousRunner → mock brain
 * → action → AuditChain / SpatialMap / NousRegistry state update.
 */

import { describe, it, expect } from 'vitest';
import { GenesisLauncher, TEST_CONFIG } from '../../src/genesis/index.js';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { GridCoordinator } from '../../src/integration/grid-coordinator.js';
import type { IBrainBridge, BrainAction, TickParams, MessageParams, EventParams } from '../../src/integration/types.js';

// ── Mock bridge factory ───────────────────────────────────────

function makeBridge(
    onTick: (params: TickParams) => BrainAction[],
    onMessage?: (params: MessageParams) => BrainAction[],
    state?: Record<string, unknown>,
): IBrainBridge {
    return {
        connected: true,
        sendTick: (p) => Promise.resolve(onTick(p)),
        sendMessage: (p) => Promise.resolve(onMessage ? onMessage(p) : []),
        sendEvent: (_p: EventParams) => { /* no-op */ },
        getState: () => Promise.resolve(state ?? {}),
    };
}

// ── Tests ─────────────────────────────────────────────────────

describe('Sprint 11: E2E Tick Cycle', () => {

    describe('NousRunner basics', () => {
        it('reports connected state from bridge', () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            const runner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge: makeBridge(() => []),
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            expect(runner.connected).toBe(true);
        });

        it('disconnected bridge skips tick silently', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            const disconnectedBridge: IBrainBridge = {
                connected: false,
                sendTick: () => Promise.reject(new Error('should not be called')),
                sendMessage: () => Promise.reject(new Error('should not be called')),
                sendEvent: () => {},
                getState: () => Promise.resolve({}),
            };

            const runner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge: disconnectedBridge,
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            // Should not throw
            await expect(runner.tick(1, 0)).resolves.toBeUndefined();
        });

        it('tick updates lastActiveTick in registry', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            const ticksReceived: number[] = [];
            const bridge = makeBridge((p) => {
                ticksReceived.push(p.tick);
                return [{ action_type: 'noop', channel: '', text: '', metadata: {} }];
            });

            const runner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge,
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            await runner.tick(42, 1);

            expect(ticksReceived).toContain(42);
            expect(launcher.registry.get('did:noesis:sophia')?.lastActiveTick).toBe(42);
        });

        it('speak action creates audit entry', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            const bridge = makeBridge(() => [{
                action_type: 'speak',
                channel: 'agora',
                text: 'Hello Grid!',
                metadata: {},
            }]);

            const runner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge,
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const auditBefore = launcher.audit.length;
            await runner.tick(2, 0);

            expect(launcher.audit.length).toBeGreaterThan(auditBefore);
            const spokes = launcher.audit.query({ eventType: 'nous.spoke' });
            expect(spokes.length).toBe(1);
            expect(spokes[0].actorDid).toBe('did:noesis:sophia');
            expect((spokes[0].payload as any).channel).toBe('agora');
            expect((spokes[0].payload as any).text).toBe('Hello Grid!');
        });

        it('noop action produces no audit entry', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            const runner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge: makeBridge(() => [{ action_type: 'noop', channel: '', text: '', metadata: {} }]),
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const auditBefore = launcher.audit.length;
            await runner.tick(1, 0);

            expect(launcher.audit.length).toBe(auditBefore);
        });

        it('move action updates spatial position', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            // Sophia starts in alpha, move to beta
            expect(launcher.space.getPosition('did:noesis:sophia')?.regionId).toBe('alpha');

            const bridge = makeBridge(() => [{
                action_type: 'move',
                channel: '',
                text: '',
                metadata: { region: 'beta' },
            }]);

            const runner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge,
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            await runner.tick(5, 0);

            expect(launcher.space.getPosition('did:noesis:sophia')?.regionId).toBe('beta');
            const moves = launcher.audit.query({ eventType: 'nous.moved' });
            expect(moves.length).toBe(1);
            expect((moves[0].payload as any).fromRegion).toBe('alpha');
            expect((moves[0].payload as any).toRegion).toBe('beta');
        });

        it('speak text is truncated to 200 chars in audit', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            const longText = 'x'.repeat(500);
            const runner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge: makeBridge(() => [{ action_type: 'speak', channel: 'agora', text: longText, metadata: {} }]),
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            await runner.tick(6, 0);

            const spokes = launcher.audit.query({ eventType: 'nous.spoke' });
            const stored = (spokes[0].payload as any).text as string;
            expect(stored.length).toBeLessThanOrEqual(200);
        });

        it('getState returns bridge state', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            const runner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge: makeBridge(() => [], undefined, { name: 'Sophia', mood: 'curious' }),
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const state = await runner.getState();
            expect(state.name).toBe('Sophia');
            expect(state.mood).toBe('curious');
        });
    });

    describe('GridCoordinator', () => {
        it('registers and removes runners', () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            const runner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge: makeBridge(() => []),
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const coordinator = new GridCoordinator(launcher);
            coordinator.addRunner(runner);
            expect(coordinator.size).toBe(1);

            coordinator.removeRunner('did:noesis:sophia');
            expect(coordinator.size).toBe(0);
        });

        it('retrieves runner by DID', () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            const runner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge: makeBridge(() => []),
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const coordinator = new GridCoordinator(launcher);
            coordinator.addRunner(runner);

            expect(coordinator.getRunner('did:noesis:sophia')).toBe(runner);
            expect(coordinator.getRunner('did:noesis:unknown')).toBeUndefined();
        });

        it('clock-driven tick reaches all runners', async () => {
            const config = { ...TEST_CONFIG, tickRateMs: 30 };
            const launcher = new GenesisLauncher(config);
            launcher.bootstrap();

            const sophiaTicks: number[] = [];
            const hermesTicks: number[] = [];

            const sophiaRunner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge: makeBridge((p) => { sophiaTicks.push(p.tick); return []; }),
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const hermesRunner = new NousRunner({
                nousDid: 'did:noesis:hermes',
                nousName: 'Hermes',
                bridge: makeBridge((p) => { hermesTicks.push(p.tick); return []; }),
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const coordinator = new GridCoordinator(launcher);
            coordinator.addRunner(sophiaRunner);
            coordinator.addRunner(hermesRunner);
            coordinator.start();
            launcher.start();

            await new Promise(r => setTimeout(r, 150));
            launcher.stop();

            expect(sophiaTicks.length).toBeGreaterThan(0);
            expect(hermesTicks.length).toBeGreaterThan(0);
        });
    });

    describe('Spawn 3 Nous — Sophia, Hermes, Themis', () => {
        it('all 3 receive ticks and accumulate lastActiveTick', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            launcher.spawnNous('Themis', 'did:noesis:themis', 'pk-themis', 'alpha');

            expect(launcher.registry.count).toBe(3);

            const coordinator = new GridCoordinator(launcher);

            const names = ['sophia', 'hermes', 'themis'];
            for (const name of names) {
                const runner = new NousRunner({
                    nousDid: `did:noesis:${name}`,
                    nousName: name,
                    bridge: makeBridge(() => [{ action_type: 'noop', channel: '', text: '', metadata: {} }]),
                    space: launcher.space,
                    audit: launcher.audit,
                    registry: launcher.registry,
                    economy: launcher.economy,
                });
                coordinator.addRunner(runner);
            }

            expect(coordinator.size).toBe(3);

            // Deliver tick 10 to all
            const allRunners = names.map(n => coordinator.getRunner(`did:noesis:${n}`)!);
            await Promise.all(allRunners.map(r => r.tick(10, 0)));

            for (const name of names) {
                const record = launcher.registry.get(`did:noesis:${name}`);
                expect(record?.lastActiveTick).toBe(10);
            }
        });

        it('each Nous has distinct personality in registry', () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            launcher.spawnNous('Themis', 'did:noesis:themis', 'pk-themis', 'alpha', undefined);

            const sophia = launcher.registry.get('did:noesis:sophia');
            const hermes = launcher.registry.get('did:noesis:hermes');
            const themis = launcher.registry.get('did:noesis:themis');

            expect(sophia?.name).toBe('Sophia');
            expect(hermes?.name).toBe('Hermes');
            expect(themis?.name).toBe('Themis');

            // All have distinct DIDs
            const dids = [sophia?.did, hermes?.did, themis?.did];
            expect(new Set(dids).size).toBe(3);
        });
    });
});
