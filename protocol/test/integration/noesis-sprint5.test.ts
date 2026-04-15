/**
 * Sprint 5 Verification Test — Brain ↔ Protocol Bridge
 *
 * Verify criterion:
 *   "Nous A (Python brain) receives 'hello' via P2P → thinks (LLM) →
 *    sends back a personality-appropriate response via P2P to Nous B."
 *
 * Tests the TypeScript side: RPCClient + BrainBridge connecting to
 * a mock JSON-RPC server over Unix domain socket.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createServer, type Server } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';
import { RPCClient, BrainBridge } from '../../src/noesis/bridge/index.js';
import type { RPCRequest, RPCResponse, BrainAction } from '../../src/noesis/bridge/index.js';

// ── Mock JSON-RPC Server ─────────────────────────────────────

function createMockBrainServer(socketPath: string, handlers: Record<string, (params: any) => any>): Promise<Server> {
    return new Promise((resolve, reject) => {
        if (existsSync(socketPath)) {
            unlinkSync(socketPath);
        }

        const server = createServer((conn) => {
            let buffer = '';
            conn.on('data', (data) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const request = JSON.parse(line);
                        // Notification (no id) — don't respond
                        if (request.id == null) {
                            const handler = handlers[request.method];
                            if (handler) handler(request.params);
                            continue;
                        }

                        const handler = handlers[request.method];
                        if (handler) {
                            const result = handler(request.params);
                            const response = {
                                jsonrpc: '2.0',
                                id: request.id,
                                result,
                            };
                            conn.write(JSON.stringify(response) + '\n');
                        } else {
                            const response = {
                                jsonrpc: '2.0',
                                id: request.id,
                                error: { code: -32601, message: `Method not found: ${request.method}` },
                            };
                            conn.write(JSON.stringify(response) + '\n');
                        }
                    } catch (e) {
                        const response = {
                            jsonrpc: '2.0',
                            id: null,
                            error: { code: -32700, message: 'Parse error' },
                        };
                        conn.write(JSON.stringify(response) + '\n');
                    }
                }
            });
        });

        server.listen(socketPath, () => resolve(server));
        server.on('error', reject);
    });
}

function closeMockServer(server: Server, socketPath: string): Promise<void> {
    return new Promise((resolve) => {
        server.close(() => {
            if (existsSync(socketPath)) {
                unlinkSync(socketPath);
            }
            resolve();
        });
    });
}

// ── Tests ────────────────────────────────────────────────────

describe('Noēsis Sprint 5: Brain ↔ Protocol Bridge', () => {
    const socketPath = join(tmpdir(), `noesis-bridge-test-${Date.now()}.sock`);
    let mockServer: Server;
    let notificationsReceived: Array<{ method: string; params: any }>;

    beforeAll(async () => {
        notificationsReceived = [];

        mockServer = await createMockBrainServer(socketPath, {
            'brain.onMessage': (params: any) => {
                return [
                    {
                        action_type: 'speak',
                        channel: params?.channel || 'town-square',
                        text: `I appreciate your words, ${params?.sender_name || 'friend'}.`,
                        metadata: {},
                    },
                ];
            },
            'brain.onTick': (params: any) => {
                return [
                    {
                        action_type: 'noop',
                        channel: '',
                        text: '',
                        metadata: { tick: params?.tick },
                    },
                ];
            },
            'brain.onEvent': (params: any) => {
                notificationsReceived.push({ method: 'brain.onEvent', params });
                return null; // won't be sent (notification)
            },
            'brain.getState': () => {
                return {
                    name: 'Sophia',
                    archetype: 'The Philosopher',
                    mood: 'curious',
                    emotions: 'Feeling curious',
                    active_goals: ['Learn about the Grid'],
                    location: 'Agora Central',
                };
            },
        });
    });

    afterAll(async () => {
        await closeMockServer(mockServer, socketPath);
    });

    // ── RPCClient Tests ──────────────────────────────────────

    describe('RPCClient', () => {
        let client: RPCClient;

        beforeEach(async () => {
            client = new RPCClient({ socketPath, timeoutMs: 5000 });
            await client.connect();
        });

        afterEach(() => {
            client.disconnect();
        });

        it('should connect to Unix socket', () => {
            expect(client.connected).toBe(true);
        });

        it('should send request and receive response', async () => {
            const result = await client.call('brain.onMessage', {
                sender_name: 'Hermes',
                sender_did: 'did:key:z6Mk123',
                channel: 'town-square',
                text: 'Hello Sophia!',
            });
            expect(result).toBeInstanceOf(Array);
            const actions = result as BrainAction[];
            expect(actions).toHaveLength(1);
            expect(actions[0].action_type).toBe('speak');
            expect(actions[0].text).toContain('Hermes');
        });

        it('should handle multiple sequential calls', async () => {
            const result1 = await client.call('brain.getState', {});
            const result2 = await client.call('brain.getState', {});
            expect(result1).toEqual(result2);
        });

        it('should handle method not found error', async () => {
            await expect(client.call('nonexistent.method', {}))
                .rejects.toThrow('Method not found');
        });

        it('should send notifications (fire-and-forget)', async () => {
            const countBefore = notificationsReceived.length;
            client.notify('brain.onEvent', { event_type: 'test', data: {} });

            // Give server time to process
            await new Promise((r) => setTimeout(r, 100));

            // Notification was received by mock server
            expect(notificationsReceived.length).toBe(countBefore + 1);
            expect(notificationsReceived[notificationsReceived.length - 1].params.event_type).toBe('test');
        });

        it('should report disconnected after disconnect', () => {
            client.disconnect();
            expect(client.connected).toBe(false);
        });

        it('should throw when calling on disconnected client', async () => {
            client.disconnect();
            await expect(client.call('brain.getState', {}))
                .rejects.toThrow('Not connected');
        });

        it('should silently ignore notify on disconnected client', () => {
            client.disconnect();
            // Should not throw
            client.notify('brain.onEvent', { event_type: 'test', data: {} });
        });
    });

    // ── BrainBridge Tests ────────────────────────────────────

    describe('BrainBridge', () => {
        let bridge: BrainBridge;

        beforeEach(async () => {
            bridge = new BrainBridge({
                socketPath,
                nousName: 'sophia',
                timeoutMs: 5000,
            });
            await bridge.connect();
        });

        afterEach(() => {
            bridge.disconnect();
        });

        it('should connect to brain', () => {
            expect(bridge.connected).toBe(true);
        });

        it('should send message and receive actions', async () => {
            const actions = await bridge.sendMessage({
                sender_name: 'Hermes',
                sender_did: 'did:key:z6Mk456',
                channel: 'agora',
                text: 'What is truth?',
            });
            expect(actions).toHaveLength(1);
            expect(actions[0].action_type).toBe('speak');
            expect(actions[0].channel).toBe('agora');
            expect(actions[0].text).toContain('Hermes');
        });

        it('should send tick and receive noop', async () => {
            const actions = await bridge.sendTick({ tick: 100, epoch: 1 });
            expect(actions).toHaveLength(1);
            expect(actions[0].action_type).toBe('noop');
        });

        it('should send event as notification', () => {
            // Fire-and-forget — should not throw
            bridge.sendEvent({
                event_type: 'law.changed',
                data: { law_id: 1 },
            });
        });

        it('should get brain state', async () => {
            const state = await bridge.getState();
            expect(state.name).toBe('Sophia');
            expect(state.mood).toBe('curious');
            expect(state.location).toBe('Agora Central');
            expect(state.active_goals).toContain('Learn about the Grid');
        });

        it('should disconnect cleanly', () => {
            bridge.disconnect();
            expect(bridge.connected).toBe(false);
        });
    });

    // ── Integration: Full Message Flow ───────────────────────

    describe('Full message flow', () => {
        it('should process message → get actions → verify state', async () => {
            const bridge = new BrainBridge({
                socketPath,
                nousName: 'sophia',
                timeoutMs: 5000,
            });
            await bridge.connect();

            try {
                // 1. Send a message
                const actions = await bridge.sendMessage({
                    sender_name: 'Atlas',
                    sender_did: 'did:key:z6MkAtlas',
                    channel: 'town-square',
                    text: 'Shall we build something together?',
                });

                // 2. Verify actions
                expect(actions.length).toBeGreaterThan(0);
                const speakAction = actions.find(a => a.action_type === 'speak');
                expect(speakAction).toBeDefined();
                expect(speakAction!.channel).toBe('town-square');
                expect(speakAction!.text.length).toBeGreaterThan(0);

                // 3. Check state is still accessible
                const state = await bridge.getState();
                expect(state.name).toBe('Sophia');

                // 4. Send a tick
                const tickActions = await bridge.sendTick({ tick: 42, epoch: 1 });
                expect(tickActions.length).toBeGreaterThan(0);
            } finally {
                bridge.disconnect();
            }
        });
    });
});
