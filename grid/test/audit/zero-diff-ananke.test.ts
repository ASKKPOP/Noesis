/**
 * Phase 10a Plan 06 Task 1 Test A — Zero-diff regression for Ananke emitter.
 *
 * T-10a-27 defense: adding `ananke.drive_crossed` entries to the chain via
 * the sole-producer emitter (`appendAnankeDriveCrossed`) MUST NOT perturb
 * the eventHash of any pre-existing, unrelated entry. Emitter is a pure
 * append — not a listener that mutates chain state.
 *
 * ---- Deviation note (Rule 3 — blocking issue) ----
 * The plan's pseudocode builds a GenesisLauncher with `fixedTime` /
 * `disableAnanke` / `tickOnce()` / `shutdown()` seams. Those seams do not
 * exist in grid/src/genesis/launcher.ts: Ananke on the Grid side is an
 * emitter called from the nous-runner dispatcher (Plan 10a-04), not a
 * launcher-level listener toggled on/off. Adding a `disableAnanke` flag
 * retroactively would be out-of-scope under the SCOPE BOUNDARY rule.
 *
 * We rescope the test to operate directly on AuditChain — the level at
 * which zero-diff is actually meaningful. The emitter produces new
 * entries; the invariant under test is that pre-existing entries' hashes
 * are unchanged whether or not the emitter appends afterwards.
 *
 * Structural template: grid/test/dialogue/zero-diff.test.ts (Date.now spy
 * + two runs compared entry-by-entry via eventHash sequence).
 */

import { describe, it, expect, vi } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendAnankeDriveCrossed } from '../../src/ananke/index.js';

describe('Phase 10a zero-diff invariant — ananke.drive_crossed emitter', () => {
    it('appending ananke.drive_crossed entries does not perturb the eventHash of preceding non-ananke entries', () => {
        // Freeze Date.now so createdAt is deterministic across both runs.
        const nowSpy = vi.spyOn(Date, 'now');
        let fakeNow = 1_700_000_000_000;
        nowSpy.mockImplementation(() => {
            fakeNow += 1;
            return fakeNow;
        });

        const DID_A = 'did:noesis:zero-diff-ananke-alpha';
        const DID_B = 'did:noesis:zero-diff-ananke-beta';

        const runScenarioB_baselineNoAnanke = (): string[] => {
            fakeNow = 1_700_000_000_000;
            const c = new AuditChain();
            // 30 non-ananke appends alternating tick + nous.spoke, similar to
            // what a short simulation would produce pre-drive-crossing.
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

        const runScenarioA_withAnankeInterleaved = (): {
            hashes: string[];
            anankeCount: number;
        } => {
            fakeNow = 1_700_000_000_000;
            const c = new AuditChain();
            let anankeCount = 0;
            // Same 30 non-ananke appends, but with an ananke.drive_crossed
            // appended AFTER every 10th entry (simulating a drive crossing
            // emitted on those ticks). The baseline 30 entries should still
            // hash identically to scenario B at their relative positions;
            // we verify that by filtering ananke entries out before compare.
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
                    appendAnankeDriveCrossed(c, DID_A, {
                        did: DID_A,
                        tick: i,
                        drive: 'hunger',
                        level: i % 20 === 0 ? 'med' : 'high',
                        direction: 'rising',
                    });
                    anankeCount += 1;
                }
            }
            return { hashes: c.all().map(e => e.eventHash), anankeCount };
        };

        const baseline = runScenarioB_baselineNoAnanke();
        const withAnanke = runScenarioA_withAnankeInterleaved();

        // 1. Scenario A has exactly baseline.length + anankeCount entries.
        expect(withAnanke.hashes.length).toBe(baseline.length + withAnanke.anankeCount);

        // 2. Every eventHash in scenario B appears in scenario A's ordered hash
        //    sequence, in the same relative order (modulo the ananke insertions).
        //    Concretely: walk scenario A, skip ananke-derived positions, assert
        //    the remaining stream is byte-identical to scenario B.
        //
        // We know ananke entries are inserted at positions 10+1, 20+2 in the
        // interleaved run (after the 10th and 20th base entries, shifting by
        // the number of prior ananke inserts). Rather than compute those
        // offsets, we identify them by re-running the chain and classifying
        // entries by eventType.
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
                appendAnankeDriveCrossed(c, DID_A, {
                    did: DID_A,
                    tick: i,
                    drive: 'hunger',
                    level: i % 20 === 0 ? 'med' : 'high',
                    direction: 'rising',
                });
            }
        }
        const nonAnankeHashes = c
            .all()
            .filter(e => e.eventType !== 'ananke.drive_crossed')
            .map(e => e.eventHash);

        // Core invariant: the non-ananke hash sequence with emitter active
        // equals the baseline hash sequence without emitter active. The
        // emitter's appends shift subsequent entries' prevHash, but BEFORE
        // the first emitter call, the hashes are identical — and because
        // each non-ananke entry's hash is derived from its own content +
        // prevHash, a single ananke insertion shifts every subsequent
        // non-ananke hash. So we assert the first K entries (before any
        // ananke insertion) match exactly, and count parity for the rest.
        const firstAnankeIdx = c.all().findIndex(e => e.eventType === 'ananke.drive_crossed');
        expect(firstAnankeIdx).toBeGreaterThan(0);

        const preAnankeHashes = c
            .all()
            .slice(0, firstAnankeIdx)
            .map(e => e.eventHash);

        // Every eventHash before the first ananke emission is byte-identical
        // to the scenario-B baseline at the same index. This is the true
        // zero-diff property of a pure append emitter: it does not
        // retroactively perturb already-committed entries.
        for (let i = 0; i < preAnankeHashes.length; i++) {
            expect(preAnankeHashes[i], `entry ${i} hash must match baseline`).toBe(
                baseline[i],
            );
        }

        // Parity: scenario A's non-ananke entry count equals baseline.
        expect(nonAnankeHashes.length).toBe(baseline.length);

        // Sanity: emitter fired at least once.
        expect(withAnanke.anankeCount).toBeGreaterThanOrEqual(1);

        nowSpy.mockRestore();
    });
});
