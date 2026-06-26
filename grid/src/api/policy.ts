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
    // Phase 48 Library v3 — reading room is public; contribute/cite need a Civic-DID.
    'GET /api/v1/library/entries/:entryId': 'public',
    'POST /api/v1/library/contribute':      'civic_did_required',
    'POST /api/v1/library/cite':            'civic_did_required',
    'GET /api/v1/market/listings': 'public',
    'GET /api/v1/portal/discover': 'public', // spec §2 — public discovery of organizations + Houses feed
    'GET /api/v1/portal/grids': 'public', // spec §2 — public discovery of active Grids (multi-Grid framework)
    'GET /api/v1/polis/bills': 'public',
    'GET /api/v1/polis/bills/:id': 'public',
    'GET /api/v1/nous/:civic_did_hash/public': 'public',
    'GET /api/v1/audit/trail': 'public',
    'GET /api/v1/audit/firehose': 'public', // WS — redacted in serializer
    'GET /ws/events': 'public', // WS — gated by its own GRID_WS_SECRET handler check (Phase 36 gap)

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

    // Human Civic-DID applications — use portal session auth internally (D-V3-33 pipeline)
    'POST /api/v1/portal/civic/apply': 'public',
    'GET /api/v1/portal/civic/application': 'public',

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
    // H2 operator inspect is a POST (operator/relationships.ts); the DID hook must pass
    // it through to the x-operator-tier handler, not default-deny it (Phase 36 gap).
    'POST /api/v1/nous/:did/relationships/inspect': 'public',
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
    // cognitive-snapshot is registered as POST (cognitive-snapshot.ts), not GET.
    'POST /api/v1/operator/nous/:did/cognitive-snapshot': 'public',
    'POST /api/v1/operator/nous/:did/memory/query': 'public',
    // operator relationship-events is registered as GET (operator/relationships.ts), not POST.
    'GET /api/v1/operator/relationships/:edge_key/events': 'public',
    'POST /api/v1/operator/replay/export': 'public',
    'POST /api/v1/operator/spawn-system-nous': 'public',

    // Portal Manager v1 (Tier-3 Henry-side meta-ops) — READ-ONLY reviewer queue.
    // Requires a SERVER-TRUSTED Portal session: the global hook runs requirePortalSession
    // (401 portal_session_required for anonymous callers) and the handler then calls
    // operatorScope (403 operator_scope_required when req.didContext.operatorDid is absent).
    // The route is ALSO admin-surface-gated behind GRID_ADMIN_ENABLED (503 admin_disabled
    // when off). The earlier spoofable x-operator-tier/-id header pattern is RETIRED as the
    // sole boundary — it survives only as a secondary intent signal behind operatorScope.
    // Observe-only; emits no audit events.
    'GET /api/v1/portal-manager/registrations': 'portal_session_required',

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

    // W1 — Civic dues (D-MONEY-08): member sees + pays its own dues.
    // civic_did_required: Brain JWT resolves to civic_member tier; handler enforces own-due-only.
    'GET /api/v1/civic/dues':                    'civic_did_required',
    'POST /api/v1/civic/dues/:dueId/pay':        'civic_did_required',

    // W — Economy read routes: de-orphan wei rails over HTTP (read-only observability).
    // account/credit: civic_did_required (scoped to caller's own DID; bigint→string).
    // treasury: public (the commons fund is transparently readable by anyone).
    'GET /api/v1/civic/account':   'civic_did_required',
    'GET /api/v1/civic/credit':    'civic_did_required',
    'GET /api/v1/civic/treasury':  'public',

    // W4 — Model-first endowment (D-MONEY-09): the operator endows a member account
    // with wei (the live wei source). portal_session_required → requirePortalSession
    // runs in the hook (401 anonymous); the handler then runs operatorScope (403) +
    // a secondary x-operator-tier>=5 signal, behind the GRID_ENDOWMENT_ENABLED gate.
    'POST /api/v1/portal/account/endow': 'portal_session_required',

    // O3 Forest / O2c-b — human-authed PERSISTENT conversation (Forest PWA).
    // 'public' policy: the handler does its own Portal-session cookie verification
    // (mirrors /api/v1/portal/chat/*); the thread is scoped to the session humanDid.
    'POST /api/v1/portal/conversation/:nousId/messages': 'public',
    'GET /api/v1/portal/conversation/:nousId':           'public',
    // Join-a-Grid S2/S3 — the User-side routes cookie-check inside the handler
    // (humanFromSession), so 'public' here; the Nous-read route is civic_member-gated.
    'POST /api/v1/portal/nous/:nousId/claim':            'public',
    'GET /api/v1/portal/nous':                           'public',
    'POST /api/v1/portal/grid-recommendations':          'public',
    'GET /api/v1/civic/grid-recommendations':            'civic_did_required',
    // Phase 47 Police v3 (POL-01/02) — complaint + investigation. All civic_member-gated;
    // no operator-direct / Police-direct sanction path exists (D-V3-18).
    'POST /api/v1/police/complaint':                                'civic_did_required',
    'POST /api/v1/police/complaint/:complaintId/investigate':       'civic_did_required',
    'GET /api/v1/police/complaints':                                'civic_did_required',
    // Phase 47 Plan 2 — charges (police), conviction (GOVERNMENT only — the constitutional
    // gate), sanction execution (police, only against a convicted charge). No operator path.
    'POST /api/v1/police/charge':                                   'police_only',
    'POST /api/v1/police/charge/:chargeId/convict':                 'government_only',
    'POST /api/v1/police/charge/:chargeId/execute-sanction':        'police_only',
    // Phase 47 Plan 3 — appeals. The sanctioned party appeals (civic); the Government
    // upholds/overturns (government_only). All sanctions are appealable.
    'POST /api/v1/gov/appeal':                                      'civic_did_required',
    'POST /api/v1/gov/appeal/:appealId/resolve':                    'government_only',

    // W — Conversation routes: human↔Nous chat thread (de-orphan ConversationStore).
    // Content is private (never on the audit chain); sender inferred from DID form.
    'POST /api/v1/civic/conversation/:partnerDid/messages': 'civic_did_required',
    'GET /api/v1/civic/conversation/:partnerDid':           'civic_did_required',

    // W — Approval routes: consult-your-human gate (de-orphan ApprovalStore).
    // All four routes require a Civic-DID bearer. Ownership enforced per-handler:
    //   request: any Civic-DID may call (caller = nous_did)
    //   list/approve/reject: caller must equal the approval's human_did (403 not_your_approval)
    'POST /api/v1/civic/approvals':                   'civic_did_required',
    'GET /api/v1/civic/approvals':                    'civic_did_required',
    'POST /api/v1/civic/approvals/:id/approve':       'civic_did_required',
    'POST /api/v1/civic/approvals/:id/reject':        'civic_did_required',

    // W — Procurement member routes: members see open RFPs + place bids (VOTE-05 preserved).
    // GET lists/detail are public-readable (anyone may browse open RFPs to decide whether to bid).
    // POST bid requires civic_member tier (bidder = caller; no issue/award exposed here).
    'GET /api/v1/procurement/notices':                          'public',
    'GET /api/v1/procurement/notices/:noticeId':                'public',
    'POST /api/v1/procurement/notices/:noticeId/bids':          'civic_did_required',

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

    // Phase 42 P2P-01..03 — P2P signaling routes (5 entries)
    // Per D-42-03: TURN is FREE in v3.0; Civic-DID auth required to prevent anonymous relay abuse.
    // Per D-42-06: p2p/signal/inbox is scoped to bearer's Civic-DID (route handler drains its own DID only).
    'POST /api/v1/p2p/announce':           'civic_did_required',  // Brain JWT heartbeat
    'GET /api/v1/p2p/peers/:civicDid':     'public',              // public peer presence lookup
    'POST /api/v1/p2p/signal/:peerDid':    'civic_did_required',  // Brain JWT SDP relay
    'GET /api/v1/p2p/signal/inbox':        'civic_did_required',  // Brain JWT SDP inbox drain
    'GET /api/v1/p2p/turn-credentials':    'civic_did_required',  // Brain JWT TURN auth

    // Phase 43 FORK-01 — Fork endpoint (2 entries)
    // header-trust pattern: both routes use x-operator-tier / x-operator-id auth internally.
    // 'public' is the established policy for all operator.* routes (D-25b-NEW-1).
    'POST /api/v1/operator/fork/:nousDid':          'public',  // H4+ header-trust, builds .tar.gz
    'GET /api/v1/operator/fork/:nousDid/download':  'public',  // one-time-token download

    // Phase 44 MKT-01..06 — Civic marketplace routes (8 new entries per RESEARCH.md Pattern 4).
    // GET /api/v1/market/listings is already 'public' (Phase 36 VIS-01, line 35 of policy.ts) — NOT duplicated here.
    'POST /api/v1/market/listing/create':                'business_did_required', // MKT-01
    'GET /api/v1/market/listing/:id':                     'public',               // MKT-02 single view
    'POST /api/v1/market/listing/:id/bid':                'civic_did_required',   // MKT-03
    'POST /api/v1/market/listing/:id/accept':             'civic_did_required',   // MKT-03 seller accept
    'POST /api/v1/market/listing/:id/reject':             'civic_did_required',   // MKT-03 seller reject
    'POST /api/v1/market/listing/:id/confirm-settlement': 'civic_did_required',   // MKT-04
    'POST /api/v1/market/listing/:id/dispute':            'civic_did_required',   // MKT-05
    'POST /api/v1/police/investigate':                    'civic_did_required',   // D-44-05 stub

    // Phase 45 (IRS-01..04) — IRS treasury routes.
    // GET /api/v1/irs/treasury: public per SC-2 (no auth required, Cache-Control: max-age=10).
    // POST /api/v1/irs/disburse: government_only — requires Government legislation_ref JWT per D-V3-21.
    // GET /api/v1/irs/audit/:period: public per SC-4 (public transparency required).
    'GET /api/v1/irs/treasury':        'public',
    'POST /api/v1/irs/disburse':       'government_only',
    'GET /api/v1/irs/audit/:period':   'public',

    // L4 — Orbital objects read API. Read-only, no audit, public.
    'GET /api/v1/orbital/objects':     'public',

    // Phase 46 (CIVGOV-01..06) — Government v3 legislative pipeline.
    // Nous-only legislation (D-V3-21): drafting/co-sponsoring/arguing require a Civic-DID;
    // opening/closing sessions + enacting/repealing laws require a Government session (Speaker);
    // the law book + individual bills are visitor-readable (CIVGOV-05 / Phase 36).
    'POST /api/v1/gov/bill/draft':            'civic_did_required',  // CIVGOV-01
    'POST /api/v1/gov/bill/:id/cosponsor':    'civic_did_required',  // CIVGOV-02
    'POST /api/v1/gov/session/open':          'government_only',     // CIVGOV-03 (Speaker)
    'POST /api/v1/gov/session/:id/argument':  'civic_did_required',  // CIVGOV-03 (public hearing, DID to speak)
    'POST /api/v1/gov/session/close':         'government_only',     // CIVGOV-03 (Speaker)
    'POST /api/v1/gov/law/enact':             'government_only',     // CIVGOV-05
    'POST /api/v1/gov/law/:id/repeal':        'government_only',     // CIVGOV-05
    'GET /api/v1/gov/law/active':             'public',              // CIVGOV-05 (law book, visitor-readable)
    'GET /api/v1/gov/bill/:id':               'public',              // CIVGOV-01 (bill view, visitor-readable)

    // Phase 58 (NH1-06 / R-58-06) — civic-parcels HOUSE-1 routes.
    // The two GET feeds are public (map view, owner DIDs hashed HEX64); the five
    // write routes are civic_did_required (D-NH-07 Nous-only land; the route adds a
    // defensive 403 humans_cannot_own_land for did:civic:noesis:human:* DIDs).
    'GET /api/v1/civic/parcels':                  'public',
    'GET /api/v1/civic/parcels/:id':              'public',
    'POST /api/v1/civic/parcels/:id/purchase':     'civic_did_required',
    'POST /api/v1/civic/parcels/:id/build':        'civic_did_required',
    // Phase 61 (NH4-04 / R-61-04) — HOUSE-4 build-from-blueprint route.
    // civic_did_required (D-NH-07 Nous-only; the handler rejects did:civic:noesis:human:*
    // builders with a defensive 403 and authorizes owner OR co-build staff only).
    'POST /api/v1/civic/parcels/:id/build-from-blueprint': 'civic_did_required',
    'POST /api/v1/civic/parcels/:id/join':         'civic_did_required',
    'POST /api/v1/civic/parcels/:id/leave':        'civic_did_required',
    'POST /api/v1/civic/parcels/:id/entry-policy': 'civic_did_required',

    // Phase 59 (NH2-04 / R-59-04) — civic-parcels HOUSE-2 interior routes.
    // - POST interior/extend is civic_did_required (owner-only furnishing; the route
    //   adds 403 not_owner + 422 invalid_furniture on top of the Nous-only tier gate).
    // - GET interior is 'public' — consistent with the Phase 58 detail-read GET feeds
    //   (lines 306–307): the handler performs its own entry-policy + derelict + D-NH-07
    //   gating (owner always; visitors only on open/allowlisted non-derelict; humans
    //   never see private interiors). 'public' lets the DID hook pass through to it.
    'POST /api/v1/civic/parcels/:id/interior/extend': 'civic_did_required',
    'GET /api/v1/civic/parcels/:id/interior':         'public',

    // Phase 60 (NH3-04/05/08/09 / R-60-04..09) — civic-parcels HOUSE-3 commerce routes.
    // All write routes are civic_did_required (D-NH-07 Nous-only; the handlers add their
    // own owner/staff/guest authorization via parcelRegistry.roleOf + reject humans from
    // every role edge with a defensive 403 humans_cannot_hold_role). Co-work/board content,
    // scope_ref bodies, and place names stay Grid-side (D-60-10).
    'POST /api/v1/civic/parcels/:id/bind-shop':       'civic_did_required',
    'POST /api/v1/civic/parcels/:id/unbind-shop':     'civic_did_required',
    'POST /api/v1/civic/parcels/:id/name':            'civic_did_required',
    'POST /api/v1/civic/parcels/:id/invite':          'civic_did_required',
    'POST /api/v1/civic/parcels/:id/roles':           'civic_did_required',
    'POST /api/v1/civic/parcels/:id/roles/revoke':    'civic_did_required',
    'POST /api/v1/civic/parcels/:id/board/post':      'civic_did_required',
    'POST /api/v1/civic/parcels/:id/board/claim':     'civic_did_required',
    'POST /api/v1/civic/parcels/:id/board/complete':  'civic_did_required',
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
