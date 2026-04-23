/**
 * Phase 11 Wave 4 — WHISPER-03 zero-diff audit regression.
 *
 * Clone of grid/test/dialogue/zero-diff.test.ts (Phase 7 shipped).
 *
 * Invariant: adding N passive 'nous.whispered' observers to AuditChain
 * MUST NOT mutate any entries[].eventHash. Proof: run the SAME simulation
 * twice — once with 0 passive observers, once with N passive observers —
 * and assert entries.map(e => e.eventHash) is byte-identical.
 *
 * Additional: strict 4-key audit tuple assertion for each whisper entry.
 * No extra fields ever leak into audit payloads.
 *
 * Phase 11 Wave 4 / WHISPER-03 carry-forward invariant #2 (zero-diff).
 */

import { describe, it, expect, vi } from 'vitest';
import { buildWhisperSim } from './_sim.js';
import type { AuditEntry } from '../../src/audit/types.js';

describe('whisper zero-diff — passive observers do not mutate chain hashes', () => {
    it('0 vs 3 passive observers produce byte-identical eventHash arrays', async () => {
        // Freeze Date.now for deterministic createdAt values across both runs.
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => {
            fakeNow += 1;
            return fakeNow;
        });

        const seeds = {
            whisperSeed: 'phase-11-zero-diff',
            ticks: 100,
            sends: 25,
        };

        // Run A: zero passive observers
        fakeNow = 1_700_000_000_000;
        const runA = await buildWhisperSim({ ...seeds, observers: [] });

        // Run B: 3 passive observers on 'nous.whispered'
        fakeNow = 1_700_000_000_000;
        const seenHashesB: string[] = [];
        const passiveObserver1 = (entry: AuditEntry): void => {
            if (entry.eventType === 'nous.whispered') {
                seenHashesB.push(entry.eventHash);
            }
        };
        const passiveObserver2 = (_entry: AuditEntry): void => {
            // No-op passive observer — just subscribes
        };
        const passiveObserver3 = (entry: AuditEntry): void => {
            // Reads payload but MUST NOT modify entry
            void entry.payload;
        };
        const runB = await buildWhisperSim({
            ...seeds,
            observers: [passiveObserver1, passiveObserver2, passiveObserver3],
        });

        nowSpy.mockRestore();

        // Core zero-diff assertion: eventHash arrays are byte-identical
        const hashesA = runA.entries.map(e => e.eventHash);
        const hashesB = runB.entries.map(e => e.eventHash);

        expect(hashesA.length).toBeGreaterThanOrEqual(25);
        expect(hashesA).toEqual(hashesB);

        // Passive observer1 collected hashes — should be the SAME hashes as in runA
        const whisperHashesA = runA.entries
            .filter(e => e.eventType === 'nous.whispered')
            .map(e => e.eventHash);
        expect(seenHashesB).toEqual(whisperHashesA);
    });

    it('strictly 4-key tuple in each audit entry — no extra fields leak', async () => {
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => { fakeNow += 1; return fakeNow; });

        const result = await buildWhisperSim({
            whisperSeed: 'phase-11-zero-diff-tuple',
            ticks: 50,
            sends: 20,
        });

        nowSpy.mockRestore();

        const whispers = result.entries.filter(e => e.eventType === 'nous.whispered');
        expect(whispers.length).toBeGreaterThanOrEqual(20);

        for (const entry of whispers) {
            // STRICT 4-KEY TUPLE — no extras ever (WHISPER-03)
            const keys = Object.keys(entry.payload as Record<string, unknown>).sort();
            expect(keys).toEqual(['ciphertext_hash', 'from_did', 'tick', 'to_did']);
        }
    });

    it('whispers between unobserved pairs produce the same hashes as whispers between observed pairs', async () => {
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => { fakeNow += 1; return fakeNow; });

        const seeds = { whisperSeed: 'phase-11-cross-pair', ticks: 60, sends: 15 };

        // Run with observer on SOME whispers only
        fakeNow = 1_700_000_000_000;
        const observedDids = new Set(['did:noesis:alpha', 'did:noesis:beta']);
        const partialObserver = (entry: AuditEntry): void => {
            if (entry.eventType === 'nous.whispered') {
                const p = entry.payload as { from_did: string; to_did: string };
                // Only "observe" alpha→beta direction
                void (observedDids.has(p.from_did) && observedDids.has(p.to_did));
            }
        };
        const runWithPartial = await buildWhisperSim({ ...seeds, observers: [partialObserver] });

        // Run with NO observers
        fakeNow = 1_700_000_000_000;
        const runWithNone = await buildWhisperSim({ ...seeds, observers: [] });

        nowSpy.mockRestore();

        // Byte-identical regardless of which direction was "observed"
        const hashesPartial = runWithPartial.entries.map(e => e.eventHash);
        const hashesNone = runWithNone.entries.map(e => e.eventHash);
        expect(hashesPartial).toEqual(hashesNone);
    });
});
