/**
 * Phase 42 P2P-01..05 — domain types.
 * D-42-02: 5-minute TTL for peer presence announcements.
 * D-42-03: 3600s TURN TTL (1 hour coturn standard); TURN_REALM = 'noesis.grid'.
 */

export const P2P_PEER_TTL_MS = 5 * 60 * 1000;       // 5 minutes per D-42-02
export const SDP_INBOX_ENTRY_TTL_MS = 60 * 1000;     // 60 seconds — ICE negotiation budget
export const TURN_TTL_SECONDS = 3600;                 // 1 hour coturn standard
export const TURN_REALM = 'noesis.grid';

export interface PeerEntry {
    readonly civicDid: string;
    readonly lastSeenAt: number;   // Date.now() ms
    readonly lastSeenTick: number;
}

export interface PeerStatus {
    readonly status: 'online' | 'offline';
    readonly last_seen_at?: string;  // ISO 8601, present only when online
}

export interface InboxEntry {
    readonly connectionId: string;    // UUID v4
    readonly fromDid: string;         // CIVIC_DID_RE
    readonly encryptedBlob: string;   // base64-encoded ciphertext
    readonly expiresAt: number;       // Date.now() ms
}

export interface TurnCredentials {
    readonly username: string;
    readonly password: string;
    readonly ttl: number;
    readonly realm: string;
}

import type { P2PPeerStore } from './p2p-peer-store.js';
import type { SdpInboxStore } from './sdp-inbox-store.js';

export interface P2PService {
    readonly peerStore: P2PPeerStore;
    readonly sdpInboxStore: SdpInboxStore;
    readonly turnSharedSecret: string;
}
