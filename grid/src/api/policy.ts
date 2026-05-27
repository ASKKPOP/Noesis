/**
 * VIS-04 enforcement table — single source of truth for ROUTE_DID_POLICY per D-36-17.
 * Default-deny: any unlisted route resolves to civic_did_required.
 * Routes are keyed as "METHOD /path" strings.
 *
 * BACKWARD COMPATIBILITY NOTE:
 * Pre-Phase-36 routes that used their own auth or were unauthenticated are marked
 * 'public' here, which means the DID enforcement hook passes them through to their
 * route handlers unchanged. This preserves existing behavior. Future phases will
 * migrate these routes to stricter policies as the Civic-DID auth layer matures.
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
    // Health (existing, unauthenticated)
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

    // Phase 36 write routes — enforce Civic-DID (the primary VIS-02 deliverable)
    'POST /api/v1/trade': 'civic_did_required',
    'POST /api/v1/governance/propose': 'civic_did_required',
    'POST /api/v1/governance/commit': 'civic_did_required',
    'POST /api/v1/governance/reveal': 'civic_did_required',
    'POST /api/v1/spawn': 'civic_did_required',

    // Pre-Phase-36 read routes — marked public to preserve existing behavior.
    // These use their own internal auth (x-operator-tier headers etc.) or were
    // unauthenticated. Future phases will migrate to stricter policies.
    'GET /api/v1/grid/status': 'public',
    'GET /api/v1/grid/clock': 'public',
    'GET /api/v1/grid/regions': 'public',
    'GET /api/v1/grid/regions/:id': 'public',
    'GET /api/v1/grid/nous': 'public',
    'GET /api/v1/nous/:did/state': 'public',
    'GET /api/v1/economy/trades': 'public',
    'GET /api/v1/economy/shops': 'public',
    'GET /api/v1/governance/laws': 'public',
    'GET /api/v1/governance/laws/:id': 'public',
    'GET /api/v1/audit/verify': 'public',
    'GET /api/v1/audit/drift-alerts': 'public',

    // Portal auth routes (existing, public for sign-in flows)
    'GET /api/v1/portal/auth/nonce': 'public',
    'POST /api/v1/portal/auth/verify': 'public',
    'POST /api/v1/portal/auth/logout': 'public',
    'GET /api/v1/portal/auth/me': 'public',   // portal /me uses its own cookie check
    'PATCH /api/v1/portal/auth/me': 'public', // portal PATCH /me uses its own cookie check
    'POST /api/v1/portal/auth/email/signup': 'public',
    'POST /api/v1/portal/auth/email/signin': 'public',

    // Portal wallet — uses portal session auth internally
    'POST /api/v1/portal/wallet/transfer': 'public',

    // Portal chat — uses portal session auth internally
    'POST /api/v1/portal/chat/onboard': 'public',
    'POST /api/v1/portal/chat/nous/:nousId': 'public',

    // Portal Nous spawn — uses portal session auth internally
    'GET /api/v1/portal/nous/spawn/config': 'public',
    'GET /api/v1/portal/nous/spawn/check-name': 'public',
    'GET /api/v1/portal/nous/spawn/status/:txHash': 'public',
    'POST /api/v1/portal/nous/spawn': 'public',

    // Portal Nous data
    'GET /api/v1/portal/nous/:nousId/lore': 'public',
    'GET /api/v1/portal/nous/:nousId/norms': 'public',
    'GET /api/v1/portal/nous/:nousId/skills': 'public',

    // Portal community — uses portal session auth internally
    'GET /api/v1/portal/community/posts': 'public',
    'GET /api/v1/portal/community/posts/:id/replies': 'public',
    'GET /api/v1/portal/community/users': 'public',
    'GET /api/v1/portal/community/leaderboard': 'public',
    'GET /api/v1/portal/community/following': 'public',
    'POST /api/v1/portal/community/posts': 'public',
    'POST /api/v1/portal/community/posts/:id/replies': 'public',
    'POST /api/v1/portal/community/follow/:did': 'public',
    'DELETE /api/v1/portal/community/follow/:did': 'public',

    // Portal support — uses portal session auth internally
    'GET /api/v1/portal/support/tickets': 'public',
    'POST /api/v1/portal/support/tickets': 'public',

    // Portal human profile — uses portal session auth internally
    'GET /api/v1/portal/human/me/progress': 'public',
    'GET /api/v1/portal/human/me/nous': 'public',

    // Portal activity
    'GET /api/v1/portal/activity': 'public',

    // Human profiles
    'GET /api/v1/humans/:did': 'public',
    'GET /api/v1/humans/:did/history': 'public',

    // Nous tick metrics
    'GET /api/v1/nous/:did/tick-metrics': 'public',

    // Grid culture + lore
    'GET /api/v1/grid/culture/skills/lineage': 'public',
    'GET /api/v1/grid/lore': 'public',
    'GET /api/v1/grid/norms': 'public',

    // Governance proposals (conditional — only registered when governance service present)
    'GET /api/v1/governance/proposals': 'public',
    'GET /api/v1/governance/proposals/:id/body': 'public',
    'GET /api/v1/governance/proposals/:id/ballots/history': 'public',
    'POST /api/v1/governance/proposals/:id/ballots/commit': 'public',
    'POST /api/v1/governance/proposals/:id/ballots/reveal': 'public',

    // Relationship graph
    'GET /api/v1/nous/:did/relationships': 'public',
    'GET /api/v1/nous/:did/relationships/inspect': 'public',
    'GET /api/v1/grid/relationships/graph': 'public',

    // Operator routes — use their own x-operator-tier/x-operator-id auth mechanism
    'POST /api/v1/operator/clock/pause': 'public',
    'POST /api/v1/operator/clock/resume': 'public',
    'GET /api/v1/operator/governance/laws': 'public',
    'POST /api/v1/operator/governance/laws': 'public',
    'PUT /api/v1/operator/governance/laws/:id': 'public',
    'DELETE /api/v1/operator/governance/laws/:id': 'public',
    'POST /api/v1/operator/humans/:did/ban': 'public',
    'POST /api/v1/operator/humans/:did/freeze': 'public',
    'POST /api/v1/operator/nous/:did/delete': 'public',
    'POST /api/v1/operator/nous/:did/mute': 'public',
    'POST /api/v1/operator/nous/:did/quarantine': 'public',
    'POST /api/v1/operator/nous/:did/slash': 'public',
    'POST /api/v1/operator/nous/:did/force-sleep': 'public',
    'POST /api/v1/operator/nous/:did/telos/force': 'public',
    'GET /api/v1/operator/nous/:did/cognitive-snapshot': 'public',
    'POST /api/v1/operator/nous/:did/memory/query': 'public',
    'POST /api/v1/operator/relationships/:edge_key/events': 'public',
    'POST /api/v1/operator/replay/export': 'public',
    'POST /api/v1/operator/spawn-system-nous': 'public',

    // Admin routes — gated by GRID_ADMIN_ENABLED env, use their own mechanism
    'GET /api/v1/admin/config': 'public',
    'PUT /api/v1/admin/config': 'public',
    'POST /api/v1/admin/notifications': 'public',
    'POST /api/v1/admin/restart/:service': 'public',

    // Phase 37 (REG-01..06) — DID Registry routes.
    // - Public lookups are visitor-accessible (REG-05).
    // - Civic-DID request is public because the request is signed with the existence-key
    //   (not a Civic-DID bearer); REG-01 explicitly requires this asymmetry.
    // - Civic-DID revocation requires a government_only session (REG-04 court-order gate).
    // - Business registration requires civic_did_required tier (REG-03).
    // - Business dissolution requires government_only — same court-order discipline as civic revoke.
    //   This is the SOLE caller of appendRegistryBusinessDidDissolved in Phase 37 (REG-06).
    'GET /api/v1/registry/civic-did/:did':            'public',
    'GET /api/v1/registry/business-did/:did':         'public',
    'POST /api/v1/registry/civic-did/request':        'public',
    'POST /api/v1/registry/civic-did/:did/revoke':    'government_only',
    'POST /api/v1/registry/business-did/register':    'civic_did_required',
    'POST /api/v1/registry/business-did/:did/dissolve': 'government_only',

    // Phase 38 (WIRE-02) — Brain bearer-token registration/revocation.
    // - Register is public: the request body carries an existence-key signature
    //   (mirrors REG-01 Civic-DID request). The signature gate is in the handler.
    // - Revoke is government_only: per D-V3-18 only a court-order-bearing
    //   Government session may revoke a Brain token.
    'POST /api/v1/brain/token/register': 'public',
    'POST /api/v1/brain/token/revoke':   'government_only',

    // Phase 38 (WIRE-01 REST + WIRE-02 bearer) — Brain action dispatch.
    // civic_did_required: the JWT subject is a Civic-DID; the issuer is the
    // existence-DID (verified against brain_tokens public key in tryDid).
    'POST /api/v1/brain/actions': 'civic_did_required',

    // Phase 38 (WIRE-03 batch replay + WIRE-04 idempotency) — offline replay endpoint.
    // Same auth requirements as /brain/actions: Civic-DID bearer JWT.
    'POST /api/v1/brain/events/batch': 'civic_did_required',

    // Phase 38 (WIRE-01 WSS + WIRE-05 per-DID filter) — Brain firehose subscription.
    // WS upgrade routes are technically GET from Fastify's perspective.
    // civic_did_required: Brain JWT must resolve to civic_member tier via tryDid.
    'GET /api/v1/brain/firehose': 'civic_did_required',

    // Phase 39 — operator/me/* fleet management (D-39-04 / D-39-05)
    // These routes accept Portal session token only. Brain JWTs are for action dispatch only.
    'GET /api/v1/operator/me/nous':      'portal_session_required',
    'POST /api/v1/operator/me/brains':   'portal_session_required',
    'GET /api/v1/operator/me/quota':     'portal_session_required',
    'GET /api/v1/operator/me/settings':  'portal_session_required',
    'PATCH /api/v1/operator/me/settings': 'portal_session_required',

    // Phase 40 — Brain-JWT-authenticated settings fetch (D-40-01).
    // Policy: 'public' — the route performs its own EdDSA JWT verification internally
    // (same pattern as POST /api/v1/brain/token/register and GET /portal/auth/me).
    // Brain startup uses Phase 38 EdDSA bearer token, not a portal session cookie.
    // T-40-02-01: Brain JWT verified against registered public key in brain_tokens table.
    'GET /api/v1/operator/me/brain-settings': 'public',

    // Phase 41 Sleep Cycle (SLEEP-01..05) — presence + inbox + queue-aware send.
    // All 6 routes registered explicitly per OBS-36-01.
    'POST /api/v1/civic/presence':        'civic_did_required', // Brain JWT heartbeat (T-41-01)
    'GET /api/v1/civic/presence':         'public',             // Civic Map polling — no auth
    'GET /api/v1/civic/presence/me':      'civic_did_required', // Brain JWT — own DID only
    'GET /api/v1/civic/inbox':            'civic_did_required', // Brain JWT — scoped (T-41-05)
    'PATCH /api/v1/civic/inbox/ack':      'civic_did_required', // Brain JWT — scoped (T-41-05)
    'POST /api/v1/civic/message':         'civic_did_required', // Civic-DID send (T-41-02)

    // Phase 41 — Grid Manager presence overview (Steward Console Section 4).
    'GET /api/v1/grid-manager/presence-overview': 'portal_session_required',
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
