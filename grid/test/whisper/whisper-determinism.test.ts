/**
 * Phase 11 Wave 4 — WHISPER-03 / D-11-13 determinism regression.
 *
 * Proves wall-clock independence and nonce-derivation determinism:
 * Two fresh simulations with identical seeds but different tickRateMs produce
 * byte-identical (tick, from_did, to_did, ciphertext_hash) tuples.
 *
 * tickRateMs is an injected Chronos parameter — changing it must NOT affect
 * the cryptographic or audit-chain output. This test proves that invariant.
 *
 * Same DID + tick + counter → identical ciphertext_hash tuple.
 *
 * NO Date.now in the simulation helper (wall-clock ban per D-11-13).
 * Date.now is frozen in the test to ensure byte-identical eventHash values.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildWhisperSim } from './_sim.js';

describe('whisper determinism — byte-identical replay across tickRateMs divergence', () => {
    it('yields identical (tick, from_did, to_did, ciphertext_hash) sequence regardless of tickRateMs', async () => {
        // Freeze Date.now so AuditChain.createdAt is identical across both runs.
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => {
            fakeNow += 1;
            return fakeNow;
        });

        const seeds = { whisperSeed: 'phase-11-det', ticks: 100, sends: 20 };

        // Reset fakeNow before each run for byte-identical createdAt values
        fakeNow = 1_700_000_000_000;
        const runA = await buildWhisperSim({ ...seeds, tickRateMs: 1_000_000 });

        fakeNow = 1_700_000_000_000;
        const runB = await buildWhisperSim({ ...seeds, tickRateMs: 1000 });

        fakeNow = 1_700_000_000_000;
        const runC = await buildWhisperSim({ ...seeds, tickRateMs: 50 });

        nowSpy.mockRestore();

        // Extract (tick, from_did, to_did, ciphertext_hash) tuples
        function extractTuples(result: typeof runA) {
            return result.entries
                .filter(e => e.eventType === 'nous.whispered')
                .map(e => {
                    const p = e.payload as {
                        tick: number;
                        from_did: string;
                        to_did: string;
                        ciphertext_hash: string;
                    };
                    return [p.tick, p.from_did, p.to_did, p.ciphertext_hash];
                });
        }

        const tuplesA = extractTuples(runA);
        const tuplesB = extractTuples(runB);
        const tuplesC = extractTuples(runC);

        // Must have ≥20 tuples (meaningful sample)
        expect(tuplesA.length).toBeGreaterThanOrEqual(20);
        expect(tuplesB.length).toBeGreaterThanOrEqual(20);
        expect(tuplesC.length).toBeGreaterThanOrEqual(20);

        // Core determinism invariant: tickRateMs has zero effect on tuple content
        expect(tuplesA).toEqual(tuplesB);
        expect(tuplesA).toEqual(tuplesC);
    });

    it('ciphertext_hash values are all valid 64-char lowercase hex', async () => {
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => { fakeNow += 1; return fakeNow; });

        const result = await buildWhisperSim({
            whisperSeed: 'phase-11-hex-check',
            ticks: 50,
            sends: 10,
        });

        nowSpy.mockRestore();

        const whispers = result.entries.filter(e => e.eventType === 'nous.whispered');
        for (const entry of whispers) {
            const p = entry.payload as { ciphertext_hash: string };
            expect(p.ciphertext_hash).toMatch(/^[0-9a-f]{64}$/);
        }
    });

    it('each whisper tuple has exactly the 4 closed keys (WHISPER-03)', async () => {
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => { fakeNow += 1; return fakeNow; });

        const result = await buildWhisperSim({
            whisperSeed: 'phase-11-closed-tuple',
            ticks: 50,
            sends: 10,
        });

        nowSpy.mockRestore();

        const whispers = result.entries.filter(e => e.eventType === 'nous.whispered');
        expect(whispers.length).toBeGreaterThanOrEqual(10);

        for (const entry of whispers) {
            const keys = Object.keys(entry.payload as Record<string, unknown>).sort();
            expect(keys).toEqual(['ciphertext_hash', 'from_did', 'tick', 'to_did']);
        }
    });
});
