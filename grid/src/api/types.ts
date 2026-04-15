/**
 * API request/response types for Grid services.
 */

export interface GridStatus {
    name: string;
    tick: number;
    epoch: number;
    nousCount: number;
    regionCount: number;
    activeLaws: number;
    auditEntries: number;
    uptime: number;
}

export interface DomainRegistration {
    name: string;
    gridDomain: string;
    didKey: string;
    publicKey: string;
    humanOwner?: string;
}

export interface DomainRecord {
    name: string;
    gridDomain: string;
    fullAddress: string;
    didKey: string;
    status: 'pending' | 'active' | 'suspended' | 'exiled';
}

export interface ErrorResponse {
    error: string;
    code: number;
}
