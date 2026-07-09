/**
 * SYNC: grid/src/audit/types.ts
 *
 * This file is the dashboard-side mirror of the Grid audit types. It is
 * intentionally hand-copied (not imported from @noesis/grid) because:
 *   (a) the dashboard builds as a Next.js app and has no workspace dep
 *       on grid/ (which pulls fastify/mysql2 into client bundles);
 *   (b) a divergent copy surfaces in grep the moment server shapes change.
 *
 * If the Grid-side shape changes, update THIS file AND the matching
 * dashboard/src/test/fixtures/ws-frames.ts in lockstep.
 */

export interface AuditEntry {
    id?: number;
    eventType: string;       // domain.register, ousia.transfer, law.enacted, etc.
    actorDid: string;        // Who performed the action
    targetDid?: string;      // Who was affected (optional)
    payload: Record<string, unknown>;
    prevHash: string;        // SHA-256 hash of previous entry
    eventHash: string;       // SHA-256(prevHash + eventType + actorDid + payload + timestamp)
    createdAt: number;       // Unix timestamp (ms)
}

export interface AuditQuery {
    eventType?: string;
    actorDid?: string;
    targetDid?: string;
    limit?: number;
    offset?: number;
}

/**
 * Normalize a raw audit entry into the AuditEntry shape (QA ISSUE-010, 2026-07-09).
 *
 * The Grid speaks two shapes: authenticated operator frames carry the full
 * camelCase AuditEntry, while the REST GET /api/v1/audit/trail and the WS visitor
 * firehose return a reduced snake_case projection ({tick, event_type, actor_did,
 * payload}). Downstream consumers (categorizeEventType, FirehoseRow) assume
 * camelCase strings; an undefined eventType crashed /grid via
 * `undefined.startsWith(...)`. Accept either shape and fill safe defaults so the
 * page never white-screens on the projection.
 */
export function normalizeAuditEntry(raw: Record<string, unknown>): AuditEntry {
    const pick = (camel: string, snake: string): unknown => raw[camel] ?? raw[snake];
    return {
        id: raw.id as number | undefined,
        eventType: (pick('eventType', 'event_type') as string | undefined) ?? '',
        actorDid: (pick('actorDid', 'actor_did') as string | undefined) ?? '',
        targetDid: pick('targetDid', 'target_did') as string | undefined,
        payload: (raw.payload as Record<string, unknown> | undefined) ?? {},
        prevHash: (pick('prevHash', 'prev_hash') as string | undefined) ?? '',
        eventHash: (pick('eventHash', 'event_hash') as string | undefined) ?? '',
        createdAt: (pick('createdAt', 'created_at') as number | undefined) ?? 0,
    };
}
