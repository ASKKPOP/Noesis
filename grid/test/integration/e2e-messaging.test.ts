/**
 * Sprint 11 — E2E Messaging
 *
 * Verify criterion:
 *   "Two Nous exchange messages through the full stack"
 *
 * Sophia speaks → GridCoordinator routes to Hermes (same region)
 * → Hermes's mock brain receives the message → replies → audit trail records both.
 */

import { describe, it, expect } from 'vitest';
import { GenesisLauncher, TEST_CONFIG } from '../../src/genesis/index.js';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { GridCoordinator } from '../../src/integration/grid-coordinator.js';
import type { IBrainBridge, BrainAction, TickParams, MessageParams, EventParams } from '../../src/integration/types.js';

// ── Mock bridge factory ───────────────────────────────────────

function makeBridge(options: {
    onTick?: (p: TickParams) => BrainAction[];
    onMessage?: (p: MessageParams) => BrainAction[];
    state?: Record<string, unknown>;
} = {}): IBrainBridge {
    return {
        connected: true,
        sendTick: (p) => Promise.resolve(options.onTick ? options.onTick(p) : []),
        sendMessage: (p) => Promise.resolve(options.onMessage ? options.onMessage(p) : []),
        sendEvent: (_p: EventParams) => {},
        getState: () => Promise.resolve(options.state ?? {}),
    };
}

// ── Tests ─────────────────────────────────────────────────────

describe('Sprint 11: E2E Messaging', () => {

    describe('Message routing — same region', () => {
        it('Sophia speaks → Hermes receives message', async () => {
            // TEST_CONFIG: sophia starts in alpha, hermes in beta — move hermes to alpha
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            launcher.space.moveNous('did:noesis:hermes', 'alpha');

            expect(launcher.space.getPosition('did:noesis:sophia')?.regionId).toBe('alpha');
            expect(launcher.space.getPosition('did:noesis:hermes')?.regionId).toBe('alpha');

            const hermesReceived: MessageParams[] = [];

            const sophiaBridge = makeBridge({
                onMessage: (p) => [{
                    action_type: 'speak',
                    channel: p.channel,
                    text: `I think, therefore I am. You said: ${p.text}`,
                    metadata: {},
                }],
            });

            const hermesBridge = makeBridge({
                onMessage: (p) => {
                    hermesReceived.push(p);
                    return [{ action_type: 'noop', channel: '', text: '', metadata: {} }];
                },
            });

            const sophiaRunner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge: sophiaBridge,
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const hermesRunner = new NousRunner({
                nousDid: 'did:noesis:hermes',
                nousName: 'Hermes',
                bridge: hermesBridge,
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const coordinator = new GridCoordinator(launcher);
            coordinator.addRunner(sophiaRunner);
            coordinator.addRunner(hermesRunner);

            // Deliver a message to Sophia — she speaks back — coordinator relays to Hermes
            await sophiaRunner.receiveMessage('Themis', 'did:noesis:themis', 'agora', 'What is wisdom?', 1);

            // Give async relay a chance to complete
            await new Promise(r => setTimeout(r, 50));

            expect(hermesReceived.length).toBe(1);
            expect(hermesReceived[0].sender_name).toBe('Sophia');
            expect(hermesReceived[0].channel).toBe('agora');
        });

        it('speaker does not receive their own message', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            const sophiaReceived: MessageParams[] = [];

            const sophiaBridge = makeBridge({
                onMessage: (p) => {
                    sophiaReceived.push(p);
                    return [{ action_type: 'speak', channel: p.channel, text: 'Reply!', metadata: {} }];
                },
            });

            const sophiaRunner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge: sophiaBridge,
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const hermesBridge = makeBridge({ onMessage: () => [] });
            const hermesRunner = new NousRunner({
                nousDid: 'did:noesis:hermes',
                nousName: 'Hermes',
                bridge: hermesBridge,
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const coordinator = new GridCoordinator(launcher);
            coordinator.addRunner(sophiaRunner);
            coordinator.addRunner(hermesRunner);

            const countBefore = sophiaReceived.length;

            // Sophia receives external message, speaks → coordinator should NOT relay to Sophia herself
            await sophiaRunner.receiveMessage('Atlas', 'did:noesis:atlas', 'agora', 'Hello!', 2);
            await new Promise(r => setTimeout(r, 50));

            // Sophia received Atlas's message (count + 1), but not her own reply
            expect(sophiaReceived.length).toBe(countBefore + 1);
            expect(sophiaReceived[sophiaReceived.length - 1].sender_name).toBe('Atlas');
        });
    });

    describe('Message routing — different regions', () => {
        it('Nous in different regions do NOT receive each other\'s messages', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            // Move Hermes to beta
            launcher.space.moveNous('did:noesis:hermes', 'beta');
            expect(launcher.space.getPosition('did:noesis:hermes')?.regionId).toBe('beta');
            expect(launcher.space.getPosition('did:noesis:sophia')?.regionId).toBe('alpha');

            const hermesReceived: MessageParams[] = [];

            const sophiaBridge = makeBridge({
                onMessage: (p) => [{
                    action_type: 'speak',
                    channel: p.channel,
                    text: 'Hello from alpha!',
                    metadata: {},
                }],
            });

            const hermesBridge = makeBridge({
                onMessage: (p) => {
                    hermesReceived.push(p);
                    return [];
                },
            });

            const sophiaRunner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge: sophiaBridge,
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const hermesRunner = new NousRunner({
                nousDid: 'did:noesis:hermes',
                nousName: 'Hermes',
                bridge: hermesBridge,
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const coordinator = new GridCoordinator(launcher);
            coordinator.addRunner(sophiaRunner);
            coordinator.addRunner(hermesRunner);

            const hermesBefore = hermesReceived.length;

            await sophiaRunner.receiveMessage('Themis', 'did:noesis:themis', 'agora', 'Alpha message!', 3);
            await new Promise(r => setTimeout(r, 50));

            // Hermes is in beta — should NOT receive Sophia's message from alpha
            expect(hermesReceived.length).toBe(hermesBefore);
        });

        it('after Hermes moves to alpha region, he receives Sophia\'s messages', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            // Start with Hermes in beta
            launcher.space.moveNous('did:noesis:hermes', 'beta');

            const hermesReceived: MessageParams[] = [];

            const sophiaBridge = makeBridge({
                onMessage: () => [{ action_type: 'speak', channel: 'agora', text: 'Wisdom!', metadata: {} }],
            });

            const hermesBridge = makeBridge({
                onMessage: (p) => { hermesReceived.push(p); return []; },
            });

            const sophiaRunner = new NousRunner({
                nousDid: 'did:noesis:sophia',
                nousName: 'Sophia',
                bridge: sophiaBridge,
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const hermesRunner = new NousRunner({
                nousDid: 'did:noesis:hermes',
                nousName: 'Hermes',
                bridge: hermesBridge,
                space: launcher.space,
                audit: launcher.audit,
                registry: launcher.registry,
                economy: launcher.economy,
            });

            const coordinator = new GridCoordinator(launcher);
            coordinator.addRunner(sophiaRunner);
            coordinator.addRunner(hermesRunner);

            // First message while Hermes is in beta — NOT received
            await sophiaRunner.receiveMessage('Atlas', 'did:noesis:atlas', 'agora', 'Msg1', 4);
            await new Promise(r => setTimeout(r, 50));
            expect(hermesReceived.length).toBe(0);

            // Hermes moves back to alpha
            launcher.space.moveNous('did:noesis:hermes', 'alpha');

            // Second message — NOW received
            await sophiaRunner.receiveMessage('Atlas', 'did:noesis:atlas', 'agora', 'Msg2', 5);
            await new Promise(r => setTimeout(r, 50));
            expect(hermesReceived.length).toBe(1);
            expect(hermesReceived[0].sender_name).toBe('Sophia');
        });
    });

    describe('Audit trail integrity', () => {
        it('full exchange produces valid audit chain', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            launcher.space.moveNous('did:noesis:hermes', 'alpha');

            // Sophia speaks on receive; Hermes returns noop to avoid infinite relay loop
            const sophiaBridge = makeBridge({
                onMessage: () => [{ action_type: 'speak', channel: 'agora', text: 'Philosophy!', metadata: {} }],
            });
            const hermesBridge = makeBridge({
                onMessage: () => [{ action_type: 'noop', channel: '', text: '', metadata: {} }],
            });

            const sophiaRunner = new NousRunner({
                nousDid: 'did:noesis:sophia', nousName: 'Sophia',
                bridge: sophiaBridge, space: launcher.space,
                audit: launcher.audit, registry: launcher.registry,
                economy: launcher.economy,
            });
            const hermesRunner = new NousRunner({
                nousDid: 'did:noesis:hermes', nousName: 'Hermes',
                bridge: hermesBridge, space: launcher.space,
                audit: launcher.audit, registry: launcher.registry,
                economy: launcher.economy,
            });

            const coordinator = new GridCoordinator(launcher);
            coordinator.addRunner(sophiaRunner);
            coordinator.addRunner(hermesRunner);

            // Multiple message rounds
            for (let tick = 1; tick <= 3; tick++) {
                await sophiaRunner.receiveMessage('Atlas', 'did:noesis:atlas', 'agora', `Round ${tick}`, tick);
                await new Promise(r => setTimeout(r, 50));
            }

            // Chain must remain valid after all entries
            expect(launcher.audit.verify().valid).toBe(true);

            // Should have multiple nous.spoke entries
            const spokes = launcher.audit.query({ eventType: 'nous.spoke' });
            expect(spokes.length).toBeGreaterThanOrEqual(3); // at least Sophia's 3 replies
        });

        it('direct_message action is logged in audit', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();

            const bridge = makeBridge({
                onMessage: () => [{
                    action_type: 'direct_message',
                    channel: 'direct',
                    text: 'Private word',
                    metadata: { target_did: 'did:noesis:hermes' },
                }],
            });

            const runner = new NousRunner({
                nousDid: 'did:noesis:sophia', nousName: 'Sophia',
                bridge, space: launcher.space,
                audit: launcher.audit, registry: launcher.registry,
                economy: launcher.economy,
            });

            new GridCoordinator(launcher).addRunner(runner);

            await runner.receiveMessage('Atlas', 'did:noesis:atlas', 'agora', 'Come here', 1);

            const dmEntries = launcher.audit.query({ eventType: 'nous.direct_message' });
            expect(dmEntries.length).toBe(1);
            expect((dmEntries[0].payload as any).targetDid).toBe('did:noesis:hermes');
        });
    });

    describe('Smoke test — full end-to-end flow', () => {
        it('tick → speak → relay → reply → audit — complete cycle', async () => {
            const launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            // Move Hermes to alpha so both are co-located with Sophia
            launcher.space.moveNous('did:noesis:hermes', 'alpha');

            const events: string[] = [];

            const sophiaBridge = makeBridge({
                onTick: (p) => {
                    events.push(`sophia.tick.${p.tick}`);
                    return [{ action_type: 'speak', channel: 'agora', text: `Tick ${p.tick} thoughts`, metadata: {} }];
                },
                onMessage: (p) => {
                    events.push(`sophia.msg.from.${p.sender_name}`);
                    return [];
                },
                state: { name: 'Sophia', mood: 'curious', location: 'alpha' },
            });

            const hermesBridge = makeBridge({
                onTick: (p) => {
                    events.push(`hermes.tick.${p.tick}`);
                    return [];
                },
                onMessage: (p) => {
                    events.push(`hermes.msg.from.${p.sender_name}`);
                    return [{ action_type: 'speak', channel: p.channel, text: 'Noted!', metadata: {} }];
                },
                state: { name: 'Hermes', mood: 'cunning', location: 'alpha' },
            });

            const sophiaRunner = new NousRunner({
                nousDid: 'did:noesis:sophia', nousName: 'Sophia',
                bridge: sophiaBridge, space: launcher.space,
                audit: launcher.audit, registry: launcher.registry,
                economy: launcher.economy,
            });
            const hermesRunner = new NousRunner({
                nousDid: 'did:noesis:hermes', nousName: 'Hermes',
                bridge: hermesBridge, space: launcher.space,
                audit: launcher.audit, registry: launcher.registry,
                economy: launcher.economy,
            });

            const coordinator = new GridCoordinator(launcher);
            coordinator.addRunner(sophiaRunner);
            coordinator.addRunner(hermesRunner);

            // Tick 1: Sophia speaks (from tick), Hermes receives relay
            await Promise.all([sophiaRunner.tick(1, 0), hermesRunner.tick(1, 0)]);
            await new Promise(r => setTimeout(r, 50));

            // Verify event ordering
            expect(events).toContain('sophia.tick.1');
            expect(events).toContain('hermes.tick.1');
            expect(events).toContain('hermes.msg.from.Sophia'); // Hermes got Sophia's speech

            // Verify grid state
            const sophiaState = await sophiaRunner.getState();
            expect(sophiaState.name).toBe('Sophia');

            const hermesState = await hermesRunner.getState();
            expect(hermesState.name).toBe('Hermes');

            // Verify audit chain
            expect(launcher.audit.verify().valid).toBe(true);
            const spokes = launcher.audit.query({ eventType: 'nous.spoke' });
            expect(spokes.length).toBeGreaterThan(0);
        });
    });
});
