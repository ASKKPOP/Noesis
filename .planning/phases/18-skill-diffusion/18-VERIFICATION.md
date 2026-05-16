---
phase: 18-skill-diffusion
verified: 2026-05-16T09:45:00Z
status: gaps_found
score: 10/12 must-haves verified
overrides_applied: 0
gaps:
  - truth: "skill.inferred fires at quarantine promotion for ObservationalLearner-path skills"
    status: failed
    reason: "QuarantineStore.sweep() always emits SKILL_TAUGHT for all promoted skills regardless of origin (whisper-path vs OL-path). The quarantine payload_json does not store a source='observed' field that would allow sweep() to differentiate OL-sourced skills. The observe_trade() return of SKILL_INFERRED Action is discarded by asyncio.create_task() in on_tick(), so it never reaches the actions list returned to Grid."
    artifacts:
      - path: "brain/src/noesis_brain/skills/quarantine.py"
        issue: "QuarantineStore.sweep() appends SKILL_TAUGHT for all promoted skills; no source-origin field in payload to dispatch SKILL_INFERRED for OL-path promotions"
      - path: "brain/src/noesis_brain/rpc/handler.py"
        issue: "on_tick() uses asyncio.create_task(self._obs_learner.observe_trade(...)) — return value discarded; the SKILL_INFERRED Action returned by observe_trade() never reaches the actions list; on_tick() sweep only emits SKILL_TAUGHT for all promotions"
      - path: "brain/src/noesis_brain/skills/quarantine.py enqueue()"
        issue: "payload_json dict has no 'source' key — comment in observational.py mentions source='observed' but it is not stored in the quarantine row"
    missing:
      - "QuarantineStore.enqueue() must accept and store a 'source' field (e.g. 'observed' vs 'peer') in payload_json"
      - "QuarantineStore.sweep() must read payload['source'] and emit SKILL_INFERRED (not SKILL_TAUGHT) when source='observed'"
      - "QuarantineResult must carry a 'source' field so handler.py on_tick() can select the correct ActionType"
      - "handler.py on_tick() sweep loop must emit ActionType.SKILL_INFERRED for result.source=='observed' and SKILL_TAUGHT for peer-path promotions"
  - truth: "source: observed provenance tag persists from OL enqueue through quarantine into active SkillStore"
    status: failed
    reason: "The 'source: observed' tag is described in a code comment in observational.py but is NOT included in the quarantine payload_json dict passed to QuarantineStore.enqueue(). The enqueue() payload dict has name, description, instructions, triggers, tags, source_did, parent_hash — no 'source' key. The production skills table (SkillStore) has no column for this tag either. Provenance is lost at the quarantine boundary."
    artifacts:
      - path: "brain/src/noesis_brain/learning/observational.py"
        issue: "Comment at line 218 says 'source=observed provenance tag' but the enqueue() call at line 219 passes no source field"
      - path: "brain/src/noesis_brain/skills/quarantine.py"
        issue: "enqueue() payload dict (lines 88-95) has no 'source' key; _promote() INSERT does not write a source/provenance column"
    missing:
      - "observational.py: pass source='observed' to quarantine_store.enqueue() (new parameter)"
      - "quarantine.py: accept 'source' parameter in enqueue(), include in payload_json"
      - "quarantine.py: _promote() must write source/provenance to active skills table (or rely on peer_verified=1 as proxy — clarify intent)"
human_verification:
  - test: "Confirm whether observation-count debounce (MIN_OBSERVATIONS_BEFORE_EXTRACT=2) satisfies SKILL-02 tick-based rate-limit"
    expected: "SKILL-02 says 'rate-limited to one creation per sleep epoch (30 ticks) per Nous'. D-18-06 claims 'already specified in SKILL-02' and 'already exists in observational.py and is preserved'. The existing gate is observation-count-based (2 observations), not tick-based. Developer must decide: is the observation-count gate sufficient, or does a tick-based epoch gate (reset every 30 ticks) need to be added?"
    why_human: "D-18-06 in CONTEXT.md treats MIN_OBSERVATIONS as the rate-limit, while REQUIREMENTS.md specifies ticks. Resolving this ambiguity requires a product/architecture decision — the two interpretations are not equivalent under adversarial conditions."
---

# Phase 18: Skill Diffusion Verification Report

**Phase Goal:** Wire skill diffusion into the Noesis agent loop — peer-taught skills enter quarantine, survive trust re-checks across QUARANTINE_TICKS, and are promoted to the active SkillStore while audit events (skill.taught, skill.inferred, skill.rejected) propagate through Grid with full allowlist + privacy enforcement.
**Verified:** 2026-05-16T09:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SKILL_FORBIDDEN_KEYS contains skill_body, skill_text, rule_text | VERIFIED | `grid/src/audit/broadcast-allowlist.ts` lines 296-300: `SKILL_FORBIDDEN_KEYS = Object.freeze(['skill_body', 'skill_text', 'rule_text'])` |
| 2 | FORBIDDEN_KEY_PATTERN extended with skill_body, skill_text, rule_text | VERIFIED | Line 360 of broadcast-allowlist.ts: pattern ends with `\|skill_body\|skill_text\|rule_text/i` |
| 3 | ALLOWLIST_MEMBERS grows from 36 to 39 (skill.taught pos 37, skill.inferred pos 38, skill.rejected pos 39) | VERIFIED | Lines 161-163 of broadcast-allowlist.ts; count confirmed at 39 via Python parse |
| 4 | Three sole-producer emitters created in grid/src/skills/ (appendSkillTaught, appendSkillInferred, appendSkillRejected) | VERIFIED | Files exist; each calls audit.append with correct event name; sole-producer boundary test passes (59/59 Grid tests green) |
| 5 | Three NousRunner dispatch cases wired (skill_taught, skill_inferred, skill_rejected) | VERIFIED | nous-runner.ts lines 724, 747, 768; imports appendSkillTaught/Inferred/Rejected from `../skills/index.js` |
| 6 | `__skill_share:` dispatch wired in BrainHandler.on_message() before Thymos path | VERIFIED | handler.py line 154: `_SKILL_SHARE_PREFIX = "__skill_share:"` check runs before thymos; routes through PeerSkillFilter to quarantine |
| 7 | QuarantineStore created with 5-column skills_quarantine table (D-18-03 schema) | VERIFIED | quarantine.py: `skill_hash, source_did, received_tick, promote_at_tick, payload_json`; 23 Brain tests pass |
| 8 | on_tick() quarantine sweep runs before ObservationalLearner dispatch | VERIFIED | handler.py: sweep block at line 299 runs before OL block at line 421 |
| 9 | lineage_parent_hash TEXT column added to skills table (idempotent ALTER TABLE) | VERIFIED | store.py lines 33-38: `ALTER TABLE skills ADD COLUMN lineage_parent_hash TEXT`; PRAGMA table_info confirms |
| 10 | PeerSkillFilter._count_peer_skills() counts both active AND quarantine rows | VERIFIED | peer_filter.py lines 188-191: active_count + quarantine_count from skills_quarantine table |
| 11 | skill.inferred fires at quarantine promotion for ObservationalLearner-path skills | FAILED | Quarantine sweep always emits SKILL_TAUGHT for all promotions; no source-origin field in quarantine payload; observe_trade() SKILL_INFERRED return discarded by asyncio.create_task() |
| 12 | source: observed provenance tag persists from OL enqueue through quarantine into active SkillStore | FAILED | Tag mentioned in comment at observational.py:218 but not stored in quarantine payload_json dict; not in production skills table schema |

**Score:** 10/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `grid/src/audit/broadcast-allowlist.ts` | SKILL_FORBIDDEN_KEYS + FORBIDDEN_KEY_PATTERN extended + ALLOWLIST_MEMBERS at 39 | VERIFIED | All three present and wired |
| `grid/test/audit/skill-allowlist-baseline.test.ts` | Wave 0 baseline gate (now updated to 39) | VERIFIED | Exists; now asserts 39 after Wave 2 superseded the Wave 0 36-count |
| `grid/test/skills/skill-privacy.test.ts` | SKILL_FORBIDDEN_KEYS coverage test | VERIFIED | 9 tests pass |
| `brain/src/noesis_brain/skills/quarantine.py` | QuarantineStore class + QUARANTINE_TICKS env-configurable | VERIFIED | Class exists; QUARANTINE_TICKS reads from env, defaults to 5 |
| `brain/src/noesis_brain/rpc/types.py` | SKILL_TAUGHT, SKILL_INFERRED, SKILL_REJECTED ActionType members | VERIFIED | Lines 52-54 |
| `brain/src/noesis_brain/skills/store.py` | lineage_parent_hash column via idempotent ALTER TABLE | VERIFIED | Lines 33-38 |
| `brain/src/noesis_brain/rpc/handler.py` | __skill_share: dispatch + quarantine sweep + cached_peer_weights | VERIFIED | All present; sweep at line 299, dispatch at line 154 |
| `brain/src/noesis_brain/learning/observational.py` | _STRUCTURAL_INVALID_RE + quarantine redirect | VERIFIED (partial) | Filter at line 44; quarantine redirect at line 219; but source='observed' not stored |
| `grid/src/skills/types.ts` | SKILL_TAUGHT_KEYS, SKILL_INFERRED_KEYS, SKILL_REJECTED_KEYS, VALID_REJECTION_REASONS | VERIFIED | All exported |
| `grid/src/skills/appendSkillTaught.ts` | Sole producer for skill.taught (pos 37) | VERIFIED | 10-step validation; audit.append('skill.taught') at line 103 |
| `grid/src/skills/appendSkillInferred.ts` | Sole producer for skill.inferred (pos 38) | VERIFIED | audit.append('skill.inferred') at line 90 |
| `grid/src/skills/appendSkillRejected.ts` | Sole producer for skill.rejected (pos 39) | VERIFIED | audit.append('skill.rejected') at line 87; VALID_REJECTION_REASONS enum check |
| `grid/src/skills/index.ts` | Re-exports all emitters and types | VERIFIED | Exports all required symbols |
| `grid/src/integration/nous-runner.ts` | 3 skill dispatch cases wired | VERIFIED | Cases at lines 724, 747, 768 |
| `brain/test/test_quarantine_store.py` | QuarantineStore unit tests | VERIFIED | 9 test functions; all pass |
| `brain/test/test_observational_filter.py` | DID/numeric filter unit tests | VERIFIED | 10 test functions; all pass |
| `brain/test/test_skill_lineage.py` | 3-hop SQL self-join lineage test | VERIFIED (with caveat) | Uses test-only skill_hash column not in production schema; see Data-Flow Trace |
| `grid/test/skills/appendSkillTaught.test.ts` | Emitter closed-tuple + validation tests | VERIFIED | 13 tests including closed-tuple enforcement |
| `grid/test/skills/appendSkillInferred.test.ts` | Emitter tests | VERIFIED | 11 tests |
| `grid/test/skills/appendSkillRejected.test.ts` | Emitter + rejection_reason enum tests | VERIFIED | 12 tests including all 3 valid reasons |
| `grid/test/skills/skill-producer-boundary.test.ts` | Sole-producer boundary enforcement | VERIFIED | SOLE_EMITTERS check; 6 tests pass |
| `grid/test/audit/skill-allowlist.test.ts` | Allowlist count=39 + position assertions | VERIFIED | toBe(39) and position checks |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `handler.py on_message()` | `PeerSkillFilter.evaluate()` | `self._peer_filter.evaluate(payload, sender_did)` | WIRED | Line 162: `self._peer_filter.evaluate(payload, source_did=sender_did)` |
| `handler.py on_tick()` | `QuarantineStore.sweep()` | `self._quarantine_store.sweep(current_tick, trust_fn)` | WIRED | Line 309 |
| `NousRunner dispatch` | `appendSkillTaught` | `import { appendSkillTaught } from '../skills/index.js'` | WIRED | Line 37-40 import; case at line 724 |
| `observational.py observe_trade()` | `QuarantineStore.enqueue()` | `self._quarantine_store.enqueue(skill, ...)` | WIRED | Line 219 |
| `broadcast-allowlist.ts` | `skill.taught` | `ALLOWLIST_MEMBERS position 37` | WIRED | Line 161 |
| `quarantine.py sweep()` | `SKILL_INFERRED ActionType` | Should emit SKILL_INFERRED for OL-path promotions | NOT_WIRED | sweep() only emits SKILL_TAUGHT for all promotions; no source-origin differentiation |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `quarantine.py sweep()` | `sweep_results` | SQLite skills_quarantine table | Yes | FLOWING — reads rows with promote_at_tick <= current_tick |
| `handler.py on_tick()` | `actions` list from sweep | QuarantineStore.sweep() | Partial | HOLLOW — always emits SKILL_TAUGHT; never emits SKILL_INFERRED for OL-path |
| `test_skill_lineage.py` | `lineage_parent_hash` column | Test-only fixture table adds `skill_hash` column | Test only | DISCONNECTED from production — production skills table has no `skill_hash` column; lineage SQL self-join requires computed sha256(instructions) at query time in production |

**Note on lineage:** SKILL-04 says lineage is "reconstructable from the audit chain via the parent_hash field in skill.taught payloads" — the audit chain (Grid side) has `skill_hash` and `parent_hash` in `skill.taught` events. The production SkillStore has `lineage_parent_hash` but no stored `skill_hash` column. The SQL WITH RECURSIVE self-join demonstrated in the test requires `skill_hash` as a stored column (added test-only). In production, the equivalent query would need to join on `sha256(instructions)` computed at query time, which SQLite does not support natively. Lineage reconstruction from the audit chain itself is sound; lineage from SkillStore SQL is not demonstrable with the production schema.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Grid skill tests (59 tests) | `npx vitest run test/skills/ test/audit/skill-allowlist.test.ts` | 59 passed | PASS |
| Brain skill tests (23 tests) | `uv run python -m pytest test/test_quarantine_store.py test/test_observational_filter.py test/test_skill_lineage.py` | 23 passed | PASS |
| ALLOWLIST_MEMBERS count | Python parse of broadcast-allowlist.ts | 39 | PASS |
| Sole-producer boundary | `grep -rn "audit\.append.*skill\." grid/src/ | grep -v appendSkill"` | 0 hits | PASS |
| `__skill_share` in handler | `grep -n "__skill_share" handler.py` | 2 hits (lines 154, 181) | PASS |
| ActionType SKILL_* in types.py | `grep -n "SKILL_TAUGHT\|SKILL_INFERRED\|SKILL_REJECTED" types.py` | 3 hits | PASS |
| skill.inferred never emitted in on_tick sweep | `grep -n "SKILL_INFERRED" handler.py` | 0 hits | FAIL — SKILL_INFERRED absent from handler's action emission |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SKILL-01 | Plans 02, 05 | `__skill_share:` dispatch + quarantine + trust gate wired | SATISFIED | handler.py dispatch at line 154; PeerSkillFilter.evaluate() sole entry; sweep in on_tick() line 299 |
| SKILL-02 | Plans 03, 05 | OL DID/numeric filter + quarantine redirect + source:observed tag | PARTIAL | Filter present; quarantine redirect present; source:observed NOT stored in quarantine payload; rate-limit is observation-count-based not tick-based (see human_verification) |
| SKILL-03 | Plans 01, 04, 05 | Three allowlisted events at promotion; closed-tuple; sole-producer | PARTIAL | skill.taught and skill.rejected wired end-to-end; skill.inferred exists in allowlist and Grid emitter but is NEVER emitted by Brain for OL-path promotions — quarantine sweep only emits SKILL_TAUGHT for all promotions |
| SKILL-04 | Plans 02, 05 | lineage_parent_hash column; SQL self-join lineage reconstruction | PARTIAL | Column added; test demonstrates 3-hop lineage; but test requires test-only skill_hash column not present in production schema; audit chain lineage via skill.taught events is intact |

**Orphaned requirements from REQUIREMENTS.md:** None — all 4 SKILL REQs are claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `brain/src/noesis_brain/learning/observational.py` | 218 | Comment says `source="observed"` but it is not in the enqueue() call parameters | Blocker | SKILL-02 provenance tag not preserved; SKILL-03 skill.inferred vs skill.taught differentiation at promotion requires this field |
| `brain/src/noesis_brain/rpc/handler.py` | 433-434 | `asyncio.create_task(self._obs_learner.observe_trade(...))` discards return value | Blocker | SKILL_INFERRED Action returned by observe_trade() is never appended to the actions list; skill.inferred never reaches Grid for OL-path |
| `brain/src/noesis_brain/skills/quarantine.py` | 88-95 | `enqueue()` payload dict missing 'source' key | Blocker | Cannot distinguish OL-sourced vs peer-taught skills at sweep time; all promotions emit SKILL_TAUGHT |

### Human Verification Required

#### 1. OL Rate-Limit Gate — tick-based vs observation-count-based

**Test:** Confirm with developer whether MIN_OBSERVATIONS_BEFORE_EXTRACT=2 satisfies SKILL-02.

**Expected:** SKILL-02 says "rate-limited to one creation per sleep epoch (30 ticks) per Nous". D-18-06 in CONTEXT.md says the "per-pair debounce counter (MIN_OBSERVATIONS_BEFORE_EXTRACT=2) already exists and is preserved." These are not equivalent: MIN_OBSERVATIONS is an observation-count gate (blocks until 2 observations of same pair/item), not a tick-based gate (allows only 1 creation per 30-tick window per Nous).

**Why human:** Resolving this requires a product decision: (a) the count-based gate is deemed sufficient for the 30-tick intent, or (b) an additional tick-based rate gate needs to be added (tracking last_extraction_tick per pair, blocking if current_tick - last < 30).

### Gaps Summary

Two root-cause gaps block SKILL-03 goal achievement:

**Root cause 1 — Missing source-origin tag in quarantine (causes 2 failures):**

The `source: observed` provenance tag for OL-inferred skills is documented in code comments but not stored. This single omission causes two failures: (1) the provenance tag is lost, and (2) the quarantine sweep cannot distinguish OL-path skills from peer-taught skills to emit the correct audit event (`skill.inferred` vs `skill.taught`).

**Fix:** `observational.py` must pass `source='observed'` to `quarantine_store.enqueue()`. The `enqueue()` method must include it in `payload_json`. The `sweep()` method must read `payload.get('source')` and dispatch `SKILL_INFERRED` (with `source_event_hash` reconstructed from payload) for OL-path skills and `SKILL_TAUGHT` for peer-path skills.

**Root cause 2 — OL action return discarded (symptom of root cause 1):**

`asyncio.create_task(self._obs_learner.observe_trade(...))` discards the `SKILL_INFERRED` Action that `observe_trade()` returns. If the root cause 1 fix is applied correctly (quarantine sweep emits SKILL_INFERRED), this `create_task` discard becomes a non-issue — the SKILL_INFERRED event will flow via the sweep path instead. However, if the action is needed sooner than the next sweep tick, the handler would also need to await and collect the result.

The cleaner fix is root cause 1: ensure the quarantine payload stores `source`, and the sweep emits the correct event. The `observe_trade()` return discarded by `create_task` is then acceptable because SKILL_INFERRED fires at promotion time (which is what SKILL-03 requires: "emitted at quarantine promotion").

---

_Verified: 2026-05-16T09:45:00Z_
_Verifier: Claude (gsd-verifier)_
