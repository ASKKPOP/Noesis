/**
 * Phase 10b Wave 0 RED stub — CHRONOS-02 zero-diff invariant for bios entries.
 *
 * Clones grid/test/audit/zero-diff-ananke.test.ts shape with renames.
 *
 * Invariant: appending bios.birth / bios.death entries to the chain does
 * NOT perturb the eventHash of any pre-existing, unrelated entry. Bios
 * emitters are sole-producer pure appends; they do not mutate prior
 * chain state.
 *
 * Additional CHRONOS-02 specific assertion: every audit entry's payload
 * tick (when present) equals the loop counter at which it was appended —
 * audit_tick === system_tick → no chronos-induced drift (chronos is a
 * passive observer; it does not modify audit timing).
 *
 * RED at Wave 0: imports `appendBiosBirth` from a module that does not
 * exist. Wave 2 + Wave 4 turn GREEN.
 */
import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendBiosBirth } from '../../src/bios/appendBiosBirth.js';

describe('Phase 10b zero-diff invariant — bios.birth + tick discipline', () => {
    it('appending bios.birth entries does not perturb the eventHash of preceding non-bios entries', () => {
        // Freeze Date.now for deterministic createdAt across both runs.
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => {
            fakeNow += 1;
            return fakeNow;
        });

        const DID_A = 'did:noesis:zero-diff-bios-alpha';
        const DID_B = 'did:noesis:zero-diff-bios-beta';
        const PSYCHE = 'a'.repeat(64);

        const baselineNoBios = (): string[] => {
            fakeNow = 1_700_000_000_000;
            const c = new AuditChain();
            for (let i = 0; i < 30; i++) {
                if (i % 3 === 0) {
                    c.append('tick', 'system', { tick: i, epoch: Math.floor(i / 10) });
                } else {
                    const speaker = i % 2 === 0 ? DID_A : DID_B;
                    c.append('nous.spoke', speaker, {
                        channel: 'channel-a',
                        text: `utterance-${i}`,
                        tick: i,
                    });
                }
            }
            return c.all().map(e => e.eventHash);
        };

        const withBiosInterleaved = (): { hashes: string[]; biosCount: number } => {
            fakeNow = 1_700_000_000_000;
            const c = new AuditChain();
            let biosCount = 0;
            for (let i = 0; i < 30; i++) {
                if (i % 3 === 0) {
                    c.append('tick', 'system', { tick: i, epoch: Math.floor(i / 10) });
                } else {
                    const speaker = i % 2 === 0 ? DID_A : DID_B;
                    c.append('nous.spoke', speaker, {
                        channel: 'channel-a',
                        text: `utterance-${i}`,
                        tick: i,
                    });
                }
                if (i > 0 && i % 10 === 0) {
                    appendBiosBirth(c, DID_A, { did: DID_A, psyche_hash: PSYCHE, tick: i });
                    biosCount += 1;
                }
            }
            return { hashes: c.all().map(e => e.eventHash), biosCount };
        };

        const baseline = baselineNoBios();
        const withBios = withBiosInterleaved();

        expect(withBios.hashes.length).toBe(baseline.length + withBios.biosCount);

        // Pre-bios hashes byte-identical to baseline at same indices.
        fakeNow = 1_700_000_000_000;
        const c = new AuditChain();
        for (let i = 0; i < 30; i++) {
            if (i % 3 === 0) {
                c.append('tick', 'system', { tick: i, epoch: Math.floor(i / 10) });
            } else {
                const speaker = i % 2 === 0 ? DID_A : DID_B;
                c.append('nous.spoke', speaker, {
                    channel: 'channel-a',
                    text: `utterance-${i}`,
                    tick: i,
                });
            }
            if (i > 0 && i % 10 === 0) {
                appendBiosBirth(c, DID_A, { did: DID_A, psyche_hash: PSYCHE, tick: i });
            }
        }

        const firstBiosIdx = c.all().findIndex(e => e.eventType === 'bios.birth');
        expect(firstBiosIdx).toBeGreaterThan(0);

        const preBiosHashes = c.all().slice(0, firstBiosIdx).map(e => e.eventHash);
        for (let i = 0; i < preBiosHashes.length; i++) {
            expect(preBiosHashes[i], `entry ${i} hash must match baseline`).toBe(baseline[i]);
        }

        expect(withBios.biosCount).toBeGreaterThanOrEqual(1);

        nowSpy.mockRestore();
    });

    it('audit_tick === loop counter for every entry (no chronos-induced drift)', () => {
        const c = new AuditChain();
        const PSYCHE = 'a'.repeat(64);
        const DID = 'did:noesis:zero-diff-tick';
        for (let t = 0; t < 100; t++) {
            c.append('tick', 'system', { tick: t });
            if (t === 50) {
                appendBiosBirth(c, DID, { did: DID, psyche_hash: PSYCHE, tick: t });
            }
        }
        // Every entry whose payload carries `tick` must equal the loop
        // counter at append time — chronos modifies subjective experience
        // (Brain-side only), never audit timing.
        const entries = c.all();
        let loopCounter = 0;
        let biosSeen = false;
        for (const e of entries) {
            const payload = e.payload as Record<string, unknown>;
            if (e.eventType === 'tick') {
                expect(payload.tick).toBe(loopCounter);
                loopCounter += 1;
            } else if (e.eventType === 'bios.birth') {
                // bios.birth is appended INSIDE the tick==50 iteration,
                // after `c.append('tick', ...)` has already incremented
                // loopCounter from 50 to 51. So the bios.birth tick=50
                // matches loopCounter - 1 at this moment.
                expect(payload.tick).toBe(loopCounter - 1);
                biosSeen = true;
            }
        }
        expect(biosSeen).toBe(true);
    });
});
