/**
 * LoreCitationListener — Phase 20 LORE-02.
 * Pure-observer on the lore cited event (LORE_CITED_EVENT). Increments citation_count in lore_commons MySQL table.
 *
 * INVARIANT: Zero audit.append() calls inside this class body.
 * Enforced by: grid/test/lore/lore-producer-boundary.test.ts grep gate.
 */
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import type { LoreStorage } from './LoreStorage.js';
import { LORE_CITED_EVENT } from './appendLoreCited.js';

export class LoreCitationListener {
    constructor(
        private readonly audit: AuditChain,
        private readonly storage: LoreStorage,
        private readonly gridName: string,
    ) {
        // Pure observer — onAppend only; zero audit.append in this class body
        this.audit.onAppend((entry) => this.handleEntry(entry));
    }

    private handleEntry(entry: AuditEntry): void {
        if (entry.eventType !== LORE_CITED_EVENT) return;
        const contentHash = entry.payload['content_hash'] as string;
        if (typeof contentHash !== 'string' || contentHash.length !== 64) return;
        // Fire-and-forget increment — errors swallowed (audit chain is truth; citation_count is cache)
        this.storage.incrementCitationCount(this.gridName, contentHash).catch(() => {});
    }
}
