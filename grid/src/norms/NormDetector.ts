// Phase 19 NORM-01..03: Pure-observer listener on nous.self_model_revised.
// INVARIANT: Zero audit.append calls inside this class.
// All emissions delegate to: appendNormCandidate, appendNormCrystallized (sole producers).
// Enforced by: grid/test/norms/norm-producer-boundary.test.ts

import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import type { RelationshipListener } from '../relationships/listener.js';
import type { NormConfig } from './types.js';
import { appendNormCandidate } from './appendNormCandidate.js';
import { appendNormCrystallized } from './appendNormCrystallized.js';

interface CandidateEntry {
    dids: Map<string, number>;        // did → latestTick (for window eviction)
    firstSeenTick: number;
    candidateFiredTick: number | null; // tick when the candidate event was first fired; null if not yet
}

export class NormDetector {
    private readonly audit: AuditChain;
    private readonly relationships: RelationshipListener;
    private readonly config: NormConfig;
    private candidates: Map<string, CandidateEntry> = new Map();

    constructor(audit: AuditChain, relationships: RelationshipListener, config: NormConfig) {
        this.audit = audit;
        this.relationships = relationships;
        this.config = config;
        // Pure observer — onAppend only; zero audit.append calls in this class body
        this.audit.onAppend((entry) => this.handleEntry(entry));
    }

    public reset(): void {
        this.candidates.clear();
    }

    // Live path: accumulates AND checks thresholds AND calls emitters.
    public handleEntry(entry: AuditEntry): void {
        if (entry.eventType !== 'nous.self_model_revised') return;
        const fingerprint = entry.payload['revision_hash'] as string;
        const nousDid = entry.actorDid;
        const tick = entry.payload['tick'] as number;
        if (typeof fingerprint !== 'string' || typeof tick !== 'number') return;

        // Update current DID's tick BEFORE eviction so the contributing DID is never
        // self-evicted on its own contribution event (evictStale uses lastTick < cutoff).
        let candidate = this.candidates.get(fingerprint);
        if (!candidate) {
            candidate = { dids: new Map(), firstSeenTick: tick, candidateFiredTick: null };
            this.candidates.set(fingerprint, candidate);
        }
        candidate.dids.set(nousDid, tick); // idempotent for same DID; updates tick

        // Evict stale DIDs from ALL candidates at current tick (after updating current DID)
        this.evictStale(tick);

        // Check threshold
        if (candidate.dids.size >= this.config.threshold) {
            const convergenceType = this.classifyConvergence(candidate.dids);
            const participatingCount = candidate.dids.size;

            // Fire the candidate event if not yet fired for this cluster
            if (candidate.candidateFiredTick === null) {
                candidate.candidateFiredTick = tick;
                appendNormCandidate(this.audit, 'did:noesis:grid', {
                    convergence_type: convergenceType,
                    fingerprint,
                    participating_count: participatingCount,
                    tick,
                }, this.config.threshold);
            }

            // Check crystallization: cluster stable for adoptionTicks
            if (
                candidate.candidateFiredTick !== null &&
                tick - candidate.candidateFiredTick >= this.config.adoptionTicks
            ) {
                appendNormCrystallized(this.audit, 'did:noesis:grid', {
                    convergence_type: convergenceType,
                    evidence_tick_range: [candidate.firstSeenTick, tick],
                    fingerprint,
                    participating_count: participatingCount,
                    tick,
                }, this.config.threshold);
                // Remove from candidates after crystallization
                this.candidates.delete(fingerprint);
            }
        }
    }

    // Rebuild path: populates candidateMap WITHOUT calling emitters (Pitfall 3).
    private applyEntry(entry: AuditEntry): void {
        if (entry.eventType !== 'nous.self_model_revised') return;
        const fingerprint = entry.payload['revision_hash'] as string;
        const nousDid = entry.actorDid;
        const tick = entry.payload['tick'] as number;
        if (typeof fingerprint !== 'string' || typeof tick !== 'number') return;

        let candidate = this.candidates.get(fingerprint);
        if (!candidate) {
            candidate = { dids: new Map(), firstSeenTick: tick, candidateFiredTick: null };
            this.candidates.set(fingerprint, candidate);
        }
        candidate.dids.set(nousDid, tick);
    }

    // Called by GenesisLauncher at startup (D-19-05).
    // Replays nous.self_model_revised events from [fromTick, ∞) WITHOUT calling emitters.
    public rebuildFromChain(fromTick: number): void {
        this.reset();
        const entries = this.audit.all();
        for (const entry of entries) {
            const tick = entry.payload?.['tick'] as number | undefined;
            if (typeof tick === 'number' && tick < fromTick) continue;
            this.applyEntry(entry);
        }
    }

    private evictStale(currentTick: number): void {
        const cutoff = currentTick - this.config.windowTicks;
        for (const [fp, candidate] of this.candidates) {
            for (const [did, lastTick] of candidate.dids) {
                if (lastTick < cutoff) {
                    candidate.dids.delete(did);
                }
            }
            // Evict empty candidates
            if (candidate.dids.size === 0) {
                this.candidates.delete(fp);
            }
        }
    }

    private classifyConvergence(dids: Map<string, number>): 'emergent' | 'coincidental' {
        // D-19-08: if any pair has RelationshipListener edge with weight > 0 → emergent
        const didArray = Array.from(dids.keys());
        for (let i = 0; i < didArray.length; i++) {
            for (let j = i + 1; j < didArray.length; j++) {
                const edge = this.relationships.getEdge(didArray[i]!, didArray[j]!);
                if (edge !== undefined && edge.weight > 0) {
                    return 'emergent';
                }
            }
        }
        return 'coincidental';
    }
}
