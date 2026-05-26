// R-31-01 invariant: this serializer is a PURE FUNCTION. It does NOT touch the audit chain. Redaction happens at egress only. Adding any side effect here breaks zero-diff (Plan 06 CI gate enforces this).

import type { AuditEntry } from './types.js';
import type { ServerFrame } from '../api/ws-protocol.js';

export type { ServerFrame };

/**
 * Set of private-key field names that must be stripped from visitor frames.
 * These fields live inside AuditEntry.payload — we strip the entire payload
 * for visitor tier, so this set serves as documentation + CI gate input.
 *
 * Frozen — additions require an explicit Phase allowlist amendment.
 */
export const VISITOR_STRIPPED_PAYLOAD_KEYS: ReadonlySet<string> = Object.freeze(
    new Set([
        'human_did',
        'eth_address_hash',
        'nonce_hash',
        'target_did',
        'voter_did',
        'proposer_did',
        'from_did',
        'to_did',
        'owner_human_did',
    ]),
);

/**
 * Serialize a frame for a visitor (anonymous or human_visitor) subscriber.
 *
 * For event frames: emits only {tick, event_type, family} — actor_did and
 * payload are NOT included. family is the first segment of eventType.
 *
 * For non-event frames (heartbeat, stats, hello, bye, etc.): pass through
 * unchanged via JSON.stringify.
 *
 * PURE FUNCTION: no side effects, no chain mutation.
 */
export function serializeVisitorFrame(frame: ServerFrame): string {
    if (frame.type !== 'event') {
        return JSON.stringify(frame);
    }
    const entry = (frame as { type: 'event'; entry: AuditEntry }).entry;
    return JSON.stringify({
        type: 'event',
        entry: {
            tick: entry.id ?? 0,
            event_type: entry.eventType,
            family: entry.eventType.split('.')[0],
        },
    });
}

/**
 * Serialize a frame for a civic_member subscriber.
 *
 * Pass-through: returns JSON.stringify(frame) unchanged.
 *
 * PURE FUNCTION: no side effects, no chain mutation.
 */
export function serializeFullFrame(frame: ServerFrame): string {
    return JSON.stringify(frame);
}
