---
phase: 25a
plan: 06
type: execute
wave: 4
depends_on: [25a-02, 25a-04, 25a-05]
files_modified:
  - steward/src/app/firehose/page.tsx
  - steward/src/app/humans/[did]/page.tsx
  - steward/src/app/nous/[id]/page.tsx
  - steward/src/app/system/page.tsx
  - steward/src/app/users/page.tsx
  - steward/src/components/StewardShell.tsx
autonomous: true
requirements: [OBS-FIREHOSE, OBS-COGNITIVE-INSPECTOR, OBS-BRAIN-HEALTH, OBS-ALLOWLIST-MONITOR, OBS-HUMANS]
tags: [steward, ui, firehose, cognitive-inspector, brain-health, allowlist-monitor, humans]
user_setup: []
must_haves:
  truths:
    - "/firehose route renders a WebSocket-tailed list of allowlisted events with family-color-coded 1-line rows"
    - "/firehose connection status pill shows Connecting / Connected / Disconnected (with exponential backoff countdown)"
    - "/firehose pauses auto-scroll on viewport hover, resumes on leave"
    - "/humans/[did] route renders header card + 3 tabs (Profile, History, Nous) per UI-SPEC"
    - "/humans/[did] shows 'Human not found.' inline on 404, no redirect"
    - "/users page DID cells deep-link to /humans/[did]"
    - "Cognitive Inspector card on /nous/[id] renders 5 sections: hashes, counts, drive bars (5 named drives), skill titles (K=10), sleep+creed metadata"
    - "Brain Health 2×2 grid on /nous/[id] renders 4 cards (Tick Performance, Memory Stores, Drive & Sleep, Coherence)"
    - "Allowlist Monitor on /system renders Drift Alert Panel (5s polling) + Static Reference Table"
    - "Drift Alert Panel shows green confirmation state when 0 entries (positive confirmation, not absence)"
    - "StewardShell sidebar includes /firehose and /humans nav items"
  artifacts:
    - path: "steward/src/app/firehose/page.tsx"
      provides: "Live firehose WebSocket UI"
      min_lines: 150
    - path: "steward/src/app/humans/[did]/page.tsx"
      provides: "Human drill-down profile + history + Nous roster"
      min_lines: 200
    - path: "steward/src/app/nous/[id]/page.tsx"
      provides: "Existing Nous detail + Cognitive Inspector card + Brain Health 2x2 grid"
      contains: "Cognitive Inspector|Brain Health"
    - path: "steward/src/app/system/page.tsx"
      provides: "Existing system page + Allowlist Monitor section"
      contains: "Allowlist Monitor|Drift Alert"
  key_links:
    - from: "steward/src/app/firehose/page.tsx"
      to: "Grid WS endpoint /api/v1/audit/firehose"
      via: "new WebSocket(GRID_ORIGIN.replace(/^http/, 'ws') + ...)"
      pattern: "/api/v1/audit/firehose"
    - from: "steward/src/app/humans/[did]/page.tsx"
      to: "Grid REST /api/v1/humans/:did and /api/v1/humans/:did/history"
      via: "fetch in useEffect"
      pattern: "/api/v1/humans/"
    - from: "steward/src/app/nous/[id]/page.tsx"
      to: "Grid REST POST /api/v1/operator/nous/:did/cognitive-snapshot"
      via: "fetch with body {tier: 'H3', operator_id}"
      pattern: "cognitive-snapshot"
    - from: "steward/src/app/system/page.tsx"
      to: "Grid REST /api/v1/audit/drift-alerts"
      via: "setInterval poll"
      pattern: "/api/v1/audit/drift-alerts"
---

<objective>
Ship the five Steward UI surfaces that consume the backends built in Plans 02-05:

1. `/firehose` — new page, WebSocket-tailed event stream with family-color rows (D-25a-14)
2. `/humans/[did]` — new drill-down page with Profile, History, Nous tabs (D-25a-18)
3. Cognitive Inspector card — inline on `/nous/[id]`, calls Grid H3 proxy (D-25a-02..05)
4. Brain Health 2×2 grid — inline on `/nous/[id]`, audit-aggregation + tick-metrics
5. Allowlist Monitor — inline on `/system`, drift panel + static reference (D-25a-16, D-25a-17)

Plus: nav additions in StewardShell, and `/users` DID cells become deep-links to `/humans/[did]` (D-25a-19).

All UI per the locked `.planning/phases/25a-observer-surfaces/25a-UI-SPEC.md` (the design contract — copywriting, colors, spacing, typography, accessibility are all specified there verbatim).

Purpose: This is the user-visible surface of 25a. Every backend from Plans 02-05 is consumed here, no functionality goes unused.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/25a-observer-surfaces/25a-CONTEXT.md
@.planning/phases/25a-observer-surfaces/25a-UI-SPEC.md
@.planning/phases/25a-observer-surfaces/25a-PATTERNS.md
@.planning/phases/25a-observer-surfaces/25a-RESEARCH.md
@steward/src/components/StewardShell.tsx
@steward/src/app/audit/page.tsx
@steward/src/app/users/page.tsx
@steward/src/app/nous/[id]/page.tsx
@steward/src/app/system/page.tsx
@steward/src/app/globals.css

<interfaces>
<!-- Grid endpoint contracts (consumed by this plan) -->

WS GET /api/v1/audit/firehose
  Frames: HelloFrame {type:'hello', serverTime, gridName}, EventFrame {type:'event', entry: AuditEntry}

REST GET /api/v1/audit/drift-alerts → { alerts: DriftAlert[] }
REST GET /api/v1/humans/:did → { did, eth_address, grid_name, region, created_at, last_active, nous_count, transfer_count }
REST GET /api/v1/humans/:did/history → { siwe_sessions, transfers, whispers_sent, regions_visited }
REST GET /api/v1/nous/:did/tick-metrics → { p50, p95, queue_depth, sample_count }
REST POST /api/v1/operator/nous/:did/cognitive-snapshot
  Body: { tier: 'H3', operator_id: string }
  → 6-key response: { drive_levels, last_sleep_tick, reflexion_count, rule_count, skill_titles_topk, creed_violation_count }

REST GET /api/v1/audit/trail?type=<eventType>&actor=<did>&limit=<n> → existing endpoint (used for Brain Health families 2-4)

<!-- Drive name enum (UI must render these 5 exact strings) -->
HUNGER | CURIOSITY | SAFETY | BOREDOM | LONELINESS

<!-- Event family prefixes for /firehose color coding -->
operator. | nous. | trade. | law. | iris. | skill. | norm. | lore. | human. | ananke.
(see UI-SPEC §"Event-Family Color Palette for /firehose" for exact hex values)

<!-- GRID_ORIGIN pattern (all steward pages) -->
const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: /firehose page + StewardShell nav + Allowlist Monitor on /system</name>
  <read_first>
    - .planning/phases/25a-observer-surfaces/25a-UI-SPEC.md §"Surface 1: /firehose" + §"Surface 4: Allowlist Monitor" + §"Copywriting Contract" + §"Accessibility Contract" + §"Event-Family Color Palette"
    - steward/src/app/audit/page.tsx (full file — fetch+render skeleton, GRID_ORIGIN const, truncateDid/relativeTime helpers, StewardShell wrap pattern)
    - steward/src/app/users/page.tsx (lines 1-145 — loading/error styling, Promise.allSettled pattern, inline-styled muted text)
    - steward/src/components/StewardShell.tsx (full file — existing nav array; add 2 new items)
    - steward/src/app/system/page.tsx (full file — find where new "Allowlist Monitor" section mounts; per UI-SPEC after Regions card)
    - steward/src/app/globals.css :root block — confirm CSS variable names match UI-SPEC color table
    - grid/src/audit/broadcast-allowlist.ts (extract `ALLOWLIST_MEMBERS` array — needed for static reference table; can either re-export or hardcode the 45 strings)
  </read_first>
  <action>
    1. **StewardShell nav (modify steward/src/components/StewardShell.tsx):**
       - Locate the existing nav-items array (sidebar items).
       - Add two entries: `{ href: '/firehose', label: 'Firehose' }` and `{ href: '/humans', label: 'Humans' }` — exact label text matches UI-SPEC navigation conventions; position alphabetically among existing items.
       - Note: `/humans` is the existing roster path (`/users` continues to exist; the sidebar nav can show "Users" pointing to `/users` and a new "Humans" link is optional — but UI-SPEC instructs adding `/humans` separately. If sidebar already lists "Users" use that label and route; do NOT duplicate). Final rule: at MINIMUM add `/firehose` to nav. `/humans/[did]` is a drill-down reached via `/users` deep-links (Task 3) — no separate nav item needed unless UI-SPEC explicitly demands it.

    2. **Create steward/src/app/firehose/page.tsx** (per UI-SPEC Surface 1):
       - `'use client'` at top
       - Imports: `useEffect, useState, useRef` from react; `StewardShell` from `@/components/StewardShell`
       - `const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';`
       - Constants:
         - `EVENT_FAMILY_COLORS`: object mapping family prefix → `{ leftBorder, badgeBg, badgeText }` exactly per UI-SPEC §"Event-Family Color Palette" (10 families + unknown fallback)
         - `MAX_BUFFER = 200` (ring buffer of buffered rows when paused)
       - State: `events[]`, `connected: 'connecting'|'connected'|'disconnected'`, `retryCountdown: number`, `isPaused: boolean`
       - useEffect: open `new WebSocket(GRID_ORIGIN.replace(/^http/, 'ws') + '/api/v1/audit/firehose')` (append `?token=${GRID_WS_SECRET}` from `process.env.NEXT_PUBLIC_GRID_WS_TOKEN` if available — match existing /ws/events client pattern in this codebase if one exists; otherwise omit token)
       - On 'message': parse JSON; if `frame.type === 'event'` append to events array (cap at 500 rows for memory)
       - On 'close': set disconnected; start exponential backoff (1s → 2s → 4s, cap 30s); countdown timer updates retryCountdown every second
       - Cleanup: close socket on unmount
       - Render via StewardShell: `title="Live Firehose"`, `breadcrumb="Steward · Firehose"`
       - Inside: connection status pill (per UI-SPEC), status bar ("N events · WebSocket connected · auto-scroll ON"), then a scrollable viewport `<div ref={viewportRef} onMouseEnter={()=>setIsPaused(true)} onMouseLeave={()=>setIsPaused(false)}>`
       - Rows as `<table><tbody><tr>...</tr></tbody></table>` for keyboard traversal accessibility
       - Each row: family dot (6px circle, `aria-label="{family} event"`) | timestamp (`HH:MM:SS.mmm`, 80px fixed) | event-type badge (10px mono, family colors) | actor DID truncated (8+…+6)
       - Row height 32px, left-border 3px family color, hover `background: rgba(0,0,0,0.03)`
       - Auto-scroll effect: when not paused AND new event arrives, `viewportRef.current.scrollTop = scrollHeight`
       - Pause indicator: fixed pill at bottom of viewport, terracotta tint, fade transition 150ms (CSS class with `transition: opacity 150ms`)
       - Copy strings VERBATIM from UI-SPEC §"Copywriting Contract"
       - Color values VERBATIM from UI-SPEC tables (no token substitution allowed for event-family hex values)

    3. **Modify steward/src/app/system/page.tsx** (append Allowlist Monitor section per UI-SPEC Surface 4):
       - Append after existing "Regions" card:
       - Section heading: `<h2>Allowlist Monitor</h2>` (10px mono uppercase eyebrow + serif heading per UI-SPEC)
       - **Drift Alert Panel** (ABOVE static reference per UI-SPEC):
         - useState `driftAlerts: DriftAlert[]`, `lastUpdated: number`
         - useEffect with `setInterval` 5s polling `GET /api/v1/audit/drift-alerts`
         - "Last updated Xs ago" counter via separate 1s interval
         - When `driftAlerts.length === 0` → render GREEN confirmation state: `background: rgba(34,139,34,0.06)`, `border-color: rgba(34,139,34,0.3)`, text `color: #2d7a2d`, copy: "No drift detected. All runtime emissions are allowlisted."
         - When `driftAlerts.length > 0` → render RED/terracotta alert panel: `background: rgba(184,84,47,0.08)`, `border-left: 4px solid var(--terracotta)`, table with columns: Event Type, Actor DID (truncated), Tick, Detected At (relative)
         - `role="alert"` on panel; `aria-live="polite"` on count badge
       - **Static Reference Table:**
         - Card title: "Allowlisted Events" + count badge "{N} events" (N = ALLOWLIST_MEMBERS.length)
         - Source: hardcode the 45 event names from `grid/src/audit/broadcast-allowlist.ts` `ALLOWLIST_MEMBERS` as a TypeScript const in this file (acceptable per RESEARCH §"Static Reference Data"; build-time generation is also acceptable — pick the simpler path)
         - For each event: position (1-indexed), event name, producer file path (manually curated short string), payload key list (manually curated — sourced from STATE.md "Locked payload shapes")
         - Acceptable simplification: for the 25a MVP, if curating all 45 producer/payload details is excessive, render only `Position` + `Event Type` columns. Producer/payload columns can show `—` for events lacking a curated entry. UI-SPEC permits this density-first table.
       - Copy + styling per UI-SPEC §"Copywriting Contract" + Surface 4 contract

    4. **Verification (manual + automated):**
       - Run `cd steward && npx tsc --noEmit` — must pass (typecheck only; Steward has no vitest)
       - Run `cd steward && npm run build` — Next.js build must succeed
       - Manual verify (recorded in PLAN execution log, no automation): `/firehose` renders, status pill shows connected, rows scroll; `/system` shows Allowlist Monitor section
  </action>
  <verify>
    <automated>cd steward && npx tsc --noEmit && npm run build 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `test -f steward/src/app/firehose/page.tsx`
    - `grep -c "use client" steward/src/app/firehose/page.tsx` returns 1
    - `grep -n "/api/v1/audit/firehose" steward/src/app/firehose/page.tsx` returns a match
    - `grep -n "EVENT_FAMILY_COLORS\\|family.*color\\|leftBorder" steward/src/app/firehose/page.tsx` confirms family color table
    - `grep -nE "operator\\.|nous\\.|trade\\.|law\\.|iris\\.|skill\\.|norm\\.|lore\\.|human\\.|ananke\\." steward/src/app/firehose/page.tsx` returns matches for all 10 family prefixes
    - `grep -n "/firehose" steward/src/components/StewardShell.tsx` returns a match (nav link added)
    - `grep -n "Allowlist Monitor\\|Drift Alert" steward/src/app/system/page.tsx` returns matches
    - `grep -n "/api/v1/audit/drift-alerts" steward/src/app/system/page.tsx` returns a match
    - `grep -n "No drift detected" steward/src/app/system/page.tsx` returns a match (positive empty state)
    - `cd steward && npx tsc --noEmit` exits 0
    - `cd steward && npm run build` exits 0
  </acceptance_criteria>
  <done>/firehose ships per UI-SPEC; nav updated; Allowlist Monitor on /system with drift panel + static reference; Next.js build green.</done>
</task>

<task type="auto">
  <name>Task 2: Cognitive Inspector + Brain Health cards on /nous/[id]</name>
  <read_first>
    - .planning/phases/25a-observer-surfaces/25a-UI-SPEC.md §"Surface 2: Cognitive Inspector" + §"Surface 3: Brain Health Metrics" + Correction Notice (drive names HUNGER/CURIOSITY/SAFETY/BOREDOM/LONELINESS)
    - steward/src/app/nous/[id]/page.tsx (full file — confirm where existing Brain State card mounts; new cards mount AFTER it, BEFORE "Force Telos")
    - steward/src/app/globals.css `.steward-card` and `.steward-stat-card` (confirm classes exist and CSS rules)
  </read_first>
  <action>
    1. Edit `steward/src/app/nous/[id]/page.tsx`. Add state + fetch for cognitive snapshot:
       - useState `cognitive: CognitiveSnapshotResponse | null`, `cogLoading: boolean`, `cogError: string | null`
       - In existing useEffect (or a new sibling useEffect), POST to `${GRID_ORIGIN}/api/v1/operator/nous/${did}/cognitive-snapshot` with body `{tier: 'H3', operator_id: 'op:steward:default'}` (operator_id may be empty/dev placeholder per existing Steward patterns — confirm via reading other operator POSTs in the codebase)
       - Handle 200, 403 (display H3+ required message), 503 (display Brain offline message)
    2. Add state + fetch for Brain Health:
       - tick-metrics: `GET /api/v1/nous/:did/tick-metrics`
       - audit aggregations (families 2-4): use existing `GET /api/v1/audit/trail?type=<eventType>&actor=<did>&limit=200` for each of: `nous.reflection_authored`, `skill.taught`, `skill.inferred`, `nous.self_model_revised`, `ananke.drive_crossed`, `nous.sleep.entered`, `nous.sleep.completed`, `nous.creed_violation`
       - Compute counts client-side from response arrays
    3. **Cognitive Inspector card** (per UI-SPEC Surface 2):
       - `<section className="steward-card">` with eyebrow "Cognitive Inspector" + H3+ tier badge
       - Hashes row (3 pills) — reuse mem/creed/skill hashes from EXISTING brain-state fetch (do not refetch)
       - Counts row (3 stat cells): Reflexion Buffer (reflexion_count), Self-Model Rules (rule_count), Creed Violations (creed_violation_count)
       - Drive bars: 5 bars in order HUNGER, CURIOSITY, SAFETY, BOREDOM, LONELINESS; fill colors per UI-SPEC table; `role="meter"`, `aria-valuenow={level*100}`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-label="{Drive} drive level"`
       - Skill titles section: render `skill_titles_topk` as plain text list (K up to 10), 13px sans; truncate >60 chars with `title=` attribute; empty state "No skills recorded."
       - Sleep + creed metadata row: Last Sleep Tick (toLocaleString or "Never" if 0)
       - Loading state: each section shows `…`; do not block card render
       - 403 state: copy verbatim from UI-SPEC "H3+ operator tier required to access cognitive snapshot."
       - 503 state: "Cognitive snapshot unavailable — Brain offline."
    4. **Brain Health 2×2 grid** (per UI-SPEC Surface 3):
       - Section heading "Brain Health" + sub-label "Derived from existing audit events — read-only"
       - 4 cards (using `.steward-stat-card` class — parchment bg, terracotta stripe):
         - **Card A: Tick Performance** — from tick-metrics fetch: p50ms, p95ms (large numerics), queue_depth + sample_count below. 404 → "Tick metrics unavailable."
         - **Card B: Memory Stores** — 3 stacked stats: Reflexion buffer (count `nous.reflection_authored` for did), Skill store size (count of `skill.taught` + `skill.inferred` for did), Rule count (count `nous.self_model_revised` for did). Use audit trail filter `actor=did`. If the actorDid for skill events is the Grid system DID (per Open Question 2), filter the array by `payload.learner_did === did` instead — implement BOTH and pick the working filter at execution time.
         - **Card C: Drive & Sleep** — 5 mini drive bars from last `ananke.drive_crossed` per drive (group by `payload.drive`, take latest); sleep cadence (avg delta of consecutive `nous.sleep.entered` ticks); last sleep duration (most recent `nous.sleep.completed.tick - nous.sleep.entered.tick`). Empty: "No sleep events recorded."
         - **Card D: Coherence** — single large 36px numeric of creed violation count; if > 0, color `var(--terracotta)`; else `var(--ink)`. Label "Creed Violations".
    5. Mount placement: AFTER the existing Brain State card, BEFORE the "Force Telos" form (per UI-SPEC).
    6. Run `cd steward && npx tsc --noEmit && npm run build`
  </action>
  <verify>
    <automated>cd steward && npx tsc --noEmit && npm run build 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Cognitive Inspector" steward/src/app/nous/\\[id\\]/page.tsx` returns a match
    - `grep -n "Brain Health" steward/src/app/nous/\\[id\\]/page.tsx` returns a match
    - `grep -n "cognitive-snapshot" steward/src/app/nous/\\[id\\]/page.tsx` returns a match (endpoint call)
    - `grep -nE "HUNGER|CURIOSITY|SAFETY|BOREDOM|LONELINESS" steward/src/app/nous/\\[id\\]/page.tsx` returns 5 names (drive enum rendered per Correction Notice)
    - `grep -n "ananke\\|eros\\|logos" steward/src/app/nous/\\[id\\]/page.tsx` — `ananke` may appear in event-type literals like `'ananke.drive_crossed'`; `eros` and `logos` MUST return ZERO matches (Correction Notice — these were wrong in CONTEXT)
    - `grep -n "tick-metrics\\|p50\\|p95" steward/src/app/nous/\\[id\\]/page.tsx` returns matches
    - `grep -n "role=\"meter\"" steward/src/app/nous/\\[id\\]/page.tsx` returns matches (drive bar a11y)
    - `grep -n "H3+ operator tier required\\|Brain offline\\|No skills recorded" steward/src/app/nous/\\[id\\]/page.tsx` confirms verbatim UI-SPEC copy
    - `cd steward && npx tsc --noEmit` exits 0
    - `cd steward && npm run build` exits 0
  </acceptance_criteria>
  <done>Cognitive Inspector card and Brain Health 2×2 grid both render per UI-SPEC; 5 drives named correctly; tier + 503 error states handled; ARIA correct.</done>
</task>

<task type="auto">
  <name>Task 3: /humans/[did] page + /users deep-link wiring</name>
  <read_first>
    - .planning/phases/25a-observer-surfaces/25a-UI-SPEC.md §"Surface 5: /humans/[did]" + §"Copywriting Contract" + §"Accessibility Contract" tab requirements
    - steward/src/app/nous/[id]/page.tsx (drill-down spine pattern — header card + back link + tab navigation)
    - steward/src/app/users/page.tsx (lines 170-180 — DID cell currently renders truncated DID; modify to wrap in Link)
  </read_first>
  <action>
    1. **Create steward/src/app/humans/[did]/page.tsx** (per UI-SPEC Surface 5):
       - `'use client'`
       - `useParams` from next/navigation to extract `did` param
       - State: `profile`, `history`, `loading`, `error`, `activeTab: 'profile'|'history'|'nous'`
       - useEffect with Promise.allSettled([fetch profile, fetch history, fetch nous list])
       - Render via StewardShell: `title={profile?.grid_name ?? truncateDid(did)}`, `breadcrumb={"Steward · Users · " + name}`
       - Back link: `<Link href="/users">← Back to Users</Link>` (11px mono muted)
       - 404 state: "Human not found." serif 22px, link back to `/users`. No redirect.
       - **Header card** (`.steward-card`, full width):
         - name + truncated DID
         - flexbox row: wallet (6+…+4), joined (date), region, last_active (relative), Nous count, Transfers count
         - Tooltip on Transfers label: "On-chain balance not available — showing transfer event count."
       - **Tab bar** (per UI-SPEC §"Tabbed sections"):
         - `<div role="tablist">` with 3 `<button role="tab" aria-selected={...}>` for Profile / History / Nous
         - Arrow key handling (left/right switches tabs)
         - Focus ring: `outline: 2px solid var(--terracotta)`, offset 2px
       - **Tab 1 (Profile)**: labeled-value grid (3-col CSS grid) with Wallet Address, Joined, Region, Last Active, DID. No copy-to-clipboard.
       - **Tab 2 (History)**: 4 sub-section cards, each `.steward-card`:
         - SIWE Sessions (timestamp, event type)
         - Cyber Coin Transfers (timestamp, tick, asset)
         - Whispers Sent (timestamp, tick, to_did truncated)
         - Regions Visited (timestamp, region)
         - Each table shows up to 20 rows; if 0 entries, "No {type} events found." centered
       - **Tab 3 (Nous)**: roster table filtered by `humanOwner === did` (call `/api/v1/grid/nous` if endpoint exists; otherwise read from existing Dashboard pattern). Empty: "No Nous owned by this human." No sanction stubs (UI-SPEC explicit prohibition).
       - Copy strings VERBATIM from UI-SPEC §"Copywriting Contract"
    2. **Modify steward/src/app/users/page.tsx** (deep-link wiring per D-25a-19):
       - Find DID cell (per RESEARCH at lines 174-178)
       - Wrap with `<Link href={\`/humans/${u.did}\`}>{truncateDid(u.did)}</Link>` from `next/link`
       - Inline style: keep mono/muted; add hover via inline event handler OR `:hover` className → terracotta text on hover
       - Keep all other columns unchanged (surgical change)
    3. Run `cd steward && npx tsc --noEmit && npm run build`
  </action>
  <verify>
    <automated>cd steward && npx tsc --noEmit && npm run build 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `test -f steward/src/app/humans/\\[did\\]/page.tsx`
    - `grep -c "use client" steward/src/app/humans/\\[did\\]/page.tsx` returns 1
    - `grep -nE "/api/v1/humans/" steward/src/app/humans/\\[did\\]/page.tsx` returns ≥2 matches (profile + history)
    - `grep -n "role=\"tablist\"\\|role=\"tab\"\\|aria-selected" steward/src/app/humans/\\[did\\]/page.tsx` confirms a11y tab pattern
    - `grep -n "Human not found\\|No Nous owned by this human\\|On-chain balance not available" steward/src/app/humans/\\[did\\]/page.tsx` confirms verbatim copy
    - `grep -n "← Back to Users" steward/src/app/humans/\\[did\\]/page.tsx` confirms back link copy
    - `grep -n "Link.*humans" steward/src/app/users/page.tsx` confirms deep-link wiring on /users DID cells
    - `grep -nE "ban-human|freeze-wallet|sanction" steward/src/app/humans/\\[did\\]/page.tsx` returns ZERO matches (25b scope — explicit prohibition)
    - `cd steward && npx tsc --noEmit` exits 0
    - `cd steward && npm run build` exits 0
  </acceptance_criteria>
  <done>/humans/[did] ships with full 3-tab UI, accessibility-correct tabs, all 4 history sub-sections, /users deep-link wired, no sanction stubs.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Grid (WS + REST) | Steward UI initiates all data fetches; Grid validates tier where required |
| Steward UI rendering | DOM XSS — audit event payload values must be safely rendered |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-25a-06-01 | Information Disclosure | Steward bypasses Grid and calls Brain directly | mitigate | Steward never imports Brain URL; `cognitive-snapshot` is fetched ONLY via Grid `/api/v1/operator/nous/:did/cognitive-snapshot`; CI grep test: `grep "brain\\..*cognitive" steward/src/` returns 0 (Steward → Grid only) |
| T-25a-06-02 | Information Disclosure | Drive bars render incorrect/leaky drive names | mitigate | UI-SPEC Correction Notice locks the 5 names (HUNGER/CURIOSITY/SAFETY/BOREDOM/LONELINESS); grep test asserts these strings present and `eros|logos` absent |
| T-25a-06-03 | Information Disclosure | Skill title bodies leak via tooltip or copy-paste | mitigate | Cognitive Inspector renders `skill_titles_topk` (titles only — per Plan 03 endpoint contract); no body field exists in response |
| T-25a-06-04 | Tampering | XSS via event payload in /firehose row | mitigate | React's default escaping protects text content; never use `dangerouslySetInnerHTML`; CI grep: `grep -n "dangerouslySetInnerHTML" steward/src/app/firehose/ steward/src/app/humans/` returns 0 |
| T-25a-06-05 | Denial of Service | /firehose event array grows unbounded | mitigate | Cap stored events at 500; on overflow, drop oldest (client-side ring buffer) |
| T-25a-06-06 | Information Disclosure | 25b sanction controls render stubs accidentally | mitigate | UI-SPEC explicit prohibition; CI grep: `ban-human|freeze-wallet|sanction` returns 0 in /humans/[did]/page.tsx |
| T-25a-06-07 | Elevation of Privilege | UI exposes H3-tier badge / messaging without tier validation | accept | Grid enforces tier; UI tier badge is cosmetic; 25a out-of-scope for client-side tier UI |
</threat_model>

<verification>
- /firehose, /humans/[did], /system Allowlist Monitor, /nous/[id] Cognitive Inspector + Brain Health all ship per UI-SPEC
- All copy strings match UI-SPEC §"Copywriting Contract" verbatim
- All 5 drive names rendered correctly (HUNGER/CURIOSITY/SAFETY/BOREDOM/LONELINESS); eros/logos absent
- /users → /humans/[did] deep-link wired
- ARIA roles/labels correct for tabs, drive meters, drift alert
- No sanction stubs (25b scope)
- No direct Brain calls from Steward (Grid proxy only)
- Next.js build green; tsc clean
</verification>

<success_criteria>
- D-25a-14 (firehose UI): SHIPPED
- D-25a-02..05 (Cognitive Inspector UI): SHIPPED — H3 tier badge, drive bars, skill titles, sleep+creed metadata
- D-25a-06 (Brain Health 4-card grid): SHIPPED
- D-25a-16 (Drift Alert Panel): SHIPPED — green confirmation on 0, red panel on >0
- D-25a-17 (Static reference + drift detector): SHIPPED
- D-25a-18 (/humans/[did] 3-tab drill-down): SHIPPED
- D-25a-19 (/users deep-link): SHIPPED
- UI-SPEC Correction Notice honored (correct 5 drive names everywhere)
</success_criteria>

<output>
After completion, create `.planning/phases/25a-observer-surfaces/25a-06-SUMMARY.md` documenting:
- All 6 modified/created Steward files
- All consumed endpoints (WS + 5 REST endpoints)
- Confirmation grep results for: drive names, sanction-stub absence, brain-direct-call absence, dangerouslySetInnerHTML absence
- Manual smoke test checklist for operator validation (each surface visually verified)
- Decision IDs implemented: D-25a-02, D-25a-04, D-25a-06, D-25a-14, D-25a-16, D-25a-17, D-25a-18, D-25a-19
</output>
