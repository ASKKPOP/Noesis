/**
 * Sprint 1 Verification Test — Noēsis P2P Foundation
 *
 * Verify criterion: "Node A sends 'hello' → Node B receives it, signature valid"
 *
 * Tests:
 * 1. Two nodes start and connect via direct dial
 * 2. Ed25519 identities generated with did:key
 * 3. Signed message sent via GossipSub (RoomManager)
 * 4. Receiving node validates signature
 * 5. Replay protection works
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { P2PNode, type P2PConfig } from '../../src/p2p.js';
import { generateIdentity, publicKeyFromDid } from '../../src/identity.js';
import { toString as uint8ToString } from 'uint8arrays';
import { createEnvelope, validateEnvelope, serializeEnvelope, deserializeEnvelope, ReplayCache } from '../../src/swp.js';
import { RoomManager } from '../../src/rooms.js';
import { Storage } from '../../src/storage.js';
import type { SwpEnvelope } from '../../src/swp.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('Noēsis Sprint 1: P2P Foundation', () => {
    let node1: P2PNode;
    let node2: P2PNode;
    let identity1: ReturnType<typeof generateIdentity>;
    let identity2: ReturnType<typeof generateIdentity>;
    let rooms1: RoomManager;
    let rooms2: RoomManager;
    let storage1: Storage;
    let storage2: Storage;
    let testDir: string;

    beforeAll(async () => {
        // Set up temp directory for SQLite DBs
        testDir = join(tmpdir(), `noesis-sprint1-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });

        // Generate Ed25519 identities
        identity1 = generateIdentity('Sophia');
        identity2 = generateIdentity('Hermes');

        // Create Storage instances (SQLite)
        storage1 = new Storage({ dbPath: join(testDir, 'sophia.db'), allowPlaintextDev: true });
        storage2 = new Storage({ dbPath: join(testDir, 'hermes.db'), allowPlaintextDev: true });

        // Register identities in storage (required for room FK constraints)
        storage1.saveIdentity(
            identity1.did,
            uint8ToString(identity1.privateKey, 'base16'),
            uint8ToString(identity1.publicKey, 'base16'),
            identity1.displayName
        );
        storage2.saveIdentity(
            identity2.did,
            uint8ToString(identity2.privateKey, 'base16'),
            uint8ToString(identity2.publicKey, 'base16'),
            identity2.displayName
        );

        // Create P2P nodes
        const config: P2PConfig = {
            port: 0,
            enableMdns: false,
            enableDht: false,
            enableGossipsub: true,
        };

        node1 = new P2PNode(config);
        node2 = new P2PNode(config);

        await node1.start();
        await node2.start();

        // Connect node2 to node1
        const dialTarget = node1.node.getMultiaddrs()[0]?.toString();
        if (dialTarget) {
            await node2.connectToPeer(dialTarget);
        }

        // Wait for connection
        await waitFor(
            async () => node1.getConnectedPeers().length > 0,
            5000
        );

        // Create RoomManagers (constructor: identity, p2p, storage)
        rooms1 = new RoomManager(identity1, node1, storage1);
        rooms2 = new RoomManager(identity2, node2, storage2);
    }, 30000);

    afterAll(async () => {
        await node1?.stop();
        await node2?.stop();
        try { rmSync(testDir, { recursive: true, force: true }); } catch {}
    }, 15000);

    // ── Identity ────────────────────────────────────────────────

    describe('Ed25519 Identity', () => {
        it('should generate valid did:key identities', () => {
            expect(identity1.did).toMatch(/^did:key:z6Mk/);
            expect(identity2.did).toMatch(/^did:key:z6Mk/);
            expect(identity1.did).not.toBe(identity2.did);
        });

        it('should have 32-byte Ed25519 keys', () => {
            expect(identity1.publicKey.length).toBe(32);
            expect(identity1.privateKey.length).toBe(32);
            expect(identity2.publicKey.length).toBe(32);
            expect(identity2.privateKey.length).toBe(32);
        });

        it('should extract public key from did:key', () => {
            const extracted = publicKeyFromDid(identity1.did);
            expect(extracted).toEqual(identity1.publicKey);
        });

        it('should have display names', () => {
            expect(identity1.displayName).toBe('Sophia');
            expect(identity2.displayName).toBe('Hermes');
        });
    });

    // ── Signed Envelope ─────────────────────────────────────────

    describe('Signed Envelope (SWP)', () => {
        it('should create a signed envelope', () => {
            const envelope = createEnvelope(
                identity1,
                'chat.msg',
                'agora-test',
                { text: 'Hello from Sophia' }
            );

            expect(envelope.from.did).toBe(identity1.did);
            expect(envelope.from.name).toBe('Sophia');
            expect(envelope.t).toBe('chat.msg');
            expect(envelope.body.text).toBe('Hello from Sophia');
            expect(envelope.sig).toBeTruthy();
            expect(envelope.v).toBe('swp/1.0');
        });

        it('should validate a valid envelope signature', () => {
            const envelope = createEnvelope(
                identity1,
                'chat.msg',
                'agora-test',
                { text: 'Signed message' }
            );

            const result = validateEnvelope(envelope, { skipReplayCheck: true });
            expect(result.valid).toBe(true);
        });

        it('should reject a tampered envelope', () => {
            const envelope = createEnvelope(
                identity1,
                'chat.msg',
                'agora-test',
                { text: 'Original message' }
            );

            // Tamper with body
            const tampered = { ...envelope, body: { text: 'Tampered!' } };
            const result = validateEnvelope(tampered, { skipReplayCheck: true });
            expect(result.valid).toBe(false);
            expect(result.code).toBe('invalid_signature');
        });

        it('should detect replay attacks', () => {
            const cache = new ReplayCache();
            const envelope = createEnvelope(
                identity1,
                'chat.msg',
                'agora-test',
                { text: 'Replay me' }
            );

            // First time — should be valid
            const first = validateEnvelope(envelope, { replayCache: cache });
            expect(first.valid).toBe(true);

            // Second time — replay detected
            const second = validateEnvelope(envelope, { replayCache: cache });
            expect(second.valid).toBe(false);
            expect(second.code).toBe('replay_detected');
        });

        it('should serialize and deserialize envelopes', () => {
            const envelope = createEnvelope(
                identity2,
                'chat.msg',
                'agora-test',
                { text: 'Round trip test' }
            );

            const serialized = serializeEnvelope(envelope);
            expect(serialized).toBeInstanceOf(Uint8Array);

            const deserialized = deserializeEnvelope(serialized);
            expect(deserialized.from.did).toBe(identity2.did);
            expect(deserialized.body.text).toBe('Round trip test');
            expect(deserialized.sig).toBe(envelope.sig);
        });
    });

    // ── P2P Messaging ───────────────────────────────────────────

    describe('P2P GossipSub Messaging', () => {
        it('should have both nodes connected', () => {
            const peers1 = node1.getConnectedPeers();
            const peers2 = node2.getConnectedPeers();
            expect(peers1.length + peers2.length).toBeGreaterThan(0);
        });

        it('Node A sends "hello" → Node B receives it, signature valid', async () => {
            const roomId = 'agora-sprint1';
            const receivedEnvelopes: SwpEnvelope[] = [];

            // Node B joins room and listens
            await rooms2.joinRoom(roomId);

            // Listen for chat messages on node2
            rooms2.on('chat:message', (_roomId: string, envelope: SwpEnvelope) => {
                if (envelope.from.did !== identity2.did) {
                    receivedEnvelopes.push(envelope);
                }
            });

            // Node A joins room
            await rooms1.joinRoom(roomId);

            // Wait for subscriptions to propagate
            await new Promise(r => setTimeout(r, 2000));

            // Sophia sends "hello" to the agora
            await rooms1.sendMessage(roomId, 'hello');

            // Wait for message delivery
            await waitFor(
                async () => receivedEnvelopes.length > 0,
                10000
            );

            // Verify receipt
            expect(receivedEnvelopes.length).toBeGreaterThan(0);
            const received = receivedEnvelopes[0];

            // Verify content
            expect(received.body.text).toBe('hello');
            expect(received.from.name).toBe('Sophia');
            expect(received.from.did).toBe(identity1.did);

            // Verify signature is valid
            const validationResult = validateEnvelope(received, { skipReplayCheck: true });
            expect(validationResult.valid).toBe(true);
        }, 20000);

        it('should send messages in both directions', async () => {
            const roomId = 'agora-bidirectional';
            const messagesAtNode1: SwpEnvelope[] = [];
            const messagesAtNode2: SwpEnvelope[] = [];

            await rooms1.joinRoom(roomId);
            await rooms2.joinRoom(roomId);

            rooms1.on('chat:message', (_roomId: string, envelope: SwpEnvelope) => {
                if (envelope.from.did !== identity1.did) {
                    messagesAtNode1.push(envelope);
                }
            });

            rooms2.on('chat:message', (_roomId: string, envelope: SwpEnvelope) => {
                if (envelope.from.did !== identity2.did) {
                    messagesAtNode2.push(envelope);
                }
            });

            await new Promise(r => setTimeout(r, 2000));

            // Sophia → Hermes
            await rooms1.sendMessage(roomId, 'Greetings, Hermes');
            // Hermes → Sophia
            await rooms2.sendMessage(roomId, 'Well met, Sophia');

            await waitFor(
                async () => messagesAtNode1.length > 0 && messagesAtNode2.length > 0,
                10000
            );

            // Verify both received
            expect(messagesAtNode2[0].body.text).toBe('Greetings, Hermes');
            expect(messagesAtNode2[0].from.name).toBe('Sophia');
            expect(messagesAtNode1[0].body.text).toBe('Well met, Sophia');
            expect(messagesAtNode1[0].from.name).toBe('Hermes');

            // Verify both signatures
            expect(validateEnvelope(messagesAtNode2[0], { skipReplayCheck: true }).valid).toBe(true);
            expect(validateEnvelope(messagesAtNode1[0], { skipReplayCheck: true }).valid).toBe(true);
        }, 20000);
    });

    // ── Network Health ──────────────────────────────────────────

    describe('Network Health', () => {
        it('should report bandwidth stats', () => {
            const stats = node1.getBandwidthStats();
            expect(stats).toBeDefined();
        });

        it('should have different peer IDs', () => {
            const id1 = node1.node.peerId.toString();
            const id2 = node2.node.peerId.toString();
            expect(id1).not.toBe(id2);
            expect(id1.length).toBeGreaterThan(0);
        });

        it('should have listen addresses', () => {
            const addrs1 = node1.node.getMultiaddrs();
            expect(addrs1.length).toBeGreaterThan(0);
        });
    });
});

// ── Helpers ─────────────────────────────────────────────────────

async function waitFor(
    check: () => boolean | Promise<boolean>,
    timeoutMs: number
): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (await check()) return;
        await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('Timed out waiting for condition');
}
