# Phase 26: Sophia Onboarding — Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the first-time user onboarding wizard at `/portal/onboard`. Detect new users (no prior activity), route them through a 3-effective-step wizard (Welcome → Sophia greeting + goal capture → World tour), store the captured goal in `human_users.onboarding_goal`, and return them to the main portal. No new audit events. Allowlist delta: 0.

**Requirements covered:** ONBOARD-01 through ONBOARD-06.

</domain>

<decisions>
## Implementation Decisions

### Wizard Structure

- **D-01:** The 4 ONBOARD-03 steps are compressed to 3 rendered steps:
  - **Step 1 (Welcome):** Pre-scripted animated world introduction — no LLM call
  - **Step 2 (Sophia + Goal):** LLM-backed multi-turn conversation where Sophia greets the user, learns their name/interests, AND captures their goal in the same flow (steps 2 and 3 from ONBOARD-03 are merged into one Sophia chat session)
  - **Step 3 (World tour):** Pre-scripted — Sophia shows the 5 regions on the isometric map — no LLM call
- **D-02:** Only step 2 hits `POST /api/v1/portal/chat/onboard`. Steps 1 and 3 use static/pre-written copy.

### Sophia Chat UX

- **D-03:** Step 2 is multi-turn — up to 3 exchanges (Sophia message → user reply → Sophia responds, up to 3 cycles). Sophia drives the conversation naturally across greeting, name/interests, and goal.
- **D-04:** Sophia's messages appear as **full text after a loading indicator** for simplicity (no streaming SSE infra needed). Target: ~2s per response (ONBOARD-02). Loading state shows a pulsing avatar or "Sophia is thinking…" indicator.
- **D-05:** Progression out of step 2: Sophia concludes with a natural closing line (e.g., "I think we're ready — shall we explore the world?") and a **Continue button** appears. User taps Continue explicitly. No auto-advance.

### Goal Capture

- **D-06:** Goal is captured organically during step 2's multi-turn conversation. There is no separate dedicated goal step. Sophia asks something like "What draws you here — what are you hoping to find?" in the flow of conversation. User types a free-form reply.
  - **SUPERSEDED (2026-06-10):** Step 2 is no longer an LLM chat — it is a static registration guide (Portal-first registration framing, D-V3-33). Goal is now set from the user's chosen next action (or the default `'Exploring Noēsis'` on skip). See `docs/plans/2026-06-10-onboarding-registration-guide-design.md`. Reason: LLM-gated onboarding hard-blocked all new users whenever Ollama was unreachable (production incident 2026-06-10).
- **D-07:** The goal text stored in `human_users.onboarding_goal` comes from the user's final substantive reply in step 2 (the message that most directly answers the goal prompt). Extraction: either pass the full conversation to the LLM with instruction to identify the goal sentence, or store the last user message verbatim. Claude's discretion on extraction approach.
- **D-08:** Goal is stored to DB via `PATCH /api/v1/portal/auth/me` (new endpoint, or extend existing) before step 3 begins. If storage fails, log it but don't block the wizard.

### Welcome Scene (Claude's Discretion — user did not select for discussion)

- **D-09 (Claude):** Reuse `CyberGrid.tsx` as an animated background (same pattern as `portal/auth/page.tsx`). Overlay: Noēsis logotype + a one-paragraph world intro narration using `--serif` typography. Brief (5–10 seconds read time). Continue button visible immediately.

### World Tour (Claude's Discretion — user did not select for discussion)

- **D-10 (Claude):** Step 3 reuses CyberGrid with pre-scripted district highlight narration (cycle through AI_CORE → HUB → DATA → DARKWEB → RESIDENTIAL with tooltip panels). Static labels from Sophia. No LLM call. Continue ends the wizard.

### Skip / Re-entry (Claude's Discretion — user did not select for discussion)

- **D-11 (Claude):** No skip button on the wizard — onboarding is required for first-time users (ONBOARD-01). If user navigates away mid-wizard, next portal visit re-starts from step 1. Returning users (onboarding_goal IS NOT NULL) bypass `/portal/onboard` automatically. No re-do path in v2.5.
  - **SUPERSEDED (2026-06-10):** A persistent "Skip the guide — browse as visitor" link now exists on every step (user decision: most users want a quick start). Skip PATCHes the default goal so the derived `onboarded` contract (D-12) is preserved. Registration is encouraged, not forced — D-V3-33 gates Grid participation, not Portal reading.

### First-time Detection

- **D-12:** A user is "first-time" if `human_users.onboarding_goal IS NULL` (set on account creation). The `/me` endpoint should return `onboarded: boolean`. Next.js middleware (or `portal/layout.tsx`) redirects to `/portal/onboard` when `onboarded` is false.

### DB Migration

- **D-13:** Migration adds `onboarding_goal TEXT NULL DEFAULT NULL` column to `human_users`. Schema version 14 (versions 11, 12, 13 were applied by Phases 22–25b — RESEARCH.md confirms this from the live schema.ts). Uses existing `MigrationRunner` pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/research/v2.5-requirements.md` §ONBOARD — ONBOARD-01 through ONBOARD-06 define the full onboarding scope; read all 6 before planning
- `.planning/research/v2.5-requirements.md` §PORTAL — PORTAL-02 defines the `/portal/onboard` route in the portal route namespace

### Existing Portal Code (read before writing plans)
- `dashboard/src/app/portal/auth/page.tsx` — reference for CyberGrid background pattern + CSS variable usage + `dynamic({ ssr: false })`
- `dashboard/src/components/portal/CyberGrid.tsx` — isometric city canvas; use as background for welcome and world tour steps
- `dashboard/src/components/portal/PortalShell.tsx` — shell wrapper; onboard page is OUTSIDE the shell (no sidebar) — same as auth page
- `dashboard/src/app/portal/layout.tsx` — where first-time detection + redirect to `/portal/onboard` should live
- `dashboard/src/lib/stores/human-auth-store.ts` — Zustand store; needs `onboarded: boolean` field once `/me` returns it
- `dashboard/src/app/portal/chat/page.tsx` — Phase 26 chat placeholder; NOT the onboarding chat (different route)

### Grid Backend (read before writing plans)
- `grid/src/api/portal/auth.ts` — `/me` endpoint; extend to return `onboarded: boolean`; also add `PATCH /me` or new endpoint for goal storage
- `grid/src/db/schema.ts` — migration array; Phase 26 migration is version 14 (`onboarding_goal TEXT NULL`)
- `grid/src/main.ts` — where LLM provider is configured; `POST /api/v1/portal/chat/onboard` reuses this provider config with a fixed Sophia system prompt

### Design System
- `dashboard/src/app/globals.css` (or equivalent) — CSS variables: `--navy`, `--parchment`, `--bronze`, `--ink`, `--muted`, `--serif`, `--sans-portal`; all new components use these, no raw color values

### Prior Phase Context
- `.planning/phases/24-portal-shell/24-CONTEXT.md` — establishes CSS variable pattern, PortalShell structure, portal palette decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CyberGrid.tsx`: Full isometric animated city — 7 district types with hover tooltips and click-expand panels. Import via `dynamic({ ssr: false })`. Already used on auth page as a full-screen background. Reuse for both step 1 (welcome) and step 3 (world tour with district highlighting).
- `useHumanAuthStore`: Needs `onboarded: boolean` added when `/me` is extended. Pattern already used for `did`, `eth_address`, `region`.
- `PortalWagmiShell`: Dynamic import shell at `layout.tsx` level — onboard page inherits the wagmi provider but should render WITHOUT PortalSidebar/PortalHeader (full-screen wizard, no nav chrome).

### Established Patterns
- **CSS variables only**: `style={{ color: 'var(--ink)', fontFamily: 'var(--serif)' }}` — never Tailwind color classes
- **`dynamic({ ssr: false })`**: Required for CyberGrid and any wagmi-dependent components
- **`credentials: 'include'`**: All Grid fetch calls from portal include the cookie; LLM proxy endpoint will also need this
- **Fetch-based API calls**: No dedicated API client — raw `fetch` with `credentials: 'include'`

### Integration Points
- `dashboard/src/components/portal/PortalShell.tsx` → add redirect guard: `if (!currentUser.onboarded) router.replace('/portal/onboard')` (layout.tsx is `'use client'` with no redirect capability; PortalShell already has the bypass pattern for `/portal/auth` and is the correct location — confirmed by PATTERNS.md and live code inspection)
- New route: `dashboard/src/app/portal/onboard/page.tsx` — client component (ssr: false), wizard state machine
- New Grid endpoint: `POST /api/v1/portal/chat/onboard` — fixed Sophia system prompt, multi-turn capable (accepts conversation history array)
- DB: `human_users` table gets `onboarding_goal TEXT NULL` (schema version 14)

</code_context>

<specifics>
## Specific Ideas

- Sophia persona for onboarding system prompt: warm, curious, philosophical. She should introduce herself, learn the user's name and interests organically, ask what draws them to Noēsis, and close with readiness to show the world.
- District highlight order for world tour (step 3): AI_CORE → HUB → DATA → DARKWEB → RESIDENTIAL — mirrors the journey from "where Nous think" to "where humans connect"
- The chat bubble UI for Sophia should use `--serif` for Sophia's messages (to feel philosophical) and `--sans-portal` for user input
- The Continue button across all steps: matches the portal's primary button style from PortalHeader/PortalSidebar (bronze/amber on navy)

</specifics>

<deferred>
## Deferred Ideas

- Streaming LLM responses (SSE / ReadableStream) — simpler full-text-after-spinner approach chosen for v2.5; revisit if Sophia chat in Phase 27 needs it
- Sophia re-do onboarding flow — no re-entry path in v2.5; future phase can add a "Revisit world tour" from portal settings
- Preset goal cards (Explorer / Scholar / Merchant / Guardian) — free-form text chosen; curated cards are a possible enhancement
- Sophia memory of onboarding goal in Phase 27 chat — the goal is stored but Phase 27 defines whether Sophia references it; note for Phase 27 context

</deferred>

---

*Phase: 26-sophia-onboarding*
*Context gathered: 2026-05-22*
