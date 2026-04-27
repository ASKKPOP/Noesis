/**
 * Phase 13 — Operator Replay & Export public API.
 *
 * The replay engine NEVER appends to the chain (T-10-07).
 * CI gate: scripts/check-replay-readonly.mjs greps this directory tree for
 * any '.append(' call and fails on match. See 13-CONTEXT.md D-13-03.
 */
export { ReadOnlyAuditChain } from './readonly-chain.js';
export { ReplayGrid, type ReplayGridOptions } from './replay-grid.js';
export { buildStateAtTick, type ReplayState } from './state-builder.js';
