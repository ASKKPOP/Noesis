// Phase 19 NORM-01..03: Type definitions for norm crystallization.
// Payload shapes are LOCKED (D-19-10) — do NOT add, remove, or reorder keys.

export interface NormCandidatePayload {
    convergence_type: 'emergent' | 'coincidental';
    fingerprint: string;         // CHAR(6) hex per D-19-03
    participating_count: number; // unique Nous DID count
    tick: number;
}

// Locked alphabetical key tuple for closed-tuple enforcement (D-19-10).
export const NORM_CANDIDATE_KEYS = [
    'convergence_type', 'fingerprint', 'participating_count', 'tick',
] as const;

export interface NormCrystallizedPayload {
    convergence_type: 'emergent' | 'coincidental';
    evidence_tick_range: [number, number]; // [first_seen_tick, crystallized_tick]
    fingerprint: string;
    participating_count: number;
    tick: number;
}

export const NORM_CRYSTALLIZED_KEYS = [
    'convergence_type', 'evidence_tick_range', 'fingerprint', 'participating_count', 'tick',
] as const;

export const VALID_CONVERGENCE_TYPES = new Set(['emergent', 'coincidental'] as const);

export interface NormConfig {
    threshold: number;     // NORM_THRESHOLD; default 3
    windowTicks: number;   // NORM_WINDOW_TICKS; default 10
    adoptionTicks: number; // NORM_ADOPTION_TICKS; default 20
}

export const DEFAULT_NORM_CONFIG: NormConfig = {
    threshold: 3,
    windowTicks: 10,
    adoptionTicks: 20,
};
