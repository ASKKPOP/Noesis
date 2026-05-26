/**
 * Phase 37 — civic-registry barrel export.
 *
 * Plans 02–04 consume these exports for routes, audit producers, and CI gates.
 */

export type { CivicDidRecord, BusinessDidRecord, CivicDidStatus, BusinessDidStatus } from './types.js';
export { buildCivicDidVc, buildBusinessDidVc, GRID_REGISTRY_DID } from './vc-builder.js';
export { verifyGovernmentSession, GOV_SESSION_ISSUER_DID } from './government-session.js';
export type { GovernmentSessionResult } from './government-session.js';
export { CivicDidStore } from './civic-did-store.js';
export { BusinessDidStore } from './business-did-store.js';
