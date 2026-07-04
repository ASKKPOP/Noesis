/**
 * Phase 42 P2P-01 — TTL-aware in-memory peer presence store.
 * 5-min TTL per D-42-02. Grid restart clears peers; Brains re-announce on reconnect.
 * No DB persistence — peer presence is ephemeral by design.
 */
import { P2P_PEER_TTL_MS, type PeerEntry, type PeerStatus } from './types.js';

export class P2PPeerStore {
    private peers = new Map<string, PeerEntry>();

    /**
     * Upsert peer presence. Called by POST /api/v1/p2p/announce.
     */
    announce(civicDid: string, tick: number): void {
        this.peers.set(civicDid, {
            civicDid,
            lastSeenAt: Date.now(),
            lastSeenTick: tick,
        });
    }

    /**
     * Check if a peer is online. Expired entries are deleted on read.
     */
    getStatus(civicDid: string): PeerStatus {
        const entry = this.peers.get(civicDid);
        if (!entry) return { status: 'offline' };
        if (Date.now() - entry.lastSeenAt > P2P_PEER_TTL_MS) {
            this.peers.delete(civicDid);
            return { status: 'offline' };
        }
        return {
            status: 'online',
            last_seen_at: new Date(entry.lastSeenAt).toISOString(),
        };
    }

    /**
     * Purge all stale entries. Called by setInterval in Plan 04 server startup.
     */
    cleanup(): void {
        const now = Date.now();
        for (const [did, entry] of this.peers) {
            if (now - entry.lastSeenAt > P2P_PEER_TTL_MS) this.peers.delete(did);
        }
    }

    /**
     * Test-only — peer count for assertions.
     */
    size(): number {
        return this.peers.size;
    }

    /**
     * Count of currently-online peers, TTL-filtered at call time (does not
     * depend on the periodic cleanup() interval having already purged stale
     * entries). Used by GET /api/v1/system/map's P2P institution metric.
     */
    countOnline(): number {
        const now = Date.now();
        let count = 0;
        for (const entry of this.peers.values()) {
            if (now - entry.lastSeenAt <= P2P_PEER_TTL_MS) count++;
        }
        return count;
    }
}
