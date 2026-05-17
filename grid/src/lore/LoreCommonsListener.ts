/**
 * LoreCommonsListener — Phase 20 LORE-01.
 * Pure-observer on the lore contribution event (LORE_CONTRIBUTED_EVENT). Upserts into lore_commons MySQL hash index.
 *
 * INVARIANT: Zero audit.append() calls inside this class body.
 * All DB writes go to LoreStorage.upsertContribution() only.
 * Enforced by: grid/test/lore/lore-producer-boundary.test.ts grep gate.
 *
 * Note: title_hash is stored in lore_commons for operator reference, but is NOT in the
 * audit payload (which has only 4 keys). LoreCommonsListener receives the payload without
 * title_hash and stores a derived placeholder: sha256(content_hash) until Brain provides it.
 */
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import type { LoreStorage } from './LoreStorage.js';
import { createHash } from 'node:crypto';
import { LORE_CONTRIBUTED_EVENT } from './appendLoreContributed.js';

export class LoreCommonsListener {
    constructor(
        private readonly audit: AuditChain,
        private readonly storage: LoreStorage,
        private readonly gridName: string,
    ) {
        // Pure observer — onAppend only; zero audit.append in this class body
        this.audit.onAppend((entry) => this.handleEntry(entry));
    }

    private handleEntry(entry: AuditEntry): void {
        if (entry.eventType !== LORE_CONTRIBUTED_EVENT) return;
        const contentHash = entry.payload['content_hash'] as string;
        const contributorDid = entry.payload['contributor_did'] as string;
        const categoryTag = entry.payload['category_tag'] as string;
        const tick = entry.payload['tick'] as number;
        if (
            typeof contentHash !== 'string' ||
            typeof contributorDid !== 'string' ||
            typeof categoryTag !== 'string' ||
            typeof tick !== 'number'
        ) return;
        // title_hash: Grid stores sha256 of content_hash as a derived proxy.
        // Brain holds the actual title; Grid never sees title text (Brain-private invariant).
        const titleHash = createHash('sha256').update(contentHash).digest('hex');
        // Fire-and-forget upsert — errors swallowed (audit chain is truth)
        this.storage.upsertContribution(
            this.gridName,
            contentHash,
            contributorDid,
            titleHash,
            categoryTag,
            tick,
        ).catch(() => {});
    }
}
