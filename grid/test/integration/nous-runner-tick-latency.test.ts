/**
 * Plan 25a-04 Task 2: NousRunner per-instance tick-latency ring buffer.
 *
 * Invariants:
 *   - Each sendTick() call pushes duration into RingBuffer<number>(100)
 *   - getTickMetrics() returns {p50, p95, queue_depth, sample_count}
 *   - sample_count === number of ticks (up to 100)
 *   - p50 and p95 are positive after ticks (measured in ms)
 *   - After 101 ticks, sample_count remains 100 (ring eviction)
 */

import { describe, it, expect } from 'vitest';
import { NousRunner } from '../../src/integration/nous-runner.js';
import { AuditChain } from '../../src/audit/chain.js';
import { NousRegistry } from '../../src/registry/registry.js';
import { SpatialMap } from '../../src/space/map.js';
import { EconomyManager } from '../../src/economy/config.js';
import type { IBrainBridge, BrainAction, TickParams } from '../../src/integration/types.js';

/** Fake bridge that resolves after a ~10ms delay */
function makeFakeBridge(delayMs = 10): IBrainBridge {
    return {
        connected: true,
        async sendTick(_params: TickParams): Promise<BrainAction[]> {
            await new Promise(r => setTimeout(r, delayMs));
            return [];
        },
        async sendMessage(_params: unknown): Promise<BrainAction[]> { return []; },
        async getState(): Promise<Record<string, unknown>> { return {}; },
        async queryMemory(_p: unknown): Promise<{ entries: [] }> { return { entries: [] }; },
        async forceTelos(_t: unknown): Promise<{ telos_hash_before: string; telos_hash_after: string }> {
            return { telos_hash_before: 'a', telos_hash_after: 'b' };
        },
    };
}

function makeRunner(bridge: IBrainBridge): NousRunner {
    const audit = new AuditChain();
    const registry = new NousRegistry();
    const space = new SpatialMap();
    const economy = new EconomyManager({ minTransfer: 1, maxTransfer: 1000 });

    registry.spawn(
        { did: 'did:noesis:test01', name: 'Test', publicKey: 'pk', region: 'agora' },
        'genesis',
        0,
        100,
    );

    return new NousRunner({
        nousDid: 'did:noesis:test01',
        nousName: 'Test',
        bridge,
        space,
        audit,
        registry,
        economy,
    });
}

describe('NousRunner tick-latency ring buffer', () => {
    it('getTickMetrics returns zero values when no ticks sent', () => {
        const runner = makeRunner(makeFakeBridge(0));
        const metrics = runner.getTickMetrics();
        expect(metrics.p50).toBe(0);
        expect(metrics.p95).toBe(0);
        expect(metrics.sample_count).toBe(0);
        expect(metrics.queue_depth).toBe(0);
    });

    it('sample_count === 5 after 5 ticks', async () => {
        const runner = makeRunner(makeFakeBridge(5));
        for (let i = 0; i < 5; i++) {
            await runner.tick(i, 0);
        }
        const metrics = runner.getTickMetrics();
        expect(metrics.sample_count).toBe(5);
    });

    it('p50 and p95 are positive after ticks with delay', async () => {
        const runner = makeRunner(makeFakeBridge(10));
        for (let i = 0; i < 5; i++) {
            await runner.tick(i, 0);
        }
        const metrics = runner.getTickMetrics();
        expect(metrics.p50).toBeGreaterThan(0);
        expect(metrics.p95).toBeGreaterThan(0);
    });

    it('sample_count stays at 100 after 101 ticks (ring eviction)', async () => {
        const runner = makeRunner(makeFakeBridge(0));
        for (let i = 0; i < 101; i++) {
            await runner.tick(i, 0);
        }
        const metrics = runner.getTickMetrics();
        expect(metrics.sample_count).toBe(100);
    });
});
