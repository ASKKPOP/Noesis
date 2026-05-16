---
phase: 18-skill-diffusion
verified: 2026-05-16T12:00:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 10/12
  gaps_closed:
    - "skill.inferred fires at quarantine promotion for ObservationalLearner-path skills"
    - "source: observed provenance tag persists from OL enqueue through quarantine into active SkillStore"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Confirm whether observation-count debounce (MIN_OBSERVATIONS_BEFORE_EXTRACT=2) satisfies SKILL-02 tick-based rate-limit"
    expected: "ROADMAP Success Criterion 2 explicitly states 'Inferred skills are rate-limited to one creation per sleep epoch (30 ticks) per Nous.' The existing gate is observation-count-based (MIN_OBSERVATIONS_BEFORE_EXTRACT=2 in observational.py line 54), not tick-based. Developer must decide: (a) the observation-count gate is accepted as sufficient for the 30-tick epoch intent, or (b) a tick-based epoch gate (per-Nous, blocking if current_tick - last_extraction_tick < 30) must be implemented."
    why_human: "The two gates are not equivalent under adversarial conditions — an adversarial seller could force 2 observations within a single tick epoch, satisfying the count gate while violating the 30-tick cadence intent. No plan in phase 18 addressed this. Resolving requires a product/architecture decision."
---

# Phase 18: Skill Diffusion Verification Report

**Phase Goal:** Wire PeerSkillFilter + ObservationalLearner into teaching/inference paths. Allowlist 36→39 (+3: skill.taught, skill.inferred, skill.rejected).
**Verified:** 2026-05-16T12:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plan 18-06)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SKILL_FORBIDDEN_KEYS contains skill_body, skill_text, rule_text | VERIFIED | `grid/src/audit/broadcast-allowlist.ts` lines 296-300 |
| 2 | FORBIDDEN_KEY_PATTERN extended with skill_body, skill_text, rule_text | VERIFIED | Line 360 of broadcast-allowlist.ts |
| 3 | ALLOWLIST_MEMBERS grows from 36 to 39 (skill.taught pos 37, skill.inferred pos 38, skill.rejected pos 39) | VERIFIED | Lines 161-163 of broadcast-allowlist.ts; count confirmed at 39 |
| 4 | Three sole-producer emitters created in grid/src/skills/ (appendSkillTaught, appendSkillInferred, appendSkillRejected) | VERIFIED | Files exist; each calls audit.append with correct event name; 118 Grid tests green |
| 5 | Three NousRunner dispatch cases wired (skill_taught, skill_inferred, skill_rejected) | VERIFIED | nous-runner.ts lines 724, 747, 768 |
| 6 | `__skill_share:` dispatch wired in BrainHandler.on_message() before Thymos path | VERIFIED | handler.py line 154 |
| 7 | QuarantineStore created with 5-column skills_quarantine table | VERIFIED | quarantine.py: skill_hash, source_did, received_tick, promote_at_tick, payload_json; 670 Brain tests pass |
| 8 | on_tick() quarantine sweep runs before ObservationalLearner dispatch | VERIFIED | handler.py: sweep block at line 299 runs before OL block |
| 9 | lineage_parent_hash TEXT column added to skills table (idempotent ALTER TABLE) | VERIFIED | store.py lines 33-38 |
| 10 | PeerSkillFilter._count_peer_skills() counts both active AND quarantine rows | VERIFIED | peer_filter.py lines 188-191 |
| 11 | skill.inferred fires at quarantine promotion for ObservationalLearner-path skills | VERIFIED (closed) | handler.py line 315: `if result.source == "observed"` emits `ActionType.SKILL_INFERRED` at line 325; confirmed by grep returning hit in sweep block |
| 12 | source: observed provenance tag persists from OL enqueue through quarantine into active SkillStore | VERIFIED (closed) | observational.py line 229: `source='observed'` passed to enqueue(); quarantine.py line 97: `"source": source` in payload_json; sweep() line 146: `payload.get("source", "peer")`; QuarantineResult.source at line 46 |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/audit/broadcast-allowlist.ts` | SKILL_FORBIDDEN_KEYS + FORBIDDEN_KEY_PATTERN + ALLOWLIST_MEMBERS at 39 | VERIFIED | All three present |
| `brain/src/noesis_brain/skills/quarantine.py` | QuarantineStore with source field in enqueue/QuarantineResult/sweep | VERIFIED | source field added in plan 18-06; 14 quarantine tests pass |
| `brain/src/noesis_brain/learning/observational.py` | source='observed' passed to quarantine_store.enqueue() | VERIFIED | Line 229: `source='observed'` |
| `brain/src/noesis_brain/rpc/handler.py` | SKILL_INFERRED emitted for OL-path promotions in sweep loop | VERIFIED | Lines 315-330: result.source == "observed" branch |
| `brain/src/noesis_brain/rpc/types.py` | SKILL_TAUGHT, SKILL_INFERRED, SKILL_REJECTED ActionType members | VERIFIED | Lines 52-54 |
| `brain/src/noesis_brain/skills/store.py` | lineage_parent_hash column via idempotent ALTER TABLE | VERIFIED | Lines 33-38 |
| `brain/test/test_quarantine_store.py` | QuarantineStore unit tests including TestSourceProvenance | VERIFIED | 14 tests (9 existing + 5 gap-closure); all pass |
| `brain/test/test_observational_filter.py` | OL filter tests including TestSourcePassthrough | VERIFIED | 11 tests (10 existing + 1 gap-closure); all pass |
| `brain/test/test_skill_lineage.py` | 3-hop SQL self-join lineage test | VERIFIED | 4 tests pass |
| `grid/src/skills/appendSkillTaught.ts` | Sole producer for skill.taught (pos 37) | VERIFIED | audit.append('skill.taught') |
| `grid/src/skills/appendSkillInferred.ts` | Sole producer for skill.inferred (pos 38) | VERIFIED | audit.append('skill.inferred') |
| `grid/src/skills/appendSkillRejected.ts` | Sole producer for skill.rejected (pos 39) | VERIFIED | audit.append('skill.rejected') |
| `grid/src/integration/nous-runner.ts` | 3 skill dispatch cases wired | VERIFIED | Cases at lines 724, 747, 768 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `handler.py on_message()` | `PeerSkillFilter.evaluate()` | `self._peer_filter.evaluate(payload, source_did=sender_did)` | WIRED | Line 162 |
| `handler.py on_tick()` | `QuarantineStore.sweep()` | `self._quarantine_store.sweep(current_tick, trust_fn)` | WIRED | Line 309 |
| `quarantine.py sweep()` | `ActionType.SKILL_INFERRED` | `result.source == "observed"` branch in handler.py line 315 | WIRED | Fixed in plan 18-06 |
| `observational.py observe_trade()` | `QuarantineStore.enqueue()` | `source='observed'` keyword argument | WIRED | Line 229; payload stores source |
| `NousRunner dispatch` | `appendSkillTaught/Inferred/Rejected` | imports from `../skills/index.js` | WIRED | Lines 37-40 import; cases at 724, 747, 768 |
| `broadcast-allowlist.ts` | `skill.taught/inferred/rejected` | ALLOWLIST_MEMBERS positions 37-39 | WIRED | Lines 161-163 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `quarantine.py sweep()` | `sweep_results` | SQLite skills_quarantine table | Yes | FLOWING |
| `handler.py on_tick()` | SKILL_INFERRED action for OL-path | QuarantineResult.source + payload_json.source_event_hash | Yes | FLOWING — fixed in 18-06 |
| `handler.py on_tick()` | SKILL_TAUGHT action for peer-path | QuarantineResult (source != 'observed') | Yes | FLOWING — unchanged |
| `test_skill_lineage.py` | lineage_parent_hash column | Test-only fixture adds skill_hash column | Test only | DISCONNECTED from production — no stored skill_hash column in production schema; lineage via audit chain events is sound |

**Note on json import in handler.py line 322:** The except clause references `json.JSONDecodeError` but `json` is imported locally as `_json`. This is non-blocking: `json.JSONDecodeError` is a subclass of `ValueError`, so the `ValueError` branch in the tuple catches decode errors correctly at runtime. The name reference is wrong but has no observable effect.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Grid skill tests (118 tests) | `npx vitest run grid/test/skills/ grid/test/audit/skill-allowlist.test.ts` | 118 passed | PASS |
| Brain full test suite (670 tests) | `uv run python -m pytest test/ -q` | 670 passed | PASS |
| SKILL_INFERRED in handler sweep loop | `grep -n "SKILL_INFERRED" handler.py` | Line 325 (in sweep block) | PASS |
| source='observed' in observational.py | `grep -n "source='observed'" observational.py` | Line 229 | PASS |
| source field in quarantine payload | `grep -n '"source": source' quarantine.py` | Line 97 | PASS |
| QuarantineResult.source field | `grep -n "source: str" quarantine.py` | Line 46 | PASS |
| result.source check in handler sweep | `grep -n "result\.source" handler.py` | Line 315 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SKILL-01 | Plans 02, 05 | `__skill_share:` dispatch + quarantine + trust gate wired | SATISFIED | handler.py dispatch at line 154; PeerSkillFilter sole entry; sweep in on_tick() line 299 |
| SKILL-02 | Plans 03, 05, 06 | OL DID/numeric filter + quarantine redirect + source:observed tag + rate-limit | PARTIAL | Filter present; quarantine redirect present; source:observed stored; tick-based rate-limit (30 ticks per epoch per Nous) NOT implemented — see Human Verification |
| SKILL-03 | Plans 01, 04, 05, 06 | Three allowlisted events at promotion; closed-tuple; sole-producer | SATISFIED | skill.taught, skill.inferred, skill.rejected all wired end-to-end; SKILL_INFERRED emitted for OL-path promotions |
| SKILL-04 | Plans 02, 05 | lineage_parent_hash column; SQL self-join lineage reconstruction | SATISFIED (with caveat) | Column added; 3-hop test passes; production lineage from audit chain events intact; SQL self-join requires test-only skill_hash column |

**Orphaned requirements from REQUIREMENTS.md:** None — all 4 SKILL REQs are claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `brain/src/noesis_brain/rpc/handler.py` | 322 | `json.JSONDecodeError` referenced but `json` imported as `_json` in same block | Warning | Non-blocking: ValueError (parent class) catches JSONDecodeError; runtime correct |

### Human Verification Required

#### 1. OL Rate-Limit Gate — tick-based vs observation-count-based

**Test:** Confirm with developer whether MIN_OBSERVATIONS_BEFORE_EXTRACT=2 satisfies SKILL-02 tick-based rate-limit, or whether a tick-based epoch gate must be added.

**Expected:** ROADMAP Success Criterion 2 explicitly states "Inferred skills are rate-limited to one creation per sleep epoch (30 ticks) per Nous." The current implementation uses `MIN_OBSERVATIONS_BEFORE_EXTRACT=2` in `observational.py` line 54 — an observation-count gate that blocks until 2 observations of the same buyer/seller/item pair. This is NOT a tick-based gate. A tick-based gate would track `_last_extraction_tick` per Nous and block new extractions if `current_tick - last_extraction_tick < 30`.

**Why human:** The two gates are not equivalent under adversarial conditions — an adversarial seller could force 2 identical observations within a single tick epoch, satisfying the count gate while violating the 30-tick cadence intent. Resolving requires a product/architecture decision:
- Option A: The observation-count gate is accepted as the intended implementation of the 30-tick rate-limit intent. No new code needed.
- Option B: A tick-based gate must be added — tracking `_last_extraction_tick: dict[str, int]` per Nous (or per pair), blocking extraction if `tick - last_tick < SLEEP_EPOCH_TICKS (30)`. Requires a new plan.

### Gaps Summary

No automated gaps remain. Both previously identified gaps were closed by plan 18-06 (commits 1b8f9d9, 485f4d8, 771230d):

- Truth 11 (SKILL_INFERRED dispatch): closed by `result.source == "observed"` branch in handler.py sweep loop.
- Truth 12 (source:observed provenance): closed by threading `source='observed'` and `source_event_hash` through quarantine enqueue → payload_json → sweep → QuarantineResult.

One human decision point remains: the tick-based rate-limit for SKILL-02 (ROADMAP SC-2). All 12 truths pass automated verification; 670 Brain tests and 118 Grid tests pass.

---

_Verified: 2026-05-16T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
