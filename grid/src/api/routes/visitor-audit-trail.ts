/**
 * Visitor audit trail route — Phase 36 VIS-01 / D-V3-12 + D-36-06.
 *
 * ROUTE_DID_POLICY: 'public' — listed in grid/src/api/policy.ts
 *
 * // D-V3-12 + D-36-06: visitor sees last 1000 events sliding window; actor_did replaced by family prefix; payload redacted.
 *
 * GET /api/v1/audit/trail?limit=N
 *   200: {entries: VisitorAuditEntry[]}
 *
 * Per-tier behavior:
 *   - civic_member (req.didContext.tier): returns full entries with actor_did and payload
 *   - anonymous / human_visitor (null or non-civic_member): returns entries with:
 *       - actor_did replaced by event_type family prefix (e.g. 'nous' for 'nous.spoke')
 *       - payload replaced by empty object {}
 *
 * Cap: last 1000 events per D-36-06. Default limit 100, max 1000.
 * Window is sliding: returns the most recent N events from the chain.
 */

import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { AuditEntry } from '../../audit/types.js';

/** Audit entry shape for civic_member tier. */
export interface FullAuditEntry {
    tick: number;
    event_type: string;
    actor_did: string;
    payload: Record<string, unknown>;
}

/** Redacted audit entry shape for anonymous / human_visitor tiers. */
export interface RedactedAuditEntry {
    tick: number;
    event_type: string;
    actor_did: string; // family prefix (e.g. 'nous' for 'nous.spoke')
    payload: Record<string, never>; // always empty object {}
}

export type VisitorAuditEntry = FullAuditEntry | RedactedAuditEntry;

/**
 * Extract the event family prefix from an event_type string.
 * e.g. 'nous.spoke' → 'nous', 'portal.did_issued' → 'portal'
 */
function eventFamily(eventType: string): string {
    return eventType.split('.')[0] ?? eventType;
}

/**
 * Map an AuditEntry to a FullAuditEntry (civic_member view).
 * tick is the entry id (used as logical tick proxy for Phase 36 stub).
 */
function toFullEntry(entry: AuditEntry): FullAuditEntry {
    return {
        tick: entry.id ?? 0,
        event_type: entry.eventType,
        actor_did: entry.actorDid,
        payload: entry.payload,
    };
}

/**
 * Map an AuditEntry to a RedactedAuditEntry (anonymous / human_visitor view).
 * actor_did → event family prefix. payload → {}.
 */
function toRedactedEntry(entry: AuditEntry): RedactedAuditEntry {
    return {
        tick: entry.id ?? 0,
        event_type: entry.eventType,
        actor_did: eventFamily(entry.eventType),
        payload: {},
    };
}

export function registerVisitorAuditTrailRoute(
    app: FastifyInstance,
    services: GridServices,
): void {
    app.get<{ Querystring: { limit?: string } }>(
        '/api/v1/audit/trail',
        async (req, _reply) => {
            const rawLimit = parseInt(req.query.limit ?? '100', 10);
            const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 100, 1000);

            // Fetch last `limit` events from the chain (sliding window per D-36-06).
            const total = services.audit.length;
            const offset = Math.max(0, total - limit);
            const raw = services.audit.query({ limit, offset });

            const isCivicMember = req.didContext?.tier === 'civic_member';

            const entries: VisitorAuditEntry[] = isCivicMember
                ? raw.map(toFullEntry)
                : raw.map(toRedactedEntry);

            return { entries };
        },
    );
}
