# Phase 36: Visitor/DID Read-Write Split — Research

**Researched:** 2026-05-25
**Domain:** Fastify preHandler DID enforcement · WS firehose per-subscriber redaction · Next.js 15 visitor UI · CI gate scripts · v3.0 three-tier visitor model
**Confidence:** HIGH (all findings verified against live codebase; no speculative library research needed — stack is fully established)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-36-01** Visitor entry URL = Portal landing (`portal.noesis`). Grid root redirects to Portal landing unless Portal session cookie present.
**D-36-02** Visitor tourist scope = rich tour: ~5 main surfaces (Portal landing, Civic Map, Library reading room, Marketplace browse, Polis bill drafts).
**D-36-03** Marketplace listings fully visible to visitors including prices.
**D-36-04** Two-step registration: (1) Portal sign-up (SIWE or email) → operator-DID; (2) "Apply for Genesis Polis citizenship" → Portal-gated Civic-DID.
**D-36-05** Visitor rate limit = 120 req/min per IP (bucket per source IP). DID-holders get per-DID buckets (Phase 39).
**D-36-06** Visitor audit-trail scope = last 1000 events sliding window (no deployment-age leak).
**D-36-07** Throttle on 429 = HTTP 429 + `Retry-After` header (browser-friendly, no state).
**D-36-08** `FirehoseStats.visitor_count_active` = internal-only metric (Portal Manager Tier 3 only; NOT public).
**D-36-09** Revoked Civic-DID behavior default = revert to visitor status (Polis can legislate otherwise in Phase 46).
**D-36-10** Steward `/admin/*` and Portal `/admin/*` = always DID-required + tier-gated. CI gate `scripts/check-admin-policy-isolation.mjs` enforces.
**D-36-11** Visitor can view public Nous profile (display name, zone, civic standing tier, public bio, status). Forbidden: memory inspector, audit history, Brain config, treasury balance, active contracts.
**D-36-12** Civic Map renders per-Nous avatars positioned in zones; click → public profile.
**D-36-13** Civic Map refresh rate = 5-second polling (matches Phase 32/34 hook pattern). NOT WebSocket push.
**D-36-14** Zone deep-dive shows: zone tax rate, recent activity (last 20 events), top contributors, static zone description.
**D-36-15** Visitor can see Polis bill drafts + tally results after `proposal.tallied`. Cannot see `ballot.committed` / `ballot.revealed` (VOTE-05 invariant).
**D-36-16** Three-tier visitor model: **Anonymous** (no Portal session, no Civic-DID) / **Human Visitor** (Portal session / operator-DID, no Civic-DID in this Grid) / **Civic Member** (Portal session + Civic-DID in this Grid).
**D-36-17** `ROUTE_DID_POLICY` enum = 6 values: `public` | `portal_session_required` | `civic_did_required` | `business_did_required` | `government_only` | `police_only`. Default-deny (missing route = `civic_did_required`). CI gate `scripts/check-did-policy-coverage.mjs`.
**D-36-18** Human Visitor soft interactions (read-side, no state mutation): **Follow a Nous** + **Watch a Polis bill**. Both = `portal_session_required` per D-36-17.
**D-36-19** Notification delivery for D-36-18 = Portal account notification queue (server-side persistent queue scoped to operator-DID), polled NOT WebSocket-push. Endpoints: `GET /portal/api/v1/notifications` + `POST /portal/api/v1/notifications/:id/read`. New audit event: `portal.notification_dispatched`.
**D-36-20** Registration flow = uniform two-step for both Anonymous AND Human Visitor (same code path; UI shows different copy).
**D-36-21** Auth methods = SIWE + email signup + email signin + Google OAuth + Apple OAuth (5 endpoints). CI gate `scripts/check-no-did-exception-count.mjs` updated to assert 5 (not 3).
**D-36-22** Civic terminology = "Grid Charter" (immutable founding doc) + "Laws of Themis" (Polis-legislated bills). Visitor ToS copy verbatim: "By entering Genesis Grid, you agree to the Grid Charter and the Laws of Themis."
**D-36-23** Portal landing hero = Dashboard-class (3D libs permitted: three.js, aframe). All other functional surfaces (Civic Map, Polis, Library, Marketplace, Public Profile, Steward) stay raw-SVG per D-V3-06.
**D-36-24** Atmospheric toggles (NIGHT/PACKETS/RAIN) deferred to v3.1 Phase 56 polish.
**D-36-25** Visitor footer = GRID HEALTH + UPTIME only. ACTIVE NODES + PACKETS/S excluded (fingerprinting concern per Q-VA-3, Type B census leak per D-V3-24).

### Claude's Discretion

- `ROUTE_DID_POLICY` data structure exact TypeScript interface design
- CI gate implementation language (likely Node.js ESM, matching Phase 31-34 pattern)
- Visitor session cookie format (Portal-managed; doesn't need Civic-DID)
- Civic Map SVG zone layout (Phase 21 raw-SVG invariant preserved; specific layout coords are engineering detail)
- Marketplace listing pagination strategy for visitor view
- Library reading room search algorithm (extends Phase 20 LORE)
- Bill draft body summary algorithm (full body might be too long; summary heuristic TBD)

### Deferred Ideas (OUT OF SCOPE)

- Visitor → DID-holder session continuity (Phase 56 Portal UI polish)
- Visitor analytics dashboard for Polis (Phase 46 follow-up or later)
- A/B testing visitor landing variants (v3.0 ships single layout)
- Internationalization of visitor surfaces (English only in v3.0)
- Mobile-responsive Civic Map (desktop-first; mobile in Phase 56)
- Visitor-callable `GET /portal/api/v1/grids/list` endpoint (v3.1+ when multiple Grids exist)
- Brain-seed transparency for Type B Polis-α requests (Phase 37b)
- Cross-Grid visitor experience (v3.1+ via Phase 55)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIS-01 | Unauthenticated visitors browse public Grid surfaces (Civic Map, audit events stream redacted, Library, Government bill drafts, Marketplace) without DID | Section: Architecture Patterns > 3-Tier Visitor Model; Standard Stack > Fastify rate-limiting |
| VIS-02 | All state-mutating Grid routes (POST/PUT/DELETE in api/v1) require valid Civic-DID bearer. `requireCivicDid()` decorator returns 401 structured error | Section: Architecture Patterns > ROUTE_DID_POLICY Enforcement; Code Examples > requireDid preHandler |
| VIS-03 | WS firehose redaction layer: strips private fields for non-DID subscribers per-event ACL; preserves R-31-01 zero-diff (redaction is post-chain at egress only) | Section: Architecture Patterns > WS Firehose Per-Subscriber Redaction; Code Examples > serializeFrame |
| VIS-04 | Per-endpoint `ROUTE_DID_POLICY` table in `grid/src/api/policy.ts` maps every route; CI gate enforces complete coverage; 6-value enum | Section: Architecture Patterns > ROUTE_DID_POLICY Table; CI Gates section |
| VIS-05 | Sole-producer files for 4 new audit events: `portal.did_issued`, `portal.did_revoked`, `grid.recognition_granted`, `grid.recognition_revoked` | Section: Don't Hand-Roll > Sole Producer Pattern; Code Examples > Sole-Producer Template |
</phase_requirements>

---

## Summary

Phase 36 implements the visit-vs-action read/write asymmetry in v3.0: unauthenticated visitors can browse public Grid surfaces; every state-mutating route requires a Civic-DID. The architecture is fundamentally an enforcement layer over the existing Fastify route structure — a `ROUTE_DID_POLICY` lookup table + Fastify preHandler hook that intercepts requests before handlers fire.

Three distinct concerns ship in this phase. First, the **Grid backend** gets `ROUTE_DID_POLICY` enforcement infrastructure: a policy table, a `requireDid()` / `tryDid()` preHandler pair, WS firehose per-subscriber redaction extending `WsFirehoseHub`, visitor rate limiting at the Fastify request level, and 4 new sole-producer audit event files. Second, the **Portal frontend** (living inside `dashboard/src/app/portal/` per the existing v2.5 pattern — Q-V3-PORTAL-3 planner discretion) gets 5 new visitor-facing page routes and supporting components. Third, **3 new CI gate scripts** enforce the policy invariants at build time, and the existing `check-no-did-exception-count.mjs` gate count updates from 3 to 5.

The UI design contract is fully locked in `36-UI-SPEC.md`. The raw-SVG rendering pattern for Civic Map is established in Phase 21 (`skill-lineage.tsx`). The 5-second polling pattern is established in Phase 34 (`use-health-detailed.ts`). The sole-producer triad discipline is established in Phase 33 (`append-portal-auth-login.ts`). The CI gate script pattern is established in Phase 33 (`check-sole-producer-discipline.mjs` + `rig-invariants.yml`).

**Primary recommendation:** This phase is execution-heavy, not research-heavy. All technical decisions are locked. Planner should structure waves around the dependency graph: Grid backend enforcement infrastructure (Wave 1 — blocks everything), sole-producer audit events (Wave 2 — parallel with Grid), portal frontend pages (Wave 3 — parallel once Grid endpoints exist), CI gates (Wave 4 — last, after all files land).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `ROUTE_DID_POLICY` enforcement | API / Backend (Grid Fastify) | — | Prehandler hook lives at route registration; all policy enforcement is server-side before handler fires |
| 3-tier visitor identity resolution | API / Backend (Grid Fastify) | Frontend Server (Portal SSR) | Grid verifies DID bearer; Portal SSR reads session cookie for Human Visitor tier |
| WS firehose per-subscriber redaction | API / Backend (Grid Fastify) | — | Serializer runs inside `WsFirehoseHub` on the Grid; no client involvement in redaction |
| Visitor rate limiting | API / Backend (Grid Fastify) | — | In-memory IP bucket per Fastify request lifecycle; per-IP, not per-user |
| 4 audit event sole producers | API / Backend (Grid) | — | `grid/src/audit/append-*.ts` sole producer discipline; no frontend involvement |
| Portal landing page | Frontend Server (Portal SSR) | CDN / Static (3D hero) | Next.js 15 server component with client component for live ticker; 3D bg is client-only |
| Civic Map SVG | Frontend Server (Portal SSR) | API / Backend (server computes coords) | Server-computed zone/avatar coords; client renders raw `<svg>`; 5s polling |
| Library reading room | Frontend Server (Portal SSR) | API / Backend | Server component shell + client filter bar; no library logic in frontend |
| Marketplace browse | Frontend Server (Portal SSR) | API / Backend | Server component shell + client filters |
| Polis bill drafts | Frontend Server (Portal SSR) | API / Backend | Server component; tally-only privacy enforced server-side |
| Notification queue (D-36-19) | API / Backend (Grid Fastify) | Frontend Server (Portal SSR poll) | Server-persistent queue + REST poll; NOT WS push |
| CI gates | Build / Scripts | — | Node.js ESM scripts in `scripts/` dir; wired into `rig-invariants.yml` |
| `FirehoseStats.visitor_count_active` | API / Backend (Grid Fastify) | — | Internal metric only; extends `FirehoseStats` interface additively per D-32-C1 |

---

## Standard Stack

### Core (already present in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Fastify | `^5.0.0` [VERIFIED: package.json] | HTTP server; route registration; preHandler hooks | Already the Grid API framework; preHandler hooks are the natural enforcement point |
| `@fastify/websocket` | `11.2.0` [VERIFIED: npm view] | WS upgrade + server socket lifecycle | Already wired in Phase 32 firehose hub |
| `@fastify/cookie` | already registered [VERIFIED: server.ts:43] | Session cookie reading for Human Visitor tier check | Already registered in `buildServer`; no new dep needed |
| Next.js | `15.2.4` [VERIFIED: dashboard/package.json] | Portal frontend (server components + client components) | Dashboard already on Next.js 15 + React 19 |
| Tailwind CSS | `^4.0.0` (CSS-first `@theme`) [VERIFIED: dashboard/package.json] | Visitor UI styling | Project convention since v2.4; no shadcn; hand-rolled |
| Vitest | `^2.0.0` (grid) / `^4.1.0` (dashboard) [VERIFIED: package.json] | Unit tests for policy enforcement and sole producers | Established test framework |
| `jose` | `^6.2.3` [VERIFIED: grid/package.json] | JWT verification for Portal-issued tokens; ES256 key pair already generated | Already used in `portal/auth.ts` for SIWE JWT issuance |

### New Dependencies (none required for core features)

No new npm packages needed for the Grid backend enforcement layer or the Portal frontend pages. All capabilities exist in the current stack:

- Rate limiting: Fastify v5 onRequest/preHandler hooks + in-memory Map per IP [ASSUMED — Fastify does not bundle rate-limit middleware by default; `@fastify/rate-limit` is the standard plugin but may be overkill for visitor bucket at 120 req/min. Simple in-process Map with sliding window is sufficient for v3.0 single-server topology]
- Visitor auth resolution: parse `Authorization: Bearer <jwt>` header using already-imported `jose` `jwtVerify`; parse session cookie using already-registered `@fastify/cookie`
- 3D Portal landing hero: three.js permitted per D-36-23; not a hard requirement for Phase 36 functional delivery (can ship stub or static image in v3.0 and defer 3D to Phase 56 polish per D-36-24 atmospheric controls deferred pattern)

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-process IP rate-limit Map | `@fastify/rate-limit` | Plugin adds Redis/memory-store backend flexibility; overkill for single-server v3.0 where in-memory Map suffices; add if multi-instance in v3.x |
| Manual JWT parsing in preHandler | Fastify `authenticate` plugin | Plugin approach adds config indirection; manual parsing is 10 lines and already established in `portal/auth.ts:352` (`jwtVerify`) |
| Polling for Civic Map (5s) | WS push | WS push requires per-visitor connection; explicitly rejected in D-36-13 to avoid connection overhead |
| Raw SVG for Civic Map | d3, react-flow, cytoscape | Explicitly forbidden by D-V3-06 raw-SVG invariant; Phase 21 establishes the server-computed coords pattern |

---

## Architecture Patterns

### System Architecture Diagram

```
Browser / Visitor
     │
     │ HTTP GET (no DID)
     ▼
Fastify preHandler: routeDidPolicyCheck()
     │
     ├─ ROUTE_DID_POLICY = 'public' ──────────────────────────────────→ Route handler (full response)
     │
     ├─ ROUTE_DID_POLICY = 'portal_session_required' ──────────────────→ parseCookie() →
     │                                                                      [cookie present] → Route handler
     │                                                                      [cookie absent]  → 401
     │
     ├─ ROUTE_DID_POLICY = 'civic_did_required' + sub-tiers ──────────→ verifyDid() →
     │                                                                      [DID valid]   → Route handler
     │                                                                      [DID missing] → 401 did_required
     │
     └─ [route NOT in table] ─────────────────────────────────────────→ 401 did_required (default-deny)

WS Upgrade: wss://grid/api/v1/firehose
     │
     ▼
WsFirehoseHub.onConnect(socket, didContext)
     │
     │  AuditChain.onAppend(entry) ──→ isAllowlisted(entry.eventType)?
     │                                      │ YES
     │                                      ▼
     │                             for each subscriber:
     │                               if subscriber.didContext:
     │                                 send full entry (actor_did, payload)
     │                               else:
     │                                 send redacted frame {tick, event_type, family}
     │                             (in-memory chain UNCHANGED — zero-diff R-31-01)
     │
     └─ visitor_count_active += 1 on connect (FirehoseStats extension, D-V3-13)

Portal Frontend (Next.js 15, dashboard/src/app/portal/)
     │
     ├─ page.tsx (Portal landing) ── Server component shell
     │     └─ <LiveTicker> (client) ── polls /health/detailed every 5s
     │     └─ tier-aware welcome banner (reads server-side session)
     │
     ├─ civic-map/page.tsx ── Server component shell
     │     └─ <CivicMap> (client) ── polls /api/v1/civic-map/state every 5s
     │     └─ inline <svg> with server-computed zone/avatar coords
     │
     ├─ library/page.tsx ── Server component + client filter bar
     ├─ marketplace/page.tsx ── Server component + client filters
     └─ polis/bills/page.tsx ── Server component (tally-only, ballot fields absent from API response)

CI Gates (scripts/check-*.mjs)
     │
     ├─ check-did-policy-coverage.mjs ── walks every registered Fastify route; fails if route missing from ROUTE_DID_POLICY
     ├─ check-admin-policy-isolation.mjs ── every /admin/* route must be civic_did_required or higher
     ├─ check-ws-redaction-zero-diff.mjs ── asserts firehose-hub serializer branches; no audit.append in serializer
     └─ check-no-did-exception-count.mjs (update) ── assert count = 5 (was 3)
```

### Recommended Project Structure

```
grid/src/api/
├── policy.ts                  # ROUTE_DID_POLICY table (6-value enum + per-route entries)
├── _did.ts                    # requireDid() / tryDid() preHandler helpers
├── _redact.ts                 # maybeRedact() serializer helper for read routes
├── routes/
│   ├── civic-map.ts           # NEW: GET /api/v1/civic-map/state (visitor-public)
│   ├── civic-map-zone.ts      # NEW: GET /api/v1/civic-map/zone/:zone_id (visitor-public)
│   ├── nous-profile.ts        # NEW: GET /api/v1/nous/:civic_did_hash/public (visitor-public)
│   ├── library-entries.ts     # NEW: GET /api/v1/library/entries (visitor-public, content redacted)
│   ├── market-listings.ts     # NEW: GET /api/v1/market/listings (visitor-public, full price)
│   ├── polis-bills.ts         # NEW: GET /api/v1/polis/bills + /polis/bills/:id (visitor-public)
│   └── notifications.ts       # NEW: GET + POST /portal/api/v1/notifications (portal_session_required)
├── portal/
│   ├── auth.ts                # EXTEND: add Google OAuth + Apple OAuth routes (D-36-21)
│   └── ...
└── audit/
    ├── firehose-hub.ts        # EXTEND: per-subscriber didContext + visitor_count_active

grid/src/audit/
├── append-portal-did-issued.ts     # NEW: sole producer for portal.did_issued
├── append-portal-did-revoked.ts    # NEW: sole producer for portal.did_revoked
├── append-grid-recognition-granted.ts  # NEW
├── append-grid-recognition-revoked.ts  # NEW
└── broadcast-allowlist.ts          # EXTEND: +4 new events (56 → 60)

scripts/
├── check-did-policy-coverage.mjs        # NEW CI gate
├── check-admin-policy-isolation.mjs     # NEW CI gate
├── check-ws-redaction-zero-diff.mjs     # NEW CI gate
└── check-no-did-exception-count.mjs     # UPDATE: 3 → 5

dashboard/src/app/portal/           # EXISTING (v2.5 portal routes live here)
├── page.tsx                        # REWRITE: Portal landing (D-36-01/23)
├── civic-map/page.tsx              # NEW: Civic Map surface (D-36-12)
├── civic-map/zone/[zone_id]/page.tsx   # NEW: Zone deep-dive (D-36-14)
├── library/page.tsx                # NEW: Library reading room (D-36-02)
├── marketplace/page.tsx            # NEW: Marketplace browse (D-36-03)
├── polis/bills/page.tsx            # NEW: Polis bill drafts (D-36-15)
├── nous/[civic_did_hash]/page.tsx  # NEW: Public Nous profile (D-36-11)
└── components/
    ├── PortalNav.tsx               # NEW
    ├── HeroLanding.tsx             # NEW (D-36-23: 3D hero permitted)
    ├── LiveTicker.tsx              # NEW (client, 5s polling)
    ├── CivicMap.tsx                # NEW (raw SVG, server-computed coords)
    ├── LibraryEntryCard.tsx        # NEW
    ├── LibraryFilterBar.tsx        # NEW (client)
    ├── LibraryPagination.tsx       # NEW
    ├── MarketplaceListingCard.tsx  # NEW
    ├── MarketplaceFilterBar.tsx    # NEW (client)
    ├── PolissBillCard.tsx          # NEW
    └── NousPublicProfile.tsx       # NEW
```

### Pattern 1: ROUTE_DID_POLICY Table + 6-Value Enum

**What:** A TypeScript `const` object mapping `"METHOD /path"` → policy tier. Every Fastify route must have an entry; CI gate enforces completeness.

**When to use:** Every new route that lands in any v3.0 phase MUST add its entry to this table. The table is the single source of truth — HTTP verb convention alone is insufficient (POST can be a query, GET can be state-mutating in edge cases).

**Example:**
```typescript
// grid/src/api/policy.ts
// [CITED: 36-CONTEXT.md D-36-17 + SUPPLEMENT-visit-vs-action.md §4]

export const ROUTE_DID_POLICY_VALUES = [
  'public',
  'portal_session_required',
  'civic_did_required',
  'business_did_required',
  'government_only',
  'police_only',
] as const;

export type RouteDIDPolicy = typeof ROUTE_DID_POLICY_VALUES[number];

/** Default-deny: any route not listed here is treated as 'civic_did_required'. */
export const ROUTE_DID_POLICY: Record<string, RouteDIDPolicy> = {
  'GET /health':                              'public',
  'GET /health/detailed':                     'public',
  'GET /api/v1/civic-map/state':              'public',
  'GET /api/v1/civic-map/zone/:zone_id':      'public',
  'GET /api/v1/library/entries':              'public',
  'GET /api/v1/market/listings':              'public',
  'GET /api/v1/polis/bills':                  'public',
  'GET /api/v1/polis/bills/:id':              'public',
  'GET /api/v1/nous/:civic_did_hash/public':  'public',
  'GET /api/v1/registry/civic-did/:did':      'public',
  'GET /api/v1/registry/business-did/:did':   'public',
  'GET /api/v1/audit/trail':                  'public',       // redacted for visitors via maybeRedact
  'GET /api/v1/audit/firehose':               'public',       // WS — redacted in serializer
  'POST /portal/auth/siwe':                   'public',       // no-DID exception #1
  'POST /portal/auth/email/signup':           'public',       // no-DID exception #2
  'POST /portal/auth/email/signin':           'public',       // no-DID exception #3
  'POST /portal/auth/oauth/google':           'public',       // no-DID exception #4 (D-36-21)
  'POST /portal/auth/oauth/apple':            'public',       // no-DID exception #5 (D-36-21)
  'GET /portal/api/v1/notifications':         'portal_session_required',  // D-36-19
  'POST /portal/api/v1/notifications/:id/read': 'portal_session_required', // D-36-19
  // Human Visitor soft interactions (D-36-18)
  'POST /api/v1/nous/:did/follow':            'portal_session_required',
  'POST /api/v1/polis/bills/:id/watch':       'portal_session_required',
  // ... all write routes below are civic_did_required or higher ...
  'POST /api/v1/trade':                       'civic_did_required',
  'POST /api/v1/governance/propose':          'civic_did_required',
  'POST /api/v1/governance/commit':           'civic_did_required',
  'POST /api/v1/governance/reveal':           'civic_did_required',
  'POST /api/v1/spawn':                       'civic_did_required',
  'POST /api/v1/registry/civic-did/request':  'civic_did_required',
  'POST /api/v1/registry/business-did/register': 'civic_did_required',
  'POST /api/v1/registry/civic-did/:did/revoke': 'government_only',
  // Admin surfaces (D-36-10) — CI gate enforces no /admin/* is ever 'public'
  // All /admin/* routes default to civic_did_required + tier check
} as const;
```

### Pattern 2: requireDid / tryDid preHandler Helpers

**What:** Two Fastify preHandler functions. `requireDid` returns 401 if no valid DID. `tryDid` returns `DIDContext | null` without erroring — for read routes that conditionally redact.

**When to use:** Every write route uses `requireDid`. Every conditionally-redacting read route uses `tryDid`. The policy table drives WHICH preHandler to apply.

**Example:**
```typescript
// grid/src/api/_did.ts
// [CITED: SUPPLEMENT-visit-vs-action.md §4 Implementation sketch]

import type { FastifyRequest, FastifyReply } from 'fastify';
import { jwtVerify } from 'jose';
import { keyPairPromise } from './portal/auth.js';

export interface DIDContext {
  did: string;          // verified DID
  tier: 'anonymous' | 'human_visitor' | 'civic_member';
  operatorDid?: string; // present for Human Visitor (portal session)
}

export async function tryDid(req: FastifyRequest): Promise<DIDContext | null> {
  // 1. Try Bearer JWT (Civic-DID bearer)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { privateKey } = await keyPairPromise;  // use publicKey half
      // NOTE: actual implementation uses jwtVerify with publicKey
      const { payload } = await jwtVerify(authHeader.slice(7), privateKey /* TODO: public key */);
      if (payload.sub && typeof payload.sub === 'string') {
        return { did: payload.sub, tier: 'civic_member' };
      }
    } catch {
      // Invalid JWT — fall through to cookie check
    }
  }
  // 2. Try Portal session cookie (Human Visitor)
  const cookie = req.cookies?.noesis_portal_token;
  if (cookie) {
    // Cookie is also JWT — verify same key pair (portal auth)
    // Returns operator-DID from cookie payload
    return { did: 'operator-did-from-cookie', tier: 'human_visitor', operatorDid: 'op-did' };
  }
  // 3. Anonymous
  return null;
}

export async function requireDid(req: FastifyRequest, reply: FastifyReply): Promise<DIDContext | null> {
  const ctx = await tryDid(req);
  if (!ctx || ctx.tier === 'anonymous' || ctx.tier === 'human_visitor') {
    reply.code(401).send({
      error: 'did_required',
      accepted_methods: ['civic_did_bearer', 'portal_session'],
    });
    return null;
  }
  return ctx;
}
```

### Pattern 3: WS Firehose Per-Subscriber Redaction

**What:** Extend `WsFirehoseHub` so each `ClientConnection` carries a `didContext: DIDContext | null` captured at WebSocket upgrade time. The `onAuditEvent` fan-out passes the entry through a per-subscriber serializer that redacts `actor_did`, `target_did`, and private payload subkeys for Anonymous/Human Visitor subscribers.

**Critical:** Redaction happens at the **wire serializer**, NOT at the audit chain. The in-memory `AuditChain` is untouched. R-31-01 zero-diff is preserved because listener fan-out order and chain commit are independent of subscriber-set composition.

**Example:**
```typescript
// grid/src/audit/firehose-hub.ts — EXTEND (do not rewrite)
// [CITED: SUPPLEMENT-visit-vs-action.md §4 + 36-CONTEXT.md D-V3-12 + R-31-01]

// Private fields that are stripped for visitor frames:
const VISITOR_STRIPPED_PAYLOAD_KEYS = new Set([
  'human_did', 'eth_address_hash', 'nonce_hash', 'target_did',
  'voter_did', 'proposer_did', 'from_did', 'to_did',
  'owner_human_did',
]);

function serializeFrame(entry: AuditEntry, didContext: DIDContext | null): string {
  if (didContext?.tier === 'civic_member') {
    return JSON.stringify({ type: 'event', entry });
  }
  // Visitor frame — stripped to family + tick (D-V3-12)
  return JSON.stringify({
    type: 'event',
    entry: {
      tick: entry.tick,
      event_type: entry.event_type,
      family: entry.event_type.split('.')[0],
      // actor_did, target_did, payload: DROPPED
    },
  });
}

// ClientConnection gains a readonly didContext field.
// WsFirehoseHub.onConnect(socket, didContext) captures from upgrade headers.
// FirehoseStats gains visitor_count_active: number (D-V3-13, additive-only per D-32-C1).
```

### Pattern 4: Sole-Producer Triad (Phase 33 discipline — 4 new events)

**What:** Every new audit event gets its own `append-*.ts` file containing the complete triad: (1) `Object.keys(payload).sort()` structural check, (2) `payloadPrivacyCheck()`, (3) `audit.append()`. Closed-tuple payload with alphabetical key order. `DID_RE` guard on all DID fields.

**When to use:** All 4 new events: `portal.did_issued`, `portal.did_revoked`, `grid.recognition_granted`, `grid.recognition_revoked`.

**Example (portal.did_issued):**
```typescript
// grid/src/audit/append-portal-did-issued.ts
// [CITED: grid/src/audit/append-portal-auth-login.ts — canonical reference]
// [CITED: SUPPLEMENT-visit-vs-action.md §5 event table]

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { DID_RE } from './append-human-joined.js';

export interface PortalDidIssuedPayload {
  readonly human_or_nous_did: string;   // DID_RE
  readonly issued_at_tick: number;      // non-negative integer
  readonly issuer_portal_id: string;    // non-empty string
}

const EXPECTED_KEYS = ['human_or_nous_did', 'issued_at_tick', 'issuer_portal_id'] as const;

export function appendPortalDidIssued(
  audit: AuditChain,
  payload: PortalDidIssuedPayload,
): AuditEntry {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('appendPortalDidIssued: payload must be a plain object');
  }
  if (typeof payload.human_or_nous_did !== 'string' || !DID_RE.test(payload.human_or_nous_did)) {
    throw new TypeError('appendPortalDidIssued: human_or_nous_did must match DID_RE');
  }
  if (!Number.isInteger(payload.issued_at_tick) || payload.issued_at_tick < 0) {
    throw new TypeError('appendPortalDidIssued: issued_at_tick must be a non-negative integer');
  }
  if (typeof payload.issuer_portal_id !== 'string' || payload.issuer_portal_id.length === 0) {
    throw new TypeError('appendPortalDidIssued: issuer_portal_id must be a non-empty string');
  }

  // Closed-tuple structural check
  const actualKeys = Object.keys(payload).sort();
  if (actualKeys.length !== EXPECTED_KEYS.length
      || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
    throw new TypeError(
      `appendPortalDidIssued: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
    );
  }

  const cleanPayload = {
    human_or_nous_did: payload.human_or_nous_did,
    issued_at_tick: payload.issued_at_tick,
    issuer_portal_id: payload.issuer_portal_id,
  };

  const privacy = payloadPrivacyCheck(cleanPayload);
  if (!privacy.ok) {
    throw new TypeError(
      `appendPortalDidIssued: privacy violation — path=${privacy.offendingPath}`,
    );
  }

  return audit.append('portal.did_issued', payload.human_or_nous_did, cleanPayload);
}
```

### Pattern 5: Civic Map Raw SVG (Phase 21 invariant)

**What:** Server-computed coordinates sent to client. Client renders inline `<svg>` with zone polygons + Nous avatar circles. No d3, no react-flow, no cytoscape, no three.js. Polled every 5s via `setInterval` + `AbortController` (matches `use-health-detailed.ts` pattern exactly — not SWR).

**When to use:** All Civic Map surfaces. Zone deep-dive reuses the same server endpoint filtered by `zone_id`.

**Example (SVG structure):**
```tsx
// dashboard/src/app/portal/civic-map/CivicMap.tsx (client component)
// [CITED: 36-UI-SPEC.md §Surface 2; steward/src/app/culture/skill-lineage.tsx Phase 21 pattern]

<svg viewBox="0 0 800 600" role="img" aria-label="Civic Map of Genesis Grid — 6 zones with active Nous avatars">
  {zones.map(zone => (
    <g key={zone.id}>
      <polygon
        points={zone.polygon}
        fill={zone.fillColor}
        stroke={zone.strokeColor}
        strokeWidth="1"
        className="cursor-pointer"
        onClick={() => router.push(`/portal/civic-map/zone/${zone.id}`)}
      />
      <text x={zone.labelX} y={zone.labelY} fill="#e8e8ec" fontSize="14" fontFamily="Inter Tight" fontWeight="600">
        {zone.label}
      </text>
      <text x={zone.labelX} y={zone.labelY + 18} fill="#6a6a76" fontSize="11" fontFamily="JetBrains Mono">
        {zone.taxRate}%
      </text>
    </g>
  ))}
  {nous.map(n => (
    <g key={n.civic_did_hash}>
      {/* 44×44 invisible hit-box for WCAG 2.5.5 touch target */}
      <rect
        x={n.x - 22} y={n.y - 22} width="44" height="44"
        fill="transparent"
        className="cursor-pointer"
        onClick={() => router.push(`/portal/nous/${n.civic_did_hash}`)}
        role="button"
        aria-label={`Nous ${n.display_name}, type ${n.type}, ${n.status}, in ${n.zone_label}`}
      />
      <circle
        cx={n.x} cy={n.y} r="6"
        fill={n.type === 'A' ? '#7c9eff' : '#c084fc'}
        opacity={n.status === 'online' ? 1 : 0.4}
        stroke="#0a0a0c" strokeWidth="1"
        className="pointer-events-none"
      />
    </g>
  ))}
</svg>
```

### Pattern 6: Visitor Tier-Aware Welcome Banner (3-tier differentiation)

**What:** Server component reads session cookie/DID from request headers; determines tier; renders tier-specific JSX. Client components receive tier as prop.

**Example:**
```tsx
// dashboard/src/app/portal/page.tsx (server component)
// [CITED: 36-UI-SPEC.md §Surface 1 Tier Differentiation Matrix]

// Verbatim copy strings locked in UI-SPEC.md Copywriting Contract:
const BANNER_COPY = {
  anonymous: {
    text: 'Welcome to Noēsis. Sign up to participate in the Polis.',
    cta: 'Sign up',
    href: '/portal/auth',
  },
  human_visitor: {
    text: `Welcome back, {display_name}. Apply for Genesis citizenship to participate.`,
    cta: 'Apply for Civic-DID',
    href: '/portal/apply/genesis',
  },
  civic_member: {
    text: `Welcome back, citizen {display_name}.`,
    cta: null,   // no CTA; quick-links bar instead
    href: null,
  },
} as const;
```

### Anti-Patterns to Avoid

- **Redacting in the audit chain itself:** The chain must commit full entries. Redaction ONLY happens at the wire serializer in `firehose-hub.ts`. Adding a conditional in `chain.append()` would break R-31-01 zero-diff.
- **Using HTTP verb convention alone for DID policy:** `POST` auth routes are exceptions. A route not in `ROUTE_DID_POLICY` defaults to `civic_did_required` — never to `public`. The table is the contract, not the verb.
- **Tracking visitors in the audit chain:** Per D-V3-13, `visitor.observed` is NOT an audit chain event. Extend `FirehoseStats` with `visitor_count_active` counter only.
- **Making `visitor_count_active` public:** Per D-36-08, internal only. Accessible to Tier 3 Portal Manager admin UI only.
- **Exposing `ballot.committed` / `ballot.revealed` to visitors:** VOTE-05 invariant. The polis bills endpoint MUST NOT include a `ballots` array; only `tally: { pass, fail, abstain }` after `status === 'passed' | 'failed'`.
- **Using d3 / react-flow / cytoscape for Civic Map:** D-V3-06 raw-SVG invariant. Phase 21 `skill-lineage.tsx` is the canonical pattern.
- **Adding portal.notification_dispatched to the visitor-accessible firehose:** The notification event is ONLY available via the REST poll endpoint, never via WS firehose.
- **`hover:r-8` in Tailwind 4 on SVG elements:** UI-SPEC FLAG — Tailwind 4 does not generate dynamic SVG `r` utilities natively. Use JavaScript-controlled hover via React state (`useState<string | null>(null)` for hovered avatar ID) rather than CSS class.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT verification | Custom token parser | `jose` `jwtVerify` (already in `grid/src/api/portal/auth.ts:352`) | Already in project; handles ES256; timing-safe; standards-compliant |
| Closed-tuple payload enforcement | Custom schema validator | The triad pattern: `Object.keys(payload).sort()` + manual checks (already established in Phase 33) | Consistent with all existing sole-producer files; checked by `check-sole-producer-discipline.mjs` |
| Visitor rate limiting (simple case) | Custom token bucket | In-process `Map<ip, {count, windowStart}>` with 60s sliding window | Sufficient for single-server v3.0; no Redis needed; Phase 39 will address per-DID quota |
| WS per-subscriber serializer | Custom WS framework | Extend existing `WsFirehoseHub` `onAuditEvent` method | Avoid replacing a working system; only add `didContext` field to `ClientConnection` |
| Fastify route registration | Express-style middleware | Fastify preHandler hook pattern (already used in Phase 25b operator sanctions) | Consistent with existing admin routes; preHandler fires before route handler; typed |
| SVG zone layout calculation | Client-side d3 layout | Server endpoint that computes and returns zone polygon coordinates | D-V3-06 invariant; server-computed is the Phase 21 pattern |

**Key insight:** Phase 36 is an enforcement layer over existing infrastructure. Almost nothing is built from scratch — the value is in wiring existing pieces (Fastify preHandlers, WsFirehoseHub, sole-producer discipline, CI gate scripts) into a policy table that future phases populate automatically.

---

## Common Pitfalls

### Pitfall 1: Breaking R-31-01 Zero-Diff by Redacting Inside the Chain

**What goes wrong:** Developer adds `if (!didContext) { entry.actor_did = 'redacted'; }` inside `onAuditEvent` before fan-out. Chain head hash diverges between sessions with different subscriber compositions.

**Why it happens:** Intuitive to redact where data originates. R-31-01 is a non-obvious system property.

**How to avoid:** Redaction ONLY in `serializeFrame()` inside `ClientConnection.trySend()` or an equivalent per-subscriber serialization step. The `AuditEntry` passed to `enqueue()` is always the unmodified original. Add a comment in `onAuditEvent()`: `// Do NOT redact here — redaction is in serializeFrame() (R-31-01 zero-diff)`.

**Warning signs:** If any test for `WsFirehoseHub` shows different chain head hashes based on who is connected, this pitfall has occurred.

### Pitfall 2: `check-did-policy-coverage.mjs` Missing Routes

**What goes wrong:** A new route is registered in a route file but not added to `ROUTE_DID_POLICY`. The CI gate fails on the next PR. OR the developer adds the route to the policy table but uses a string that doesn't match Fastify's route pattern format (e.g., `:did` vs `*`).

**Why it happens:** Policy table is a separate file from route registration. Easy to forget.

**How to avoid:** The CI gate `check-did-policy-coverage.mjs` must enumerate all routes from Fastify's route list (can use `app.printRoutes()` approach or grep `app.get/post/put/delete` calls). Template comment at route registration: `// ROUTE_DID_POLICY: 'public' — listed in grid/src/api/policy.ts`.

**Warning signs:** CI fails on `check-did-policy-coverage.mjs` with "route not found in ROUTE_DID_POLICY".

### Pitfall 3: Tailwind 4 Dynamic SVG Attribute Classes

**What goes wrong:** `hover:r-8` and similar dynamic SVG radius/stroke-width utilities don't generate in Tailwind 4's CSS-first `@theme` config (no JIT for SVG presentation attributes).

**Why it happens:** Tailwind 4 moved to CSS variables + native CSS selectors; SVG presentation attributes (`r`, `stroke-width`) are not CSS properties and don't respond to CSS class changes.

**How to avoid:** Use React state for Nous avatar hover: `const [hoveredId, setHoveredId] = useState<string | null>(null)`. Apply `r={hoveredId === n.civic_did_hash ? 8 : 6}` directly on the `<circle>` element. Stroke change via inline style or JSX conditional.

**Warning signs:** UI-SPEC §Surface 2 FLAG: "Tailwind 4 does not generate dynamic SVG r utilities natively" — already identified.

### Pitfall 4: `check-no-did-exception-count.mjs` Count Drift

**What goes wrong:** Developer adds a new auth route (e.g., Google OAuth) but doesn't update the CI gate asserting count = 5. Gate fails OR worse, gate passes because count wasn't updated and a new 6th exception slips in silently.

**Why it happens:** Gate count is a magic number that needs to match exactly.

**How to avoid:** The gate should count by GREP-ing the `ROUTE_DID_POLICY` table for entries where the route path matches `/portal/auth/*` AND the policy is `public`. Structural, not magic number. Update gate at the same time as adding route.

**Warning signs:** CI fails with "expected 5 no-DID exception routes, found N".

### Pitfall 5: Allowlist Count Off-By-One

**What goes wrong:** Phase 36 adds 4 audit events (56 → 60) + 1 notification event `portal.notification_dispatched` (60 → 61). But D-36-19 says "+1 allowlist" and the ROADMAP says "allowlist +4". There's ambiguity about whether `portal.notification_dispatched` counts in Phase 36 or is a separate Phase 36 extension.

**Why it happens:** D-36-19 was added in the middle of the discuss-phase; the ROADMAP entry was written before D-36-19 was locked.

**How to avoid:** Plan wave 0 should reconcile: the SUPPLEMENT lists 4 events (portal.did_issued, portal.did_revoked, grid.recognition_granted, grid.recognition_revoked); D-36-19 adds 1 more (`portal.notification_dispatched`). Total Phase 36 additions = 5. Final allowlist = 56 + 5 = 61. Update ROADMAP entry if needed when plan is written.

**Warning signs:** Allowlist test count assertions fail (existing `ALLOWLIST_MEMBERS.length === N` comment at the top of `broadcast-allowlist.ts` must be updated).

### Pitfall 6: `visitor_count_active` Leaking in Public Endpoint

**What goes wrong:** `visitor_count_active` is added to `FirehoseStats` and surfaced via `/health/detailed` which is public (per `ROUTE_DID_POLICY: 'public'`).

**Why it happens:** `/health/detailed` is already a public endpoint; new fields added to `FirehoseStats` automatically appear in its response per the additive-only extension rule.

**How to avoid:** `visitor_count_active` is added to the internal `WsFirehoseHub` counter but NOT added to the `FirehoseStats` interface. It's surfaced via a separate admin-only endpoint, or as a non-exported counter consumed only by the Portal Manager Tier 3 UI route (which has `civic_did_required + tier_gate` policy per D-36-10). The `stats()` method returned by `WsFirehoseHub.stats()` must not include `visitor_count_active`.

**Warning signs:** `GET /health/detailed` response includes `visitor_count_active` in firehose section.

---

## Code Examples

### Verified pattern — Fastify preHandler hook (from Phase 25b sanctions)
```typescript
// [VERIFIED: grid/src/api/portal/check-frozen.ts pattern observed in codebase]
// Phase 25b established preHandler enforcement at portal boundary.
// Phase 36 extends to DID-level enforcement using same hook lifecycle.

app.addHook('preHandler', async (req, reply) => {
  // Runs before route handler; can short-circuit with reply.send()
  const policy = ROUTE_DID_POLICY[`${req.method} ${req.routerPath}`] ?? 'civic_did_required';
  if (policy === 'civic_did_required') {
    const ctx = await requireDid(req, reply);
    if (!ctx) return; // 401 already sent
    // Attach to request for route handler use
    (req as ExtendedRequest).didContext = ctx;
  }
});
```

### Verified pattern — 5-second polling hook (from Phase 34 useHealthDetailed)
```typescript
// [VERIFIED: steward/src/lib/use-health-detailed.ts — canonical pattern]
// Portal Civic Map polling reuses EXACTLY this pattern (plain useState/useEffect/useRef).
// NOT SWR. NOT react-query. (v2.1 invariant: no external state management deps)

useEffect(() => {
  let cancelled = false;
  const controller = new AbortController();

  async function fetchCivicMap() {
    try {
      const res = await fetch(`${GRID_ORIGIN}/api/v1/civic-map/state`, {
        signal: controller.signal,
      });
      if (cancelled) return;
      if (!res.ok) { setError(`HTTP ${res.status}`); setIsLoading(false); return; }
      const data = await res.json();
      if (cancelled) return;
      setCivicMapData(data);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
      setError('Civic Map unavailable.');
      setIsLoading(false);
    }
  }

  fetchCivicMap();
  const interval = setInterval(fetchCivicMap, 5000);  // D-36-13: 5-second polling

  return () => { cancelled = true; controller.abort(); clearInterval(interval); };
}, []);
```

### Verified pattern — CI gate script structure (from Phase 33 check-sole-producer-discipline.mjs)
```javascript
// [VERIFIED: scripts/check-sole-producer-discipline.mjs — canonical gate pattern]
// New CI gates (check-did-policy-coverage.mjs etc.) follow this identical structure:
// 1. Import only node:fs, node:path
// 2. Define ROOT = process.cwd()
// 3. Walk target files with ENOENT-tolerant readdirSync
// 4. Check for required strings with text.includes(...)
// 5. Exit 0 on clean, Exit 1 with error messages on violation
// 6. Wire into .github/workflows/rig-invariants.yml as a step

#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOT = process.cwd();
// ... scan logic ...
process.exit(violations.length === 0 ? 0 : 1);
```

### Verbatim copy strings (locked by UI-SPEC.md Copywriting Contract)
```typescript
// [CITED: 36-UI-SPEC.md §Copywriting Contract — all test-asserted: yes rows]
// These exact strings MUST appear in the implementation for tests to pass.

export const COPY = {
  PAGE_TITLE: 'Noēsis · Polis',
  HERO_TAGLINE: 'PORTAL · NOĒSIS V3.0',
  HERO_H1: 'Welcome to the Polis',
  HERO_SUBTITLE: 'A digital city where Nous earn, learn, trade, form communities, and self-govern.',
  TOS: 'By entering Genesis Grid, you agree to the Grid Charter and the Laws of Themis.',
  // Tier-specific banners
  ANONYMOUS_BANNER: 'Welcome to Noēsis. Sign up to participate in the Polis.',
  CIVIC_MAP_LOADING: 'Civic Map data unavailable. Reconnecting…',
  POLIS_EMPTY: 'No bills drafted yet. The Polis is still organizing.',
} as const;
```

---

## Runtime State Inventory

> Not a rename/refactor phase. No runtime state migration required.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | No existing Civic-DID records (Phase 37 creates them) | None for Phase 36 |
| Live service config | Portal landing page (`/portal`) currently shows v2.5 Human Portal dashboard — will be replaced by v3.0 Portal landing | Code edit only; no data migration |
| OS-registered state | None | None |
| Secrets/env vars | No new secrets required; JWT keypair already generated at module load in `portal/auth.ts:53` | None |
| Build artifacts | No stale artifacts — phase adds new files, doesn't rename existing ones | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | CI gate scripts + grid build | ✓ | Managed by `setup-node@v4` in `rig-invariants.yml` | — |
| Fastify | Grid API server | ✓ | `^5.0.0` [VERIFIED: grid/package.json] | — |
| `@fastify/websocket` | WS firehose hub | ✓ | `11.2.0` [VERIFIED: npm view] | — |
| `@fastify/cookie` | Portal session cookie reading | ✓ | Registered in `server.ts:281` [VERIFIED] | — |
| `jose` | JWT verification (Civic-DID bearer) | ✓ | `^6.2.3` [VERIFIED: grid/package.json] | — |
| Next.js 15 | Portal frontend | ✓ | `15.2.4` [VERIFIED: dashboard/package.json] | — |
| Tailwind CSS 4 | Portal UI styling | ✓ | `^4.0.0` [VERIFIED: dashboard/package.json] | — |
| `three.js` | Portal landing 3D hero (D-36-23) | [ASSUMED: not yet in package.json] | Unknown | Skip 3D hero; ship with static isometric PNG or CSS art; add three.js in Phase 56 polish (D-36-24 deferred atmospheric controls precedent) |

**Missing dependencies with no fallback:** None that block Phase 36 core delivery.

**Missing dependencies with fallback:** `three.js` for Portal landing hero — fallback is static/CSS isometric city visual (the 3D hero is atmospheric, not functional per D-36-23/D-36-24; Phase 36 can ship functional Portal landing without 3D).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^2.0.0` (grid) / `^4.1.0` (dashboard) |
| Config file | `grid/vitest.config.ts` + `dashboard/vitest.config.ts` [VERIFIED: package.json scripts] |
| Quick run command | `cd grid && npx vitest run test/rig/` |
| Full suite command | `cd grid && npx vitest run && cd ../dashboard && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIS-01 | Unauthenticated GET to public routes returns 200 with public data | unit (route handler test) | `cd grid && npx vitest run test/api/visitor-public-routes.test.ts -x` | ❌ Wave 0 |
| VIS-01 | Unauthenticated GET to public routes does NOT include actor_did in audit events stream | unit | `cd grid && npx vitest run test/api/visitor-audit-redaction.test.ts -x` | ❌ Wave 0 |
| VIS-02 | POST to any civic write route without DID returns 401 `{error:'did_required'}` | unit | `cd grid && npx vitest run test/api/did-required-enforcement.test.ts -x` | ❌ Wave 0 |
| VIS-03 | WS firehose: subscriber without DID receives redacted frames (no actor_did, family prefix only) | unit (WsFirehoseHub) | `cd grid && npx vitest run test/audit/firehose-hub-redaction.test.ts -x` | ❌ Wave 0 |
| VIS-03 | WS firehose: same event received by DID and non-DID subscriber has identical tick+event_type (zero-diff) | unit | `cd grid && npx vitest run test/audit/firehose-hub-zero-diff.test.ts -x` | ❌ Wave 0 |
| VIS-04 | `ROUTE_DID_POLICY` table covers all registered routes (mirrors CI gate logic) | unit (policy table completeness) | `cd grid && npx vitest run test/api/policy-coverage.test.ts -x` | ❌ Wave 0 |
| VIS-04 | `check-did-policy-coverage.mjs` exits 0 on clean repo | smoke (script) | `node scripts/check-did-policy-coverage.mjs` | ❌ Wave 0 (script) |
| VIS-04 | `check-admin-policy-isolation.mjs` exits 0 on clean repo | smoke (script) | `node scripts/check-admin-policy-isolation.mjs` | ❌ Wave 0 (script) |
| VIS-05 | `portal.did_issued` sole producer: throws TypeError on bad payload; commits correct entry | unit | `cd grid && npx vitest run test/audit/append-portal-did-issued.test.ts -x` | ❌ Wave 0 |
| VIS-05 | `portal.did_revoked` sole producer: throws TypeError on bad payload | unit | `cd grid && npx vitest run test/audit/append-portal-did-revoked.test.ts -x` | ❌ Wave 0 |
| VIS-05 | `grid.recognition_granted` sole producer: throws TypeError on bad payload | unit | `cd grid && npx vitest run test/audit/append-grid-recognition-granted.test.ts -x` | ❌ Wave 0 |
| VIS-05 | `grid.recognition_revoked` sole producer: throws TypeError on bad payload | unit | `cd grid && npx vitest run test/audit/append-grid-recognition-revoked.test.ts -x` | ❌ Wave 0 |
| VIS-05 | Allowlist length = 61 (56 + 5 new events) | unit | `cd grid && npx vitest run test/audit/broadcast-allowlist.test.ts -x` | ✅ exists (update count assertion) |
| D-36-09 | Revoked DID context falls through to visitor tier (not hard block) | unit | `cd grid && npx vitest run test/api/did-revoked-behavior.test.ts -x` | ❌ Wave 0 |
| D-36-15 / VOTE-05 | GET /api/v1/polis/bills/:id does NOT include ballots array | unit | `cd grid && npx vitest run test/api/polis-bills-privacy.test.ts -x` | ❌ Wave 0 |
| Portal UI | Portal landing page renders "Noēsis · Polis" title | unit (component) | `cd dashboard && npx vitest run src/app/portal/page.test.tsx -x` | ❌ Wave 0 |
| Portal UI | Civic Map renders 6 zone polygons in SVG | unit (component) | `cd dashboard && npx vitest run src/app/portal/civic-map/CivicMap.test.tsx -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd grid && npx vitest run test/rig/`
- **Per wave merge:** `cd grid && npx vitest run && node scripts/check-did-policy-coverage.mjs && node scripts/check-admin-policy-isolation.mjs && node scripts/check-ws-redaction-zero-diff.mjs && node scripts/check-no-did-exception-count.mjs`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

All test files listed above with ❌ must be created in Wave 0 before implementation begins. Additionally:

- [ ] `grid/test/api/visitor-public-routes.test.ts` — VIS-01 public route 200 assertions
- [ ] `grid/test/api/did-required-enforcement.test.ts` — VIS-02 401 for all write routes
- [ ] `grid/test/audit/firehose-hub-redaction.test.ts` — VIS-03 serializer redaction
- [ ] `grid/test/audit/firehose-hub-zero-diff.test.ts` — VIS-03 R-31-01 invariant
- [ ] `grid/test/api/policy-coverage.test.ts` — VIS-04 table completeness
- [ ] `grid/test/audit/append-portal-did-issued.test.ts` — VIS-05 sole producer
- [ ] `grid/test/audit/append-portal-did-revoked.test.ts` — VIS-05 sole producer
- [ ] `grid/test/audit/append-grid-recognition-granted.test.ts` — VIS-05 sole producer
- [ ] `grid/test/audit/append-grid-recognition-revoked.test.ts` — VIS-05 sole producer
- [ ] Update `grid/test/audit/broadcast-allowlist.test.ts` — change `ALLOWLIST_MEMBERS.length` assertion to 61
- [ ] `dashboard/src/app/portal/page.test.tsx` — Portal landing copy assertions
- [ ] `dashboard/src/app/portal/civic-map/CivicMap.test.tsx` — SVG zone render

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT verification via `jose` `jwtVerify` (ES256, already in codebase); Portal session cookie; no new auth mechanism |
| V3 Session Management | yes | Existing `@fastify/cookie` session cookie (Portal JWT); `COOKIE_NAME = 'noesis_portal_token'` (already set) |
| V4 Access Control | yes | `ROUTE_DID_POLICY` preHandler enforcement; default-deny for routes not in table; tier-gated admin routes (D-36-10) |
| V5 Input Validation | yes | DID_RE regex at sole-producer boundary; `Object.keys(payload).sort()` closed-tuple; `payloadPrivacyCheck()` |
| V6 Cryptography | partial | JWT keypair already generated at module load; no new crypto required |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IP spoofing to bypass rate limit | Spoofing | Do not rate-limit on `X-Forwarded-For` alone in v3.0 single-server; use `req.ip` (Fastify's resolved IP); document limitation |
| DID forgery (crafted JWT) | Spoofing | `jwtVerify` with server-held ES256 public key; token signed by Portal auth server only |
| Ballot privacy leak via public events stream | Information Disclosure | `ballot.committed` / `ballot.revealed` must never appear in visitor-accessible `/api/v1/audit/trail?summary=true` or WS firehose family prefix (VOTE-05); enforce by ALLOWLIST + ROUTE_DID_POLICY |
| `visitor_count_active` fingerprinting | Information Disclosure | Internal metric only (D-36-08); MUST NOT appear in `/health/detailed` response (Pitfall 6 in Common Pitfalls) |
| Type B census leak via `ACTIVE NODES` stat | Information Disclosure | Excluded from visitor footer per D-36-25; not in any `public` ROUTE_DID_POLICY endpoint |
| Admin route exposure to visitor | Elevation of Privilege | CI gate `check-admin-policy-isolation.mjs` enforces every `/admin/*` route has `civic_did_required` or higher |
| HTTP-only cookie theft | Information Disclosure | `noesis_portal_token` cookie should be `HttpOnly; Secure; SameSite=Strict` — verify `fastifyCookie` options in `server.ts` (already registered Phase 33; confirm flags) |
| Prototype pollution via payload spread | Tampering | Sole-producer pattern: explicit reconstruction (no spread `...payload`); established in all Phase 33 producers |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All routes require Portal session (v2.5) | `ROUTE_DID_POLICY` 6-tier table; public routes for visitors | Phase 36 (this phase) | Visitors can browse without signing up |
| WS firehose: broadcast full entry to all clients | Per-subscriber serialization: redacted for non-DID subscribers | Phase 36 (this phase) | Privacy tier without R-31-01 breakage |
| Portal auth: 3 no-DID exceptions (siwe, email/signup, email/signin) | 5 no-DID exceptions (+google, +apple OAuth per D-36-21) | Phase 36 (this phase) | Lowers signup friction; sovereignty preserved (OAuth = identity provider, not custodian) |
| WsFirehoseHub: flat visitor count via `client_count` | `client_count` = all; `visitor_count_active` = non-DID count (internal only) | Phase 36 (this phase) | D-V3-13 metric split; D-32-C1 additive-only extension |

**Deprecated/outdated:**
- v2.5 portal landing page (`dashboard/src/app/portal/page.tsx`): will be replaced by v3.0 Portal landing; old Human Portal "Welcome back, {name}" is superseded by 3-tier visitor model banners (D-36-16/20)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `three.js` is not yet in `dashboard/package.json` | Environment Availability | Low — 3D hero is optional per D-36-23/24; fallback is static visual |
| A2 | Fastify v5 preHandler hooks fire BEFORE route handler and can short-circuit with `reply.send()` | Architecture Patterns > Pattern 1 | Medium — if behavior changed in v5, DID enforcement wouldn't work; verify with Fastify v5 docs/tests |
| A3 | Portal notification queue (D-36-19) can use in-process or MySQL table; no message queue service needed | Architecture > notification queue | Low — server-persistent queue is straightforward MySQL table; no Redis/RabbitMQ required at v3.0 scale |
| A4 | `ALLOWLIST_MEMBERS.length` assertion in `broadcast-allowlist.test.ts` will need updating from 56 to 61 | Validation Architecture | Medium — if the existing test asserts a hard-coded count, it will fail; confirm assertion mechanism before writing wave 0 tests |
| A5 | Visitor rate limiting can be implemented as in-process Map (no Redis) for v3.0 single-server | Standard Stack > Alternatives | Low — documented explicitly as v3.0 scope; Phase 39 addresses per-DID quotas with potential Redis |

**If this table is empty:** N/A — 5 assumptions logged above. All tagged `[ASSUMED]` in context above.

---

## Open Questions

1. **Portal app location (Q-V3-PORTAL-3 — Claude's Discretion)**
   - What we know: UI-SPEC.md says "new routes home = Portal app (new in v3.0 per PORTAL-01) at TBD `portal.noesis` domain; structurally extends `dashboard/` codebase OR new sibling Next.js app per Q-V3-PORTAL-3 (planner discretion)"
   - What's unclear: Whether the 5 new visitor surfaces live inside `dashboard/src/app/portal/` (existing) or a new sibling `portal/` Next.js app in the monorepo
   - Recommendation: Use `dashboard/src/app/portal/` (the existing v2.5 portal routes location) for v3.0 Phase 36. Adding a new sibling Next.js app creates Turborepo config overhead and new deployment complexity out of scope for Phase 36 (Phase 52-54 Portal Infrastructure handles the domain split). Document decision in plan Wave 0.

2. **Allowlist count reconciliation (A4 above)**
   - What we know: ROADMAP says "+4 allowlist" for Phase 36; D-36-19 adds 1 more (`portal.notification_dispatched`); total should be +5 (56 → 61)
   - What's unclear: Whether `portal.notification_dispatched` is an allowlist event (broadcast via WS firehose) or a private event (not on allowlist, only in chain)
   - Recommendation: `portal.notification_dispatched` is a personal notification to an operator-DID; it should NOT be on the broadcast allowlist (it's a private queue event). Therefore it goes in the audit chain but NOT in `ALLOWLIST_MEMBERS`. Final allowlist count = 56 + 4 = 60 (matching ROADMAP). Plan Wave 0 must confirm this interpretation.

3. **Google / Apple OAuth implementation scope (D-36-21)**
   - What we know: D-36-21 adds Google OAuth + Apple OAuth as auth methods. CI gate count updates 3 → 5.
   - What's unclear: Full OAuth provider integration (Google Cloud Console app, Apple Developer account, PKCE flow, callback URLs) may be out of scope for Phase 36's main concern (visitor/DID enforcement). Full OAuth could be a stub (placeholder routes that return 501 Not Implemented) with full implementation in Phase 52-54 Portal Infrastructure.
   - Recommendation: Add stub routes for `/portal/auth/oauth/google` + `/portal/auth/oauth/apple` that return `{"status": "coming_soon"}` with the correct `ROUTE_DID_POLICY: 'public'` entry. This satisfies the CI gate count (5 exceptions) and D-36-21 without requiring real OAuth provider registration in Phase 36.

---

## Sources

### Primary (HIGH confidence)

- `36-CONTEXT.md` — 25 locked decisions D-36-01..25, all cited verbatim [VERIFIED: read in session]
- `36-UI-SPEC.md` — complete UI design contract; verbatim copy strings; tier differentiation matrix [VERIFIED: read in session]
- `SUPPLEMENT-visit-vs-action.md` — §1 model, §2 endpoint matrix, §4 implementation sketch, §5 audit events, §7 D-V3-11..15 [VERIFIED: read in session]
- `grid/src/audit/firehose-hub.ts` — current `WsFirehoseHub` implementation; `FirehoseStats` interface; `ClientConnection` class [VERIFIED: read in session]
- `grid/src/audit/broadcast-allowlist.ts` — current allowlist (56 entries); `ALLOWLIST_MEMBERS` array; sole-producer triad discipline [VERIFIED: read in session]
- `grid/src/audit/append-portal-auth-login.ts` — canonical sole-producer reference [VERIFIED: read in session]
- `grid/src/api/portal/auth.ts` — existing auth routes (SIWE + email); JWT pattern; `COOKIE_NAME` [VERIFIED: read in session]
- `steward/src/lib/use-health-detailed.ts` — 5-second polling hook pattern (NO SWR) [VERIFIED: read in session]
- `steward/src/app/culture/skill-lineage.tsx` — raw-SVG invariant reference (Phase 21) [VERIFIED: read in session]
- `scripts/check-sole-producer-discipline.mjs` — CI gate script structure (canonical pattern) [VERIFIED: read in session]
- `.github/workflows/rig-invariants.yml` — gate wiring pattern [VERIFIED: read in session]
- `dashboard/package.json` — Next.js 15.2.4, Tailwind 4, Vitest 4.1.0 [VERIFIED: read in session]
- `grid/package.json` — Fastify ^5.0.0, jose ^6.2.3, Vitest ^2.0.0 [VERIFIED: read in session]
- `.planning/REQUIREMENTS.md` — VIS-01..05 requirement descriptions [VERIFIED: read in session]

### Secondary (MEDIUM confidence)

- `SUPPLEMENT-visit-vs-action.md §4` → `serializeFrame()` implementation sketch — research-grade pseudocode; planner will refine exact method signatures [CITED: supplement]
- Fastify v5 preHandler short-circuit behavior — [ASSUMED: consistent with v4 documented behavior; v5 changelog has no breaking change noted for hooks]

### Tertiary (LOW confidence)

- None — all critical findings are codebase-verified or directly cited from locked decision documents

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified against live package.json files
- Architecture: HIGH — enforcement patterns derived directly from existing codebase (Phase 33 sole-producer, Phase 32 firehose hub, Phase 34 polling hook)
- Pitfalls: HIGH — R-31-01 zero-diff constraint, VOTE-05 ballot privacy, Tailwind 4 SVG limitation all verified from existing code comments and UI-SPEC FLAGS
- CI gate pattern: HIGH — `check-sole-producer-discipline.mjs` structure directly inspected

**Research date:** 2026-05-25
**Valid until:** 2026-06-25 (stable stack — Next.js, Fastify, Tailwind 4 all pinned; allowlist count tied to this specific phase state)
