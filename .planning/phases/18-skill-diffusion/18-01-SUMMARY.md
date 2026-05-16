---
phase: 18-skill-diffusion
plan: "01"
subsystem: grid/audit
tags: [privacy-gate, allowlist, forbidden-keys, wave-0]
dependency_graph:
  requires: []
  provides: [SKILL_FORBIDDEN_KEYS, FORBIDDEN_KEY_PATTERN-skill-extension, allowlist-36-baseline-gate]
  affects: [grid/src/audit/broadcast-allowlist.ts]
tech_stack:
  added: []
  patterns: [forbidden-keys-constant, regex-extension, wave-0-baseline-test]
key_files:
  created:
    - grid/test/skills/skill-privacy.test.ts
    - grid/test/audit/skill-allowlist-baseline.test.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
decisions:
  - "SKILL_FORBIDDEN_KEYS placed after HYPNOS_FORBIDDEN_KEYS following established block pattern"
  - "FORBIDDEN_KEY_PATTERN extended by appending — not rewritten — preserving all prior phase additions"
  - "skill_body, skill_text, rule_text blocked; skill_hash, parent_hash, source_event_hash remain permitted"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-16T15:59:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
requirements: [SKILL-03]
---

# Phase 18 Plan 01: Skill Privacy Gate (Wave 0) Summary

**One-liner:** FORBIDDEN_KEY_PATTERN extended with skill_body|skill_text|rule_text via SKILL_FORBIDDEN_KEYS constant; Wave 0 baseline gate asserts ALLOWLIST_MEMBERS.length === 36 before skill.* events land.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend FORBIDDEN_KEY_PATTERN + add SKILL_FORBIDDEN_KEYS | 8c6f28a | broadcast-allowlist.ts, skill-privacy.test.ts |
| 2 | Write allowlist-36-baseline RED test | 0c195ff | skill-allowlist-baseline.test.ts |

## What Was Built

**Task 1 (TDD — RED/GREEN):**
- Added `SKILL_FORBIDDEN_KEYS = Object.freeze(['skill_body', 'skill_text', 'rule_text'])` to `grid/src/audit/broadcast-allowlist.ts` after the `HYPNOS_FORBIDDEN_KEYS` block, matching the established constant pattern.
- Extended `FORBIDDEN_KEY_PATTERN` regex by appending `|skill_body|skill_text|rule_text` before the closing `/i` — surgical append, no rewrite.
- Created `grid/test/skills/skill-privacy.test.ts` with 9 tests covering: constant length, regex matches, payloadPrivacyCheck rejection of all 3 forbidden keys, and allowance of legitimate skill payload keys (skill_hash, parent_hash, source_event_hash, learner_did, teacher_did).

**Task 2:**
- Created `grid/test/audit/skill-allowlist-baseline.test.ts` asserting `ALLOWLIST_MEMBERS.length === 36` and `ALLOWLIST_MEMBERS[35] === 'iris.prior_seeded'` (Phase 17 end-state). This test is intentionally designed to fail after Wave 3 adds skill.taught/inferred/rejected (count becomes 39) — at that point it should be marked obsolete.

## Verification

- 165 test files pass, 2 skipped — no regressions from FORBIDDEN_KEY_PATTERN extension
- All 9 skill-privacy tests pass (GREEN)
- Both baseline gate assertions pass (count === 36, position 35 === 'iris.prior_seeded')

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-18-01: skill body leaking into broadcast payload | SKILL_FORBIDDEN_KEYS blocks skill_body, skill_text, rule_text at FORBIDDEN_KEY_PATTERN | Mitigated |

## Known Stubs

None — this plan only extends the privacy gate pattern with no stub data paths.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes. This plan only extends an existing privacy regex.

## Self-Check: PASSED

- `grid/src/audit/broadcast-allowlist.ts` — exists and contains SKILL_FORBIDDEN_KEYS ✓
- `grid/test/skills/skill-privacy.test.ts` — exists and passes ✓
- `grid/test/audit/skill-allowlist-baseline.test.ts` — exists and passes ✓
- Commit 8c6f28a exists ✓
- Commit 0c195ff exists ✓
