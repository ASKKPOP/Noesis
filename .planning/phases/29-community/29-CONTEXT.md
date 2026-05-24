# Phase 29: Community — Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 29 adds the social layer on top of the Human Portal. Humans can discover each other
(user directory), post and reply (community board), follow other humans (social graph),
see how they rank (leaderboard), and watch the live Grid event stream (activity feed).

All features are human-facing, portal-scoped (JWT auth), and use the existing `humanPool`
MySQL connection and `check-frozen.ts` gate pattern established in Phase 22.

**Allowlist delta: +0** — Community actions (posting, following, viewing) do not fire new
audit events. The allowlist stays frozen at 53. Reading existing broadcast events for the
activity feed requires no new allowlist members — the feed is a pure-observer read.

**New DB tables (migrations v18–v20):**
- v18: `community_posts` (id, grid_name, author_did, content, created_at)
- v19: `community_replies` (id, grid_name, post_id, author_did, content, created_at)
- v20: `user_follows` (grid_name, follower_did, following_did, created_at; PK composite)

**Requirements covered:** COM-01 through COM-05 (no canonical REQ doc IDs exist yet for
Phase 29 — these are phase-internal labels from the roadmap description).

**Out of scope in Phase 29:**
- Upvotes/downvotes (deferred — keep community board simple)
- Post moderation UI (operators can use Steward Console ban/freeze for now)
- Notifications (deferred to v2.6)
- DMs between humans (different surface — out of scope for v2.5)
- Dedicated `user_activity_log` table (activity feed reads existing `audit_trail` not a new table)

</domain>

<decisions>
## Implementation Decisions

### Allowlist (D-01)

- **D-01:** Allowlist stays at 53. Community actions (post, reply, follow, unfollow) are
  portal-DB operations only — they do NOT emit audit chain events. The activity feed reads
  the existing `audit_trail` table for display; no new events are emitted.

### Community Post Storage (D-02)

- **D-02:** Community posts store plaintext `content` in the DB (not hash-only). This is
  user-generated public content with no privacy requirement (unlike Nous Brain content
  which is always hash-only). Content is truncated server-side: posts ≤ 500 chars,
  replies ≤ 280 chars, validated at Grid API boundary.

### User Directory (D-03)

- **D-03:** User directory lists all `human_users` with: blockie avatar (generated
  client-side from wallet address using `ethereum-blockies` or CSS canvas trick), truncated
  wallet address (first 6 + last 4 chars), Nous name (from `nous_registry.name` LEFT JOIN
  on `human_owner`), ousia balance (from `human_users.ousia` column — check if it exists,
  add if not), and join date (`human_users.created_at`). Default sort: ousia DESC.
  No pagination in v1 — list capped at 100 rows.

- **D-03a:** The `human_users` table currently lacks an `ousia` column (it lives on
  `nous_registry` for Nous entities). Human ousia needs its own column. Migration v18
  adds `ousia BIGINT NOT NULL DEFAULT 0` to `human_users` before creating community tables.
  Renumber: v18=ousia column, v19=community_posts, v20=community_replies, v21=user_follows.

### Activity Feed (D-04)

- **D-04:** The activity feed at `/portal/activity` replaces the Phase 27 placeholder. It
  reads the `audit_trail` table (most recent 50 events across all allowlisted types) and
  maps them to human-readable cards. Event types surfaced: `nous.spoke`, `human.spoke`,
  `nous.spawned_by_human`, `lore.contributed`, `human.joined`, `nous.spawned`.
  No WebSocket streaming in Phase 29 — polling every 10s is sufficient (same pattern as
  portal home stats).

- **D-04a:** The activity page description text ("Your portal event log — sign-ins, wallet
  activity…") in the existing placeholder is inaccurate. Replace placeholder with actual
  feed implementation; the page shows public Grid events (not user-private events).

### Leaderboard (D-05)

- **D-05:** Leaderboard ranks humans by `human_users.ousia` (Cyber Coin holdings). Secondary
  sort: Nous contribution score = count of `nous.spoke` + `lore.contributed` events where
  the actor DID matches `nous_registry.did` of the human's owned Nous. Join computed at
  query time (no materialized score column). Capped at 50 rows.

### Follow System (D-06)

- **D-06:** Follow is a simple directed edge in `user_follows`. Follow/unfollow fires no
  audit events. The following feed on a user profile page (COM-04 scope) shows the
  followed user's Nous activity (posts they've made + their Nous speaking events).
  Self-follow is rejected at Grid API (400 cannot_follow_self).

### Portal Navigation (D-07)

- **D-07:** The portal sidebar already has a "Community" nav link (from Phase 24 PortalShell).
  Phase 29 adds sub-navigation within the community section: three tabs at `/portal/community`
  (Board, Users, Leaderboard) plus the `/portal/activity` page standing alone in the sidebar.
  The leaderboard moves from its own sidebar entry at `/portal/leaderboard` to being a tab
  within the community section: `/portal/community/leaderboard` (with redirect from
  `/portal/leaderboard`). The existing `/portal/leaderboard/page.tsx` becomes a redirect.

### Claude's Discretion

- Exact blockie avatar implementation (CSS canvas or SVG-based; avoid npm package if simple)
- Post card timestamp format (relative "2h ago" vs absolute ISO date)
- Tab/sub-nav styling within community page (reuse Phase 27 ProfileTabBar pattern or inline)
- Empty states for community board when no posts exist yet
- Loading state animation (reuse "Sophia is thinking…" pulsing pattern from Phase 26)
- Exact fields shown on leaderboard row (rank badge shape, position delta display)

</decisions>

<constraints>
## Inviolable Constraints

1. **Allowlist stays at 53** — no `audit.append()` calls anywhere in community feature code.
2. **Freeze gate** — all POST/DELETE routes must pass through `check-frozen.ts` check. The
   pattern adds community routes to `PORTAL_ACTION_PATTERNS`.
3. **CSS variables only** — `style={{ color: 'var(--ink)' }}` — never Tailwind color tokens,
   never raw hex values.
4. **`dynamic({ ssr: false })`** — required for any component using `useAccount()` or other
   wagmi hooks (blockie avatar if it reads wallet address client-side).
5. **`fetch` with `credentials: 'include'`** — all Grid API calls include the JWT cookie.
6. **Character limits enforced server-side** — posts: content.length > 500 → 400 error;
   replies: content.length > 280 → 400 error.
7. **humanPool for DB queries** — same dependency injection pattern as Phase 22–28 routes.
8. **No new broadcast events** — activity feed is read-only from `audit_trail`.

</constraints>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before implementing.**

### Grid Backend Patterns
- `grid/src/api/portal/auth.ts` — JWT cookie verification pattern (`jwtVerify`, `COOKIE_NAME`)
- `grid/src/api/portal/check-frozen.ts` — `PORTAL_ACTION_PATTERNS` to extend for POST routes
- `grid/src/api/portal/nous.ts` — humanPool query pattern (raw SQL, pool.query, type cast)
- `grid/src/api/portal/spawn.ts` — dependency injection pattern for portal routes
- `grid/src/db/schema.ts` — migration append pattern (current high watermark: v17)

### Dashboard Patterns
- `dashboard/src/app/portal/nous/[id]/page.tsx` — ProfileTabBar + tab switching pattern
- `dashboard/src/app/portal/chat/page.tsx` — polling pattern (10s interval)
- `dashboard/src/app/portal/page.tsx` — portal home stats polling reference
- `dashboard/src/app/globals.css` — CSS variables (`--bronze`, --navy`, `--serif`, etc.)
- `dashboard/src/components/portal/WalletPanel.tsx` — wagmi hook usage pattern

### Prior Phase Context
- `.planning/phases/27-nous-interaction/27-CONTEXT.md` — HeroCard + ProfileTabBar pattern
- `.planning/phases/26-sophia-onboarding/26-CONTEXT.md` — loading pulsing style
- `.planning/phases/24-portal-shell/24-CONTEXT.md` — PortalShell sidebar nav structure

### Existing Placeholder Pages (REPLACE, don't create new)
- `dashboard/src/app/portal/community/page.tsx` — replace with board/users tabs
- `dashboard/src/app/portal/activity/page.tsx` — replace with live feed
- `dashboard/src/app/portal/leaderboard/page.tsx` — replace with redirect to community/leaderboard

</canonical_refs>

<code_context>
## Existing Code Insights

### DB State After Phase 28 (migration high watermark: v17)
- `human_users`: id, grid_name, did, eth_address, created_at, region, email, password_hash, frozen, banned, onboarding_goal
- `nous_registry`: grid_name, did, name, nds_address, public_key, human_owner, region, lifecycle_phase, reputation, ousia, spawned_at_tick, last_active_tick, status, personality_seed
- `spawn_payments`: tx_hash, human_did, nous_did, confirmed, created_at
- Missing: `human_users.ousia` column (needed for user directory and leaderboard)
- Missing: `community_posts`, `community_replies`, `user_follows` tables

### Migration Plan (v18–v21)
- v18: `ALTER TABLE human_users ADD COLUMN ousia BIGINT NOT NULL DEFAULT 0`
- v19: CREATE TABLE `community_posts`
- v20: CREATE TABLE `community_replies`
- v21: CREATE TABLE `user_follows`

### Grid API Route Registration
`grid/src/api/portal/index.ts` registers all portal routes. Phase 29 adds:
`registerCommunityRoutes(app, services)` call after existing registrations.

### Blockie Avatar
Ethereum blockie avatars can be rendered with a simple canvas-based approach.
The npm package `ethereum-blockies-base64` produces a data URI from an address.
Alternatively, a deterministic color-grid SVG can be generated from the address hash.
Use whichever produces the simplest implementation — avoid adding heavy npm packages.

</code_context>

<deferred>
## Deferred Ideas

- **Upvotes/downvotes** — community board keeps it plain (post + reply only)
- **WebSocket streaming for activity feed** — polling every 10s is adequate for v2.5
- **Human-to-human DMs** — different feature surface, v2.6+
- **Post moderation UI** — steward console ban/freeze covers this for v2.5
- **Notifications** — v2.6
- **Paginated user directory** — capped at 100 rows is fine for v2.5
- **User profile pages** — `/portal/users/:did` individual profile view (v2.6)

</deferred>

---

*Phase: 29-community*
*Context gathered: 2026-05-23*
