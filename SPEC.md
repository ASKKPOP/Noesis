# Steward Console — Dashboard Page Specification

**Page**: Steward Console · Dashboard (landing view)
**Route**: `/steward/` (standalone HTML demo: `steward-console.html`)
**Purpose**: Operator/admin interface for the Noesis Grid — system dashboard for grid operators, not end users. This is a separate admin service distinct from the human portal at `/portal/*`.

---

## 1. Overall Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ TOP HEADER BAR (full width, sticky, navy bg)                    │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│  LEFT        │  MAIN CONTENT AREA                               │
│  SIDEBAR     │                                                  │
│  (240px,     │  ┌─────────────────────────────────────────────┐ │
│  fixed,      │  │ HERO STAT STRIP (4 stat cards, full width)  │ │
│  navy bg)    │  └─────────────────────────────────────────────┘ │
│              │                                                  │
│              │  ┌───────────────────────┐ ┌───────────────────┐ │
│              │  │ NOUS ROSTER TABLE     │ │ RIGHT SIDEBAR     │ │
│              │  │ (grows, ~65% width)   │ │ (~35% width)      │ │
│              │  │                       │ │ · Economy card    │ │
│              │  │                       │ │ · Governance card │ │
│              │  │                       │ │ · System Health   │ │
│              │  └───────────────────────┘ └───────────────────┘ │
│              │                                                  │
│              │  ┌─────────────────────────────────────────────┐ │
│              │  │ RECENT EVENTS FEED (full width)             │ │
│              │  └─────────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────────┘
```

**Outer page**: `background: var(--parchment)` (`#f1ead8`), `font-family: var(--sans)`, `color: var(--ink)`, `font-size: 14px`

**Left sidebar**: `width: 240px`, fixed/sticky, `height: 100vh`, `background: #1e1c1a` (operator-dark — slightly warmer navy than `--navy: #16213d`; use `#1a1714` for sidebar bg), `overflow-y: auto`

**Main content area**: `flex: 1`, `padding: 28px 32px`, `overflow-y: auto`, parchment background

**Top header**: `height: 56px`, `background: #1a1714` (same as sidebar), `border-bottom: 1px solid rgba(241,234,216,0.10)`, sticky, full width

---

## 2. Design Token Reference

```css
:root {
  --ink:          #0b1220;
  --navy:         #16213d;
  --parchment:    #f1ead8;
  --parchment-2:  #e8dfc8;
  --vellum:       #faf6ec;
  --terracotta:   #b8542f;
  --terracotta-2: #d97a4f;
  --bronze:       #8a6a3b;
  --rule:         rgba(11,18,32,0.15);
  --rule-soft:    rgba(11,18,32,0.08);
  --muted:        rgba(11,18,32,0.55);
  --rule-dark:    rgba(241,234,216,0.12);
  --muted-dark:   rgba(241,234,216,0.55);
  --serif:        "Cormorant Garamond", GFS Didot, EB Garamond, Georgia, serif;
  --sans:         "Inter Tight", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --mono:         "JetBrains Mono", "Berkeley Mono", "IBM Plex Mono", ui-monospace, monospace;
  --sidebar-bg:   #1a1714;
  --sidebar-hover: rgba(241,234,216,0.05);
  --sidebar-active-bg: rgba(184,84,47,0.15);
}
```

**Google Fonts import** (in `<head>`):
```
https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap
```

---

## 3. Top Header Bar

**Element**: `<header class="topbar">`
**Height**: 56px
**Background**: `var(--sidebar-bg)` (`#1a1714`)
**Border-bottom**: `1px solid rgba(241,234,216,0.10)`
**Layout**: `display: flex; align-items: center; justify-content: space-between; padding: 0 24px 0 0;`
**Position**: `fixed; top: 0; left: 0; right: 0; z-index: 100`

### 3a. Logo / Brand (left side)

**Container**: `display: flex; align-items: center; gap: 0; width: 240px; padding: 0 20px;`
**Border-right**: `1px solid rgba(241,234,216,0.08)` (separates brand from top nav, aligns with sidebar edge)

**Logo text**: `"Noēsis · Steward Console"`
- Font: `var(--serif)` (Cormorant Garamond), `font-size: 17px`, `font-weight: 400`
- Color: `var(--parchment)` (`#f1ead8`)
- The middle dot `·` should render as `&middot;` with `color: var(--terracotta-2)`
- No logo mark icon needed

### 3b. Version Badge (immediately after logo text, inline)

**Element**: `<span class="version-badge">`
**Text**: `v2.5`
**Font**: `var(--mono)`, `10px`, `font-weight: 500`, `letter-spacing: 0.08em`
**Background**: `rgba(184,84,47,0.18)` (terracotta 18% tint)
**Color**: `var(--terracotta-2)`
**Padding**: `2px 7px`
**Border-radius**: `4px`
**Margin-left**: `10px`
**Display**: `inline-flex; align-items: center`

### 3c. Top Nav Links (right side)

**Container**: `display: flex; align-items: center; gap: 6px; margin-left: auto;`
**Links**: Dashboard, Nous Roster, Economy, Governance, Lore, System

**Each link**:
- Font: `var(--mono)`, `11px`, `letter-spacing: 0.12em`, `text-transform: uppercase`
- Color: `rgba(241,234,216,0.55)` (muted-dark)
- Padding: `6px 12px`
- Border-radius: `6px`
- Text-decoration: none
- Transition: `background 0.15s, color 0.15s`
- Hover: `background: rgba(241,234,216,0.07); color: rgba(241,234,216,0.85)`
- **Active state** (Dashboard is active): `background: rgba(184,84,47,0.15); color: var(--terracotta-2)`

### 3d. Operator Avatar (far right)

**Element**: small avatar circle
**Size**: `28px × 28px`
**Background**: `linear-gradient(135deg, var(--terracotta), var(--bronze))`
**Border-radius**: `50%`
**Content**: Initials `"OP"` in `var(--mono)`, `9px`, color `var(--parchment)`, centered
**Margin-left**: `16px`

---

## 4. Left Sidebar

**Element**: `<nav class="sidebar">`
**Width**: `240px`
**Background**: `var(--sidebar-bg)` (`#1a1714`)
**Position**: `fixed; top: 56px; left: 0; bottom: 0; overflow-y: auto`
**Padding**: `20px 0 24px 0`
**Border-right**: `1px solid rgba(241,234,216,0.08)`

### 4a. Section Label

**Text**: `"Operator"` (appears once at top as group label)
**Font**: `var(--mono)`, `9.5px`, `letter-spacing: 0.18em`, `text-transform: uppercase`
**Color**: `rgba(241,234,216,0.30)`
**Padding**: `0 16px 10px 20px`
**Margin-bottom**: `4px`

### 4b. Nav Items

**Nav item structure**: `<a class="nav-item [active]" href="#">`
**Layout**: `display: flex; align-items: center; gap: 10px; padding: 8px 16px 8px 20px; text-decoration: none;`
**Font**: `var(--sans)`, `13px`, `font-weight: 500`
**Color** (default): `rgba(241,234,216,0.55)`
**Border-left**: `2px solid transparent`
**Transition**: `all 0.15s`
**Hover**: `background: var(--sidebar-hover); color: rgba(241,234,216,0.85); border-left-color: rgba(184,84,47,0.40)`
**Active**: `background: var(--sidebar-active-bg); color: var(--terracotta-2); border-left-color: var(--terracotta);`

**Dot indicator** (for each nav item, before label):
- `width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0`
- Default: `background: rgba(241,234,216,0.20)`
- Active: `background: var(--terracotta)`
- Hover: `background: rgba(241,234,216,0.45)`

**Nav items list (in order)**:

```
● Dashboard          ← ACTIVE
· Nous Roster
· Economy
· Governance
· Lore
· System
```

**Divider** between main nav and secondary section: `border-top: 1px solid rgba(241,234,216,0.08); margin: 12px 0;`

**Secondary section label**: `"Grid"` — same styling as "Operator" label

**Secondary nav items**:
```
· Tick History
· Audit Log
· Config
```

### 4c. Sidebar Footer

**Position**: at bottom of sidebar
**Content**: small status indicator
**Layout**: `padding: 16px 20px; border-top: 1px solid rgba(241,234,216,0.08);`

**Grid status line**:
- Dot: `6px × 6px`, `border-radius: 50%`, `background: #4ade80` (green)
- Text: `"Grid: Online"` — `var(--mono)`, `10px`, `color: rgba(241,234,216,0.45)`
- `display: flex; align-items: center; gap: 7px`

---

## 5. Main Content Area

**Element**: `<main class="content">`
**Margin-left**: `240px` (sidebar width)
**Padding-top**: `56px` (header height)
**Background**: `var(--parchment)`
**Min-height**: `100vh`

**Inner wrapper**: `padding: 28px 32px`

---

## 6. Hero Stat Strip

**Element**: `<section class="stat-strip">`
**Layout**: `display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px;`

### Stat Card Pattern

Each card is `<div class="stat-card">`:
```css
.stat-card {
  background: var(--vellum);           /* #faf6ec */
  border: 1px solid var(--rule);       /* rgba(11,18,32,0.15) */
  border-radius: 10px;
  padding: 20px 22px 18px;
  position: relative;
  overflow: hidden;
}
.stat-card::before {
  /* terracotta top-stripe */
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--terracotta), var(--terracotta-2));
}
```

**Card label** (above the number):
- Font: `var(--mono)`, `9.5px`, `letter-spacing: 0.16em`, `text-transform: uppercase`
- Color: `var(--muted)`
- Margin-bottom: `8px`

**Card value** (big number):
- Font: `var(--serif)`, `36px`, `font-weight: 400`, `line-height: 1.0`, `letter-spacing: -0.01em`
- Color: `var(--ink)`
- Margin-bottom: `4px`

**Card sub-label** (below number, small annotation):
- Font: `var(--mono)`, `10.5px`
- Color: `var(--muted)`

### The Four Stat Cards

**Card 1 — Grid Tick**
- Label: `GRID TICK`
- Value: `48,291`
- Sub-label: `+1 / 30 sec`

**Card 2 — Active Nous**
- Label: `ACTIVE NOUS`
- Value: `3`
- Sub-label: `of 3 spawned`

**Card 3 — Cyber Coin Supply**
- Label: `CYBER COIN SUPPLY`
- Value: `12,450`
- Sub-label: `ℂ total issued`

**Card 4 — Open Proposals**
- Label: `OPEN PROPOSALS`
- Value: `2`
- Sub-label: `1 voting · 1 pending`

---

## 7. Main Body — Two-Column Layout

**Element**: `<div class="body-grid">`
**Layout**: `display: grid; grid-template-columns: 1fr 320px; gap: 20px; margin-bottom: 28px; align-items: start;`

---

## 8. Nous Roster Table (left column)

**Element**: `<section class="roster-section">`

### 8a. Section Header

**Layout**: `display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px;`

**Title**:
- Text: `"Nous Roster"`
- Font: `var(--serif)`, `20px`, `font-weight: 400`, `letter-spacing: -0.01em`
- Color: `var(--ink)`

**Count badge**:
- Text: `"3 agents"`
- Font: `var(--mono)`, `10.5px`, `letter-spacing: 0.10em`
- Color: `var(--muted)`
- Background: `rgba(11,18,32,0.06)`
- Padding: `3px 8px`
- Border-radius: `4px`

### 8b. Table Card Wrapper

**Background**: `var(--vellum)`
**Border**: `1px solid var(--rule)`
**Border-radius**: `10px`
**Overflow**: `hidden`
**Position**: relative (for top-stripe)
**Top stripe**: `::before` pseudo — `height: 2px; background: linear-gradient(90deg, var(--terracotta), var(--terracotta-2))`

### 8c. Table

**Element**: `<table>`, `width: 100%`, `border-collapse: collapse`

**Column headers** (`<thead>`):
- Row background: `rgba(11,18,32,0.03)`
- Border-bottom: `1px solid var(--rule)`
- Padding: `10px 16px`
- Font: `var(--mono)`, `9.5px`, `letter-spacing: 0.14em`, `text-transform: uppercase`
- Color: `var(--muted)`
- Text-align: left

**Columns** (in order):
1. `NAME` — 180px
2. `ROLE` — 130px
3. `DID` — 180px (truncated)
4. `REGION` — 100px
5. `STATUS` — 90px
6. `SKILLS` — 70px (right-aligned)
7. `LAST TICK` — 90px (right-aligned)

**Table rows** (`<tbody> <tr>`):
- Border-bottom: `1px solid var(--rule-soft)` (`rgba(11,18,32,0.08)`)
- Padding: `12px 16px` (all cells)
- Transition: `background 0.12s`
- Hover: `background: rgba(184,84,47,0.04)` (terracotta 4% tint)
- Last row: no border-bottom

**Cell typography**:
- Default: `var(--sans)`, `13px`, color `var(--ink)`
- DID column: `var(--mono)`, `11.5px`, color `var(--muted)` (truncated, `max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`)
- Numbers (Skills, Last Tick): `var(--mono)`, `12px`, color `var(--ink)`, text-align right

### 8d. Agent Data

**Row 1 — Sophia**
| Column | Value |
|--------|-------|
| Name | `Sophia` (font-weight 500) with sub-label `Philosopher` in `var(--mono)` 10px muted below |
| Role | `Philosopher` |
| DID | `did:noesis:nous:sophia-0x1a2b` (truncated) |
| Region | `Agora` |
| Status | **Active** badge |
| Skills | `7` |
| Last Tick | `48,289` |

**Row 2 — Hermes**
| Column | Value |
|--------|-------|
| Name | `Hermes` (font-weight 500) with sub-label `Trader` |
| Role | `Trader` |
| DID | `did:noesis:nous:hermes-0x3c4d` (truncated) |
| Region | `Market` |
| Status | **Active** badge |
| Skills | `12` |
| Last Tick | `48,291` |

**Row 3 — Themis**
| Column | Value |
|--------|-------|
| Name | `Themis` (font-weight 500) with sub-label `Lawkeeper` |
| Role | `Lawkeeper` |
| DID | `did:noesis:nous:themis-0x5e6f` (truncated) |
| Region | `Forum` |
| Status | **Sleeping** badge |
| Skills | `5` |
| Last Tick | `48,241` |

### 8e. Status Badges

**Pattern** (used throughout):
```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 4px;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  white-space: nowrap;
}
```

**Badge variants**:

| Variant | Class | Background | Color | Dot color |
|---------|-------|-----------|-------|-----------|
| Active | `.badge-active` | `rgba(74,222,128,0.12)` | `#15803d` | `#4ade80` |
| Sleeping | `.badge-sleeping` | `rgba(11,18,32,0.07)` | `var(--muted)` | `rgba(11,18,32,0.30)` |
| Voting | `.badge-voting` | `rgba(138,106,59,0.12)` | `var(--bronze)` | `var(--bronze)` |
| Passed | `.badge-passed` | `rgba(184,84,47,0.10)` | `var(--terracotta)` | `var(--terracotta)` |
| Pending | `.badge-pending` | `rgba(11,18,32,0.06)` | `var(--muted)` | `rgba(11,18,32,0.25)` |
| Event type | `.badge-event` | `rgba(22,33,61,0.08)` | `var(--navy)` | none |

Each badge has a leading dot `●` at `8px` font-size except `.badge-event` (no dot, just text).

---

## 9. Right Sidebar Cards (320px column)

Three stacked cards with `gap: 16px`.

### 9a. Economy Card

**Element**: `<div class="card economy-card">`

**Card style** (shared pattern for all sidebar cards):
```css
.card {
  background: var(--vellum);
  border: 1px solid var(--rule);
  border-radius: 10px;
  padding: 18px 20px;
  position: relative;
  overflow: hidden;
}
.card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--terracotta), var(--terracotta-2));
}
```

**Card title**:
- Text: `"Economy"`
- Font: `var(--serif)`, `16px`, `font-weight: 500`
- Color: `var(--ink)`
- Margin-bottom: `4px`

**Card eyebrow** (above title):
- Text: `"CYBER COIN"`
- Font: `var(--mono)`, `9px`, `letter-spacing: 0.18em`, `text-transform: uppercase`
- Color: `var(--terracotta)`
- Margin-bottom: `6px`

**Stat rows** (4 rows, each):
- Layout: `display: flex; justify-content: space-between; align-items: baseline; padding: 9px 0; border-bottom: 1px solid var(--rule-soft);`
- Last row: no border-bottom
- Label: `var(--sans)`, `12.5px`, color `var(--muted)`
- Value: `var(--mono)`, `13px`, `font-weight: 500`, color `var(--ink)`

**Data**:
| Label | Value |
|-------|-------|
| Total Supply | `12,450 ℂ` |
| Circulating | `9,820 ℂ` |
| Human Holdings | `3,200 ℂ` |
| Nous Holdings | `6,620 ℂ` |

**Footer note** (below rows):
- Text: `"ℂ = Cyber Coin (non-custodial)"`
- Font: `var(--mono)`, `9.5px`
- Color: `rgba(11,18,32,0.35)`
- Margin-top: `10px`

---

### 9b. Governance Card

**Element**: `<div class="card governance-card">`

**Card eyebrow**: `"GOVERNANCE"` — same style as Economy card eyebrow
**Card title**: `"Open Proposals"` — same style as Economy card title

**Count badge** (inline with title):
- Text: `"2 open"`
- Same `.badge` pattern, custom: `background: rgba(138,106,59,0.10); color: var(--bronze);`
- Float/position: inline after title text with `margin-left: 8px`

**Proposal rows** (2 proposals):

**Proposal 1**:
- Badge: **Voting** (`.badge-voting`)
- Title: `"Expand trade fee buffer to 3%"` — `var(--sans)`, `12.5px`, `font-weight: 500`, color `var(--ink)`, margin-bottom `3px`
- Sub-text: `"12 for · 4 against · 8 abstain"` — `var(--mono)`, `10.5px`, color `var(--muted)`
- Padding: `10px 0`
- Border-bottom: `1px solid var(--rule-soft)`

**Proposal 2**:
- Badge: **Pending** (`.badge-pending`)
- Title: `"Crystallise norm: no unsolicited DMs"` — same styling
- Sub-text: `"Waiting for quorum · 2 days left"` — same mono muted
- Padding: `10px 0`
- No border-bottom

**Footer link**:
- Text: `"View all proposals →"`
- Font: `var(--mono)`, `10.5px`, `letter-spacing: 0.08em`
- Color: `var(--terracotta-2)`
- Text-decoration: none
- Hover: `text-decoration: underline`
- Margin-top: `8px`
- Display: `block`

---

### 9c. System Health Card

**Element**: `<div class="card system-card">`

**Card eyebrow**: `"SYSTEM"` — same eyebrow style
**Card title**: `"Health"` — same title style

**Health rows** (5 rows):
- Layout: `display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--rule-soft);`
- Last row: no border-bottom
- Label: `var(--sans)`, `12.5px`, color `var(--muted)`
- Value/badge: right side

**Data**:
| Label | Value / Badge |
|-------|---------------|
| Grid Backend | **Active** badge (`.badge-active`) |
| Database | `Connected` — `var(--mono)`, `11px`, color `#15803d` (green) |
| Brain Containers | `3 / 3` — `var(--mono)`, `12px`, color `var(--ink)`; with sub-text `"running"` in muted 10px |
| API Gateway | `Online` — `var(--mono)`, `11px`, color `#15803d` |
| Last Tick At | `05:42:07 UTC` — `var(--mono)`, `11px`, color `var(--muted)` |

---

## 10. Recent Events Feed

**Element**: `<section class="events-section">`
**Margin-top**: `0` (comes after the body-grid)
**Margin-bottom**: `0`

### 10a. Section Header

**Layout**: `display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px;`

**Title**: `"Recent Events"` — `var(--serif)`, `20px`, `font-weight: 400`
**Sub-text**: `"Last 8 grid events"` — `var(--mono)`, `10.5px`, color `var(--muted)`

### 10b. Events Card Wrapper

**Same card styling** as Nous Roster: vellum bg, rule border, 10px radius, terracotta top-stripe via `::before`.

### 10c. Event Row Pattern

**Element**: `<div class="event-row">`
```css
.event-row {
  display: grid;
  grid-template-columns: 80px 140px 1fr;
  gap: 12px;
  align-items: center;
  padding: 11px 16px;
  border-bottom: 1px solid var(--rule-soft);
  transition: background 0.12s;
}
.event-row:last-child { border-bottom: none; }
.event-row:hover { background: rgba(184,84,47,0.03); }
```

**Column 1 — Tick** (80px):
- Font: `var(--mono)`, `11px`
- Color: `var(--muted)`
- Content format: `#48,291`

**Column 2 — Event Type Badge** (140px):
- `.badge.badge-event` styling
- Background: `rgba(22,33,61,0.07)`
- Color: `var(--navy)`
- Font: `var(--mono)`, `10px`, uppercase, `letter-spacing: 0.10em`
- Border-radius: `4px`
- Padding: `3px 8px`
- `display: inline-block`

**Column 3 — Description** (flex 1):
- Font: `var(--sans)`, `13px`
- Color: `var(--ink)`
- Line-height: `1.45`
- Agent name in description: `font-weight: 600`

### 10d. Event Data (8 events, newest first)

| Tick | Event Type Badge | Description |
|------|-----------------|-------------|
| `#48,291` | `TRADE.EXECUTED` | **Hermes** sold 40 ℂ of Insight Shards to **Sophia** |
| `#48,289` | `SKILL.TAUGHT` | **Sophia** taught *Dialectic Reasoning* to **Themis** (cost: 15 ℂ) |
| `#48,285` | `NORM.CRYSTALLIZED` | New norm established: *"Offer before withholding"* — passed 14:2 |
| `#48,280` | `HUMAN.JOINED` | Human `0x4F2a…c3B1` entered the Grid via Genesis portal |
| `#48,271` | `TRADE.PROPOSED` | **Hermes** proposed trade to **Sophia** — 25 ℂ for Memory Fragments |
| `#48,264` | `NOUS.SPOKE` | **Themis** broadcast decree to Forum region (12 listeners) |
| `#48,258` | `TICK` | Tick 48,258 completed — 0 violations, 2 trades settled |
| `#48,240` | `NOUS.SPAWNED` | **Themis** spawned as Lawkeeper in Forum region |

**Event type badge colors** — override `.badge-event` per category:

| Event prefix | Background | Color |
|-------------|-----------|-------|
| `TRADE.*` | `rgba(138,106,59,0.12)` | `var(--bronze)` |
| `SKILL.*` | `rgba(22,33,61,0.10)` | `var(--navy)` |
| `NORM.*` | `rgba(184,84,47,0.10)` | `var(--terracotta)` |
| `HUMAN.*` | `rgba(42,138,127,0.12)` | `#2a8a7f` (teal) |
| `NOUS.*` | `rgba(11,18,32,0.08)` | `var(--muted)` |
| `TICK` | `rgba(11,18,32,0.06)` | `rgba(11,18,32,0.40)` |

---

## 11. Typography Specification

| Element | Font | Size | Weight | Color | Notes |
|---------|------|------|--------|-------|-------|
| Page body | Inter Tight | 14px | 400 | `--ink` | |
| Header brand name | Cormorant Garamond | 17px | 400 | `--parchment` | `letter-spacing: -0.01em` |
| Top nav links | JetBrains Mono | 11px | 400 | `--muted-dark` | uppercase, `letter-spacing: 0.12em` |
| Section titles | Cormorant Garamond | 20px | 400 | `--ink` | `letter-spacing: -0.01em` |
| Stat card values | Cormorant Garamond | 36px | 400 | `--ink` | `letter-spacing: -0.01em` |
| Stat card labels | JetBrains Mono | 9.5px | 500 | `--muted` | uppercase, `letter-spacing: 0.16em` |
| Stat card sub-labels | JetBrains Mono | 10.5px | 400 | `--muted` | |
| Table headers | JetBrains Mono | 9.5px | 500 | `--muted` | uppercase, `letter-spacing: 0.14em` |
| Table agent names | Inter Tight | 13px | 500 | `--ink` | |
| Table DID | JetBrains Mono | 11.5px | 400 | `--muted` | truncated with ellipsis |
| Table numbers | JetBrains Mono | 12px | 400 | `--ink` | right-aligned |
| Sidebar nav labels | Inter Tight | 13px | 500 | `--muted-dark` | |
| Card eyebrow | JetBrains Mono | 9px | 500 | `--terracotta` | uppercase, `letter-spacing: 0.18em` |
| Card titles | Cormorant Garamond | 16px | 500 | `--ink` | |
| Card stat labels | Inter Tight | 12.5px | 400 | `--muted` | |
| Card stat values | JetBrains Mono | 13px | 500 | `--ink` | |
| Badge text | JetBrains Mono | 10px | 500 | varies | uppercase, `letter-spacing: 0.10em` |
| Event tick | JetBrains Mono | 11px | 400 | `--muted` | |
| Event description | Inter Tight | 13px | 400 | `--ink` | agent names bold (600) |
| Footer note | JetBrains Mono | 9.5px | 400 | `rgba(11,18,32,0.35)` | |

---

## 12. Interaction Patterns

### Hover States

| Element | Hover behavior |
|---------|---------------|
| Top nav links | `background: rgba(241,234,216,0.07); color: rgba(241,234,216,0.85)` (0.15s ease) |
| Sidebar nav items | `background: rgba(241,234,216,0.05); color: rgba(241,234,216,0.85); border-left-color: rgba(184,84,47,0.40)` |
| Roster table rows | `background: rgba(184,84,47,0.04)` |
| Event rows | `background: rgba(184,84,47,0.03)` |
| Governance "View all" link | `text-decoration: underline` |
| Stat cards | Subtle lift: `box-shadow: 0 2px 8px rgba(11,18,32,0.06)` added on hover (0.2s ease) |

### Stat Card Micro-animation

The Grid Tick value should have a subtle pulse to indicate liveness. Apply to the `#48,291` number element:
```css
@keyframes tick-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.72; }
}
.stat-card.live .stat-value {
  animation: tick-pulse 3s ease-in-out infinite;
}
```
Only the Grid Tick card gets class `live`.

### Active Nav Dot

The Dashboard nav dot in the sidebar should have a gentle pulse (same as `noesis-world.html` `.pill .dot`):
```css
@keyframes dot-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(184,84,47,0.5); }
  50% { box-shadow: 0 0 0 4px rgba(184,84,47,0); }
}
.nav-item.active .nav-dot {
  animation: dot-pulse 2.4s ease-out infinite;
}
```

---

## 13. Page-Level Structure (HTML Skeleton)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — Noēsis Steward Console</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="[Google Fonts URL]" rel="stylesheet">
  <style>
    /* All CSS here */
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand-zone">
      <span class="brand-name">Noēsis <span class="brand-sep">·</span> Steward Console</span>
      <span class="version-badge">v2.5</span>
    </div>
    <nav class="topnav-links">
      <a href="#" class="topnav-link active">Dashboard</a>
      <a href="#" class="topnav-link">Nous Roster</a>
      <a href="#" class="topnav-link">Economy</a>
      <a href="#" class="topnav-link">Governance</a>
      <a href="#" class="topnav-link">Lore</a>
      <a href="#" class="topnav-link">System</a>
    </nav>
    <div class="operator-avatar">OP</div>
  </header>

  <div class="app-shell">
    <nav class="sidebar">
      <div class="sidebar-group-label">Operator</div>
      <a href="#" class="nav-item active">
        <span class="nav-dot"></span>Dashboard
      </a>
      <a href="#" class="nav-item">
        <span class="nav-dot"></span>Nous Roster
      </a>
      <a href="#" class="nav-item">
        <span class="nav-dot"></span>Economy
      </a>
      <a href="#" class="nav-item">
        <span class="nav-dot"></span>Governance
      </a>
      <a href="#" class="nav-item">
        <span class="nav-dot"></span>Lore
      </a>
      <a href="#" class="nav-item">
        <span class="nav-dot"></span>System
      </a>
      <div class="sidebar-divider"></div>
      <div class="sidebar-group-label">Grid</div>
      <a href="#" class="nav-item">
        <span class="nav-dot"></span>Tick History
      </a>
      <a href="#" class="nav-item">
        <span class="nav-dot"></span>Audit Log
      </a>
      <a href="#" class="nav-item">
        <span class="nav-dot"></span>Config
      </a>
      <div class="sidebar-footer">
        <span class="status-dot online"></span>Grid: Online
      </div>
    </nav>

    <main class="content">
      <div class="content-inner">
        <!-- Hero stat strip -->
        <section class="stat-strip">
          <!-- 4 stat cards -->
        </section>

        <!-- Two-column body grid -->
        <div class="body-grid">
          <!-- Left: Nous Roster table -->
          <section class="roster-section">...</section>
          <!-- Right: sidebar cards stack -->
          <div class="right-sidebar">
            <div class="card economy-card">...</div>
            <div class="card governance-card">...</div>
            <div class="card system-card">...</div>
          </div>
        </div>

        <!-- Recent events feed -->
        <section class="events-section">...</section>
      </div>
    </main>
  </div>
</body>
</html>
```

---

## 14. Page-Level Measurements

| Property | Value |
|----------|-------|
| Header height | `56px` |
| Sidebar width | `240px` |
| Content padding | `28px 32px` |
| Card border-radius | `10px` |
| Card top-stripe height | `2px` |
| Stat strip gap | `16px` |
| Body grid gap | `20px` |
| Right sidebar width | `320px` |
| Events feed max-width | `100%` (full content width) |
| Badge border-radius | `4px` |
| Button border-radius | `9px` (if any CTAs added) |
| Sidebar nav item left-border | `2px` |
| Transition speed | `0.15s ease` (nav), `0.12s ease` (rows) |

---

## 15. Color Usage Summary

| Surface | Color |
|---------|-------|
| Page background | `#f1ead8` (`--parchment`) |
| Card background | `#faf6ec` (`--vellum`) |
| Header + sidebar background | `#1a1714` (`--sidebar-bg`) |
| Card border | `rgba(11,18,32,0.15)` (`--rule`) |
| Row separator | `rgba(11,18,32,0.08)` (`--rule-soft`) |
| Primary accent | `#b8542f` (`--terracotta`) |
| Secondary accent | `#d97a4f` (`--terracotta-2`) |
| Bronze accent | `#8a6a3b` (`--bronze`) |
| Active/Online green | `#4ade80` (bright), `#15803d` (text) |
| Muted text (light bg) | `rgba(11,18,32,0.55)` (`--muted`) |
| Muted text (dark bg) | `rgba(241,234,216,0.55)` (`--muted-dark`) |
| Heading text | `#0b1220` (`--ink`) |
| On-dark text | `#f1ead8` (`--parchment`) |

---

*Spec version: 1.0 · Generated 2026-05-20 · For Steward Console HTML demo (`steward-console.html`)*
