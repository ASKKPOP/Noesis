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
/** Runway (months) below which a Type B drops to low-power mode (criterion 3). */
export const LOW_POWER_THRESHOLD_MONTHS = 3;
/** Type B marketplace earnings split: 70% to the Type B treasury, 30% to Genesis IRS (D-V3-25). */
export const TYPE_B_EARNING_KEEP_BPS = 7000; // basis points (70%)

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

/** treasury.stipend_paid — daily infrastructure (compute) stipend deducted from a Type B treasury. */
export interface TreasuryStipendPaidPayload {
    readonly stipend_amount: number;
    readonly tick: number;
    readonly type_b_did_hash: string;  // HEX64
}
export const TREASURY_STIPEND_PAID_KEYS = ['stipend_amount', 'tick', 'type_b_did_hash'] as const;

/** treasury.low_power_entered — runway fell below the low-power threshold; the Brain throttles. */
export interface TreasuryLowPowerEnteredPayload {
    readonly tick: number;
    readonly type_b_did_hash: string;  // HEX64
}
export const TREASURY_LOW_POWER_ENTERED_KEYS = ['tick', 'type_b_did_hash'] as const;

/** Split a gross Type B marketplace earning into the 70% kept + 30% IRS cut (integer Bios). */
export function splitTypeBEarning(gross: number): { typeBShare: number; irsShare: number } {
    const typeBShare = Math.floor((gross * TYPE_B_EARNING_KEEP_BPS) / 10000);
    return { typeBShare, irsShare: gross - typeBShare };
}
