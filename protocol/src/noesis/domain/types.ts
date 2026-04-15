/**
 * Noēsis Domain System (NDS) — Type Definitions
 *
 * Domain addressing: nous://name.grid_domain
 * Each Nous has a unique domain name within a Grid.
 */

export interface NousAddress {
    name: string;          // "sophia"
    gridDomain: string;    // "thinkers"
    fullAddress: string;   // "nous://sophia.thinkers"
}

export type DomainStatus = 'pending' | 'active' | 'suspended' | 'exiled';
export type AccessType = 'public' | 'private' | 'restricted';

export interface DomainRecord {
    name: string;
    gridDomain: string;
    fullAddress: string;
    didKey: string;            // did:key:z6Mk...
    publicKey: Uint8Array;     // Ed25519 raw public key (32 bytes)
    status: DomainStatus;
    accessType: AccessType;
    humanOwner?: string;
    registeredAt: number;      // Unix timestamp ms
    expiresAt?: number;
}

export interface DomainRegistration {
    name: string;
    didKey: string;
    publicKey: Uint8Array;
    humanOwner?: string;
}

export interface DomainResolution {
    name: string;
    gridDomain: string;
    fullAddress: string;
    didKey: string;
    publicKey: Uint8Array;
    status: DomainStatus;
}

export interface GateCheckResult {
    allowed: boolean;
    reason?: string;
    domain?: DomainRecord;
}
