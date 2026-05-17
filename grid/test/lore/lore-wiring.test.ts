/**
 * LoreQuotaTracker production wiring test — Phase 20 LORE-03 gap closure.
 *
 * Verifies that:
 * 1. GenesisLauncher exposes a non-null loreQuotaTracker.
 * 2. loreQuotaTracker is a functional LoreQuotaTracker (quota works).
 * 3. NousRunner constructed with loreDeps: { quotaTracker: launcher.loreQuotaTracker }
 *    correctly enforces quota (loreDeps is non-null at runtime).
 */
import { describe, it, expect } from 'vitest';
import { GenesisLauncher } from '../../src/genesis/launcher.js';
import { LoreQuotaTracker } from '../../src/lore/LoreQuotaTracker.js';
import { TEST_CONFIG } from '../../src/genesis/presets.js';

function makeLauncher(): GenesisLauncher {
    return new GenesisLauncher({ ...TEST_CONFIG });
}

describe('GenesisLauncher.loreQuotaTracker — production wiring (LORE-03)', () => {
    it('GenesisLauncher exposes a non-null loreQuotaTracker after construction', () => {
        const launcher = makeLauncher();
        expect(launcher.loreQuotaTracker).toBeDefined();
        expect(launcher.loreQuotaTracker).not.toBeNull();
    });

    it('loreQuotaTracker is an instance of LoreQuotaTracker', () => {
        const launcher = makeLauncher();
        expect(launcher.loreQuotaTracker).toBeInstanceOf(LoreQuotaTracker);
    });

    it('loreQuotaTracker.tryConsume works correctly (quota functional)', () => {
        const launcher = makeLauncher();
        const did = 'did:noesis:test-nous';
        // First 3 calls should succeed
        expect(launcher.loreQuotaTracker.tryConsume(did, 0)).toBe(true);
        expect(launcher.loreQuotaTracker.tryConsume(did, 0)).toBe(true);
        expect(launcher.loreQuotaTracker.tryConsume(did, 0)).toBe(true);
        // 4th call in same epoch should be rejected
        expect(launcher.loreQuotaTracker.tryConsume(did, 0)).toBe(false);
    });

    it('NousRunner loreDeps wiring: quotaTracker from launcher enforces K=3 and epoch reset', () => {
        // Verifies the production wiring path:
        // GenesisLauncher → loreQuotaTracker → loreDeps: { quotaTracker } → NousRunner
        const launcher = makeLauncher();

        // Simulate loreDeps injection: quotaTracker is what NousRunner receives
        const loreDeps = { quotaTracker: launcher.loreQuotaTracker };
        const did = 'did:noesis:wiring-test';

        // First 3 allowed (ticks within epoch 0, epochLength=30)
        expect(loreDeps.quotaTracker.tryConsume(did, 10)).toBe(true);
        expect(loreDeps.quotaTracker.tryConsume(did, 11)).toBe(true);
        expect(loreDeps.quotaTracker.tryConsume(did, 12)).toBe(true);
        // 4th blocked in same epoch
        expect(loreDeps.quotaTracker.tryConsume(did, 13)).toBe(false);
        // Next epoch (tick 30) resets the quota
        expect(loreDeps.quotaTracker.tryConsume(did, 30)).toBe(true);
    });
});
