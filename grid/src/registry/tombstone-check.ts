/**
 * tombstone-check — centralized HTTP-410-Gone guard for AGENCY-05.
 *
 * Every authenticated operator route in Plan 02 calls tombstoneCheck()
 * immediately after DID_RE validation and before any business logic.
 * Tombstoned DIDs return HTTP 410 Gone (never 404 — the record existed,
 * it was intentionally deleted, and the audit trail proves when/by-whom).
 *
 * See: 08-CONTEXT D-09, 08-PATTERNS §tombstone-check.
 */

import type { NousRegistry } from './registry.js';

export class TombstonedDidError extends Error {
    /** HTTP status hint — Plan 02's route handlers map this to 410. */
    readonly statusHint = 410 as const;
    readonly did: string;
    readonly deletedAtTick: number;

    constructor(did: string, deletedAtTick: number) {
        super(`DID ${did} is tombstoned (deletedAtTick=${deletedAtTick})`);
        this.name = 'TombstonedDidError';
        this.did = did;
        this.deletedAtTick = deletedAtTick;
    }
}

/**
 * Throws TombstonedDidError if the DID is tombstoned. No-op for active or
 * unknown DIDs (unknown is NOT tombstoned — a different guard handles 404).
 */
export function tombstoneCheck(registry: NousRegistry, did: string): void {
    const record = registry.get(did);
    if (record && record.status === 'deleted') {
        throw new TombstonedDidError(did, record.deletedAtTick ?? -1);
    }
}
