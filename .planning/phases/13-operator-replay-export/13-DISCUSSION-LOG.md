# Phase 13: Operator Replay & Export — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 13-operator-replay-export
**Areas discussed:** Rewind panel placement, Scrubber UX, Replay tier elevation

---

## Gray Area Selection

| Option | Selected |
|--------|----------|
| Rewind panel placement | ✓ |
| Scrubber UX | ✓ |
| Export consent copy | (skipped — ROADMAP defaults used) |
| Replay tier elevation | ✓ |

---

## Rewind Panel Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New route /grid/replay | Dedicated page, bookmarkable URL, clean separation from live state | ✓ |
| Tab on /grid page | Third tab, no navigation needed but URL doesn't distinguish live vs replay | |
| Drawer/slide-over on /grid | Slides over existing grid, inspector feel | |

**User's choice:** New route `/grid/replay`

---

### Follow-up: Nav entry

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, nav entry for Replay | H3+ see Replay link; H1/H2 don't | ✓ |
| No nav entry — linked from export only | Only reachable from export flow or direct URL | |

**User's choice:** Yes, nav entry for Replay (H3+ tier-gated)

---

### Follow-up: Component reuse

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse with read-only prop | Same Firehose/Inspector/RegionMap with replayMode flag | ✓ |
| Simplified replay-specific view | Purpose-built replay components | |

**User's choice:** Reuse with read-only prop

---

## Scrubber UX

| Option | Description | Selected |
|--------|-------------|----------|
| Slider + jump-to-tick input | Timeline slider + numeric input for direct tick | ✓ |
| Step buttons only | Prev/next tick + epoch jump buttons | |
| Slider + step buttons + jump input | All three controls | |

**User's choice:** Slider + jump-to-tick input

---

### Follow-up: Auto-play

| Option | Description | Selected |
|--------|-------------|----------|
| Manual step only — no auto-play | No play button, no wall-clock coupling | ✓ |
| Auto-play with speed control | Play button + speed multiplier | |

**User's choice:** Manual step only

---

## Replay Tier Elevation

| Option | Description | Selected |
|--------|-------------|----------|
| Redact inline, elevate on demand | Placeholder text + Elevate affordance per field, ElevationDialog pops without pausing | ✓ |
| Replay pauses, elevation dialog interrupts | Full-screen ElevationDialog halts view | |
| Pre-gate at replay entry | Operator declares tier before entering /grid/replay | |

**User's choice:** Redact inline, elevate on demand

---

### Follow-up: Tier reset

| Option | Description | Selected |
|--------|-------------|----------|
| Resets when leaving replay | H4/H5 scoped to replay session, resets to H1 on route exit | ✓ |
| Persists until manually downgraded | Elevation stays after leaving replay | |

**User's choice:** Resets when leaving replay (auto-downgrade on unmount)

---

## Export Consent Copy

Not discussed — ROADMAP defaults accepted:
- Title: `Export audit chain slice`
- Confirm: `Export forever`
- Cancel: `Keep private`
- Typed confirmation: Grid-ID string (paste-suppressed)

---

## Claude's Discretion

- ReplayGrid SQLite vs MySQL isolation strategy
- Tarball JSONL manifest field ordering
- `replay-verify` CLI command interface
- `replay.*` event hard-ban enforcement mechanism placement

## Deferred Ideas

- Auto-play / speed multiplier — ruled out (wall-clock coupling concern)
- Decision-level replay — anti-feature (LLM non-determinism)
- Parquet export — deferred to RIG-PARQUET-01
- Mutating rewind — anti-feature
