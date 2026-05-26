/**
 * Phase 38 WIRE-05 — per-Civic-DID relevance filter for the WSS firehose.
 *
 * Applied at egress (ClientConnection.trySend), AFTER the audit listener has
 * already received the entry from the chain. This means:
 *   - The audit chain HEAD HASH is independent of subscriber composition.
 *   - The chain-listener fan-out path is unchanged — R-31-01 generalizes here.
 *
 * Filter scope (Phase 38):
 *   1. Own actor events  — entry.actorDid === did
 *   2. Targeted events   — entry.targetDid === did
 *   3. community.* where actor_did === did  // TODO Phase 49: full membership filter
 *   4. tick              — world heartbeat for everyone
 *   5. Otherwise         — drop
 *
 * Visitor / anonymous / human_visitor tiers bypass this filter (return true) —
 * they still flow through Phase 36's serializeVisitorFrame redaction.
 */
import type { AuditEntry } from './types.js';
import type { DIDContext } from '../api/preHandlers/types.js';

export function isRelevantFor(
    entry: AuditEntry,
    didContext: DIDContext | null,
): boolean {
    if (!didContext || didContext.tier !== 'civic_member') return true;
    const did = didContext.did;
    if (entry.actorDid === did) return true;
    if (entry.targetDid === did) return true;
    if (entry.eventType.startsWith('community.') && entry.actorDid === did) {
        // TODO Phase 49: also include events where subscriber is a member of the
        //   actor's community. Requires community_members table from Phase 49.
        return true;
    }
    if (entry.eventType === 'tick') return true;
    return false;
}
