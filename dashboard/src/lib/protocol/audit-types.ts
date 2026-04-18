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
