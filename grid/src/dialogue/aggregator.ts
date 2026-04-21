/**
 * Phase 7 Plan 01 — DialogueAggregator
 *
 * Listener-driven, pull-query aggregator that detects bidirectional
 * peer dialogue from the grid AuditChain and emits a DialogueContext to
 * each participant on their next tick.
 *
 * Key invariants:
 *   - Pure observer: registering N listeners (including this aggregator)
 *     on AuditChain MUST NOT alter any entries[].eventHash. Verified by
 *     grid/test/dialogue/zero-diff.test.ts.
 *   - No wall-clock: no Date.now / Math.random / performance.now anywhere
 *     in this module. All timing is driven by entry.payload.tick (D-07).
 *   - Deterministic iteration: Array.from(map.keys()).sort() before
 *     iterating (Pitfall 2 in 07-RESEARCH.md).
 *   - Pause-safe: reset() is called from GenesisLauncher when WorldClock
 *     pauses (D-04) so dialogue windows never span pause boundaries.
 *
 * Pattern source:
 *   - AuditChain listener surface: grid/src/audit/chain.ts (lines 50-58)
 *   - Pull-query tick loop: grid/src/integration/grid-coordinator.ts (lines 42-51)
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { computeDialogueId } from './dialogue-id.js';
import type {
    DialogueAggregatorConfig,
    DialogueContext,
    SpokeObservation,
} from './types.js';

const MAX_TEXT_LEN = 200;           // D-09 utterance text truncation cap
const MAX_UTTERANCES = 5;           // D-09 per-context utterance cap
const BUFFER_FACTOR = 4;            // Per-pair buffer cap = windowTicks * BUFFER_FACTOR (T-07-04)

interface PairBuffer {
    /** Sorted DIDs that define this pair. */
    readonly sortedDids: readonly string[];
    /** Channel (per D-05, channel is part of pair identity). */
    readonly channel: string;
    /** First tick in the current sliding window; advances as old utterances prune. */
    windowStartTick: number;
    /** Ordered utterances within the current window. */
    utterances: SpokeObservation[];
    /** Set of speaker DIDs seen in this window — size 2 ⇒ bidirectional. */
    readonly speakersInWindow: Set<string>;
}

export class DialogueAggregator {
    private readonly audit: AuditChain;
    private readonly config: DialogueAggregatorConfig;

    /** Key: sortedDids.join('|') + '|' + channel. */
    private buffers: Map<string, PairBuffer> = new Map();

    /**
     * dialogue_ids already delivered, keyed by `${pair_key}|${did}`.
     * Each participant receives a given dialogue_id exactly once (D-08, D-11).
     * Cleared on reset() (D-04).
     */
    private delivered: Map<string, Set<string>> = new Map();

    constructor(audit: AuditChain, config: DialogueAggregatorConfig) {
        this.audit = audit;
        this.config = config;
        this.audit.onAppend((entry) => this.handleEntry(entry));
    }

    /**
     * Drain any dialogue contexts owed to `did` as of `currentTick`.
     *
     * The coordinator calls this per-runner per-tick before invoking
     * `runner.tick(...)`. Each returned DialogueContext should be plumbed
     * through TickParams.dialogue_context on the runner's next sendTick.
     *
     * This method mutates the `delivered` map (records each emitted
     * dialogue_id so the same window does not re-emit) but does not
     * touch AuditChain state — listener is pure.
     */
    drainPending(did: string, currentTick: number): DialogueContext[] {
        const results: DialogueContext[] = [];

        // Deterministic pair iteration (Pitfall 2).
        const keys = Array.from(this.buffers.keys()).sort();

        for (const key of keys) {
            const buf = this.buffers.get(key);
            if (!buf) continue;

            // Only emit for pairs that include this DID.
            if (!buf.sortedDids.includes(did)) continue;

            // Do NOT prune based on currentTick here — the buffer is kept
            // window-valid by ingestSpoke as new utterances arrive. drainPending
            // is a pure read of whatever bidirectional window has already
            // formed. Suppress unused-param warning by referencing currentTick:
            void currentTick;

            // Bidirectional + threshold gate (D-01).
            if (buf.speakersInWindow.size < 2) continue;
            if (buf.utterances.length < this.config.minExchanges) continue;

            const windowStartTick = buf.windowStartTick;
            const windowEndTick = buf.utterances[buf.utterances.length - 1]?.tick ?? windowStartTick;

            const dialogueId = computeDialogueId(buf.sortedDids, buf.channel, windowStartTick);

            // D-08 + D-11: each participant receives a given dialogue_id
            // at most once. Key by (pair_key, did) so drainPending(A) then
            // drainPending(B) both succeed for the same window, but a
            // repeat drainPending(A) for the same dialogue_id is a no-op.
            const deliveryKey = `${key}|${did}`;
            let deliveredForDid = this.delivered.get(deliveryKey);
            if (!deliveredForDid) {
                deliveredForDid = new Set();
                this.delivered.set(deliveryKey, deliveredForDid);
            }
            if (deliveredForDid.has(dialogueId)) continue;

            // Pick the counterparty (the other DID in the sorted pair).
            const counterparty = buf.sortedDids.find((d) => d !== did);
            if (!counterparty) continue;

            // Keep the LAST MAX_UTTERANCES utterances (D-09).
            const uttSlice = buf.utterances.slice(-MAX_UTTERANCES).map((u) => ({
                tick: u.tick,
                speaker_did: u.speaker_did,
                speaker_name: u.speaker_name,
                text: u.text, // already truncated at ingest
            }));

            const ctx: DialogueContext = {
                dialogue_id: dialogueId,
                counterparty_did: counterparty,
                channel: buf.channel,
                exchange_count: buf.utterances.length,
                window_start_tick: windowStartTick,
                window_end_tick: windowEndTick,
                utterances: uttSlice,
            };

            results.push(ctx);
            deliveredForDid.add(dialogueId);
        }

        return results;
    }

    /**
     * D-04: clear all buffered state. Called from GenesisLauncher when
     * WorldClock pauses so dialogue windows cannot span pause boundaries.
     */
    reset(): void {
        this.buffers = new Map();
        this.delivered = new Map();
    }

    // -------------------- internals --------------------

    private handleEntry(entry: AuditEntry): void {
        if (entry.eventType !== 'nous.spoke') return;

        const obs = this.extractObservation(entry);
        if (!obs) return;

        this.ingestSpoke(obs);
    }

    private extractObservation(entry: AuditEntry): SpokeObservation | null {
        const p = entry.payload;
        const tickRaw = p['tick'];
        const channelRaw = p['channel'];
        const textRaw = p['text'];
        const nameRaw = p['name'];

        if (typeof tickRaw !== 'number') return null;
        if (typeof channelRaw !== 'string') return null;
        if (typeof textRaw !== 'string') return null;

        const speaker_name = typeof nameRaw === 'string'
            ? nameRaw
            : entry.actorDid.split(':').pop() ?? entry.actorDid;

        return {
            tick: tickRaw,
            speaker_did: entry.actorDid,
            speaker_name,
            channel: channelRaw,
            // D-09: truncate to MAX_TEXT_LEN at ingest so downstream never sees longer.
            text: textRaw.length > MAX_TEXT_LEN ? textRaw.slice(0, MAX_TEXT_LEN) : textRaw,
        };
    }

    /**
     * Ingest a single nous.spoke observation into the per-pair buffer for
     * every other DID observed on the same channel within the live window.
     *
     * Simpler model: we key the buffer by `(speaker, otherSpeaker, channel)`
     * using sorted DIDs — but we only create a buffer once a second distinct
     * speaker is observed on that channel. Until then we hold a "pending"
     * entry keyed by `(speaker, channel)`.
     */
    private ingestSpoke(obs: SpokeObservation): void {
        const { tick, channel, speaker_did } = obs;

        // Look at every existing buffer on this channel — if a second
        // speaker shows up, the buffer becomes bidirectional.
        // Also look for ANY other speaker on this channel to pair with.
        //
        // Strategy: scan every existing buffer whose channel matches and
        // whose sortedDids includes this speaker OR which has only one
        // speaker so far and this is a new one.

        let foundExisting = false;

        // Deterministic iteration over buffers.
        const keys = Array.from(this.buffers.keys()).sort();
        for (const key of keys) {
            const buf = this.buffers.get(key);
            if (!buf) continue;
            if (buf.channel !== channel) continue;
            if (!buf.sortedDids.includes(speaker_did)) continue;

            // Prune before adding.
            this.pruneWindow(buf, tick);

            // If prune emptied the buffer, windowStartTick resets to this tick.
            if (buf.utterances.length === 0) {
                buf.windowStartTick = tick;
                buf.speakersInWindow.clear();
            }

            buf.utterances.push(obs);
            buf.speakersInWindow.add(speaker_did);
            this.enforceBufferCap(buf);
            foundExisting = true;
        }

        if (foundExisting) return;

        // No existing buffer includes this speaker on this channel.
        // Look for a "solo" buffer on this channel whose single speaker
        // differs — that's a new bidirectional pair forming.
        for (const key of keys) {
            const buf = this.buffers.get(key);
            if (!buf) continue;
            if (buf.channel !== channel) continue;
            if (buf.sortedDids.length !== 1) continue;
            if (buf.sortedDids[0] === speaker_did) continue;

            // Check window — if other speaker's first utterance is within window, merge.
            if (tick - buf.windowStartTick > this.config.windowTicks - 1) {
                // Outside window — don't merge; let this observation start a new solo buffer.
                continue;
            }

            // Promote solo buffer → pair buffer under a new key.
            const otherDid = buf.sortedDids[0];
            const sortedDids = [otherDid, speaker_did].sort();
            const newKey = sortedDids.join('|') + '|' + channel;

            // It's possible a pair buffer already exists under newKey.
            const existingPair = this.buffers.get(newKey);
            if (existingPair) {
                // Merge the solo buffer's utterances in (they occurred on this channel).
                for (const u of buf.utterances) {
                    existingPair.utterances.push(u);
                    existingPair.speakersInWindow.add(u.speaker_did);
                }
                existingPair.utterances.push(obs);
                existingPair.speakersInWindow.add(speaker_did);
                // Reset windowStartTick to the earliest utterance still in window.
                existingPair.utterances.sort((a, b) => a.tick - b.tick);
                this.enforceBufferCap(existingPair);
                this.buffers.delete(key);
                return;
            }

            // Promote.
            const promoted: PairBuffer = {
                sortedDids,
                channel,
                windowStartTick: buf.windowStartTick,
                utterances: [...buf.utterances, obs],
                speakersInWindow: new Set([...buf.speakersInWindow, speaker_did]),
            };
            this.enforceBufferCap(promoted);
            this.buffers.delete(key);
            this.buffers.set(newKey, promoted);
            return;
        }

        // No existing buffer matches — create a new solo buffer for this speaker.
        const soloKey = speaker_did + '|' + channel;
        const existingSolo = this.buffers.get(soloKey);
        if (existingSolo) {
            this.pruneWindow(existingSolo, tick);
            if (existingSolo.utterances.length === 0) {
                existingSolo.windowStartTick = tick;
                existingSolo.speakersInWindow.clear();
            }
            existingSolo.utterances.push(obs);
            existingSolo.speakersInWindow.add(speaker_did);
            this.enforceBufferCap(existingSolo);
            return;
        }

        const solo: PairBuffer = {
            sortedDids: [speaker_did],
            channel,
            windowStartTick: tick,
            utterances: [obs],
            speakersInWindow: new Set([speaker_did]),
        };
        this.buffers.set(soloKey, solo);
    }

    /** Drop utterances older than (currentTick - windowTicks + 1). D-07. */
    private pruneWindow(buf: PairBuffer, currentTick: number): void {
        const minTick = currentTick - this.config.windowTicks + 1;
        if (minTick <= buf.windowStartTick && buf.utterances.length > 0) {
            // Nothing to prune.
            return;
        }

        const kept: SpokeObservation[] = [];
        const speakersAfter = new Set<string>();
        for (const u of buf.utterances) {
            if (u.tick >= minTick) {
                kept.push(u);
                speakersAfter.add(u.speaker_did);
            }
        }
        buf.utterances = kept;
        buf.speakersInWindow.clear();
        for (const s of speakersAfter) buf.speakersInWindow.add(s);
        if (kept.length > 0) {
            buf.windowStartTick = kept[0].tick;
        }
    }

    /** T-07-04: cap per-pair utterance buffer to windowTicks * BUFFER_FACTOR. */
    private enforceBufferCap(buf: PairBuffer): void {
        const cap = this.config.windowTicks * BUFFER_FACTOR;
        if (buf.utterances.length > cap) {
            buf.utterances = buf.utterances.slice(-cap);
            // Rebuild speakersInWindow after slicing.
            buf.speakersInWindow.clear();
            for (const u of buf.utterances) buf.speakersInWindow.add(u.speaker_did);
            buf.windowStartTick = buf.utterances[0]?.tick ?? buf.windowStartTick;
        }
    }
}
