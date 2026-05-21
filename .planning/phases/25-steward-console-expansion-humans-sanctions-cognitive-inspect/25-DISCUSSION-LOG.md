# Phase 25: Steward Console Expansion — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 25-steward-console-expansion-humans-sanctions-cognitive-inspect
**Areas discussed:** Phase scope, Brain-private boundary, Sanctions catalog, Live firehose + Allowlist monitor, Replay + Culture + Spawn wizard, Humans expansion

---

## Phase Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Ship all 9 in Phase 25 (one fat phase) | Plan and execute everything together | |
| Split into 25a/25b/25c | Group by theme: observer / sanctions+wizard / replay+culture | ✓ |
| Pick top-priority subset, defer rest | 3-4 sections now, others to v2.6 | |
| Discuss scope first, then decide | Talk through load-bearing vs nice-to-have | |

**User's choice:** Split into 25a/25b/25c
**Notes:** Established that 25a = observer surfaces (zero new events), 25b = sanctions + spawn wizard (new operator.* events), 25c = replay + culture (zero new events). Sequential landing.

---

## Brain-Private Boundary — Cognitive Inspector Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Hashes + counts only | Strict invariant — reflexion_count, rule_count, etc, from audit events | |
| Hashes + counts + drive/sleep/iris snapshots | Add observable derived state | |
| Above + Brain-exposed read endpoint (new) | Brain-side read endpoint with scrubbed cognitive metadata | ✓ |

**User's choice:** Brain-exposed read endpoint (new)
**Notes:** New Brain API surface — first read endpoint outside the tick RPC contract. Triggered follow-up on endpoint contract and skill text exposure.

---

## Brain Health — Metric Selection

| Option | Selected |
|--------|----------|
| Tick latency & queue depth per Nous | ✓ |
| Reflexion buffer fill + skill store size + rule count | ✓ |
| Drive levels (Ananke) + sleep cadence (Hypnos) | ✓ |
| Coherence violations + creed activity | ✓ |

**User's choice:** All four
**Notes:** All sourced from existing audit events — zero new events.

---

## Brain Read Endpoint Contract

| Option | Description | Selected |
|--------|-------------|----------|
| HTTP GET /brain/<did>/cognitive-snapshot (steward only) | Steward backend proxies through Grid → Brain | ✓ |
| Audit-event-only (no new Brain endpoint) | Reconsider — derive everything from audit events | |
| Brain pushes periodic snapshot via existing tick RPC | Extend tick response, no new surface but couples tick path | |

**User's choice:** HTTP GET /brain/<did>/cognitive-snapshot
**Notes:** H3+ gated. Returns scrubbed JSON. Grep-gated for plaintext fields. Every query emits operator.inspected.

---

## Skill Titles Exposure

| Option | Description | Selected |
|--------|-------------|----------|
| Hash only | Steward sees skill_hash + popularity rank only | |
| Yes — title only, never body | Titles cross to steward | |
| Hash only on wire, title only at Brain endpoint | Endpoint is the one exposure point, operator-tier gated, audited | ✓ |

**User's choice:** Hash only at Grid wire, title only at Brain endpoint
**Notes:** Explicit, audited exception to Brain-private discipline. Locked.

---

## Sanctions Catalog

| Option | Description | Selected |
|--------|-------------|----------|
| Mute-broadcast | H3, silence Nous from public events | ✓ |
| Slash Cyber Coin balance | H4, zero or fractional reduction | ✓ |
| Quarantine | H4, isolate from peers (no whispers/trades/speech) | ✓ |
| Force-sleep cycle | H3, manual Hypnos NREM trigger | ✓ |

**User's choice:** All four
**Notes:** Each maps to a new sole-producer operator.* event.

---

## Allowlist Budget Handling for Sanctions

| Option | Description | Selected |
|--------|-------------|----------|
| Add only events whose sanction is selected | Each sanction → one new operator.* event | ✓ |
| Reuse existing operator.* with action field | Stretch payloads — violates closed-tuple | |
| Defer new events; ship only existing 43-event sanctions | Pull mute/slash/quarantine/force-sleep | |

**User's choice:** Add new events per selected sanction
**Notes:** +4 Nous sanctions, +2 human sanctions = +6 events total for 25b. Allowlist running total: 53 (after v2.5 portal +4). ROADMAP/STATE sync required when 25b plans.

---

## Live Firehose Differentiation

| Option | Description | Selected |
|--------|-------------|----------|
| New /firehose route, WebSocket tail, no filter, no expand | Two surfaces with different jobs | ✓ |
| Extend /audit with 'live tail' toggle | One route, two modes | |
| /firehose tail + /audit search, shared components | Two routes, shared component library | |

**User's choice:** New /firehose route, pure tail
**Notes:** Tunes for density (1-line rows, color-coded by event family). /audit unchanged.

---

## Allowlist Monitor Job

| Option | Description | Selected |
|--------|-------------|----------|
| Static reference + last-emit timestamps | Read-only, no alerting | |
| Above + runtime drift detector | Grid-side hook on AuditChain.append catches non-allowlisted events | ✓ |
| Above + CI report link | Add CI gate status card | |

**User's choice:** Runtime drift detector
**Notes:** Defense-in-depth beyond CI grep gate. New /audit/drift-alerts endpoint backed by Grid-side ring buffer.

---

## Replay Scrubber UX

| Option | Description | Selected |
|--------|-------------|----------|
| Modal/full-screen ReplayGrid from chain-export entry | Invocation-scoped, modal tears down ReplayGrid on close | ✓ |
| Dedicated /replay route, always-on dev tool | Persistent, multi-session reusable | |
| Inline scrubber on /audit rows | Embedded, no modal | |

**User's choice:** Modal spawn from chain-export entry
**Notes:** Single-tick stepping with keyboard + drag-to-scrub on timeline. Side panel shows firehose+inspector+map at replayed tick.

---

## Culture Browser Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Re-theme Phase 21 SVGs into StewardShell, no logic changes | Pure consolidation | |
| Re-theme + per-Nous cross-filtering | Highlight a Nous's contributions across all three views | ✓ |
| Re-theme + time-window slider | Global tick-range scope across all three | |
| Defer to v2.6 | Phase 21 dashboard ships these already | |

**User's choice:** Re-theme + per-Nous cross-filtering
**Notes:** Client-side dim/highlight pass on existing data. Raw SVG invariant from Phase 21 carries forward.

---

## Spawn-Nous Wizard Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Steward-only wizard for system/researcher Nous (distinct from Phase 27) | Sophia/Hermes/Themis-class, no humanOwner | ✓ |
| Unified wizard — Phase 27 deep-link with H5 override | Wait for Phase 27, deep-link from steward | |
| Defer to Phase 27 entirely | Pull from 25b scope | |

**User's choice:** Steward-only for system/researcher Nous
**Notes:** Distinct code path. H5 gated. Treasury-funded. Creed text stays Brain-private (hash only).

---

## Humans Expansion Scope

| Option | Selected |
|--------|----------|
| Per-human transaction history | ✓ |
| Per-human Nous roster | ✓ |
| Sanction actions (ban, freeze wallet) | ✓ |
| Read-only KYC-ish profile pane | ✓ |

**User's choice:** All four

---

## Humans Phase Assignment

| Option | Description | Selected |
|--------|-------------|----------|
| 25a (Observer) — if read-only only | All read-only items in 25a | |
| 25b (Sanctions) — if ban/freeze included | All in 25b | |
| Split: read-only to 25a, sanctions to 25b | Profile/history/roster in 25a; ban/freeze in 25b | ✓ |

**User's choice:** Split between 25a and 25b
**Notes:** 25b adds operator.human_banned and operator.human_frozen (H5).

---

## Claude's Discretion

- Visual styling, layout, color palettes for new pages
- WebSocket reconnection / backpressure behavior for /firehose
- Form validation copy + error states for sanction dialogs
- Modal animation / transition for replay scrubber
- Brain endpoint authentication mechanism (planner decides from existing Grid↔Brain auth)

## Deferred Ideas

- Dedicated /replay route (always-on)
- Inline replay scrubber on /audit rows
- Time-window slider on /culture
- CI report card on allowlist monitor
- Unified spawn wizard with Phase 27 deep-link
- Component sharing between /audit and /firehose
- Phase 21 dashboard culture views retirement
