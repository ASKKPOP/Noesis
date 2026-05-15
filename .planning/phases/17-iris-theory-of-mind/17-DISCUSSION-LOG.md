# Phase 17: Iris (Theory of Mind) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 17 — Iris (Theory of Mind)
**Mode:** --auto (all areas auto-selected; recommended options auto-chosen)
**Areas discussed:** Allowlist Sequencing, elicit() Trigger, Iris Action Types, context_for() Injection, IrisRuntime Initialization, FORBIDDEN_KEY_PATTERN, Dashboard

---

## Prior State at Context Gathering

**Brain module recovered from deletion incident (2026-05-15):**
- iris/types.py, iris/config.py, iris/store.py, iris/elicit.py, iris/integration.py, iris/priors.py, iris/__init__.py — all present
- handler.py: seed_priors() wired; _iris_runtime field exists (uninitialized); elicit() NOT yet called; context_for() NOT yet injected

**Grid side:** No iris/ directory, no allowlist entries for iris.* events, no NousRunner cases

**Broadcast allowlist:** Still at 27 (Phase 15/16 Grid-side additions not yet in code)

---

## Allowlist Sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 17 adds 33-36, assumes 15/16 already done | Wave 0 verifies Phase 15/16 entries; adds if missing | ✓ |
| Phase 17 owns only 33-36, fails if 15/16 missing | Strict prerequisite gate | |

**Auto-selected:** Phase 17 Wave 0 verifies Phase 15/16 allowlist entries (28-32); adds them if missing before adding iris.* at 33-36.

---

## elicit() Trigger Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| On dialogue_context delivery (per peer) | LLM call for each peer in exchange, cooldown enforced | ✓ |
| Every tick for all known peers | Too expensive; LLM on every tick per pair | |
| Manual operator trigger | Breaks autonomous cognition goal | |

**Auto-selected:** elicit() triggered by dialogue_context, once per peer per cooldown window (20 ticks).
**Notes:** If no dialogue_context arrives, only seed_priors() runs (deterministic, no LLM).

---

## Iris Action Types → Grid Emission

| Option | Description | Selected |
|--------|-------------|----------|
| 4 new ActionType members forwarded to Grid | Brain→Grid via NousRunner; sole-producer appendIris* emitters | ✓ |
| Brain emits directly via shared audit module | Breaks sole-producer boundary invariant | |
| Piggyback on existing action types | Payload conflicts; anti-pattern | |

**Auto-selected:** 4 new ActionType members (iris_belief_revised, iris_context_invoked, iris_contradiction_detected, iris_prior_seeded). 3-keys-not-5 invariant. 4 sole-producer emitters in grid/src/iris/.

---

## context_for() Prompt Injection

| Option | Description | Selected |
|--------|-------------|----------|
| "Theory of Mind" section between drives and Telos | Top-5 beliefs per peer, up to 3 peers | ✓ |
| Appended after Telos section | Less visible to LLM in long prompts | |
| Per-peer section (one heading per peer) | Verbose; prompt bloat risk | |

**Auto-selected:** Unified "Theory of Mind" section, between drives and Telos. Up to 3 peers × 5 beliefs. iris.context_invoked fires with total belief_count when any beliefs injected.

---

## IrisRuntime Initialization

| Option | Description | Selected |
|--------|-------------|----------|
| Optional-dep injection in constructor (iris_db_dir param) | Matches Phase 15 AAULearner pattern; backward-compatible | ✓ |
| Always-on (unconditional init) | Forces data_dir on all Brain instances | |
| Lazy init on first elicit() call | Complicates testing; hidden init side-effect | |

**Auto-selected:** `iris_db_dir: str | Path | None = None` in BrainHandler.__init__(). IrisStore + IrisRuntime constructed only if provided.

---

## FORBIDDEN_KEY_PATTERN Extension

| Option | Description | Selected |
|--------|-------------|----------|
| Add 6 iris-specific forbidden keys | belief_content, target_content, emotion_text, dimension_text, belief_prose, iris_content | ✓ |
| Add only "belief_content" | Under-specified; other leaks possible | |

**Auto-selected:** All 6 keys added to FORBIDDEN_KEY_PATTERN regex. Three-tier grep gate (Grid emitters + Brain wire + Dashboard).

---

## Dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| No new panel (firehose only) | Brain-private content; no meaningful data to show | ✓ |
| ToM panel with event counts | Possible but low value without content | |
| Full belief viewer (H5 only) | Content never crosses wire — impossible | |

**Auto-selected:** No new Dashboard panel. 4 iris.* events appear in firehose automatically. Inspector unchanged.

---

## Claude's Discretion

- LLM prompt template for elicit() — planner designs (JSON-mode preferred)
- SQLite pragma tuning for IrisStore
- Test fixture format for elicit() responses (matching Phase 14 FixtureBrainAdapter)

## Deferred Ideas

- Second-order ToM ("what X believes Y believes about Z") — v2.4
- Cross-Nous belief sharing — post-v2.3 (adversarial surface)
- Belief influence on governance voting — post-v2.3
- Thymos + Iris integration — v2.4
- ToM Inspector badge — future phase
