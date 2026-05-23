---
phase: 25c
slug: replay-scrubber-culture-browser
status: draft
shadcn_initialized: false
preset: none
created: 2026-05-22
extends: .planning/phases/25a-observer-surfaces/25a-UI-SPEC.md
---

# Phase 25c — UI Design Contract

> Visual and interaction contract for two new StewardShell observer surfaces:
> `/replay` (operator-export scrubber) and `/culture` (norm/lore/skill browser).
> This document is ADDITIVE to the 25a contract — it does not redefine palette,
> typography, spacing, card patterns, or nav structure. Read 25a-UI-SPEC.md first.

---

## Inheritance Statement

All of the following carry forward UNCHANGED from `25a-UI-SPEC.md`:

- **Design System** — hand-rolled CSS custom properties + inline styles; no shadcn, Radix, d3, react-flow, cytoscape, recharts (D-10 raw-SVG invariant carries from D-9-08)
- **Spacing scale** — xs 4 / sm 8 / md 16 / lg 20 / xl 24 / 2xl 28 / 3xl 32
- **Typography scale** — Display 34 serif / Heading 20–22 serif / Body 13 sans / Label-meta 9–12 mono
- **Color palette** — `--ink`, `--parchment`, `--vellum`, `--terracotta`, `--terracotta-2`, `--bronze`, `--rule`, `--muted`
- **60/30/10 assignment** — parchment dominant, vellum secondary, terracotta accent (reserved for: card stripe, active nav, drift, alerts, error text)
- **Card patterns** — `steward-card` (vellum bg + 3px terracotta stripe) for editable/composite sections; `steward-stat-card` (parchment bg) for metrics
- **Event-family color palette** — 11-family table from 25a applies VERBATIM. The `operator` family (`#b8542f` terracotta) governs the export row left-border + event-type badge for the replay scrubber. The `nous`, `iris`, `skill`, `norm`, `lore`, `human`, `ananke`, `law`, `trade` colors govern event rows in the scrubber modal event list.
- **Accessibility contract** — WCAG 2.1 AA minimum; desktop-first (min 1280px); focus rings `outline: 2px solid var(--terracotta)` `outline-offset: 2px`
- **StewardShell nav pattern** — section + active-link dot + border-left
- **Read-only surface communication rules** — no action buttons inside read-only surfaces; only interactivity allowed: tick slider, row click, filter selection, tab switch, modal close

If anything below conflicts with 25a, 25a wins and this document is in error.

---

## 25c-Specific Decisions

### Design system additions

None. No new tokens. No new fonts. No new component libraries. No new color values
beyond the 25a palette + event-family table.

### shadcn gate

Already evaluated in 25a: `components.json` not present, project uses no component
library. 25c MUST NOT introduce one. Recheck on each plan execution.

### Registry safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn not initialized |
| third-party | none | not applicable |

No new third-party registries declared.

---

## StewardShell Nav Extension

Add two new links to `steward/src/components/StewardShell.tsx`. Place them in a new
**"Observatory"** group positioned BETWEEN the existing "Operator" group and "Grid"
group. Group-heading style matches the existing 9px mono uppercase `--muted`
sidebar-section pattern.

```
[Operator]
  Dashboard
  Nous Roster
  Economy
  Governance
  Users
  Firehose
  Audit Log
[Observatory]   ← new
  Replay       → /replay
  Culture      → /culture
[Grid]
  System
  World Map
```

Order rationale: "Observatory" name reinforces read-only stance (matches the
Surface 4 "Allowlist Monitor" framing from 25a) and groups historical/derived
views (replay = past; culture = aggregated emergence) separately from live
operator surfaces.

Active-link treatment: identical to 25a — terracotta dot + left-border.

---

## Surface 1: /replay (Operator Export Scrubber)

**Route:** `steward/src/app/replay/page.tsx` (server component)
**Modal:** `steward/src/app/replay/replay-modal.tsx` (client component)
**StewardShell props:** `title="Replay"`, `breadcrumb="Steward · Observatory · Replay"`

### Listing Page Layout

```
StewardShell
  [page h1] "Replay"
  [page sub-label] "Operator exports — click a row to scrub through its tick range."
  [steward-card: "Operator Exports" with count badge "{N}"]
    [table]
      thead: Exported At · Operator · Tick Range · Tarball Hash
      tbody: rows (cursor: pointer)
    [empty state: "No exports recorded yet."]
```

**Important correction from RESEARCH (Pitfall 2):** The `operator.exported`
payload has NO `nous_did` field. Its actual shape is
`{tier, operator_id, start_tick, end_tick, tarball_hash, requested_at}`. The
CONTEXT D-05 column spec "Nous DID" does not exist in this event. The columns
below correct that error.

### Listing Table Columns

| Column | Content | Style | Width |
|--------|---------|-------|-------|
| Exported At | Absolute datetime from `payload.requested_at` (or `entry.createdAt` as fallback). Format: `YYYY-MM-DD HH:MM:SS` (24h) | 11px mono `--muted` | 160px |
| Operator | `payload.operator_id` (full string) | 11px mono `--ink` | auto |
| Tick Range | `{start_tick.toLocaleString()} → {end_tick.toLocaleString()}` | 11px mono `--ink`, no-wrap | auto |
| Tarball Hash | First 12 chars of `payload.tarball_hash` + `…` (full hash in `title` attr) | 11px mono `--muted` | 140px |

Row height: 36px (slightly taller than firehose to communicate "this is a clickable
record" rather than a live stream row).

Row hover: `background: rgba(184,84,47,0.06)` (lighter terracotta tint than 25a
table default to soften click affordance). `cursor: pointer`. Row also receives
`tabindex="0"` and `role="button"` with `aria-label="Open scrubber for export
{operator_id} ticks {start_tick} to {end_tick}"`.

Row left-border: 3px solid `#b8542f` (operator-family color from 25a). Reinforces
the export is an operator-tier event.

Polling: page is a Next.js server component with `cache: 'no-store'` — refresh on
nav. No client-side polling on the listing (exports are rare; users navigate
intentionally).

### Empty / Error States

| Condition | Display |
|-----------|---------|
| No exports yet | Card body: "No exports recorded yet. Exports appear here when an H5 operator runs `operator.exported`." 12px mono `--muted`, padding 24px, centered. |
| Grid unreachable | Card body: "Could not reach Grid. Retry by reloading the page." 12px mono `--muted`. |
| Audit query failed | Card body: "Could not load operator exports." 12px mono `--muted`. |

### Scrubber Modal

Opens on row click. Closes on Escape, click outside the modal panel, or the close
button.

#### Modal Structure

```
[overlay: position fixed, inset 0, background rgba(26,23,20,0.55), z-index 50]
  [panel: max-width 960px, max-height 80vh, margin auto, background var(--vellum),
   border-radius 12px, box-shadow 0 20px 60px rgba(0,0,0,0.25), overflow hidden]

    [panel header — 16px 24px, border-bottom 1px var(--rule)]
      [left] eyebrow "Export"  + title "{operator_id} · ticks {start} → {end}"
      [right] [tier badge] [close button "×"]

    [panel body — overflow-y auto, padding 24px]

      [tier gate region — see H3+ gate spec below]

      [scrubber control region]
        [tick label row: "Tick {selected.toLocaleString()}"  ·  "{position}/{total} events shown"]
        [<input type="range">]
        [tick bounds: start_tick (left)  end_tick (right) — 10px mono muted]

      [event list region]
        [section eyebrow "Events at tick {selected}"]
        [scrollable list — max-height 320px]
          [row] [family-dot] [event-type badge] [actor-DID truncated] [tick]
          ...
        [empty: "No events at this tick."]

    [panel footer — 12px 24px, border-top 1px var(--rule)]
      [meta: "Showing tick {selected} · Observer-only — no Grid mutations."]
```

#### Panel Header

- Eyebrow "Export": 10px mono uppercase `--muted`, letter-spacing 0.14em
- Title: 20px serif `--ink`, weight 400 (matches 25a inherited Heading scale). Operator_id rendered in mono 14px
- Tier badge: existing `.badge` class — `H3+` in 9px mono `--muted`,
  `background var(--parchment)`, `border 1px solid var(--rule)`
- Close button: 24px square, 18px `×` glyph, `--muted` ink, hover `--ink`. ARIA
  label `"Close scrubber"`. Focus ring per 25a accessibility contract.

#### Tier Gate Spec (D-06 — H3+ required, H4 redaction)

Three states, derived from the operator-tier cookie injected by the Steward proxy:

| Operator tier | Treatment |
|---------------|-----------|
| H1, H2 (below H3) | Replace scrubber control + event list with full-panel-body inline message: **"H3+ operator tier required to replay exports."** 14px sans `--ink`, centered, padding-block 48px. No slider rendered. No data fetched. |
| H3 | Render scrubber + event list. Sensitive payload fields (telos text, whisper ciphertext, reflection content) are REDACTED inline: replace the value with the literal string `— Requires H4` in 10px mono `--muted`. The event row itself still renders (event type + actor + tick visible). |
| H4, H5 | Render scrubber + event list with NO redaction. All payload fields visible per their event-family contract. |

Redaction implementation note: 25c-EXECUTOR must extend the existing event-row
render to check `req.cookies['x-operator-tier']` server-side OR inspect the
`tier` prop passed from the page. Sensitive keys to redact at H3 (canonical list,
matching the wire-privacy invariants from prior phases):

```
telos_text · creed_text · skill_body · rule_text · lore_body · message · text
content · ciphertext (rendered as hash only) · belief_content · violation_text
```

Each redacted field renders the placeholder `— Requires H4` (em-dash, single
space, uppercase R). Tooltip on the placeholder: `"Sensitive payload field —
H4 required to view"`.

#### Scrubber Control

- Tick label row layout: flexbox, `justify-content: space-between`,
  `margin-bottom: 12px`
- Left label: `"Tick "` + tick number in 14px mono `--ink`, `font-variant-numeric: tabular-nums` (stays within inherited 25a typography bands; mono numeric is the established convention for tick counters in the firehose viewport)
- Right label: `"{count} events"` in 11px mono `--muted`
- Slider: native `<input type="range">` styled with:
  ```
  width: 100%;
  height: 6px;
  background: var(--rule);
  border-radius: 3px;
  accent-color: var(--terracotta);
  ```
  Min = `start_tick`, max = `end_tick`, step = 1, default value = `start_tick`.
- Bounds row: flexbox justify-between, 10px mono `--muted`, displays
  `start_tick.toLocaleString()` and `end_tick.toLocaleString()`.
- Keyboard: `<input type="range">` natively supports ←/→ (1 step), Page Up/Down
  (10 step), Home/End (bounds). Documented in `aria-describedby` helper text
  hidden visually: `"Use arrow keys to step ticks. Page Up and Page Down jump
  by 10 ticks. Home and End jump to bounds."`
- ARIA: `aria-label="Replay tick scrubber"`, `aria-valuemin`, `aria-valuemax`,
  `aria-valuenow` auto-set by the input.
- Focus ring: 25a default (2px terracotta outline).

#### Event List

Below the scrubber. Filtering rule (from RESEARCH Pattern 5):

> Event list at selected tick = `entries.filter(e => (e.id ?? 0) <= selectedTick)`
> sorted descending by `id`, sliced to the most recent 100. The "events at this
> tick" framing in CONTEXT is cumulative — show all events from `start_tick` up
> to and including `selectedTick`. This matches the dashboard `ReplayGrid` view
> and is what the audit-chain replay semantically produces.

Each row anatomy (matches 25a firehose row but slightly denser — modals favor
compactness):

| Slot | Content | Style |
|------|---------|-------|
| Family dot | 6px circle | Event-family color from 25a table |
| Tick | `{e.id}` | 10px mono `--muted`, fixed width 60px right-aligned |
| Event-type badge | Event type string | 10px mono badge per 25a family-color table |
| Actor DID | Truncated first 8 + `…` + last 6 | 10px mono `--muted` |
| Payload preview | Up to 2 key=value pairs (most informative keys per family) OR redaction placeholder | 10px mono `--muted`, truncate at 40 chars per pair |

Row height: 24px (denser than firehose 32px — modal context). Padding-block 4px.

Row hover: `background: rgba(0,0,0,0.03)` — subtle, no terracotta tint (avoids
fighting the family left-border).

Row left-border: 3px solid family color.

Scroll container: max-height 320px, `overflow-y: auto`. Internal scrollbar
styled with `--rule` track, `--muted` thumb (matches firehose viewport).

Empty state: "No events at or before this tick." 12px mono `--muted`, padding
24px, centered.

#### Modal Loading / Error States

| Condition | Display |
|-----------|---------|
| Loading entries | Slider disabled. Event list shows centered spinner-free message "Loading export entries…" 12px mono `--muted`. |
| Audit fetch failed | Slider disabled. Event list shows "Could not load export entries." 12px mono `--muted`. |
| Operator tier missing | Same gate as H1/H2 — "H3+ operator tier required to replay exports." |
| Empty export (0 entries returned) | Slider disabled. Event list shows "No entries in this export range." 12px mono `--muted`. |

#### Modal Accessibility

- Focus trap: when modal opens, focus moves to the close button. Tab cycles
  through close → slider → first event row → close. Shift-Tab reverses.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby="replay-modal-title"`
  on the panel.
- Background scroll lock: `document.body.style.overflow = 'hidden'` while open.
- Escape key: closes modal. Click on overlay (outside panel): closes modal.
  Click inside panel: does not close.

---

## Surface 2: /culture (Norm Timeline + Lore Graph + Skill Lineage)

**Route:** `steward/src/app/culture/page.tsx` (server component — fetches all
three endpoints)
**Filter bar:** `steward/src/app/culture/nous-filter-bar.tsx` (client component)
**SVG components:** `steward/src/app/culture/{norm-timeline,lore-graph,skill-lineage}.tsx`
**StewardShell props:** `title="Culture"`, `breadcrumb="Steward · Observatory · Culture"`

### Page Layout

```
StewardShell
  [page h1] "Culture"
  [page sub-label] "Emergent skill, norm, and lore patterns. Filter by Nous."

  [Nous DID filter bar — sticky below page header, top: 0, z-index 10]
    [eyebrow "Filter"] [search input — Nous DID]  [active filter pill if set]  [clear]

  [card grid — 12-column, gap 24px]
    [Skill Lineage card — col-span 12]
    [Norm Timeline card — col-span 12]
    [Lore Graph card — col-span 12]
```

Single-column stack on a 1280px viewport. Cards reflow to full width to
maximize SVG space. Each card uses `steward-card` (vellum + terracotta stripe).

### Nous DID Filter Bar (D-11 — Claude's Discretion)

**Decision:** URL-param based filter using Next.js `useSearchParams`. Rationale:
deep-link from Nous inspector (`/nous/[did]` page can render a "View in Culture
context" link → `/culture?nous=did:noesis:...`), survives reload, no client
state to synchronize.

#### Layout

```
[sticky bar container — background var(--vellum), border-bottom 1px var(--rule),
 padding 12px 24px, margin -24px -24px 24px -24px (bleeds to card edges)]
  [flexbox row, gap 16px, align-items center]
    [eyebrow "Filter by Nous"] [text input]  [optional: active filter pill] [clear button]
```

#### Input

- Native `<input type="text">`. Placeholder: `"did:noesis:..."` in 11px mono
  `--muted`.
- Width: 320px. Height: 32px. Padding 8px 12px. Background `--parchment`,
  border `1px solid var(--rule)`, border-radius 4px, focus border
  `var(--terracotta)`.
- Font: 11px mono `--ink`.
- Behavior: typing updates a debounced URL search param (`router.replace`,
  300ms debounce). No submit button. Enter key not required.
- DID validation: input accepts free text; if value matches DID regex
  (`/^did:noesis:[a-z0-9_\-]+$/i`), filter applies. If it doesn't match, filter
  is ignored (SVGs show unfiltered view). Invalid input does NOT show an error
  state — the empty input is the canonical "show all" state.
- ARIA: `aria-label="Filter by Nous DID"`, `aria-describedby` pointing to
  visually-hidden help text "Enter a Nous DID to filter the culture views.
  Leave blank to show all."

#### Active Filter Pill

Rendered to the right of the input when a valid filter is active:

```
[pill: background rgba(184,84,47,0.10), border 1px solid rgba(184,84,47,0.3),
 border-radius 12px, padding 4px 8px, gap 8px]
  [text 11px mono var(--terracotta)] {did truncated 8+…+6}
  [× close button, ARIA "Clear filter"]
```

Clicking × clears the URL param (`router.replace('/culture')`) and removes the
pill.

#### Filter Scope Per Panel (resolved from RESEARCH open question 2)

| Panel | Behavior when filter active |
|-------|----------------------------|
| Skill Lineage | If the filtered DID matches a node `id` with `type: 'nous'`: highlight that node + dim non-incident edges (full panel still renders). If DID does not match any node: render entire graph dimmed and show inline note "Selected Nous has no skills in lineage." |
| Norm Timeline | Norms are Grid-wide convergences with no single owning DID. ALL norms render regardless of filter. Sub-label appended to card: "Norms are Grid-wide; per-Nous filter does not apply." |
| Lore Graph | Filter entries by `contributor_did === filter`. If no entries match: show "No lore contributions from this Nous." centered in card. |

The filter is a "highlight where relevant" UI, not a hard filter that hides
panels. This matches the Steward design ethos (read-only, show context).

### Cards: Common Structure

Each of the three culture cards uses `steward-card` and the following structure:

```
[steward-card]
  [3px terracotta stripe — inherited from .steward-card::before]
  [header row — padding-bottom 16px, border-bottom 1px var(--rule)]
    [left] [eyebrow "Culture"] [title h2 "Skill Lineage" | "Norm Timeline" | "Lore Graph"]
    [right] [count badge "{N} {nodes|norms|entries}"]
  [body — padding 20px 0 0 0]
    [SVG container — width 100%, min-height 320px, max-height 480px, overflow auto]
      <svg>...</svg>
    [empty state if data is empty]
  [footer — padding-top 16px, border-top 1px var(--rule), margin-top 24px]
    [legend (per-panel — see below)]
```

Title h2: 20px serif `--ink`, weight 400. Eyebrow: 10px mono uppercase
`--muted`, letter-spacing 0.14em, margin-bottom 4px.

Count badge: 10px mono `--muted`, `.badge` class, `background var(--parchment)`,
`border 1px solid var(--rule)`.

### Card 1: Skill Lineage (SVG)

**Data:** `SkillLineageResponse { nodes, edges }` from
`GET /api/v1/grid/culture/skills/lineage`. Positions are server-computed (D-10).

**Rendering:**

```xml
<svg viewBox="0 0 {maxX+40} {maxY+40}" width="100%">
  <!-- edges first (so they render under nodes) -->
  {edges.map(e => <line
    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
    stroke={edge.type === 'taught' ? '#3a7a5a' : '#7a6a2e'}
    stroke-width="1.5"
    stroke-dasharray={edge.type === 'inferred' ? '4 3' : 'none'}
    opacity={isInFilter ? 0.9 : 0.25} />)}
  {nodes.map(n => (
    n.type === 'nous'
      ? <circle cx={n.x} cy={n.y} r="8"
                fill="#3a7a5a"  /* sage — nous family */
                stroke="var(--ink)" stroke-width="1"
                opacity={isFiltered(n) ? 1 : 0.3} />
      : <rect x={n.x-6} y={n.y-6} width="12" height="12"
                fill="#7a6a2e"  /* amber — skill family */
                stroke="var(--ink)" stroke-width="1"
                opacity={isFiltered(n) ? 1 : 0.3} />
  ))}
  {nodes.map(n => <text x={n.x+12} y={n.y+4}
                         font-size="10" font-family="var(--mono)"
                         fill="var(--ink)">
    {labelTruncated(n)}
  </text>)}
</svg>
```

- **Nous nodes:** filled circle, sage `#3a7a5a` (nous family color from 25a).
  Radius 8.
- **Skill nodes:** filled rect, amber `#7a6a2e` (skill family color from 25a).
  12×12 centered on `{x,y}`.
- **Taught edges:** solid line, sage `#3a7a5a`, stroke-width 1.5.
- **Inferred edges:** dashed line (`stroke-dasharray="4 3"`), amber `#7a6a2e`,
  stroke-width 1.5.
- **Node labels:** 10px mono `--ink`, positioned at `{x+12, y+4}`. Truncate to
  16 chars + `…` if longer.

When filter active and node/edge is NOT incident to filtered DID: opacity 0.3
(dimmed). Filtered node renders at opacity 1.0 plus a 2px terracotta stroke ring.

**Legend (card footer):**

```
[●] Nous   [■] Skill   [— Taught]   [- - Inferred]
```

Each glyph rendered as a 12×12 mini-SVG inline. Text: 10px mono `--muted`,
gap 16px.

**Empty state:** "No skill lineage recorded yet." 12px mono `--muted`, centered
in SVG container height (320px).

### Card 2: Norm Timeline (SVG)

**Data:** `NormsResponse { norms[] }` from `GET /api/v1/grid/norms`. Each
NormRecord has `crystallized_tick`, `evidence_tick_range`, `fingerprint`,
`convergence_type`, `participating_count`.

**Layout:** Horizontal timeline. X-axis = tick. Each norm renders as a
horizontal bar from `evidence_tick_range[0]` to `crystallized_tick`. Y-axis =
fingerprint order (sorted by `crystallized_tick` ascending — most recent at
bottom).

```xml
<svg viewBox="0 0 800 {norms.length * 32 + 60}" width="100%">
  <!-- X-axis tick marks every 100 ticks, with mono labels at top -->
  <line x1="80" y1="20" x2="800" y2="20" stroke="var(--rule)" />
  {tickMarks.map(t => <text x={scaleX(t)} y="14"
                              font-size="9" font-family="var(--mono)"
                              fill="var(--muted)" text-anchor="middle">{t}</text>)}

  {norms.map((norm, i) => (
    <g transform={`translate(0, ${i * 32 + 40})`}>
      <!-- fingerprint label -->
      <text x="72" y="14" font-size="10" font-family="var(--mono)"
            fill="var(--ink)" text-anchor="end">{norm.fingerprint}</text>
      <!-- evidence range bar (lighter) -->
      <rect x={scaleX(norm.evidence_tick_range[0])} y="4"
            width={scaleX(norm.evidence_tick_range[1]) - scaleX(norm.evidence_tick_range[0])}
            height="16" rx="3"
            fill={normColor(norm.convergence_type)}
            opacity="0.25" />
      <!-- crystallization point -->
      <circle cx={scaleX(norm.crystallized_tick)} cy="14" r="5"
              fill={normColor(norm.convergence_type)}
              stroke="var(--ink)" stroke-width="1" />
      <!-- participant count badge -->
      <text x={scaleX(norm.crystallized_tick) + 12} y="18"
            font-size="9" font-family="var(--mono)"
            fill="var(--muted)">N={norm.participating_count}</text>
    </g>
  ))}
</svg>
```

**Norm convergence colors (extension of 25a `norm` family):**

| convergence_type | Fill | Rationale |
|------------------|------|-----------|
| `emergent` | `#5a5a6a` (norm family slate from 25a) | True emergence — primary norm color |
| `coincidental` | `#8a8479` (`--muted`) | Distinguish from emergent — neutral gray |

Both colors are from the 25a palette — no new colors introduced.

**Sub-label per D-11 filter scope:** When filter active, append below card title:
"Norms are Grid-wide; per-Nous filter does not apply." 11px mono `--muted`.

**Legend (card footer):**

```
[● Emergent]   [● Coincidental]   [▬ Evidence range]   [● Crystallization]
```

10px mono `--muted`, gap 16px.

**Empty state:** "No crystallized norms yet." 12px mono `--muted`, centered.

### Card 3: Lore Graph (SVG)

**Data:** `LoreEntriesResponse { entries[], total }` from `GET /api/v1/grid/lore`
+ `GET /api/v1/audit/trail?type=lore.cited` for citation edges. The Grid
returns pre-computed `{x, y}` positions per Phase 21 server-side layout (D-10 —
no client layout).

**Layout:** Force-directed-style scatter (server-computed). Nodes = lore
entries; edges = citations.

```xml
<svg viewBox="0 0 800 480" width="100%">
  <!-- citation edges -->
  {citations.map(c => <line
    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
    stroke="#6a4a7a"  /* mauve — lore family color from 25a */
    stroke-width="1"
    opacity={isInFilter(c) ? 0.8 : 0.2} />)}
  <!-- entry nodes -->
  {entries.map(e => <circle
    cx={e.x} cy={e.y} r="6"
    fill={categoryColor(e.category_tag)}
    stroke="var(--ink)" stroke-width="0.75"
    opacity={isFiltered(e) ? 1 : 0.3} />)}
  <!-- citation count labels (only for nodes with ≥3 citations) -->
  {entries.filter(e => e.citation_count >= 3).map(e =>
    <text x={e.x+12} y={e.y+4}
          font-size="9" font-family="var(--mono)"
          fill="var(--muted)">×{e.citation_count}</text>)}
</svg>
```

**Category colors (palette restricted to 25a tokens):**

| category_tag | Fill | Rationale |
|--------------|------|-----------|
| `myth` | `#6a4a7a` (lore family mauve from 25a) | Default lore color |
| `history` | `#5a5a6a` (norm family slate from 25a) | Cooler — past events |
| `ritual` | `#b8542f` (`--terracotta`) | Embodied practice — warm accent |
| `principle` | `#8a6a2e` (`--bronze`) | Wisdom/value — gold/bronze |
| any other / unknown | `#8a8479` (`--muted`) | Neutral fallback |

All from the 25a 11-color token set — no new colors.

**Filter behavior:** When filter active, entries with `contributor_did !== filter`
render at opacity 0.3. Filtered nodes render at opacity 1.0 with a 2px terracotta
stroke ring (matches skill lineage filter visual).

**Legend (card footer):**

```
[● Myth]   [● History]   [● Ritual]   [● Principle]   [— Citation]
```

10px mono `--muted`, gap 16px.

**Empty state:** "No lore contributions yet." 12px mono `--muted`, centered.

### SVG Common Rules (apply to all three culture cards)

- `<svg>` element `role="img"`, `aria-label="{Skill lineage|Norm timeline|Lore
  graph} visualization. {Count} {nodes|norms|entries}."` — provides
  screen-reader summary since the visualization is decorative-supplementary.
- All numeric coordinates from the server — no client-side layout (D-10
  raw-SVG invariant).
- No animation. No transitions. No hover-grow on nodes. The only interactivity
  is the URL-param filter changing opacity values via React re-render.
- Background of SVG element: `var(--parchment)` — provides contrast against
  vellum card body.
- `overflow: auto` on the container — large graphs scroll horizontally
  (skill lineage in particular).

---

## Wave-0 Cleanup (No UI Surfaces)

D-01 (relationships.ts header-auth migration), D-02 (humanSanctionStore wiring),
D-03 (SpawnNousDeps wiring) are server/Grid-only tasks with NO UI implications.
This UI-SPEC has no contract for them. The 25a `/users` page and the in-page
sanction controls (added in 25b) already render correctly against the
header-auth pattern — Wave-0 removes the 503 guards behind those routes
transparent to the UI.

If Wave-0 introduces any UI text change (e.g., removing a "503 — store not
configured" placeholder), the executor MUST update the relevant 25b copywriting
contract, not 25c. 25c does not own that copy.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| /replay page h1 | "Replay" |
| /replay page sub-label | "Operator exports — click a row to scrub through its tick range." |
| /replay table card title | "Operator Exports" |
| /replay empty state | "No exports recorded yet. Exports appear here when an H5 operator runs `operator.exported`." |
| /replay Grid unreachable | "Could not reach Grid. Retry by reloading the page." |
| /replay audit query failed | "Could not load operator exports." |
| Replay modal header eyebrow | "Export" |
| Replay modal tier-gate (H1/H2) | "H3+ operator tier required to replay exports." |
| Replay modal H4-required field placeholder | "— Requires H4" |
| Replay modal H4-required tooltip | "Sensitive payload field — H4 required to view" |
| Replay modal loading | "Loading export entries…" |
| Replay modal load failed | "Could not load export entries." |
| Replay modal empty range | "No entries in this export range." |
| Replay modal event-list empty (at tick) | "No events at or before this tick." |
| Replay modal footer meta | "Showing tick {N} · Observer-only — no Grid mutations." |
| Replay modal close button ARIA | "Close scrubber" |
| Replay modal row ARIA | "Open scrubber for export {operator_id} ticks {start_tick} to {end_tick}" |
| /culture page h1 | "Culture" |
| /culture page sub-label | "Emergent skill, norm, and lore patterns. Filter by Nous." |
| /culture filter input placeholder | `"did:noesis:..."` |
| /culture filter eyebrow | "Filter by Nous" |
| /culture filter input ARIA | "Filter by Nous DID" |
| /culture filter helper (visually hidden) | "Enter a Nous DID to filter the culture views. Leave blank to show all." |
| /culture filter pill close ARIA | "Clear filter" |
| Skill Lineage card title | "Skill Lineage" |
| Skill Lineage empty | "No skill lineage recorded yet." |
| Skill Lineage filtered-out | "Selected Nous has no skills in lineage." |
| Norm Timeline card title | "Norm Timeline" |
| Norm Timeline filter-irrelevant sub-label | "Norms are Grid-wide; per-Nous filter does not apply." |
| Norm Timeline empty | "No crystallized norms yet." |
| Lore Graph card title | "Lore Graph" |
| Lore Graph filtered-empty | "No lore contributions from this Nous." |
| Lore Graph empty | "No lore contributions yet." |
| Culture cards eyebrow (all three) | "Culture" |
| StewardShell nav group heading | "Observatory" |
| StewardShell nav link 1 | "Replay" |
| StewardShell nav link 2 | "Culture" |

No destructive copy needed in 25c (zero destructive actions on any new surface).

---

## Accessibility Contract (25c-specific additions)

25a contract applies in full. New requirements introduced by 25c surfaces:

| Requirement | Implementation |
|-------------|---------------|
| Replay table row keyboard activation | Each row `tabindex="0"` + `role="button"` + `aria-label` (see Copywriting). Enter or Space opens the scrubber modal. |
| Replay modal focus trap | On open, focus moves to close button. Tab cycles close → slider → first event row → close. Shift-Tab reverses. Background scroll locked. |
| Replay modal dialog role | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the modal title element. |
| Replay modal Escape key | Closes modal (returns focus to the originating row). |
| Replay scrubber slider | Native `<input type="range">` with `aria-label="Replay tick scrubber"`. Arrow keys = step 1; PgUp/PgDn = step 10; Home/End = bounds. Documented in visually-hidden `aria-describedby` helper. |
| Culture filter input | `aria-label="Filter by Nous DID"` + visually-hidden helper. No required field — empty = show all. |
| Culture filter pill | `role="button"` on the × element, `aria-label="Clear filter"`. |
| Culture SVG summaries | Each `<svg>` has `role="img"` + `aria-label` containing visualization type and entry count. SVG visualization is supplementary; the count badge in the card header conveys the data inventory in text. |
| Filter-induced opacity changes | Color is not the sole differentiator — filtered nodes also receive a 2px terracotta stroke ring (visible to colorblind users). |
| Redaction placeholder readability | `— Requires H4` text passes contrast check at `--muted` on `var(--vellum)` (4.5:1 verified). |

---

## Pre-Population Sources

| Field | Source |
|-------|--------|
| Design system, palette, typography, spacing | Inherited from `25a-UI-SPEC.md` unchanged |
| Event-family colors (replay event rows) | 25a-UI-SPEC §"Event-Family Color Palette" — applied verbatim |
| Skill lineage node/edge colors | 25a `nous` and `skill` family colors |
| Norm convergence colors | 25a `norm` family + `--muted` |
| Lore category colors | 25a `lore`, `norm`, `--terracotta`, `--bronze`, `--muted` |
| Modal pattern | Designer recommendation — hand-rolled overlay + panel, no modal library (Anti-pattern from RESEARCH: "Use complex modal library") |
| URL-param filter approach | RESEARCH §"Pattern 7" recommendation — `useSearchParams`; enables deferred deep-link from Nous inspector |
| `operator.exported` table columns | RESEARCH Pitfall 2 correction — payload has NO `nous_did`; CONTEXT D-05 corrected |
| Event-list cumulative filter | RESEARCH §"Pattern 5" — `entries.filter(e => (e.id ?? 0) <= selectedTick)` |
| H4 redaction placeholder copy | CONTEXT D-06 — verbatim "— Requires H4" |
| StewardShell nav group "Observatory" | Designer decision — separates historical/derived views from live operator surfaces; matches read-only Surface 4 framing from 25a |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: pending
- [ ] Dimension 2 Visuals: pending
- [ ] Dimension 3 Color: pending
- [ ] Dimension 4 Typography: pending
- [ ] Dimension 5 Spacing: pending
- [ ] Dimension 6 Registry Safety: pending

**Approval:** pending
