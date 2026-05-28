/**
 * Phase 37 / REG-01..04 — DID Registry record types.
 * Persisted in MySQL via migrations v23 (civic_did_registry) and v24 (business_did_registry).
 */

export type CivicDidStatus = 'active' | 'revoked';
export type BusinessDidStatus = 'active' | 'dissolved';

export interface CivicDidRecord {
    readonly gridName: string;
    readonly civicDid: string;
    readonly existenceDid: string;
    readonly credentialJson: object;
    readonly status: CivicDidStatus;
    readonly issuedAtTick: number;
    readonly revokedAtTick?: number;
    readonly courtConvictionRef?: string;
    // Phase 41 presence (optional — present if migration v30 applied)
    presenceStatus?: 'awake' | 'away' | 'absent' | 'presumed_departed';
    lastSeenAt?: Date | null;
    lastSeenTick?: number | null;
    awayGraceExpiresAt?: Date | null;
    frozen?: boolean;
    // Phase 42 P2P-01..05 — Ed25519 JWK for P2P SDP encryption (migration v32; NULL = P2P unavailable)
    existencePublicKeyJwk?: object | null;
}

export interface BusinessDidRecord {
    readonly gridName: string;
    readonly businessDid: string;
    readonly civicDid: string;
    readonly businessName: string;
    readonly category: string;
    readonly credentialJson: object;
    readonly status: BusinessDidStatus;
    readonly issuedAtTick: number;
    readonly dissolvedAtTick?: number;
    readonly biosCostPaid: number;
}
