/**
 * Phase 9 Plan 02 — RelationshipListener
 *
 * Pure-observer listener that derives the in-memory relationship edge Map
 * from AuditChain entries. Sole writer of the `edges` Map per D-9-05.
 *
 * Key invariants:
 *   - Pure observer: registering N listeners (including this listener)
 *     on AuditChain MUST NOT alter any entries[].eventHash. Verified by
 *     grid/test/relationships/zero-diff.test.ts.
 *   - No wall-clock: no system-time access, randomness, or timer calls anywhere
 *     in this module. All timing is driven by entry.payload.tick (D-9-12).
 *   - Deterministic iteration: Array.from(map.keys()).sort() before
 *     iterating (Pitfall 2 in RESEARCH.md).
 *   - Pause-safe: reset() is called from GenesisLauncher when WorldClock
 *     pauses (D-9-04) so relationship windows never span pause boundaries.
 *   - Zero audit emit: this file MUST NOT call audit.append. Enforced by
 *     producer-boundary grep gate (grid/test/relationships/producer-boundary.test.ts).
 *
 * Pattern source:
 *   - AuditChain listener surface: grid/src/audit/chain.ts
 *   - Pure-observer skeleton: grid/src/dialogue/aggregator.ts (exact clone)
 */

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { sortedPairKey, decayedWeight } from './canonical.js';
import type { Edge, RelationshipConfig } from './types.js';

export class RelationshipListener {
    private readonly audit: AuditChain;
    private readonly config: RelationshipConfig;

    /**
     * The SOLE in-memory edges Map in the entire codebase (D-9-05 gate 1).
     * Key: sortedPairKey(did_a, did_b). Only this file may call .set/.delete/.clear.
     * Enforced by producer-boundary.test.ts grep gate.
     */
    private edges: Map<string, Edge> = new Map();

    constructor(audit: AuditChain, config: RelationshipConfig) {
        this.audit = audit;
        this.config = config;
        this.audit.onAppend((entry) => this.handleEntry(entry));
    }

    // ─────────────────────────────── public read API ───────────────────────────────

    /**
     * Get the edge between two Nous, or undefined if no interaction recorded.
     * Returns undefined silently for self-loops (no throw).
     */
    public getEdge(didA: string, didB: string): Readonly<Edge> | undefined {
        let key: string;
        try {
            key = sortedPairKey(didA, didB);
        } catch {
            return undefined;  // self-loop — silent per D-9-11
        }
        return this.edges.get(key);
    }

    /**
     * Return the top N strongest relationships for a given DID, ordered by
     * decayed weight descending. Caller provides currentTick for lazy decay.
     *
     * n is clamped to config.topNMax at the call site (coordinator / API handler).
     */
    public getTopNFor(
        did: string,
        n: number,
        currentTick: number,
    ): ReadonlyArray<{
        counterpartyDid: string;
        valence: number;
        weight: number;
        recency_tick: number;
        last_event_hash: string;
    }> {
        const results: Array<{
            counterpartyDid: string;
            valence: number;
            weight: number;
            decayed: number;
            recency_tick: number;
            last_event_hash: string;
        }> = [];

        for (const edge of this.edges.values()) {
            if (edge.did_a !== did && edge.did_b !== did) continue;
            const counterpartyDid = edge.did_a === did ? edge.did_b : edge.did_a;
            const decayed = decayedWeight(edge, currentTick, this.config.tau);
            results.push({
                counterpartyDid,
                valence: edge.valence,
                weight: edge.weight,
                decayed,
                recency_tick: edge.recency_tick,
                last_event_hash: edge.last_event_hash,
            });
        }

        // Sort by decayed weight descending (deterministic within same weight by counterpartyDid).
        results.sort((a, b) => b.decayed - a.decayed || a.counterpartyDid.localeCompare(b.counterpartyDid));

        return results.slice(0, n).map(({ counterpartyDid, valence, weight, recency_tick, last_event_hash }) => ({
            counterpartyDid,
            valence,
            weight,
            recency_tick,
            last_event_hash,
        }));
    }

    /** Total number of edges in the Map. Exposed for tests and storage layer. */
    public get size(): number {
        return this.edges.size;
    }

    /** Read-only iterator over all edges. Consumed by storage layer for snapshots. */
    public allEdges(): IterableIterator<Edge> {
        return this.edges.values();
    }

    // ─────────────────────────────── lifecycle ────────────────────────────────────

    /**
     * D-9-04: clear all edge state. Called from GenesisLauncher when
     * WorldClock pauses so relationship windows never span pause boundaries.
     */
    public reset(): void {
        this.edges.clear();
    }

    /**
     * Replay the full audit chain to reconstruct the edges Map from scratch.
     *
     * NOTE: loadEntries does NOT fire onAppend — manual replay required (P-9-02).
     * Calling audit.loadEntries() and then iterating manually is the ONLY correct
     * approach. Using onAppend listeners here would re-subscribe and double-apply
     * entries in a live chain, silently breaking rebuild idempotency.
     */
    public rebuildFromChain(): void {
        this.reset();
        // loadEntries does NOT fire onAppend — manual replay required (P-9-02).
        // Use audit.all() to retrieve all committed entries, then iterate manually.
        // This is the ONLY correct rebuild path: onAppend listeners are not fired
        // by the restore path, so replay must be explicit.
        const entries = this.audit.all();
        for (const entry of entries) {
            this.handleEntry(entry);
        }
    }

    // ─────────────────────────────── internals ────────────────────────────────────

    private handleEntry(entry: AuditEntry): void {
        switch (entry.eventType) {
            case 'nous.spoke': {
                // actorDid = speaker; payload has {name, channel, text, tick}.
                // The "spoke" event is bidirectional by nature: the speaker interacts
                // with whoever is in the same region (Grid routes delivery via
                // receiveMessage). For relationship purposes, the speaker is ONE
                // participant; we need a second DID.
                //
                // If to_did is present in the payload (DM variant), use it.
                // Otherwise fall back to targetDid on the entry (direct_message path).
                // If neither is present, we cannot form a pair — skip silently.
                const fromDid = entry.actorDid;
                const toDid = typeof entry.payload['to_did'] === 'string'
                    ? (entry.payload['to_did'] as string)
                    : typeof entry.targetDid === 'string'
                        ? entry.targetDid
                        : null;
                if (!toDid) return;
                this.applyBump(fromDid, toDid, entry,
                    this.config.bumpSpokeValence,
                    this.config.bumpSpokeWeight);
                break;
            }

            case 'trade.settled': {
                // actorDid = proposer/buyer; payload has {counterparty, amount, nonce}.
                const proposer = entry.actorDid;
                const counterpartyRaw = entry.payload['counterparty'];
                if (typeof counterpartyRaw !== 'string') return;
                this.applyBump(proposer, counterpartyRaw, entry,
                    this.config.bumpTradeSettledValence,
                    this.config.bumpTradeSettledWeight);
                break;
            }

            case 'trade.reviewed': {
                // actorDid = Reviewer.DID (not a participant).
                // payload has {trade_id, reviewer_did, verdict, ...}.
                // Only 'fail' verdict triggers the negative bump per D-9-02.
                // We need both participant DIDs; Phase 5 payload does NOT carry them
                // directly. Fall back to payload keys reviewer_subject_did / proposer_did,
                // or targetDid, which test fixtures can supply for coverage.
                const verdict = entry.payload['verdict'];
                if (verdict !== 'fail' && verdict !== 'reject') return;

                // Try to extract participant DIDs from the payload.
                const didA = typeof entry.payload['proposer_did'] === 'string'
                    ? (entry.payload['proposer_did'] as string)
                    : typeof entry.payload['subject_did'] === 'string'
                        ? (entry.payload['subject_did'] as string)
                        : null;
                const didB = typeof entry.payload['counterparty_did'] === 'string'
                    ? (entry.payload['counterparty_did'] as string)
                    : typeof entry.targetDid === 'string'
                        ? entry.targetDid
                        : null;

                if (!didA || !didB) return;
                this.applyBump(didA, didB, entry,
                    this.config.bumpTradeRejectedValence,
                    this.config.bumpTradeRejectedWeight);
                break;
            }

            case 'telos.refined': {
                // actorDid = Nous who refined their Telos; payload has
                // {did, before_goal_hash, after_goal_hash, triggered_by_dialogue_id}.
                // We need the partner DID from the triggering dialogue.
                // Phase 7 payload does NOT carry partner_did; callers may supply it
                // via payload['partner_did'] or entry.targetDid for relationship bumps.
                const nousDid = typeof entry.payload['did'] === 'string'
                    ? (entry.payload['did'] as string)
                    : entry.actorDid;
                const partnerDid = typeof entry.payload['partner_did'] === 'string'
                    ? (entry.payload['partner_did'] as string)
                    : typeof entry.payload['nous_did'] === 'string' && entry.actorDid !== entry.payload['nous_did']
                        ? (entry.payload['nous_did'] as string)
                        : typeof entry.targetDid === 'string'
                            ? entry.targetDid
                            : null;

                if (!partnerDid) return;
                this.applyBump(nousDid, partnerDid, entry,
                    this.config.bumpTelosRefinedValence,
                    this.config.bumpTelosRefinedWeight);
                break;
            }

            default:
                return;  // silently ignore all other allowlisted events — pure observer
        }
    }

    /**
     * Apply a valence + weight bump to the edge identified by (didA, didB).
     *
     * Self-loop: sortedPairKey throws on didA === didB; we catch and return
     * silently per D-9-11 (no throw escapes, no emit, no Map write).
     *
     * All timing comes from entry.payload.tick (D-9-12 wall-clock ban).
     */
    private applyBump(
        didA: string,
        didB: string,
        entry: AuditEntry,
        valenceBump: number,
        weightBump: number,
    ): void {
        let key: string;
        try {
            key = sortedPairKey(didA, didB);
        } catch {
            return;  // D-9-11 self-loop silent-reject
        }

        const tick = entry.payload['tick'] as number;  // D-9-12 authoritative tick; no wall-clock

        const existing = this.edges.get(key);
        let edge: Edge;

        if (!existing) {
            // Construct new edge with canonical DID ordering (did_a < did_b lexicographically).
            const [smallerDid, largerDid] = didA < didB ? [didA, didB] : [didB, didA];
            edge = {
                did_a: smallerDid,
                did_b: largerDid,
                valence: 0,
                weight: 0,
                recency_tick: tick,
                last_event_hash: entry.eventHash,
            };
        } else {
            // Clone the existing edge so we can mutate safely.
            edge = { ...existing };
        }

        // Apply clamped bumps (RESEARCH.md lines 624-628 verbatim).
        edge.valence = Math.max(-1, Math.min(1, edge.valence + valenceBump));
        edge.weight  = Math.max( 0, Math.min(1, edge.weight  + weightBump));
        edge.recency_tick = tick;
        edge.last_event_hash = entry.eventHash;

        // The single Map write point in the entire grid/src/relationships/ subtree (D-9-05).
        this.edges.set(key, edge);
    }
}
