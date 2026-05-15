/**
 * Iris Grid types — Phase 17 D-17-08.
 * Payload interfaces and EXPECTED_KEYS tuples for all 4 iris.* sole-producer emitters.
 *
 * 3-keys-not-5 invariant (D-17-07): Brain metadata carries 1-3 keys;
 * Grid injects nous_did + tick at emit time. Field name is 'nous_did' (not 'did').
 *
 * Closed-tuple: EXPECTED_KEYS are alphabetically sorted to match Object.keys(payload).sort().
 */

export interface IrisBeliefRevisedPayload {
    nous_did: string;
    tick: number;
    target_did: string;
    belief_hash: string;
}

export interface IrisContextInvokedPayload {
    nous_did: string;
    tick: number;
    belief_count: number;
}

export interface IrisContradictionDetectedPayload {
    nous_did: string;
    tick: number;
    target_did: string;
    contradiction_hash: string;
}

export interface IrisPriorSeededPayload {
    nous_did: string;
    tick: number;
    target_did: string;
    seed_event_hash: string;
}

/** Alphabetically sorted key tuples — locked by D-17-08. */
export const IRIS_BELIEF_REVISED_KEYS = ['belief_hash', 'nous_did', 'target_did', 'tick'] as const;
export const IRIS_CONTEXT_INVOKED_KEYS = ['belief_count', 'nous_did', 'tick'] as const;
export const IRIS_CONTRADICTION_DETECTED_KEYS = ['contradiction_hash', 'nous_did', 'target_did', 'tick'] as const;
export const IRIS_PRIOR_SEEDED_KEYS = ['nous_did', 'seed_event_hash', 'target_did', 'tick'] as const;
