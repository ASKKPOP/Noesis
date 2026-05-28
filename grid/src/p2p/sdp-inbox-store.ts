/**
 * Phase 42 P2P-02 — per-recipient encrypted-blob SDP inbox.
 * 60s entry TTL; drain clears bucket atomically.
 * Entries are stored in-memory; Grid restart clears all pending SDP blobs.
 * Brains that miss their window must retry the full P2P handshake.
 */
import { SDP_INBOX_ENTRY_TTL_MS, type InboxEntry } from './types.js';

export class SdpInboxStore {
    private inbox = new Map<string, InboxEntry[]>();

    /**
     * Append an encrypted SDP blob to the recipient's inbox bucket.
     */
    push(toDid: string, entry: InboxEntry): void {
        const entries = this.inbox.get(toDid) ?? [];
        entries.push(entry);
        this.inbox.set(toDid, entries);
    }

    /**
     * Return all non-expired entries for a recipient AND clear their bucket atomically.
     * Returns [] for unknown DIDs.
     */
    drain(toDid: string): InboxEntry[] {
        const entries = (this.inbox.get(toDid) ?? [])
            .filter(e => e.expiresAt > Date.now());
        this.inbox.delete(toDid);
        return entries;
    }

    /**
     * Remove all expired entries across all DID buckets; delete empty buckets.
     * Called periodically by the launcher cleanup interval (OBS-R-32-02).
     */
    cleanup(): void {
        const now = Date.now();
        for (const [did, entries] of this.inbox) {
            const live = entries.filter(e => e.expiresAt > now);
            if (live.length === 0) {
                this.inbox.delete(did);
            } else {
                this.inbox.set(did, live);
            }
        }
    }

    /**
     * Helper for Plan 04 routes to compute expiresAt using the standard 60s TTL.
     */
    static computeExpiresAt(): number {
        return Date.now() + SDP_INBOX_ENTRY_TTL_MS;
    }
}
