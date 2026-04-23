/**
 * Phase 11 Wave 0 RED stub — WHISPER-05 tick-indexed rate limit.
 *
 * B=10/N=100 accept/reject matrix stub.
 * Imports RateLimiter from grid/src/whisper/rate-limit.ts (Wave 2).
 *
 * RED at Wave 0: grid/src/whisper/rate-limit.ts does not yet exist.
 * Wave 2 turns this GREEN by creating rate-limit.ts with a class/function
 * that tracks per-sender tick-indexed send counts.
 *
 * D-11-08: tick-indexed primary (B=10 sends per N=100 ticks, per sender DID,
 * env-overridable via WHISPER_RATE_BUDGET / WHISPER_RATE_WINDOW_TICKS).
 */
import { describe, expect, it } from 'vitest';
import { WHISPER_CONFIG } from '../../src/whisper/config.js';

describe('whisper rate limit — B=10/N=100 accept/reject matrix (RED until Wave 2)', () => {
    it('WHISPER_CONFIG has correct default rateBudget', () => {
        expect(WHISPER_CONFIG.rateBudget).toBe(10);
    });

    it('WHISPER_CONFIG has correct default rateWindowTicks', () => {
        expect(WHISPER_CONFIG.rateWindowTicks).toBe(100);
    });

    it('WHISPER_CONFIG has envelopeVersion 1', () => {
        expect(WHISPER_CONFIG.envelopeVersion).toBe(1);
    });

    it('WHISPER_CONFIG is frozen', () => {
        expect(Object.isFrozen(WHISPER_CONFIG)).toBe(true);
    });

    it('imports RateLimiter from grid/src/whisper/rate-limit.ts (RED until Wave 2)', async () => {
        // This will throw with "Cannot find module" until Wave 2 creates rate-limit.ts
        await expect(
            import('../../src/whisper/rate-limit.js'),
        ).resolves.toHaveProperty('RateLimiter');
    });

    it('RateLimiter accepts up to B sends per N ticks (RED until Wave 2)', async () => {
        const mod = await import('../../src/whisper/rate-limit.js') as {
            RateLimiter: new (budget: number, windowTicks: number) => {
                check: (senderDid: string, tick: number) => boolean;
                record: (senderDid: string, tick: number) => void;
            };
        };
        const rl = new mod.RateLimiter(WHISPER_CONFIG.rateBudget, WHISPER_CONFIG.rateWindowTicks);
        const did = 'did:noesis:sender01';
        // First B sends in tick 1 should be accepted
        for (let i = 0; i < WHISPER_CONFIG.rateBudget; i++) {
            expect(rl.check(did, 1)).toBe(true);
            rl.record(did, 1);
        }
        // B+1th send should be rejected
        expect(rl.check(did, 1)).toBe(false);
    });

    it('RateLimiter resets window after N ticks elapse (RED until Wave 2)', async () => {
        const mod = await import('../../src/whisper/rate-limit.js') as {
            RateLimiter: new (budget: number, windowTicks: number) => {
                check: (senderDid: string, tick: number) => boolean;
                record: (senderDid: string, tick: number) => void;
            };
        };
        const rl = new mod.RateLimiter(WHISPER_CONFIG.rateBudget, WHISPER_CONFIG.rateWindowTicks);
        const did = 'did:noesis:sender02';
        // Exhaust budget at tick 1
        for (let i = 0; i < WHISPER_CONFIG.rateBudget; i++) {
            rl.record(did, 1);
        }
        expect(rl.check(did, 1)).toBe(false);
        // After N+1 ticks, budget should reset
        const nextWindowTick = 1 + WHISPER_CONFIG.rateWindowTicks + 1;
        expect(rl.check(did, nextWindowTick)).toBe(true);
    });
});
