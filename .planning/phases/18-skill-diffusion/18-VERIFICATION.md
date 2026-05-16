---
phase: 18-skill-diffusion
verified: 2026-05-16T15:30:00Z
status: passed
score: 13/13 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 13/13
  gaps_closed:
    - "4 integration test regressions in test/skills/test_ol_filter_and_quarantine.py fixed — tick values raised to >=30 (30, 31, 32, 40) so Gate 2b no longer silently blocks them; full 30-test suite now passes"
  gaps_remaining: []
  regressions: []
---

# Phase 18: Skill Diffusion Verification Report

**Phase Goal:** Establish a safe peer-skill diffusion layer where Nous agents can extract reusable skill text from witnessing successful trades, route it through quarantine, and selectively promote vetted skills with appropriate provenance tracking and rate-limiting.
**Verified:** 2026-05-16T15:30:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (test regressions introduced by plan 18-07 tick gate)

## Goal Achievement

All 13 truths verified. All 30 tests pass (15 in test_observational_filter.py + 15 in test/skills/test_ol_filter_and_quarantine.py). No regressions.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SKILL_FORBIDDEN_KEYS contains skill_body, skill_text, rule_text | VERIFIED | `grid/src/audit/broadcast-allowlist.ts` lines 296-300 |
| 2 | FORBIDDEN_KEY_PATTERN extended with skill_body, skill_text, rule_text | VERIFIED | Line 360 of broadcast-allowlist.ts |
| 3 | ALLOWLIST_MEMBERS grows from 36 to 39 (skill.taught pos 37, skill.inferred pos 38, skill.rejected pos 39) | VERIFIED | Lines 161-163; count confirmed at 39 |
| 4 | Three sole-producer emitters in grid/src/skills/ (appendSkillTaught, appendSkillInferred, appendSkillRejected) | VERIFIED | Files exist; each calls audit.append with correct event name |
| 5 | Three NousRunner dispatch cases wired (skill_taught, skill_inferred, skill_rejected) | VERIFIED | nous-runner.ts lines 724, 747, 768 |
| 6 | `__skill_share:` dispatch wired in BrainHandler.on_message() before Thymos path | VERIFIED | handler.py line 154 |
| 7 | QuarantineStore created with 5-column skills_quarantine table | VERIFIED | quarantine.py: skill_hash, source_did, received_tick, promote_at_tick, payload_json |
| 8 | on_tick() quarantine sweep runs before ObservationalLearner dispatch | VERIFIED | handler.py: sweep block at line 299 runs before OL block |
| 9 | lineage_parent_hash TEXT column added to skills table (idempotent ALTER TABLE) | VERIFIED | store.py lines 33-38 |
| 10 | PeerSkillFilter._count_peer_skills() counts both active AND quarantine rows | VERIFIED | peer_filter.py lines 188-191 |
| 11 | skill.inferred fires at quarantine promotion for ObservationalLearner-path skills | VERIFIED | handler.py line 315: `if result.source == "observed"` emits `ActionType.SKILL_INFERRED` at line 325 |
| 12 | source: observed provenance tag persists from OL enqueue through quarantine into active SkillStore | VERIFIED | observational.py line 229: `source='observed'`; quarantine.py line 97; sweep() line 146; QuarantineResult.source line 46 |
| 13 | SLEEP_EPOCH_TICKS=30 tick gate blocks LLM extraction within one epoch per Nous; _last_extraction_tick updated after successful extraction | VERIFIED | observational.py: constant line 58, gate lines 163-170, assignment line 222; 4 TestTickGate tests pass; 4 formerly-regressed integration tests now pass with tick>=30 |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/audit/broadcast-allowlist.ts` | SKILL_FORBIDDEN_KEYS + FORBIDDEN_KEY_PATTERN + ALLOWLIST_MEMBERS at 39 | VERIFIED | All three present |
| `brain/src/noesis_brain/skills/quarantine.py` | QuarantineStore with source field in enqueue/QuarantineResult/sweep | VERIFIED | source field present; 14 quarantine tests pass |
| `brain/src/noesis_brain/learning/observational.py` | SLEEP_EPOCH_TICKS=30 constant, _last_extraction_tick gate, source='observed' to enqueue | VERIFIED | Constant line 58; gate lines 163-170; assignment line 222; source line 229 |
| `brain/src/noesis_brain/rpc/handler.py` | SKILL_INFERRED emitted for OL-path promotions in sweep loop | VERIFIED | Lines 315-330 |
| `brain/src/noesis_brain/rpc/types.py` | SKILL_TAUGHT, SKILL_INFERRED, SKILL_REJECTED ActionType members | VERIFIED | Lines 52-54 |
| `brain/src/noesis_brain/skills/store.py` | lineage_parent_hash column via idempotent ALTER TABLE | VERIFIED | Lines 33-38 |
| `brain/test/test_quarantine_store.py` | 14 unit tests including TestSourceProvenance | VERIFIED | 14 tests pass |
| `brain/test/test_observational_filter.py` | 15 tests including TestTickGate (4 new) | VERIFIED | 15 passed |
| `brain/test/test_skill_lineage.py` | 3-hop SQL self-join lineage test | VERIFIED | 4 tests pass |
| `brain/test/skills/test_ol_filter_and_quarantine.py` | Integration tests for OL filter + quarantine | VERIFIED | 15/15 pass; tick values updated to >=30 (30, 31, 32, 40) clearing Gate 2b |
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
| `observational.py observe_trade()` | `self._last_extraction_tick` | tick gate at lines 163-170; reset at line 222 | WIRED | SLEEP_EPOCH_TICKS=30 gate inserted between count gate and slug-exists gate |
| `observational.py observe_trade()` | `QuarantineStore.enqueue()` | `source='observed'` keyword argument | WIRED | Line 229 |
| `NousRunner dispatch` | `appendSkillTaught/Inferred/Rejected` | imports from `../skills/index.js` | WIRED | Lines 37-40 import; cases at 724, 747, 768 |
| `broadcast-allowlist.ts` | `skill.taught/inferred/rejected` | ALLOWLIST_MEMBERS positions 37-39 | WIRED | Lines 161-163 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `quarantine.py sweep()` | `sweep_results` | SQLite skills_quarantine table | Yes | FLOWING |
| `handler.py on_tick()` | SKILL_INFERRED action for OL-path | QuarantineResult.source + payload_json.source_event_hash | Yes | FLOWING |
| `handler.py on_tick()` | SKILL_TAUGHT action for peer-path | QuarantineResult (source != 'observed') | Yes | FLOWING |
| `observational.py observe_trade()` | `_last_extraction_tick` | tick parameter from BrainHandler.on_tick (internal Grid event) | Yes | FLOWING — ephemeral per-instance state |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SLEEP_EPOCH_TICKS=30 in observational.py | `grep "SLEEP_EPOCH_TICKS: int = 30" observational.py` | Line 58 | PASS |
| _last_extraction_tick initialized to 0 | `grep "_last_extraction_tick: int = 0" observational.py` | Line 117 | PASS |
| Tick gate between count gate and slug-exists gate | Lines 156, 165, 174 ordering | count(156) < tick(165) < slug(174) | PASS |
| _last_extraction_tick updated after extraction | `grep "_last_extraction_tick = tick" observational.py` | Line 222 | PASS |
| TestTickGate — 4 new tests pass | `uv run pytest test/test_observational_filter.py::TestTickGate -v` (from brain/) | 4 passed | PASS |
| Full observational filter suite | `uv run pytest test/test_observational_filter.py` (from brain/) | 15 passed | PASS |
| Integration suite after tick fix | `uv run pytest test/skills/test_ol_filter_and_quarantine.py` (from brain/) | 15 passed (was 4 failing) | PASS |
| Combined 30-test target suite | `uv run pytest test/test_observational_filter.py test/skills/test_ol_filter_and_quarantine.py -v` | 30 passed, 0 failed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SKILL-01 | Plans 02, 05 | `__skill_share:` dispatch + quarantine + trust gate wired | SATISFIED | handler.py dispatch at line 154; PeerSkillFilter sole entry; sweep in on_tick() line 299 |
| SKILL-02 | Plans 03, 05, 06, 07 | OL DID/numeric filter + quarantine redirect + source:observed tag + tick-based rate-limit (30 ticks per epoch per Nous) | SATISFIED | Filter present; quarantine redirect present; source:observed stored; SLEEP_EPOCH_TICKS=30 gate at lines 163-170; _last_extraction_tick reset at line 222; 4 TestTickGate tests pass; 4 integration tests pass with tick>=30 |
| SKILL-03 | Plans 01, 04, 05, 06 | Three allowlisted events at promotion; closed-tuple; sole-producer | SATISFIED | skill.taught, skill.inferred, skill.rejected all wired end-to-end |
| SKILL-04 | Plans 02, 05 | lineage_parent_hash column; SQL self-join lineage reconstruction | SATISFIED (with caveat) | Column added; 3-hop test passes; SQL self-join requires test-only skill_hash column |

**Orphaned requirements from REQUIREMENTS.md:** None — all 4 SKILL REQs are claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `brain/src/noesis_brain/rpc/handler.py` | 322 | `json.JSONDecodeError` referenced but `json` imported as `_json` in same block | Warning | Non-blocking: ValueError (parent class) catches JSONDecodeError; runtime correct |

### Human Verification Required

None — all automated checks pass. Previous human items (UAT for tick-based gate behavior) were resolved by the 18-07 plan implementation and subsequent test regression fixes.

### Gaps Summary

No gaps. The single gap identified in the previous verification (4 test regressions in `test/skills/test_ol_filter_and_quarantine.py` due to tick values < 30 being silently blocked by Gate 2b) has been resolved. All 4 affected tests now use tick values >= 30 (30, 31, 32, 40), and the full 30-test suite passes.

Phase 18 goal is fully achieved: the peer-skill diffusion layer is established with safe quarantine routing, DID/numeric structural validity filtering, provenance tagging (`source: observed`), tick-based rate-limiting (SLEEP_EPOCH_TICKS=30), lineage tracking, and three allowlisted audit events wired end-to-end.

---

_Verified: 2026-05-16T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
