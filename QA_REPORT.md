# QA Report — Steward Console HTML
Generated: 2026-05-20 · Evaluator agent against SPEC.md v1.0

---

## Criterion 1: Spec Completeness — 9/10

**What was checked**: All SPEC.md sections (§1–§15) against actual HTML.

**Present and correct**:
- Top header bar with brand, version badge, top-nav, operator avatar ✓
- Left sidebar with "Operator" label, all 6 nav items, "Grid" section label, 3 secondary items, footer with green dot and "Grid: Online" ✓
- Hero stat strip (4 cards, correct values, correct sub-labels) ✓
- Nous Roster table (7 columns, all 3 agents with correct data) ✓
- Economy card (all 4 stat rows, footer note) ✓
- Governance card (2 proposals with correct vote counts) ✓
- System Health card (all 5 rows) ✓
- Recent Events feed (8 events, newest first, all event types) ✓
- Micro-animations: `tick-pulse` on `.stat-card.live`, `dot-pulse` on active nav dot ✓
- Stat card hover `box-shadow` ✓
- All CSS token variables declared per spec §2 ✓

**Deduction**:
- The "Last 8 grid events" sub-text in the Events section header is rendered using the `.section-count-badge` class but with `background:transparent; color:var(--muted); padding:0` as an inline override — it does not match the spec's stated style for the sub-text: `var(--mono)`, `10.5px`, `color: var(--muted)`. The spec says it should be a separate sub-text element distinct from the count badge pattern, not an overridden badge. Minor presentational inconsistency. **−0.5**
- The `stat-card-label` class applies `font-weight: 500` but spec §6 says the stat card label font-weight is not explicitly specified (just `var(--mono)`, `9.5px`). Typography table §11 says weight 500 for "Stat card labels." This is actually correct — no deduction.
- The Events section sub-text uses `background:transparent` via inline style rather than a clean semantic class. Minor. **−0.5**

**Score: 9/10**

---

## Criterion 2: Design Fidelity — 9.5/10

**Token usage verified**:

| Token | Spec value | HTML value | Match |
|-------|-----------|-----------|-------|
| `--ink` | `#0b1220` | `#0b1220` | ✓ |
| `--navy` | `#16213d` | `#16213d` | ✓ |
| `--parchment` | `#f1ead8` | `#f1ead8` | ✓ |
| `--vellum` | `#faf6ec` | `#faf6ec` | ✓ |
| `--terracotta` | `#b8542f` | `#b8542f` | ✓ |
| `--terracotta-2` | `#d97a4f` | `#d97a4f` | ✓ |
| `--bronze` | `#8a6a3b` | `#8a6a3b` | ✓ |
| `--rule` | `rgba(11,18,32,0.15)` | `rgba(11,18,32,0.15)` | ✓ |
| `--rule-soft` | `rgba(11,18,32,0.08)` | `rgba(11,18,32,0.08)` | ✓ |
| `--muted` | `rgba(11,18,32,0.55)` | `rgba(11,18,32,0.55)` | ✓ |
| `--muted-dark` | `rgba(241,234,216,0.55)` | `rgba(241,234,216,0.55)` | ✓ |
| `--sidebar-bg` | `#1a1714` | `#1a1714` | ✓ |

**Card top-stripe**: All cards use `.card::before`, `.table-card::before`, `.events-card::before`, and `.stat-card::before` with `height: 2px; background: linear-gradient(90deg, var(--terracotta), var(--terracotta-2))`. Present on every card type ✓

**Sidebar active state**: `.nav-item.active { background: var(--sidebar-active-bg); color: var(--terracotta-2); border-left-color: var(--terracotta); }` matches spec §4b exactly ✓

**Topbar border**: `1px solid rgba(241,234,216,0.10)` matches spec ✓

**Header height**: `56px` ✓  
**Sidebar width**: `240px` ✓  
**Content padding**: `28px 32px` ✓  
**Body-grid columns**: `1fr 320px` ✓  
**Card border-radius**: `10px` ✓

**Deduction**:
- The `.stat-last-of-type` approach for removing borders: `.stat-row:last-of-type` in CSS removes the last `.stat-row` border. However, the economy card wraps rows in a `<div style="margin-top: 10px;">` and the selector `:last-of-type` on div elements would actually not work correctly here — `last-of-type` applies to siblings of the same tag type. Since all `.stat-row` are divs, `:last-of-type` selects the last `div` which IS the last stat row in this case. Functionally OK, but this is a subtle reliance on document structure that could break. **−0.5**

**Score: 9.5/10**

---

## Criterion 3: Badge/Status Correctness — 10/10

**All 6 badge variants verified in CSS**:

| Variant | Class | Background | Color | Present |
|---------|-------|-----------|-------|---------|
| Active | `.badge-active` | `rgba(74,222,128,0.12)` | `#15803d` | ✓ |
| Sleeping | `.badge-sleeping` | `rgba(11,18,32,0.07)` | `var(--muted)` | ✓ |
| Voting | `.badge-voting` | `rgba(138,106,59,0.12)` | `var(--bronze)` | ✓ |
| Passed | `.badge-passed` | `rgba(184,84,47,0.10)` | `var(--terracotta)` | ✓ |
| Pending | `.badge-pending` | `rgba(11,18,32,0.06)` | `var(--muted)` | ✓ |
| Event | `.badge-event` | `rgba(22,33,61,0.07)` | `var(--navy)` | ✓ |

**All 6 event type color overrides verified**:

| Prefix | Class | Background | Color | Present |
|--------|-------|-----------|-------|---------|
| TRADE.* | `.badge-trade` | `rgba(138,106,59,0.12)` | `var(--bronze)` | ✓ |
| SKILL.* | `.badge-skill` | `rgba(22,33,61,0.10)` | `var(--navy)` | ✓ |
| NORM.* | `.badge-norm` | `rgba(184,84,47,0.10)` | `var(--terracotta)` | ✓ |
| HUMAN.* | `.badge-human` | `rgba(42,138,127,0.12)` | `#2a8a7f` | ✓ |
| NOUS.* | `.badge-nous` | `rgba(11,18,32,0.08)` | `var(--muted)` | ✓ |
| TICK | `.badge-tick` | `rgba(11,18,32,0.06)` | `rgba(11,18,32,0.40)` | ✓ |

**Dot element**: `.badge-dot` present at `font-size: 8px` with `●` character in all non-event badges ✓  
**Badge base**: `font-family: var(--mono)`, `10px`, `font-weight: 500`, `letter-spacing: 0.10em`, `text-transform: uppercase`, `border-radius: 4px`, `padding: 3px 8px` — all match spec §8e exactly ✓

**Used correctly in HTML**:
- Sophia and Hermes: `.badge-active` ✓
- Themis: `.badge-sleeping` ✓
- Proposal 1: `.badge-voting` ✓
- Proposal 2: `.badge-pending` ✓
- Grid Backend in System card: `.badge-active` ✓
- `.badge-passed` defined in CSS and available (not instantiated in current data — spec listed it as a defined variant, not necessarily used) ✓

**Score: 10/10**

---

## Criterion 4: Table Quality — 9/10

**7 columns present**: NAME, ROLE, DID, REGION, STATUS, SKILLS, LAST TICK ✓

**Column widths set**: `style="width:180px"`, `130px`, `180px`, `100px`, `90px`, `70px`, `90px` — matches spec §8c exactly ✓

**DID truncation**: `.mono` class on DID cells has `max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` ✓. Full DID in `title` attribute as bonus ✓

**Status badge inline**: Badges rendered in `<td>` with `vertical-align: middle` ✓

**Terracotta hover tint**: `.roster-table tbody tr:hover { background: rgba(184,84,47,0.04); }` ✓

**Rule-soft row separators**: `.roster-table tbody tr { border-bottom: 1px solid var(--rule-soft); }` and `tr:last-child { border-bottom: none; }` ✓

**Agent name + sub-label stacking**: `.agent-name` (Inter Tight 500) + `.agent-sub` (JetBrains Mono 10px muted) correctly stacked ✓

**Right-aligned numbers**: SKILLS and LAST TICK columns use `.num` class with `text-align: right` ✓. Header columns have `.align-right` ✓

**Table card wrapper**: `.table-card` with vellum bg, rule border, 10px radius, terracotta top-stripe ✓

**Thead background**: `rgba(11,18,32,0.03)` with `border-bottom: 1px solid var(--rule)` ✓

**Deduction**:
- Column widths use inline `style` attributes on `<th>` elements rather than `<col>` or `<colgroup>` elements. This is functionally equivalent but less semantic/maintainable. The spec does not mandate `<col>` usage, so this is a minor point. **−0.5**
- The spec says "last row: no border-bottom" — implemented correctly with `:last-child`, not `:last-of-type`. ✓
- The Role column shows "Philosopher", "Trader", "Lawkeeper" which exactly duplicates the agent sub-label. This is per spec §8d which does include separate Role column values. ✓

**Score: 9/10** (−1 for inline style widths per self-check acknowledgement; evaluator agrees it's the only notable variance)

---

## Criterion 5: Typography — 9.5/10

**Cormorant Garamond usage verified**:

| Element | Spec | HTML | Match |
|---------|------|------|-------|
| Brand name | 17px, 400, `--parchment` | `.brand-name`: 17px, 400, `var(--parchment)` | ✓ |
| Section titles | 20px, 400 | `.section-title`: 20px, 400 | ✓ |
| Stat card values | 36px, 400 | `.stat-card-value`: 36px, 400, `line-height: 1.0` | ✓ |
| Card titles | 16px, 500 | `.card-title`: 16px, 500 | ✓ |

**Inter Tight usage verified**:

| Element | Spec | HTML | Match |
|---------|------|------|-------|
| Body | 14px, 400 | `body`: 14px, 400 | ✓ |
| Table cells | 13px, default | `.roster-table tbody td`: 13px | ✓ |
| Agent names | 13px, 500 | `.agent-name`: font-weight 500 (inherits sans) | ✓ |
| Card stat labels | 12.5px | `.stat-row-label`: 12.5px | ✓ |
| Sidebar nav | 13px, 500 | `.nav-item`: 13px, 500 | ✓ |

**JetBrains Mono usage verified**:

| Element | Spec | HTML | Match |
|---------|------|------|-------|
| Top nav links | 11px, uppercase, 0.12em | `.topnav-link`: 11px, uppercase, 0.12em | ✓ |
| Stat card labels | 9.5px, uppercase, 0.16em | `.stat-card-label`: 9.5px, uppercase, 0.16em | ✓ |
| Stat card sub-labels | 10.5px | `.stat-card-sub`: 10.5px | ✓ |
| Table headers | 9.5px, 0.14em | `.roster-table thead th`: 9.5px, 0.14em | ✓ |
| DID cells | 11.5px | `.mono`: 11.5px | ✓ |
| Numbers (Skills, Last Tick) | 12px | `.num`: 12px | ✓ |
| Sidebar group labels | 9.5px, 0.18em | `.sidebar-group-label`: 9.5px, 0.18em | ✓ |
| Sidebar footer | 10px | `.sidebar-footer-text`: 10px | ✓ |
| Card eyebrows | 9px, 0.18em | `.card-eyebrow`: 9px, 0.18em | ✓ |
| Badge text | 10px, 0.10em | `.badge`: 10px, 0.10em | ✓ |
| Event ticks | 11px | `.event-tick`: 11px | ✓ |
| Card footer note | 9.5px | `.card-footer-note`: 9.5px | ✓ |
| Event descriptions | 13px, Inter Tight | `.event-desc`: 13px, `var(--sans)` | ✓ |
| Agent sub-labels | mono, 10px | `.agent-sub`: mono, 10px | ✓ |

**Google Fonts import**: Correct URL with all three families + all weights per spec §2 ✓

**Deduction**:
- The spec §11 states `letter-spacing: -0.01em` for brand name, section titles, and stat card values. Brand name has it (line 93: `letter-spacing: -0.01em`). Section titles are in `.section-title` — the CSS does NOT include `letter-spacing: -0.01em` on that class (it only has `font-family`, `font-size`, `font-weight`, `color`). This is a **missed spec requirement**. **−0.5**

**Score: 9.5/10**

---

## Weighted Final Score

| Criterion | Raw Score | Weight | Weighted |
|-----------|-----------|--------|---------|
| Spec completeness | 9/10 | 0.25 | 2.25 |
| Design fidelity | 9.5/10 | 0.30 | 2.85 |
| Badge/status correctness | 10/10 | 0.15 | 1.50 |
| Table quality | 9/10 | 0.15 | 1.35 |
| Typography | 9.5/10 | 0.15 | 1.425 |
| **Total** | | | **9.375 / 10** |

---

## Judgment: PASS

**Score: 9.4 / 10** (rounds to 9.4, threshold ≥7.5)

---

## Issues for Improvement (in priority order)

### Issue 1 — Missing `letter-spacing` on section titles (Typography, §11)

**Where**: `.section-title` CSS rule (line ~399–405 in HTML)  
**Problem**: Spec §11 requires `letter-spacing: -0.01em` on section titles (Cormorant Garamond 20px elements). It is present on `.brand-name` and `.stat-card-value` but absent from `.section-title`.  
**Fix**:
```css
.section-title {
  font-family: var(--serif);
  font-size: 20px;
  font-weight: 400;
  letter-spacing: -0.01em;   /* ADD THIS */
  color: var(--ink);
}
```

### Issue 2 — Events sub-text uses overridden badge style rather than clean element (Completeness, §10a)

**Where**: Line ~1077 in HTML  
**Problem**: The "Last 8 grid events" sub-text is implemented as `<span class="section-count-badge" style="background:transparent; color:var(--muted); padding:0;">`. Spec §10a specifies it as a sub-text with `var(--mono)`, `10.5px`, `color: var(--muted)` — a distinctly styled element, not a hacked badge.  
**Fix**: Replace with a dedicated class or inline style that genuinely reflects the spec intent:
```html
<span style="font-family:var(--mono); font-size:10.5px; color:var(--muted);">Last 8 grid events</span>
```
Or add a `.section-sub-text` CSS class.

### Issue 3 — `.stat-row:last-of-type` border removal is fragile (Fidelity, §9a)

**Where**: `.stat-row:last-of-type` in CSS (line ~594)  
**Problem**: Works currently because all `.stat-row` divs are siblings, but `:last-of-type` on generic `div` elements is structurally fragile. The spec says "last row: no border-bottom."  
**Fix**: Use `.stat-row:last-child` instead, which is more semantically aligned with "last row" intent:
```css
.stat-row:last-child {
  border-bottom: none;
}
```
(Same fix applies to `.proposal-row:last-of-type` → `.proposal-row:last-child` and `.health-row:last-of-type` → `.health-row:last-child`.)

---

*All three issues are minor polish items. The page is production-quality and fully usable as specified.*
