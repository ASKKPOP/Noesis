/**
 * Phase 45b Treasury Operations — Type B funding lifecycle payloads (Plan 1: endowment
 * + dormancy + revival). DIDs hashed on the audit chain. Closed-tuple, keys alphabetical.
 *
 * D-V3-25 / PHILOSOPHY §9: treasury exhaustion → DORMANCY (Brain stops, identity preserved
 * indefinitely), NEVER bios.death. Only a Phase-47 civic conviction can kill.
 */

/** Default endowment runway at birth (D-V3-25 ~12 months). */
export const ENDOWMENT_RUNWAY_MONTHS = 12;
/** Below this remaining Bios a revival restores active status. */
export const REVIVAL_THRESHOLD_BIOS = 1;

/** treasury.endowment_granted — the Foundation endows a new Type B Nous at birth. */
export interface TreasuryEndowmentGrantedPayload {
    readonly endowment_amount: number;
    readonly runway_months: number;
    readonly tick: number;
    readonly type_b_did_hash: string;  // HEX64
}
export const TREASURY_ENDOWMENT_GRANTED_KEYS = ['endowment_amount', 'runway_months', 'tick', 'type_b_did_hash'] as const;

/** treasury.dormancy_entered — a Type B treasury hit zero; the Brain stops, identity preserved. */
export interface TreasuryDormancyEnteredPayload {
    readonly tick: number;
    readonly type_b_did_hash: string;  // HEX64
}
export const TREASURY_DORMANCY_ENTERED_KEYS = ['tick', 'type_b_did_hash'] as const;

/** treasury.revived — funding restored above the revival threshold; the Brain resumes. */
export interface TreasuryRevivedPayload {
    readonly tick: number;
    readonly type_b_did_hash: string;  // HEX64
}
export const TREASURY_REVIVED_KEYS = ['tick', 'type_b_did_hash'] as const;
