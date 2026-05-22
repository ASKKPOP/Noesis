# Phase 25c: Replay Scrubber + Culture Browser — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 25c-replay-scrubber-culture-browser
**Areas discussed:** Replay scrubber surface, Culture browser reuse strategy

---

## Replay Scrubber Surface

| Option | Description | Selected |
|--------|-------------|----------|
| New /replay section in StewardShell nav | Dedicated route listing all operator.exported entries, click one to open scrubber modal | ✓ |
| Modal spawned from firehose | Operator clicks operator.exported event in live firehose to open scrubber | |
| Modal spawned from Nous inspector | Scrubber accessible from the Nous page | |

**User's choice:** New /replay section in StewardShell nav

---

| Option | Description | Selected |
|--------|-------------|----------|
| Table of operator.exported entries | Date, Nous DID, tick range, operator — click row to open scrubber | ✓ |
| Cards grouped by Nous DID | Grouped view, each Nous shows its exports | |
| Just open scrubber directly | Always scrub most recent export, no listing page | |

**User's choice:** Table of operator.exported entries

---

| Option | Description | Selected |
|--------|-------------|----------|
| Tick slider + event list at that tick | Slider across tick range, event list below using ReplayGrid + buildStateAtTick | ✓ |
| Tick slider + relationship graph | Slider + raw-SVG relationship graph state | |
| Event timeline only (no slider) | Scrollable chronological list, no tick-seeking | |

**User's choice:** Tick slider + event list at that tick

---

| Option | Description | Selected |
|--------|-------------|----------|
| Delete dashboard stubs, build fresh in Steward | Clean slate, stubs never finished | |
| Make dashboard stubs green first, then port to Steward | Honour Phase 13 contract, then adapt into Steward | ✓ |
| Keep dashboard stubs, only build Steward version | Leave RED stubs as dead code | |

**User's choice:** Make dashboard stubs green first, then port to Steward

---

## Culture Browser Reuse Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Copy + retheme for Steward CSS | Copy components, swap dashboard Tailwind for Steward CSS variables | |
| Import directly from dashboard as shared package | Monorepo package setup (not currently in place) | |
| Build new Steward-native versions from scratch | New components, same data contracts, full Steward control | ✓ |

**User's choice:** Build new Steward-native versions from scratch

---

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing dashboard API endpoints | Same Grid routes, no new Grid work needed | ✓ |
| New operator-gated Grid endpoint | New H2+ operator route for culture data | |
| Claude's discretion | Use whatever is cleanest | |

**User's choice:** Reuse existing dashboard API endpoints (grid culture routes already exist; Steward routes through operator proxy)

---

## Claude's Discretion

- Per-Nous cross-filter exact UX (picker vs dropdown vs URL param)
- How Steward lists operator.exported entries (new Grid endpoint vs firehose filter)
- Scrubber modal size and slider control style

## Deferred Ideas

- Per-Nous cross-filter deep-link from Nous inspector
- Relationship graph in scrubber modal (user chose event list)
- Shared monorepo component package for culture components
