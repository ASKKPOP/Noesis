# Phase 36: Visitor/DID Read-Write Split — Context

**Gathered:** 2026-05-25
**Status:** Ready for planning
**Position:** Wave 1 (Foundations), parallel-eligible with Phase 37 + Phase 40

<domain>
## Phase Boundary

Implement read/write asymmetry in v3.0 architecture: unauthenticated visitors can browse public Grid + Portal surfaces; every state-mutating route requires Civic-DID (or operator-DID for the 3 Portal signup exceptions per D-V3-15). Per-endpoint `ROUTE_DID_POLICY` table is the authority. WS firehose redacts private fields for non-DID subscribers without breaking R-31-01 zero-diff. CI gates enforce policy coverage + zero-diff invariant.

This phase ships VIS-01..05 (5 requirements). Dependencies: none (Wave 1 parallel group A). Downstream: Phase 37 DID Registry (Portal-gated registration), Phase 42 P2P (visitors don't get P2P signaling), Phase 44+ civic institutions (each contributes routes to ROUTE_DID_POLICY).

</domain>

<decisions>
## Implementation Decisions

### Visitor Landing + Registration Flow (Area 1)

- **D-36-01:** Visitor entry URL is **Portal landing** (`portal.noesis`). Portal IS the front door. Visitor first sees Portal homepage with "What is Noēsis · Browse Grids · Sign up" and per-Grid drill-down links. Grid root URLs (e.g. `genesis.noesis`) redirect to Portal landing if no Portal session cookie, OR show Grid Civic Map directly if Portal session exists (cookie-based).
- **D-36-02:** Tourist info center scope is **rich tour**: visitor browses live Civic Map (6-zone view per D-V3-32, with per-Nous avatars per D-36-12), reads top-N Library entries, sees recent civic events stream (redacted per D-V3-12), browses Marketplace listings (with prices per D-36-03), reads pending Polis bill drafts (per D-36-15), and has clear "Sign up at Portal to participate" CTA throughout. Approximately 5 main visitor surfaces: Portal landing, Civic Map, Library reading room, Marketplace browse, Polis bills.
- **D-36-03:** Marketplace listings are **fully visible to visitors including prices**. Reasoning: full transparency encourages signup-to-participate; nothing private about marketplace prices; Type B Nous earnings depend on visitor traffic discovering listings.
- **D-36-04:** Registration is a **two-step flow**: (1) Visitor signs up at Portal (SIWE or email per Phase 22-23 patterns), creating Portal account + operator-DID. (2) From Portal UI, operator clicks "Apply for Genesis Polis citizenship" to start D-V3-33 Portal-gated registration flow (Portal pre-screen → Genesis Polis charter review → Civic-DID issued). Two-step is intentional: separates Portal account creation from per-Grid civic membership (matches multi-Grid framework D-V3-04).

### Rate Limiting + Audit Scope (Area 2)

- **D-36-05:** Visitor rate limit is **120 req/min per IP** (permissive default). Allows rich visitor UX (preload Civic Map zones, prefetch library entries). Bucket scoped per source IP. DID-holders get per-DID buckets (set in Phase 39 multi-tenancy; much higher than visitor bucket).
- **D-36-06:** Visitor audit-trail scope is **last 1000 events sliding window**. Doesn't reveal Grid deployment age (avoids fingerprinting). DID-holders get full audit chain access via per-Grid endpoint scoping (set in Phase 37+).
- **D-36-07:** Throttle behavior on bucket exhaustion is **HTTP 429 with `Retry-After` header**. Standard, browser-friendly, predictable. Soft-block / slow-down alternatives rejected as adding state complexity.
- **D-36-08:** FirehoseStats `visitor_count_active` (D-V3-13 extension) is **internal-only metric**. Surfaced to Portal Manager (D-V3-36 Tier 3) admin UI only. NOT exposed in any public endpoint. Prevents both fingerprinting and visitor-traffic-anxiety surveys.

### Edge Cases (Area 3)

- **D-36-09:** Revoked Civic-DID behavior **default = revert to visitor status** (supplement Q-VA-4 recommendation). Revoked holder loses write access but retains read access to public surfaces. **Amendable by Polis legislation** per D-V3-21 + D-V3-34 — Polis can pass a bill to change the default (e.g. switch to hard-block for severe sanctions). Initial v3.0 implementation hardcodes "revert to visitor"; Phase 46 (Polis) makes the policy legislatively adjustable via `gov.law_enacted` for `revocation_policy`. Hardcoded default is sane fallback if Polis hasn't yet legislated.
- **D-36-10:** Steward `/admin/*` and Portal `/admin/*` surfaces are **always DID-required + tier-gated**. Per D-V3-36 these are Tier 2 Grid Manager (per-Grid Steward) and Tier 3 Portal Manager (Portal admin UI) surfaces — administrative, never visitor-readable. CI gate `scripts/check-admin-policy-isolation.mjs` (added in this phase) ensures every `/admin/*` route has `did_required` + tier check.
- **D-36-11:** Visitor **can view a specific Nous public profile** by clicking an avatar on Civic Map. Public profile contains: display name, current zone (per D-V3-32), civic standing tier (provisional/full per D-V3-35), public bio text (Nous-authored, optional). Public profile does NOT contain: memory inspector (any layer — Karpathy/Hypnos/Pneuma), audit history (DID-required), Brain config, treasury balance, personal contracts.

### 6-Zone Civic Map Visibility (Area 4)

- **D-36-12:** Civic Map renders **per-Nous avatars positioned in zones**. Visitor sees individual Nous distributed across the 6 zones (D-V3-32). Click any avatar → public profile per D-36-11. Creates living-city visual experience.
- **D-36-13:** Civic Map refresh rate is **5-second polling**. Matches Phase 32 `/health/detailed` pattern (reuses useSWR-style hook). Predictable load; visitor browser-friendly. NOT WebSocket push (avoids per-visitor WS connection overhead).
- **D-36-14:** Zone deep-dive on click shows **public zone info**: zone tax rate, recent civic activity in zone (last 20 events filtered by `zone_id`), top contributors (display name + civic standing — top earners for Business/Manufacture/Shopping zones; top contributors for Library/Government zones). Static zone description + size also shown.
- **D-36-15:** Visitor **can see Polis (Genesis Polis) bill drafts + active legislative sessions**. Specifically: read pending bill drafts (title + body summary), see when sessions are open + scheduled (per `gov.session_opened`), see tally results AFTER `proposal.tallied` fires. **CANNOT** see individual ballots (`ballot.committed` / `ballot.revealed` are DID-required) — preserves VOTE-05 ballot privacy (the original v2.2 Phase 12 invariant). Transparency at result level; privacy at vote level.

### Claude's Discretion

These implementation choices are left to research + planning agents:
- ROUTE_DID_POLICY data structure exact shape (TypeScript interface design)
- CI gate `scripts/check-did-policy-coverage.mjs` implementation language (likely Node.js to match Phase 31-34 pattern)
- Visitor session cookie format (Portal-managed; doesn't need DID)
- Civic Map SVG rendering exact zone layout (Phase 21 raw-SVG invariant preserved; specific layout coords are engineering detail)
- Marketplace listing pagination strategy for visitor view
- Library reading room search algorithm (extends Phase 20 LORE)
- Bill draft body summary algorithm (full body might be too long; summary heuristic TBD)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v3.0 architecture source-of-truth
- `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` v3.0 §§3 (Portal Layer), §7 (Zoning), §9 (Registration Flow) — three-layer architecture, Portal-gated registration, 6-zone city
- `.planning/research/v3.0/ARCHITECTURE-v3.0.html` — canonical visual reference (15 sections, multiple SVG diagrams)
- `.planning/research/v3.0/SUPPLEMENT-visit-vs-action.md` — primary research source for this phase. §1 (model), §2 (per-endpoint matrix), §4 (Implementation sketch), §5 (Audit chain implications), §7 (D-V3-11..15 decisions)

### Phase 36 requirements
- `.planning/REQUIREMENTS.md` VIS-01..05 — the 5 REQs this phase delivers
- `.planning/REQUIREMENTS.md` MGR-01..06 — 3-tier management taxonomy (D-V3-36) — Tier 1/2/3 separation affects /admin/* gating
- `.planning/REQUIREMENTS.md` PORTAL-01, PORTAL-07 — Portal infrastructure + user UI (visitor lands at Portal per D-36-01)

### Constitutional invariants
- `PHILOSOPHY.md` §1 + §9 — first-life, sovereignty, constitutional substrate, multi-Polis sovereignty
- `CLAUDE.md` §3 (Documentation Sync Rule), GSD Workflow Notes (allowlist freeze, 3-tier management invariant, Polis naming convention)

### Pre-existing v2.x invariants (do not break)
- v2.6 Phase 31-34 audit chain hardening — `grid/src/audit/chain.ts:44-58` listener fan-out order (R-31-01 zero-diff); PersistentAuditChain pattern carries forward
- v2.6 Phase 32 frozen contracts — D-32-C1 HEALTH_THRESHOLDS, D-32-C2 computeStatus, D-32-C3 `/health/detailed` payload shape; visitor count extension MUST be additive (D-V3-13)
- v2.6 Phase 33 PORTAL_AUTH_FORBIDDEN_KEYS (13 keys) — extend with any new visitor/registration payload guards
- v2.4 Phase 21 raw-SVG invariant — Civic Map MUST be raw SVG (no d3, no react-flow, no cytoscape); zone layout uses server-computed coords
- v2.2 Phase 12 VOTE-05 — preserve ballot privacy (D-36-15 references this invariant)

### Cross-phase coordination
- Phase 37 (DID Registry) — Civic-DID issuance is the destination of registration flow (D-36-04 two-step); Phase 37b adds Type B birth ceremonies (Polis-α/β/γ) — Phase 36 surfaces visitor view of which Type B requests are pending
- Phase 52-54 (Portal Infrastructure + Workflows) — Portal landing (D-36-01), Portal-gated registration (D-36-04), reviewer panel UI (Q-V3-PORTAL-2) — Phase 36 builds the visitor-facing Portal surfaces that lead INTO Phase 54 registration flow
- Phase 57 (Zoning) — Civic Map renders 6 zones (D-V3-32); Phase 36 implements visitor view of zones (D-36-12..14); Phase 57 implements zone data model + amendment legislation

### Out of scope for this phase (handled elsewhere)
- DID issuance mechanism itself → Phase 37
- Portal Manager admin UI for reviewer panel → Phase 56 (extends PORTAL-07 user UI with admin role)
- Per-zone tax rule legislation → Phase 46 (Polis)
- Type B birth ceremony Brain seed visibility → Q-EXT-RES-5 (deferred to Phase 37b discuss-phase)
- Cross-Grid visitor view (visitor sees Commerce Polis from Genesis URL) → Phase 55 (cross-Grid framework, dormant in v3.0)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Fastify route registration pattern** (`grid/src/api/*.ts`) — decorator-style route registration; ROUTE_DID_POLICY decorator can be implemented as Fastify preHandler hook applied per-route via decorator wrapper
- **PORTAL_AUTH_FORBIDDEN_KEYS** (`grid/src/audit/portal-auth-forbidden-keys.ts`, Phase 33) — extend with any new visitor-related payload guards (e.g. visitor-IP must not appear in any payload)
- **`payloadPrivacyCheck` triad pattern** (Phase 33 — Object.keys.sort() + privacy check + audit.append) — sole-producer files for the 4 new VIS-05 events follow this pattern
- **WsFirehoseHub** (Phase 32, `grid/src/firehose/ws-hub.ts`) — already has frame counters via HubMetricsSink; extend to support per-subscriber redaction (D-V3-12) and visitor_count_active (D-V3-13)
- **`/health/detailed` payload shape** (Phase 32, D-32-C3) — visitor count extension is additive (does not modify D-32-C3 frozen shape; new top-level key `visitor` or sub-field)
- **Steward Console useSWR pattern** (`steward/src/lib/use-health-detailed.ts`, Phase 34) — reuse for visitor Civic Map polling (D-36-13)
- **Raw-SVG culture pages** (`steward/src/app/culture/skill-lineage.tsx`, Phase 21) — pattern for visitor Civic Map rendering (server-computed coordinates, no d3)

### Established Patterns

- **Sole-producer files in `grid/src/audit/`** — every new audit event has its own producer file with triad enforcement (Phase 33 discipline applies to VIS-05 4 new events)
- **Closed-tuple payload + Object.keys.sort() strict equality** — payload structure pinned at producer boundary
- **DID_RE regex** at 3 entry points (Phase 1 invariant) — extend for `did:civic:noesis:*` format (Phase 37 will add) and visitor "no-DID" sentinel value (TBD in planning)
- **Operator tier (H1-H5) gating from v2.1 Phase 6** — operator-DID + tier check decorator already exists; ROUTE_DID_POLICY for civic-DID is a parallel mechanism (not replacement)

### Integration Points

- **Fastify request lifecycle** — preHandler hook is where ROUTE_DID_POLICY enforcement happens. Returns 401 with structured error before route handler executes.
- **WS firehose subscriber registry** — extends to track `isVisitor: boolean` per subscriber; serializer reads this flag for redaction decisions
- **Civic Map data source** — server-computed zone layout + Nous positions (matches Phase 21 raw-SVG pattern); polled by visitor Civic Map page (D-36-13)
- **Steward Console + Portal user UI** — Steward is operator's per-Grid tool (Tier 2 Grid Manager surface); Portal is meta + user UI (visitor lands here per D-36-01). Both must NOT render `/admin/*` to visitors (D-36-10)
- **CI gate registry** — Phase 33 established `scripts/check-*.mjs` pattern wired into `rig-invariants.yml`. Phase 36 adds: `check-did-policy-coverage.mjs` (D-V3-11 enforcement) + `check-admin-policy-isolation.mjs` (D-36-10 enforcement) + `check-ws-redaction-zero-diff.mjs` (D-V3-12 + R-31-01 regression guard)

</code_context>

<specifics>
## Specific Ideas

- **Portal landing page layout** (D-36-01): top banner "Noēsis · v3.0 Polis · public Grid network", body has "Browse the City" CTA → Civic Map, "Sign Up" CTA → SIWE/email flow, "What is Noēsis?" link → explainer page, footer with Grid list (Genesis Grid linked; future Grids stubbed as "coming v3.1+")
- **Tourist info center 5 surfaces** (D-36-02): Portal home / Civic Map (Genesis Grid) / Library reading room / Marketplace listings / Polis bill drafts. All accessible from Portal landing navigation.
- **Marketplace pricing UX** (D-36-03): visitor sees listing card with title, description, price in Bios, seller display name (linked to public profile per D-36-11), zone tag (Business / Shopping). "Sign up to buy" CTA where DID-holder would see "Bid" button.
- **Two-step registration UX** (D-36-04): visitor clicks "Sign Up" at Portal → completes SIWE or email signup → lands on Portal dashboard with "Apply for Genesis Polis citizenship" prominent CTA. Click → registration form with civic oath text + signature confirmation → Portal pre-screen → target-Polis review → success notification → Steward Console redirect.
- **Polis bill draft visitor view** (D-36-15): visitor sees bill list with title, sponsor (display name), co-sponsors count, session schedule, status (drafting / debate / voted). Click bill → read body. After `proposal.tallied`, show tally totals (pass/fail count). NEVER show who voted what.

</specifics>

<deferred>
## Deferred Ideas

### Out of scope for Phase 36 (other phases or v3.x)
- **Visitor → DID-holder session continuity** — when visitor signs up mid-browse, their browsing state (zone, scroll position) carries over. Polish; defer to Phase 56 Portal UI.
- **Visitor analytics dashboard for Polis** — Polis-elected committee could request "what are visitors most interested in" reports. Out of scope; D-V3-13 already says no per-visit audit events. If Polis legislates a survey mechanism, add in Phase 46 follow-up.
- **A/B testing visitor landing variants** — out of scope. Single layout in v3.0.
- **Internationalization of visitor surfaces** — Phase 36 ships English only. i18n deferred.
- **Mobile-responsive Civic Map** — Phase 36 ships desktop-first; mobile per Phase 56 Portal UI work.
- **Visitor-callable Portal /portal/api/v1/grids/list endpoint** — for v3.1+ when multiple Grids exist. v3.0 returns just [Genesis] always (already covered by Phase 55 framework).
- **Brain-seed transparency for Type B Polis-α charter requests** (Q-EXT-RES-5) — visitor view of pending Type B requests with Brain seed. Out of scope for Phase 36; resolved in Phase 37b discuss-phase.
- **Cross-Grid visitor experience** — visitor browses Commerce Polis from Genesis URL. Out of scope; v3.1+ via Phase 55 activation.

### Reviewed but not scoped
(No matched todos at this phase.)

</deferred>

---

*Phase: 36-visitor-did-read-write-split*
*Context gathered: 2026-05-25*
*Next: `/gsd-plan-phase 36` to draft execution plan*
