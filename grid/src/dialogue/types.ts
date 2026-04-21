/**
 * Phase 7 Plan 01 — Dialogue subsystem type definitions.
 *
 * DialogueContext is the read-only payload the aggregator surfaces to each
 * participant on their next sendTick (D-10, D-11). It is plumbed through
 * TickParams.dialogue_context additively in Plan 01 Task 2 and consumed by
 * Plan 03 to authority-check Brain-returned `telos_refined` actions.
 *
 * All fields are readonly — DialogueContext must be immutable across the
 * AuditChain → DialogueAggregator → GridCoordinator → NousRunner path.
 */

export interface DialogueContext {
    readonly dialogue_id: string;            // 16-hex per D-03 / DIALOGUE_ID_RE
    readonly counterparty_did: string;       // The OTHER participant's did:noesis:*
    readonly channel: string;                // Gated per D-05 — same channel only
    readonly exchange_count: number;         // Bidirectional utterances observed
    readonly window_start_tick: number;      // Inclusive
    readonly window_end_tick: number;        // Inclusive
    readonly utterances: ReadonlyArray<{
        readonly tick: number;
        readonly speaker_did: string;
        readonly speaker_name: string;
        readonly text: string;               // ≤200 chars (D-09)
    }>;                                       // MAX 5 entries (D-09)
}

/**
 * Internal record of a single nous.spoke observation extracted from the
 * AuditChain. Not exposed to Brain; only the DialogueContext is surfaced.
 */
export interface SpokeObservation {
    readonly tick: number;
    readonly speaker_did: string;
    readonly speaker_name: string;
    readonly channel: string;
    readonly text: string;
}

/**
 * Aggregator configuration plumbed from GenesisLauncher (Plan 01 Task 3).
 * Defaults per D-25: windowTicks=5, minExchanges=2.
 */
export interface DialogueAggregatorConfig {
    readonly windowTicks: number;
    readonly minExchanges: number;
}
