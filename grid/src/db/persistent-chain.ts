/**
 * PersistentAuditChain — extends AuditChain with live DB persistence.
 *
 * Every append() is mirrored to the store asynchronously (fire-and-forget).
 * The in-memory chain remains the authoritative source of truth for reads
 * and hash-chain verification.
 *
 * Store failures are logged as warnings and do NOT interrupt the audit flow.
 * On restart, use GridStore.restore() to reload entries from the DB.
 */

import { AuditChain } from '../audit/chain.js';
import type { IAuditStore } from './types.js';
import type { AuditEntry } from '../audit/types.js';

export class PersistentAuditChain extends AuditChain {
    constructor(
        private readonly store: IAuditStore,
        private readonly gridName: string,
    ) {
        super();
    }

    override append(
        eventType: string,
        actorDid: string,
        payload: Record<string, unknown>,
        targetDid?: string,
    ): AuditEntry {
        // Write to in-memory chain first (synchronous, source of truth)
        const entry = super.append(eventType, actorDid, payload, targetDid);

        // Mirror to store asynchronously (fire-and-forget)
        this.store.append(this.gridName, entry).catch(err =>
            console.warn(
                `[PersistentAuditChain] Failed to persist entry ${entry.id} (${eventType}):`,
                err,
            ),
        );

        return entry;
    }
}
