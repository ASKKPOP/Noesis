/**
 * Phase 7 Plan 01 — Dialogue subsystem barrel.
 *
 * Consumers: grid/src/integration/{types.ts, nous-runner.ts, grid-coordinator.ts},
 * grid/src/genesis/launcher.ts, grid/test/dialogue/**.
 */

export { DialogueAggregator } from './aggregator.js';
export { computeDialogueId, DIALOGUE_ID_RE } from './dialogue-id.js';
export type {
    DialogueAggregatorConfig,
    DialogueContext,
    SpokeObservation,
} from './types.js';
