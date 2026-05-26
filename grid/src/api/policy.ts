/**
 * VIS-04 enforcement table — single source of truth for ROUTE_DID_POLICY per D-36-17.
 * Default-deny: any unlisted route resolves to civic_did_required.
 * Routes are keyed as "METHOD /path" strings.
 */

// Default-deny: any route NOT in this Record is treated as 'civic_did_required' by the policy lookup helper.

export const ROUTE_DID_POLICY_VALUES = [
    'public',
    'portal_session_required',
    'civic_did_required',
    'business_did_required',
    'government_only',
    'police_only',
] as const;

export type RouteDIDPolicy = (typeof ROUTE_DID_POLICY_VALUES)[number];

export const ROUTE_DID_POLICY: Readonly<Record<string, RouteDIDPolicy>> = Object.freeze({
    // Health (existing)
    'GET /health': 'public',
    'GET /health/detailed': 'public',

    // Visitor surfaces (Plan 05 will land the handlers)
    'GET /api/v1/civic-map/state': 'public',
    'GET /api/v1/civic-map/zone/:zone_id': 'public',
    'GET /api/v1/library/entries': 'public',
    'GET /api/v1/market/listings': 'public',
    'GET /api/v1/polis/bills': 'public',
    'GET /api/v1/polis/bills/:id': 'public',
    'GET /api/v1/nous/:civic_did_hash/public': 'public',
    'GET /api/v1/audit/trail': 'public',
    'GET /api/v1/audit/firehose': 'public', // WS — redacted in serializer

    // Auth exceptions (D-V3-15 amended count = 5 per D-36-21)
    'POST /portal/auth/siwe': 'public',
    'POST /portal/auth/email/signup': 'public',
    'POST /portal/auth/email/signin': 'public',
    'POST /portal/auth/oauth/google': 'public',
    'POST /portal/auth/oauth/apple': 'public',

    // Human Visitor notifications (D-36-19)
    'GET /portal/api/v1/notifications': 'portal_session_required',
    'POST /portal/api/v1/notifications/:id/read': 'portal_session_required',

    // Human Visitor soft interactions (D-36-18)
    'POST /api/v1/nous/:civic_did_hash/follow': 'portal_session_required',
    'POST /api/v1/polis/bills/:id/watch': 'portal_session_required',

    // Existing write routes (default-deny would catch these but we list explicitly for clarity)
    'POST /api/v1/trade': 'civic_did_required',
    'POST /api/v1/governance/propose': 'civic_did_required',
    'POST /api/v1/governance/commit': 'civic_did_required',
    'POST /api/v1/governance/reveal': 'civic_did_required',
    'POST /api/v1/spawn': 'civic_did_required',

    // Existing API routes (all portal-gated by convention)
    'GET /api/v1/grid/status': 'civic_did_required',
    'GET /api/v1/grid/clock': 'civic_did_required',
    'GET /api/v1/grid/regions': 'civic_did_required',
    'GET /api/v1/grid/regions/:id': 'civic_did_required',
    'GET /api/v1/grid/nous': 'civic_did_required',
    'GET /api/v1/nous/:did/state': 'civic_did_required',
    'GET /api/v1/economy/trades': 'civic_did_required',
    'GET /api/v1/economy/shops': 'civic_did_required',
    'GET /api/v1/governance/laws': 'civic_did_required',
    'GET /api/v1/governance/laws/:id': 'civic_did_required',
    'GET /api/v1/audit/verify': 'civic_did_required',
    'GET /api/v1/audit/drift-alerts': 'civic_did_required',

    // Portal auth routes (existing, public for sign-in flows)
    'GET /api/v1/portal/auth/nonce': 'public',
    'POST /api/v1/portal/auth/verify': 'public',
    'POST /api/v1/portal/auth/logout': 'public',
    'GET /api/v1/portal/auth/me': 'portal_session_required',
    'PATCH /api/v1/portal/auth/me': 'portal_session_required',
    'POST /api/v1/portal/auth/email/signup': 'public',
    'POST /api/v1/portal/auth/email/signin': 'public',

    // Portal wallet
    'POST /api/v1/portal/wallet/transfer': 'portal_session_required',

    // Portal chat
    'POST /api/v1/portal/chat/onboard': 'portal_session_required',
    'POST /api/v1/portal/chat/nous/:nousId': 'portal_session_required',

    // Portal Nous spawn
    'GET /api/v1/portal/nous/spawn/config': 'portal_session_required',
    'GET /api/v1/portal/nous/spawn/check-name': 'portal_session_required',
    'GET /api/v1/portal/nous/spawn/status/:txHash': 'portal_session_required',
    'POST /api/v1/portal/nous/spawn': 'portal_session_required',

    // Portal Nous data
    'GET /api/v1/portal/nous/:nousId/lore': 'portal_session_required',
    'GET /api/v1/portal/nous/:nousId/norms': 'portal_session_required',
    'GET /api/v1/portal/nous/:nousId/skills': 'portal_session_required',

    // Portal community
    'GET /api/v1/portal/community/posts': 'portal_session_required',
    'GET /api/v1/portal/community/posts/:id/replies': 'portal_session_required',
    'GET /api/v1/portal/community/users': 'portal_session_required',
    'GET /api/v1/portal/community/leaderboard': 'portal_session_required',
    'GET /api/v1/portal/community/following': 'portal_session_required',
    'POST /api/v1/portal/community/posts': 'portal_session_required',
    'POST /api/v1/portal/community/posts/:id/replies': 'portal_session_required',
    'POST /api/v1/portal/community/follow/:did': 'portal_session_required',
    'DELETE /api/v1/portal/community/follow/:did': 'portal_session_required',

    // Portal support
    'GET /api/v1/portal/support/tickets': 'portal_session_required',
    'POST /api/v1/portal/support/tickets': 'portal_session_required',

    // Portal human profile
    'GET /api/v1/portal/human/me/progress': 'portal_session_required',
    'GET /api/v1/portal/human/me/nous': 'portal_session_required',

    // Portal activity
    'GET /api/v1/portal/activity': 'portal_session_required',

    // Human profiles (observer routes)
    'GET /api/v1/humans/:did': 'civic_did_required',
    'GET /api/v1/humans/:did/history': 'civic_did_required',

    // Nous tick metrics
    'GET /api/v1/nous/:did/tick-metrics': 'civic_did_required',

    // Grid culture + lore
    'GET /api/v1/grid/culture/skills/lineage': 'civic_did_required',
    'GET /api/v1/grid/lore': 'civic_did_required',
    'GET /api/v1/grid/norms': 'civic_did_required',

    // Governance proposals (conditional — only registered when governance service present)
    'GET /api/v1/governance/proposals': 'civic_did_required',
    'GET /api/v1/governance/proposals/:id/body': 'civic_did_required',
    'GET /api/v1/governance/proposals/:id/ballots/history': 'civic_did_required',
    'POST /api/v1/governance/proposals/:id/ballots/commit': 'civic_did_required',
    'POST /api/v1/governance/proposals/:id/ballots/reveal': 'civic_did_required',

    // Relationship graph
    'GET /api/v1/nous/:did/relationships': 'civic_did_required',
    'GET /api/v1/nous/:did/relationships/inspect': 'civic_did_required',
    'GET /api/v1/grid/relationships/graph': 'civic_did_required',

    // Operator routes (civic_did_required minimum — Plan 06 CI gate enforces stricter for /admin/)
    'POST /api/v1/operator/clock/pause': 'civic_did_required',
    'POST /api/v1/operator/clock/resume': 'civic_did_required',
    'GET /api/v1/operator/governance/laws': 'civic_did_required',
    'POST /api/v1/operator/governance/laws': 'civic_did_required',
    'PUT /api/v1/operator/governance/laws/:id': 'civic_did_required',
    'DELETE /api/v1/operator/governance/laws/:id': 'civic_did_required',
    'POST /api/v1/operator/humans/:did/ban': 'civic_did_required',
    'POST /api/v1/operator/humans/:did/freeze': 'civic_did_required',
    'POST /api/v1/operator/nous/:did/delete': 'civic_did_required',
    'POST /api/v1/operator/nous/:did/mute': 'civic_did_required',
    'POST /api/v1/operator/nous/:did/quarantine': 'civic_did_required',
    'POST /api/v1/operator/nous/:did/slash': 'civic_did_required',
    'POST /api/v1/operator/nous/:did/force-sleep': 'civic_did_required',
    'POST /api/v1/operator/nous/:did/telos/force': 'civic_did_required',
    'GET /api/v1/operator/nous/:did/cognitive-snapshot': 'civic_did_required',
    'POST /api/v1/operator/nous/:did/memory/query': 'civic_did_required',
    'POST /api/v1/operator/relationships/:edge_key/events': 'civic_did_required',
    'POST /api/v1/operator/replay/export': 'civic_did_required',
    'POST /api/v1/operator/spawn-system-nous': 'civic_did_required',

    // Admin routes (gated by GRID_ADMIN_ENABLED, civic_did_required minimum)
    'GET /api/v1/admin/config': 'civic_did_required',
    'PUT /api/v1/admin/config': 'civic_did_required',
    'POST /api/v1/admin/notifications': 'civic_did_required',
    'POST /api/v1/admin/restart/:service': 'civic_did_required',
} as Record<string, RouteDIDPolicy>);

/**
 * Look up the policy for a route. Returns the policy from ROUTE_DID_POLICY,
 * or 'civic_did_required' if the route is not listed (default-deny).
 */
export function lookupPolicy(method: string, routePath: string): RouteDIDPolicy {
    return ROUTE_DID_POLICY[`${method} ${routePath}`] ?? 'civic_did_required';
}

/**
 * Returns true if the path is under the /admin/ namespace.
 * Used by the admin-policy-isolation CI gate in Plan 06.
 */
export function isAdminRoute(routePath: string): boolean {
    return routePath.includes('/admin/');
}
