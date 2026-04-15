/**
 * Sprint 2 Verification Test — Noēsis Domain System
 *
 * Verify criterion:
 *   "nous://sophia.thinkers sends message → nous://hermes.thinkers receives.
 *    Unregistered node is rejected."
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { P2PNode, type P2PConfig } from '../../src/p2p.js';
import { generateIdentity } from '../../src/identity.js';
import { createEnvelope, validateEnvelope } from '../../src/swp.js';
import { RoomManager } from '../../src/rooms.js';
import { Storage } from '../../src/storage.js';
import { DomainRegistry, CommunicationGate, parseNousUri, buildNousUri } from '../../src/noesis/domain/index.js';
import type { SwpEnvelope } from '../../src/swp.js';
import { toString as uint8ToString } from 'uint8arrays';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('Noēsis Sprint 2: Domain System + Communication Gate', () => {
    let node1: P2PNode;
    let node2: P2PNode;
    let node3: P2PNode; // Unregistered intruder
    let identity1: ReturnType<typeof generateIdentity>;
    let identity2: ReturnType<typeof generateIdentity>;
    let identity3: ReturnType<typeof generateIdentity>;
    let rooms1: RoomManager;
    let rooms2: RoomManager;
    let rooms3: RoomManager;
    let storage1: Storage;
    let storage2: Storage;
    let storage3: Storage;
    let registry: DomainRegistry;
    let gate: CommunicationGate;
    let testDir: string;

    beforeAll(async () => {
        testDir = join(tmpdir(), `noesis-sprint2-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });

        // Generate identities
        identity1 = generateIdentity('Sophia');
        identity2 = generateIdentity('Hermes');
        identity3 = generateIdentity('Intruder');

        // Create domain registry for "thinkers" Grid
        registry = new DomainRegistry({ gridDomain: 'thinkers' });

        // Register Sophia and Hermes — NOT the intruder
        registry.register({
            name: 'sophia',
            didKey: identity1.did,
            publicKey: identity1.publicKey,
        });
        registry.register({
            name: 'hermes',
            didKey: identity2.did,
            publicKey: identity2.publicKey,
        });

        // Create communication gate
        gate = new CommunicationGate(registry);

        // Create Storage instances
        storage1 = new Storage({ dbPath: join(testDir, 'sophia.db'), allowPlaintextDev: true });
        storage2 = new Storage({ dbPath: join(testDir, 'hermes.db'), allowPlaintextDev: true });
        storage3 = new Storage({ dbPath: join(testDir, 'intruder.db'), allowPlaintextDev: true });

        // Save identities in storage (for room FK constraints)
        storage1.saveIdentity(identity1.did, uint8ToString(identity1.privateKey, 'base16'), uint8ToString(identity1.publicKey, 'base16'), identity1.displayName);
        storage2.saveIdentity(identity2.did, uint8ToString(identity2.privateKey, 'base16'), uint8ToString(identity2.publicKey, 'base16'), identity2.displayName);
        storage3.saveIdentity(identity3.did, uint8ToString(identity3.privateKey, 'base16'), uint8ToString(identity3.publicKey, 'base16'), identity3.displayName);

        // Create P2P nodes
        const config: P2PConfig = {
            port: 0,
            enableMdns: false,
            enableDht: false,
            enableGossipsub: true,
        };

        node1 = new P2PNode(config);
        node2 = new P2PNode(config);
        node3 = new P2PNode(config);

        await node1.start();
        await node2.start();
        await node3.start();

        // Connect all nodes to node1
        const dialTarget = node1.node.getMultiaddrs()[0]?.toString();
        if (dialTarget) {
            await node2.connectToPeer(dialTarget);
            await node3.connectToPeer(dialTarget);
        }

        await waitFor(async () => node1.getConnectedPeers().length >= 2, 5000);

        // Create RoomManagers
        rooms1 = new RoomManager(identity1, node1, storage1);
        rooms2 = new RoomManager(identity2, node2, storage2);
        rooms3 = new RoomManager(identity3, node3, storage3);
    }, 30000);

    afterAll(async () => {
        await node1?.stop();
        await node2?.stop();
        await node3?.stop();
        try { rmSync(testDir, { recursive: true, force: true }); } catch {}
    }, 15000);

    // ── Domain Addressing ───────────────────────────────────────

    describe('Domain Addressing', () => {
        it('nous://sophia.thinkers resolves to her did:key', () => {
            const resolved = registry.resolve('nous://sophia.thinkers');
            expect(resolved).not.toBeNull();
            expect(resolved!.didKey).toBe(identity1.did);
            expect(resolved!.status).toBe('active');
        });

        it('nous://hermes.thinkers resolves to his did:key', () => {
            const resolved = registry.resolve('nous://hermes.thinkers');
            expect(resolved).not.toBeNull();
            expect(resolved!.didKey).toBe(identity2.did);
        });

        it('unregistered DID does not resolve', () => {
            const record = registry.lookupByDid(identity3.did);
            expect(record).toBeNull();
        });

        it('can build and parse nous:// URIs round-trip', () => {
            const uri = buildNousUri('sophia', 'thinkers');
            expect(uri).toBe('nous://sophia.thinkers');

            const parsed = parseNousUri(uri!);
            expect(parsed!.name).toBe('sophia');
            expect(parsed!.gridDomain).toBe('thinkers');
        });
    });

    // ── Communication Gate ──────────────────────────────────────

    describe('Communication Gate', () => {
        it('should ALLOW registered Sophia to send', () => {
            const envelope = createEnvelope(identity1, 'chat.msg', 'agora', { text: 'hello from sophia' });
            const result = gate.check(envelope, { skipReplayCheck: true });
            expect(result.allowed).toBe(true);
            expect(result.domain!.fullAddress).toBe('nous://sophia.thinkers');
        });

        it('should REJECT unregistered Intruder', () => {
            const envelope = createEnvelope(identity3, 'chat.msg', 'agora', { text: 'sneaking in' });
            const result = gate.check(envelope, { skipReplayCheck: true });
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('not registered');
        });
    });

    // ── End-to-End P2P with Gate ────────────────────────────────

    describe('P2P Messaging with Domain Gate', () => {
        it('nous://sophia.thinkers sends → nous://hermes.thinkers receives, gate passes', async () => {
            const roomId = 'agora-domain-test';
            const receivedAndGated: Array<{ envelope: SwpEnvelope; gateResult: ReturnType<typeof gate.check> }> = [];

            // Hermes joins and applies gate check on incoming messages
            await rooms2.joinRoom(roomId);
            rooms2.on('chat:message', (_roomId: string, envelope: SwpEnvelope) => {
                if (envelope.from.did !== identity2.did) {
                    const gateResult = gate.check(envelope, { skipReplayCheck: true });
                    receivedAndGated.push({ envelope, gateResult });
                }
            });

            // Sophia joins
            await rooms1.joinRoom(roomId);
            await new Promise(r => setTimeout(r, 2000));

            // Sophia sends
            await rooms1.sendMessage(roomId, 'Greetings from nous://sophia.thinkers');

            await waitFor(async () => receivedAndGated.length > 0, 10000);

            // Verify message received AND passed gate
            const { envelope, gateResult } = receivedAndGated[0];
            expect(envelope.body.text).toBe('Greetings from nous://sophia.thinkers');
            expect(envelope.from.name).toBe('Sophia');
            expect(gateResult.allowed).toBe(true);
            expect(gateResult.domain!.fullAddress).toBe('nous://sophia.thinkers');
        }, 20000);

        it('unregistered Intruder message is rejected by gate', async () => {
            const roomId = 'agora-intruder-test';
            const allReceived: Array<{ envelope: SwpEnvelope; gateResult: ReturnType<typeof gate.check> }> = [];

            // Hermes joins with gate enforcement
            await rooms2.joinRoom(roomId);
            rooms2.on('chat:message', (_roomId: string, envelope: SwpEnvelope) => {
                if (envelope.from.did !== identity2.did) {
                    const gateResult = gate.check(envelope, { skipReplayCheck: true });
                    allReceived.push({ envelope, gateResult });
                }
            });

            // Intruder joins (they can connect P2P but aren't registered)
            await rooms3.joinRoom(roomId);
            await new Promise(r => setTimeout(r, 2000));

            // Intruder sends
            await rooms3.sendMessage(roomId, 'I should be blocked');

            await waitFor(async () => allReceived.length > 0, 10000);

            // Message arrived via P2P but gate REJECTS it
            const { envelope, gateResult } = allReceived[0];
            expect(envelope.body.text).toBe('I should be blocked');
            expect(envelope.from.name).toBe('Intruder');
            expect(gateResult.allowed).toBe(false);
            expect(gateResult.reason).toContain('not registered');
        }, 20000);
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
