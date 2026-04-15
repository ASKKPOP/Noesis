/**
 * Noēsis Domain System — Domain Registry
 *
 * Manages domain registration, resolution, and lookup.
 * This is the in-memory implementation used by the protocol layer.
 * The Grid service will persist to MySQL.
 */

import { buildNousUri } from './uri.js';
import { validateName, validateGridDomain } from './validator.js';
import type {
    DomainRecord,
    DomainRegistration,
    DomainResolution,
    DomainStatus,
    AccessType,
} from './types.js';

export interface RegistryConfig {
    gridDomain: string;
    accessType?: AccessType;  // Default approval behavior
}

export class DomainRegistry {
    private domains = new Map<string, DomainRecord>();      // fullAddress → record
    private didIndex = new Map<string, string>();            // didKey → fullAddress
    private readonly gridDomain: string;
    private readonly accessType: AccessType;

    constructor(config: RegistryConfig) {
        const domainValidation = validateGridDomain(config.gridDomain);
        if (!domainValidation.valid) {
            throw new Error(`Invalid grid domain: ${domainValidation.error}`);
        }
        this.gridDomain = config.gridDomain;
        this.accessType = config.accessType ?? 'public';
    }

    /**
     * Register a new domain name for a Nous.
     */
    register(registration: DomainRegistration): DomainRecord {
        const { name, didKey, publicKey, humanOwner } = registration;

        // Validate name
        const nameResult = validateName(name);
        if (!nameResult.valid) {
            throw new Error(`Invalid name: ${nameResult.error}`);
        }

        // Build full address
        const fullAddress = buildNousUri(name, this.gridDomain);
        if (!fullAddress) {
            throw new Error('Failed to build nous:// URI');
        }

        // Check uniqueness
        if (this.domains.has(fullAddress)) {
            throw new Error(`Domain "${fullAddress}" is already registered`);
        }

        // Check DID uniqueness
        if (this.didIndex.has(didKey)) {
            throw new Error(`DID "${didKey}" already has a registered domain`);
        }

        // Determine initial status based on access type
        const status: DomainStatus = this.accessType === 'public' ? 'active' : 'pending';

        const record: DomainRecord = {
            name,
            gridDomain: this.gridDomain,
            fullAddress,
            didKey,
            publicKey,
            status,
            accessType: this.accessType,
            humanOwner,
            registeredAt: Date.now(),
        };

        this.domains.set(fullAddress, record);
        this.didIndex.set(didKey, fullAddress);

        return record;
    }

    /**
     * Resolve a nous:// address to domain info.
     */
    resolve(fullAddress: string): DomainResolution | null {
        const record = this.domains.get(fullAddress);
        if (!record) return null;

        return {
            name: record.name,
            gridDomain: record.gridDomain,
            fullAddress: record.fullAddress,
            didKey: record.didKey,
            publicKey: record.publicKey,
            status: record.status,
        };
    }

    /**
     * Lookup domain by did:key.
     */
    lookupByDid(didKey: string): DomainRecord | null {
        const fullAddress = this.didIndex.get(didKey);
        if (!fullAddress) return null;
        return this.domains.get(fullAddress) ?? null;
    }

    /**
     * Check if a did:key is registered and active.
     */
    isActive(didKey: string): boolean {
        const record = this.lookupByDid(didKey);
        return record?.status === 'active';
    }

    /**
     * Update domain status (approve, suspend, exile).
     */
    updateStatus(fullAddress: string, status: DomainStatus): void {
        const record = this.domains.get(fullAddress);
        if (!record) throw new Error(`Domain "${fullAddress}" not found`);
        record.status = status;
    }

    /**
     * Revoke a domain registration.
     */
    revoke(fullAddress: string): void {
        const record = this.domains.get(fullAddress);
        if (!record) return;
        this.didIndex.delete(record.didKey);
        this.domains.delete(fullAddress);
    }

    /**
     * List all registered domains.
     */
    listAll(): DomainRecord[] {
        return Array.from(this.domains.values());
    }

    /**
     * List active domains only.
     */
    listActive(): DomainRecord[] {
        return this.listAll().filter(d => d.status === 'active');
    }

    /**
     * Get the grid domain this registry manages.
     */
    getGridDomain(): string {
        return this.gridDomain;
    }
}
