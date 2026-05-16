/**
 * Closed 3-key payload for nous.sleep.entered and nous.sleep.completed.
 * Phase 16 HYP-04. D-16-05.
 * Key-set enforced at runtime by appendNousSleepEntered / appendNousSleepCompleted.
 */
export interface NousSleepPayload {
    /** SHA-256 hexdigest (64 chars) of LTM graph state post-SHY. Never LTM content. */
    readonly ltm_snapshot_hash: string;
    /** Nous DID — matches /^did:noesis:[a-z0-9_\-]+$/i. Self-report: must equal actorDid. */
    readonly nous_did: string;
    /** Non-negative integer world-clock tick. */
    readonly tick: number;
}
