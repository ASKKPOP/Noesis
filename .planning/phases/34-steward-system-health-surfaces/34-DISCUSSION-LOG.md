# Phase 34: Steward `/system` Health Surfaces — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 34-steward-system-health-surfaces
**Areas discussed:** Sparkline rendering technique, Reasons-array display, Stale Allowlist Monitor
**Skipped (Claude's Discretion):** Card design & layout

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Card design & layout | Three separate vs one combined section; layout, sparkline bucket granularity, sparkline width | |
| Sparkline rendering technique | Raw SVG vs CSS flex divs vs mixed | ✓ |
| Reasons-array display | Extend payload vs derive client-side vs generic | ✓ |
| Stale Allowlist Monitor | Fix to 56 vs defer to Phase 35 vs dynamic endpoint | ✓ |

---

## Sparkline rendering technique

### Q1: Which rendering primitive should EventsPerMinuteSparkline.tsx use?

| Option | Description | Selected |
|--------|-------------|----------|
| Raw inline SVG (recommended) | Matches v2.4 culture-dashboard invariant. Single SVG element with `<rect>` per bucket-family pair. ~80 lines for 5 buckets × 10 families. | |
| CSS flex divs | Lightest. Nested `<div>` with background colors and flex widths. ~40 lines. Cost: breaks 'raw SVG for charts' precedent. | |
| Mixed (SVG for events, CSS for frame counter) | SVG for stacked-bar Events-per-Minute (multi-family geometry); CSS divs for 12-point frame-counter sparkline (single-color). Two visual conventions. | ✓ |

**User's choice:** Mixed (SVG for events, CSS for frame counter)
**Notes:** Optimizes each tool for its job. Two visual conventions accepted as trade-off for cleanest implementation per surface.

---

### Q2: How should EventsPerMinuteSparkline bucket the 'last 5 minutes' window?

| Option | Description | Selected |
|--------|-------------|----------|
| 5 buckets (1 per minute, recommended) | 5 wide stacked bars labeled '-4m' … 'now'. Reads cleanly at a glance. Matches REQ phrasing literally. | |
| 30 buckets (1 per 10s) | 30 thin bars; more responsive but harder to read individual bars. | |
| 60 buckets (1 per 5s, matches poll cadence) | 60 thin bars; one per /health/detailed poll. Tightest correlation with frame-counter sparkline. Very thin bars, family colors hard to distinguish. | ✓ |

**User's choice:** 60 buckets (1 per 5s, matches poll cadence)
**Notes:** Maximum temporal resolution prioritized over individual bar readability.

---

### Q3: How should the 12-point frame-counter sparkline render?

| Option | Description | Selected |
|--------|-------------|----------|
| 12 thin vertical bars (recommended) | Each bar height = (frames_sent in 5s delta) / max in window. Matches Events-per-Minute bar language. Single accent color. | |
| Polyline (SVG) | 12 points connected by a line. Traditional sparkline. Cost: violates the CSS-for-frame-counter decision from Q1. | |
| Two stacked rows of bars (sent + dropped) | Top row = frames_sent delta, bottom row = frames_dropped delta. Both signals at 5s granularity. Visually busier. | ✓ |

**User's choice:** Two stacked rows of bars (sent + dropped)
**Notes:** Both signals visible side-by-side. Implementation: CSS-div bars per Q1 primitive decision.

---

## Reasons-array display

### Q1: How should the Steward cards surface WHY status is degraded/critical?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend /health/detailed payload (recommended) | Add optional `readonly reasons: string[]` to HealthDetailedPayload. Additive non-breaking. Phase 32 D-32-C2 anticipated this. Server is single source of truth. | ✓ |
| Derive client-side from raw values | Steward re-implements predicate logic. Cost: drift risk; two sources of truth. Zero grid/ changes. | |
| Generic 'Degraded' with no detail | Card shows status banner only. Operator clicks through to logs. Smallest code surface. | |
| Tooltip-only reasons (hybrid) | Extend payload as in option 1 but render in title= tooltip only. Cleaner default. Same backend cost. | |

**User's choice:** Extend /health/detailed payload (recommended)
**Notes:** Phase 32 D-32-C2 explicitly anticipated this additive path. Server is single source of truth.

---

### Q2: What format should the reasons array entries take?

| Option | Description | Selected |
|--------|-------------|----------|
| Snake_case keys (recommended, current shape) | 'reconcile_stale', 'stale_frames', 'divergence_above_degraded'. Greppable. Matches Pino warn-log shape. Steward maps client-side. | ✓ |
| Human-readable sentences | Server returns 'Reconcile loop has not run for 2 minutes', etc. Cost: server owns presentation; localization-hostile. | |
| Structured objects (code + context) | Each reason is `{ code, context }`. Lets UI render with live numbers. Cost: payload growth; more complex contract. | |

**User's choice:** Snake_case keys
**Notes:** Server contract stays stable; Steward maps to human labels in steward/src/lib/health-reason-labels.ts.

---

### Q3: When/where should reasons be displayed?

| Option | Description | Selected |
|--------|-------------|----------|
| Visible sub-line under status when degraded/critical (recommended) | Comma-separated muted sub-line directly under status banner. Always visible; no hover. Empty array on 'ok' renders nothing. | ✓ |
| Hover tooltip only | Status badge gets title= attribute. Cleaner default. Cost: mobile/touch unfriendly; one extra interaction. | |
| Expandable details panel | Small caret + inline disclosure. Most detail-rich. Cost: more UI to design and test. | |

**User's choice:** Visible sub-line under status when degraded/critical
**Notes:** Glance-distance reading prioritized over interaction-cost. Operator sees WHY immediately.

---

## Stale Allowlist Monitor

### Q1: How should the stale Allowlist Monitor reference be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Fix to 56 statically in Phase 34 (recommended) | Add 11 missing entries (positions 46–56) inline. Single small commit. Restores parity with cards directly above. Will go stale again on next growth. | ✓ |
| Defer to Phase 35 doc-sync (strict scope) | Phase 34 doesn't touch the existing Allowlist Monitor. Cost: ship-time Phase 34 looks visibly inconsistent (cards show 56-event reality, monitor below says 45). | |
| Convert to dynamic fetch from /api/v1/audit/allowlist | New Grid endpoint; Steward fetches on mount. Future-proof. Cost: cross-workspace scope creep; sole-producer + CI gate needed; not in REQUIREMENTS.md. | |
| Fix to 56 + add CI gate | Option 1 PLUS scripts/check-steward-allowlist-sync.mjs. Cost: one more CI gate to maintain. | |

**User's choice:** Fix to 56 statically in Phase 34
**Notes:** Single small commit acceptable; user-acknowledged trade-off that the list will go stale on next allowlist growth. CI gate deferred to v2.7+ if pattern recurs.

---

## Claude's Discretion

Areas where Claude has flexibility during planning/implementation:

- Card design & layout (user explicitly skipped this area)
- Hook architecture for `use-health-detailed.ts` (SWR-shape vs plain useEffect+setInterval)
- Watchdog refactor extent for `/firehose` (extract WS code vs add watchdog inline)
- Snake_case → human label mapping table contents in `steward/src/lib/health-reason-labels.ts`
- Exact producer-file paths for the 11 new ALLOWLIST_STATIC entries
- Sparkline hover/tooltip behavior (title= attributes vs no tooltips)
- Frame-counter sparkline exact colors (terracotta confirmed for dropped; sent palette TBD)
- Empty-state copy for 503 / cold-start grace / client_count=0
- UAT shape (mirrors Phase 31/32 playbook)
- Where to compute frame-counter deltas (inside hook vs in component)

## Deferred Ideas

Captured in 34-CONTEXT.md `<deferred>` section. Highlights:

- CI gate `scripts/check-steward-allowlist-sync.mjs` (v2.7+ if pattern recurs)
- Dynamic `/api/v1/audit/allowlist` endpoint (v2.7+ if dashboards need allowlist introspection)
- OpenTelemetry self-hosted (OBS-FUTURE-OTEL-01, still deferred)
- Structured reasons objects with context (revisit only if reasons need live numbers)
- Expandable details panel for reasons (revisit if arrays grow >3 entries)
- Steward `/users` consumer adaptation (carried from Phase 33; not Phase 34 scope)

---

*Audit trail generated 2026-05-25.*
