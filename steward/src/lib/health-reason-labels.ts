/**
 * Phase 34 D-34-B2: snake_case → human label mapping for HealthDetailedPayload.reasons[].
 *
 * Source of truth for keys: grid/src/diagnostics/health-watchdog.ts computeStatus()
 * (lines 107-155). The 7 known keys below match the FROZEN Phase 32 D-32-C2 predicate.
 *
 * Labels are short (2-4 words) to fit comma-separated on one sub-line beneath the
 * status banner inside the Audit Pipeline Health and Firehose Diagnostics cards
 * (D-34-B3).
 *
 * Unknown keys fall back to the raw snake_case via getReasonLabel — future grid-side
 * additions don't break the UI.
 */

export const HEALTH_REASON_LABELS: Record<string, string> = {
    grace_period: 'Cold-start grace period',
    divergence_above_critical: 'Audit divergence critical',
    persist_error_with_divergence: 'Persist failing with divergence',
    divergence_above_degraded: 'Audit divergence elevated',
    no_frames_with_clients: 'No frames despite clients',
    stale_frames: 'No frames in 60s',
    reconcile_stale: 'Reconcile loop stale',
};

/**
 * Resolve a reason key to its human label. Returns the raw key as fallback when
 * the key is not in HEALTH_REASON_LABELS — graceful unknown discipline.
 */
export function getReasonLabel(key: string): string {
    return HEALTH_REASON_LABELS[key] ?? key;
}
