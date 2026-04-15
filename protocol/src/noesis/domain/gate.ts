/**
 * Noēsis Domain System — Communication Gate
 *
 * The gate checks incoming P2P messages and rejects senders
 * who are not registered with an active domain in this Grid.
 *
 * Flow:
 *   1. Extract sender did:key from envelope signature
 *   2. Check local cache for domain status
 *   3. If cache miss → query registry
 *   4. If registered + active → ALLOW
 *   5. If not registered or suspended/exiled → REJECT
 */

import { validateEnvelope } from '../../swp.js';
import type { SwpEnvelope, ValidationOptions } from '../../swp.js';
import type { DomainRegistry } from './registry.js';
import type { GateCheckResult } from './types.js';

interface CacheEntry {
    didKey: string;
    allowed: boolean;
    expiresAt: number;
}

export interface GateConfig {
    cacheTtlMs?: number;       // Default: 5 minutes
    maxCacheSize?: number;     // Default: 10,000
}

export class CommunicationGate {
    private readonly registry: DomainRegistry;
    private readonly cache = new Map<string, CacheEntry>();
    private readonly cacheTtlMs: number;
    private readonly maxCacheSize: number;

    constructor(registry: DomainRegistry, config?: GateConfig) {
        this.registry = registry;
        this.cacheTtlMs = config?.cacheTtlMs ?? 5 * 60 * 1000;
        this.maxCacheSize = config?.maxCacheSize ?? 10_000;
    }

    /**
     * Check whether an incoming envelope should be allowed through.
     * Validates both the SWP envelope signature AND domain registration.
     */
    check(envelope: SwpEnvelope, validationOptions?: ValidationOptions): GateCheckResult {
        const senderDid = envelope.from.did;

        // 1. Validate envelope signature first
        const validation = validateEnvelope(envelope, validationOptions);
        if (!validation.valid) {
            return {
                allowed: false,
                reason: `Envelope validation failed: ${validation.error}`,
            };
        }

        // 2. Check cache
        const cached = this.getCached(senderDid);
        if (cached !== undefined) {
            if (cached) {
                const domain = this.registry.lookupByDid(senderDid);
                return { allowed: true, domain: domain ?? undefined };
            }
            return {
                allowed: false,
                reason: `Sender ${senderDid} is not registered or not active (cached)`,
            };
        }

        // 3. Query registry
        const domain = this.registry.lookupByDid(senderDid);

        if (!domain) {
            this.setCache(senderDid, false);
            return {
                allowed: false,
                reason: `Sender ${senderDid} is not registered in this Grid`,
            };
        }

        if (domain.status !== 'active') {
            this.setCache(senderDid, false);
            return {
                allowed: false,
                reason: `Sender ${domain.fullAddress} is ${domain.status}`,
            };
        }

        // Active and registered — allow
        this.setCache(senderDid, true);
        return { allowed: true, domain };
    }

    /**
     * Invalidate cache for a specific DID (e.g., on status change).
     */
    invalidate(didKey: string): void {
        this.cache.delete(didKey);
    }

    /**
     * Clear the entire cache.
     */
    clearCache(): void {
        this.cache.clear();
    }

    private getCached(didKey: string): boolean | undefined {
        const entry = this.cache.get(didKey);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(didKey);
            return undefined;
        }
        return entry.allowed;
    }

    private setCache(didKey: string, allowed: boolean): void {
        // Evict oldest if at capacity
        if (this.cache.size >= this.maxCacheSize) {
            const oldest = this.cache.keys().next().value;
            if (oldest) this.cache.delete(oldest);
        }

        this.cache.set(didKey, {
            didKey,
            allowed,
            expiresAt: Date.now() + this.cacheTtlMs,
        });
    }
}
