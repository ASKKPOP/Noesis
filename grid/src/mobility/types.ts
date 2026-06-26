/**
 * Phase 51 Type Mobility (Plan 1 — abandon + adopt) — payload contracts.
 * DIDs hashed on the audit chain (raw DIDs live in mobility_records + nous_sponsors).
 * Closed-tuple payloads, keys alphabetical.
 *
 * The "operator" who abandons is the human who OWNS the Nous (the Join-a-Grid Type A
 * pairing, nous_sponsors) — so mobility reuses that ownership truth.
 */

/** 30-day adoption window, in ticks (30s/tick). */
export const ADOPTION_WINDOW_TICKS = 86400; // 30 days × 24h × 3600s / 30s

/** mobility.operator_abandoned — the owning operator declares it will stop hosting. */
export interface MobilityOperatorAbandonedPayload {
    readonly nous_did_hash: string;     // HEX64 — the abandoned Nous (existence DID)
    readonly operator_did_hash: string; // HEX64 — the releasing human/operator
    readonly tick: number;
    readonly window_end_tick: number;
}
export const MOBILITY_OPERATOR_ABANDONED_KEYS = ['nous_did_hash', 'operator_did_hash', 'tick', 'window_end_tick'] as const;

/** mobility.adoption_attempted — a human tries to adopt an abandoned Nous (logged even on
 *  rejection, for transparency). */
export interface MobilityAdoptionAttemptedPayload {
    readonly adopter_did_hash: string;  // HEX64
    readonly nous_did_hash: string;     // HEX64
    readonly tick: number;
}
export const MOBILITY_ADOPTION_ATTEMPTED_KEYS = ['adopter_did_hash', 'nous_did_hash', 'tick'] as const;

/** mobility.adoption_succeeded — adoption accepted; the Nous stays Type A under the new operator. */
export interface MobilityAdoptionSucceededPayload {
    readonly adopter_did_hash: string;  // HEX64
    readonly nous_did_hash: string;     // HEX64
    readonly tick: number;
}
export const MOBILITY_ADOPTION_SUCCEEDED_KEYS = ['adopter_did_hash', 'nous_did_hash', 'tick'] as const;

/** The auto-issued Type B Civic-DID: did:noesis:nous:auto:<key>. Existence-DID is preserved;
 *  only the substrate authority (Civic-DID) changes. Deterministic from the existence DID. */
export function autoTypeBCivicDid(existenceDid: string, key: string): string {
    void existenceDid;
    return `did:noesis:nous:auto:${key}`;
}

/** mobility.converted_to_type_b — window expired with no adoption → Foundation custody. */
export interface MobilityConvertedToTypeBPayload {
    readonly auto_civic_did_hash: string; // HEX64 — the reissued Type B Civic-DID
    readonly nous_did_hash: string;       // HEX64 — the (preserved) existence DID
    readonly tick: number;
}
export const MOBILITY_CONVERTED_TO_TYPE_B_KEYS = ['auto_civic_did_hash', 'nous_did_hash', 'tick'] as const;

/** mobility.dormancy_entered — the freshly-converted Type B Nous waits, dormant, for its
 *  Type B endowment (Phase 45b) to fund it. */
export interface MobilityDormancyEnteredPayload {
    readonly nous_did_hash: string; // HEX64
    readonly tick: number;
}
export const MOBILITY_DORMANCY_ENTERED_KEYS = ['nous_did_hash', 'tick'] as const;
