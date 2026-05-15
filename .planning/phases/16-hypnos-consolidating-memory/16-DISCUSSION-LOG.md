# Phase 16: Hypnos (Consolidating Memory) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 16 — Hypnos (Consolidating Memory)
**Areas discussed:** Episode sources, Sleep trigger, Concept nodes, Peer voices scope

---

## Episode Sources

| Option | Description | Selected |
|--------|-------------|----------|
| All Memory objects by recency | Observations, conversations, events from MemoryStream — broadest consolidation, reuses existing infrastructure | ✓ |
| AAU pages only | WikiCategory.LEARNED pages from the AAU fetcher only | |
| AAU + high-importance memories | AAU pages + MemoryStream entries with importance ≥ 7.0 | |

**User's choice:** All Memory objects by recency
**Notes:** Broadest consolidation — a Nous integrates everything it experienced in a single cognitive buffer.

---

## Sleep Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed tick interval | Every SLEEP_MIN_INTERVAL ticks (default 30) | ✓ |
| Working Memory full | Sleep fires when the 7th slot is inserted | |
| Both (interval + capacity) | Sleep fires at the tick interval OR when Working Memory hits cap=7 | |

**User's choice:** Fixed tick interval
**Notes:** Simple, predictable, easy to test determinism. iris/config.py hint confirms SLEEP_MIN_INTERVAL=30.

---

## Concept Nodes

| Option | Description | Selected |
|--------|-------------|----------|
| Content hash as node ID | sha256(episode.content)[:16] = node ID; two identical episodes → same node (dedup) | ✓ |
| Sentence-level chunks | Split episode by sentence; each chunk = node | |
| Source DID tuples | (source_did, memory_type) pairs as nodes | |

**User's choice:** Content hash as node ID
**Notes:** Fully deterministic, no LLM call, O(episodes²) edge updates per sleep. Dedup is automatic.

---

## Peer Voices Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — Phase 16 owns it | Complete ObservationalLearner + peer_voices wiring in handler | ✓ |
| No — separate or skip | ObservationalLearner out of scope for Phase 16 | |

**User's choice:** Yes — Phase 16 owns it
**Notes:** observational.py docstring says Phase 16; system prompt slot labeled Phase 16; handler has zero wiring. Phase 16 completes it.

---

## Claude's Discretion

- LTM graph serialization format for ltm_snapshot_hash computation
- SQLite pragma tuning beyond WAL for ltm_{did_safe}.db
- Test fixture format for sleep boundary events
- recency_factor formula for LTM retrieval ranking

## Deferred Ideas

- REM dreaming / creative recombination
- Cross-Nous LTM merging (anti-feature)
- LTM external database export (anti-feature)
- Dashboard LTM panel
