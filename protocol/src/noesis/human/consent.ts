/**
 * Consent Manager — tracks permissions between humans and their Nous.
 *
 * All human interactions require explicit consent grants.
 * Grants can be scoped, time-limited, and revoked.
 */

import type { ConsentGrant, PermissionScope, OwnershipProof } from './types.js';

export class ConsentManager {
    private readonly grants: ConsentGrant[] = [];
    private readonly owners = new Map<string, OwnershipProof>(); // key: `${humanId}:${nousDid}`

    /** Register ownership proof. */
    registerOwnership(proof: OwnershipProof): void {
        const key = `${proof.humanId}:${proof.nousDid}`;
        this.owners.set(key, proof);
    }

    /** Check if human owns a Nous. */
    isOwner(humanId: string, nousDid: string): boolean {
        const key = `${humanId}:${nousDid}`;
        const proof = this.owners.get(key);
        if (!proof) return false;
        if (proof.expiresAt < Date.now()) return false;
        return true;
    }

    /** Grant consent for specific scopes. Only owners can grant. */
    grant(
        humanId: string,
        nousDid: string,
        scopes: PermissionScope[],
        expiresAt: number | null = null,
    ): ConsentGrant {
        if (!this.isOwner(humanId, nousDid)) {
            throw new Error('Only owners can grant consent');
        }

        const consent: ConsentGrant = {
            nousDid,
            humanId,
            scopes,
            grantedAt: Date.now(),
            expiresAt,
            revokedAt: null,
        };

        this.grants.push(consent);
        return consent;
    }

    /** Revoke all grants for a human-Nous pair. */
    revokeAll(humanId: string, nousDid: string): number {
        let count = 0;
        const now = Date.now();
        for (const g of this.grants) {
            if (g.humanId === humanId && g.nousDid === nousDid && g.revokedAt === null) {
                g.revokedAt = now;
                count++;
            }
        }
        return count;
    }

    /** Revoke a specific scope. */
    revokeScope(humanId: string, nousDid: string, scope: PermissionScope): boolean {
        for (const g of this.grants) {
            if (g.humanId === humanId && g.nousDid === nousDid && g.revokedAt === null) {
                const idx = g.scopes.indexOf(scope);
                if (idx !== -1) {
                    g.scopes.splice(idx, 1);
                    if (g.scopes.length === 0) {
                        g.revokedAt = Date.now();
                    }
                    return true;
                }
            }
        }
        return false;
    }

    /** Check if a human has a specific permission for a Nous. */
    hasPermission(humanId: string, nousDid: string, scope: PermissionScope): boolean {
        const now = Date.now();
        for (const g of this.grants) {
            if (g.humanId !== humanId || g.nousDid !== nousDid) continue;
            if (g.revokedAt !== null) continue;
            if (g.expiresAt !== null && g.expiresAt < now) continue;
            if (g.scopes.includes(scope)) return true;
        }
        return false;
    }

    /** Get all active grants for a human-Nous pair. */
    activeGrants(humanId: string, nousDid: string): ConsentGrant[] {
        const now = Date.now();
        return this.grants.filter(g =>
            g.humanId === humanId &&
            g.nousDid === nousDid &&
            g.revokedAt === null &&
            (g.expiresAt === null || g.expiresAt >= now),
        );
    }

    /** Get all Nous DIDs a human has any active permission for. */
    accessibleNous(humanId: string): string[] {
        const now = Date.now();
        const dids = new Set<string>();
        for (const g of this.grants) {
            if (g.humanId !== humanId) continue;
            if (g.revokedAt !== null) continue;
            if (g.expiresAt !== null && g.expiresAt < now) continue;
            if (g.scopes.length > 0) dids.add(g.nousDid);
        }
        return [...dids];
    }

    /** Total grant count. */
    get count(): number {
        return this.grants.length;
    }
}
