/**
 * Noēsis Domain System (NDS) — Public API
 */

export { parseNousUri, buildNousUri, isValidSegment, NOUS_SCHEME } from './uri.js';
export { validateName, validateGridDomain } from './validator.js';
export { DomainRegistry, type RegistryConfig } from './registry.js';
export { CommunicationGate, type GateConfig } from './gate.js';
export type {
    NousAddress,
    DomainStatus,
    AccessType,
    DomainRecord,
    DomainRegistration,
    DomainResolution,
    GateCheckResult,
} from './types.js';
