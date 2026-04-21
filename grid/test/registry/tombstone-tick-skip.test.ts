/**
 * Phase 8 AGENCY-05 — SC#3 tick-skip guard in NousRunner.
 *
 * Verifies that a tombstoned Nous does not receive Brain sendTick calls.
 * The guard fires in NousRunner.tick() by checking registry status BEFORE
 * dispatching to the brain bridge.
 *
 * Cases:
 *   1. Active Nous — tick proceeds (bridge.sendTick called).
 *   2. Tombstoned Nous — tick is skipped (bridge.sendTick NOT called).
 *   3. Unknown DID in registry — tick proceeds (no record = not deleted).
 */

import { describe, it, expect, vi } from 'vitest';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { SpatialMap } from '../../src/space/map.js';
import { AuditChain } from '../../src/audit/chain.js';
import { LogosEngine } from '../../src/logos/engine.js';
import type { IBrainBridge, BrainAction } from '../../src/integration/types.js';
import type { EconomyManager } from '../../src/economy/config.js';

const ALPHA_DID = 'did:noesis:alpha';
const AGORA     = 'agora';

function makeBridge(connected = true): IBrainBridge {
    return {
        connected,
        sendTick: vi.fn().mockResolvedValue([] as BrainAction[]),
        sendMessage: vi.fn().mockResolvedValue([] as BrainAction[]),
        sendEvent: vi.fn(),
        getState: vi.fn().mockResolvedValue({}),
        queryMemory: vi.fn().mockResolvedValue({ entries: [] }),
        forceTelos: vi.fn().mockResolvedValue({ telos_hash_before: 'a'.repeat(64), telos_hash_after: 'b'.repeat(64) }),
    } as IBrainBridge;
}

function makeRunner(
    registry: NousRegistry,
    bridge: IBrainBridge,
): NousRunner {
    const space = new SpatialMap();
    const audit = new AuditChain();
    const economy: EconomyManager = {
        validateTransfer: vi.fn().mockReturnValue({ valid: true }),
    } as unknown as EconomyManager;

    return new NousRunner({
        nousDid: ALPHA_DID,
        nousName: 'Alpha',
        bridge,
        space,
        audit,
        registry,
        economy,
    });
}

describe('SC#3 tick-skip guard — tombstoned Nous skips Brain sendTick', () => {
    it('active Nous: tick proceeds — bridge.sendTick is called', async () => {
        const registry = new NousRegistry();
        registry.spawn(
            { did: ALPHA_DID, name: 'Alpha', publicKey: 'pk', region: AGORA },
            'test.grid', 0, 100,
        );
        const bridge = makeBridge();
        const runner = makeRunner(registry, bridge);

        await runner.tick(1, 0);

        expect(bridge.sendTick).toHaveBeenCalledTimes(1);
    });

    it('tombstoned Nous: tick is skipped — bridge.sendTick NOT called', async () => {
        const registry = new NousRegistry();
        const space = new SpatialMap();
        registry.spawn(
            { did: ALPHA_DID, name: 'Alpha', publicKey: 'pk', region: AGORA },
            'test.grid', 0, 100,
        );
        // Tombstone BEFORE tick fires
        registry.tombstone(ALPHA_DID, 5, space);

        const bridge = makeBridge();
        const runner = makeRunner(registry, bridge);

        await runner.tick(6, 0);

        expect(bridge.sendTick).not.toHaveBeenCalled();
    });

    it('unknown DID (not in registry): tick proceeds — no guard triggers', async () => {
        // Registry has NO record for ALPHA_DID — `registry.get()` returns undefined.
        // The guard only triggers on status === 'deleted'; undefined ≠ deleted.
        const registry = new NousRegistry();
        const bridge = makeBridge();
        const runner = makeRunner(registry, bridge);

        await runner.tick(1, 0);

        expect(bridge.sendTick).toHaveBeenCalledTimes(1);
    });
});
