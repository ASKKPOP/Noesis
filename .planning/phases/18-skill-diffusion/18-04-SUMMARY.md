---
phase: 18-skill-diffusion
plan: "04"
subsystem: grid/skills
tags: [skill-diffusion, sole-producer, allowlist, nous-runner, wave-2]
dependency_graph:
  requires: [18-02]
  provides: [appendSkillTaught, appendSkillInferred, appendSkillRejected, skill-allowlist-39, skill-dispatch-cases]
  affects:
    - grid/src/skills/types.ts
    - grid/src/skills/appendSkillTaught.ts
    - grid/src/skills/appendSkillInferred.ts
    - grid/src/skills/appendSkillRejected.ts
    - grid/src/skills/index.ts
    - grid/src/audit/broadcast-allowlist.ts
    - grid/src/integration/nous-runner.ts
tech_stack:
  added: []
  patterns:
    - sole-producer-emitter (10-step validation clone of appendIrisBeliefRevised)
    - closed-tuple-enforcement (Object.keys(payload).sort() strict equality)
    - 3-keys-not-5 (Brain sends metadata keys; Grid injects learner_did+tick)
    - enum-validation-not-hash (rejection_reason uses VALID_REJECTION_REASONS set, not HEX64_RE)
    - dispatch-reject-logged-not-rethrown (console.warn skill.dispatch.rejected)
key_files:
  created:
    - grid/src/skills/types.ts
    - grid/src/skills/appendSkillTaught.ts
    - grid/src/skills/appendSkillInferred.ts
    - grid/src/skills/appendSkillRejected.ts
    - grid/src/skills/index.ts
  modified:
    - grid/src/audit/broadcast-allowlist.ts
    - grid/src/integration/nous-runner.ts
decisions:
  - "DID_RE and HEX64_RE re-exported from appendSkillTaught (project pattern — one canonical definition per module group)"
  - "appendSkillInferred and appendSkillRejected import DID_RE/HEX64_RE from appendSkillTaught rather than redeclaring"
  - "rejection_reason uses VALID_REJECTION_REASONS Set membership check — not HEX64_RE — because rejected skills carry human-readable enum values, not hashes"
  - "appendSkillRejected has 9 steps (not 10) — no second-DID step; steps renumbered accordingly"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-16T16:18:25Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 2
requirements: [SKILL-03]
---

# Phase 18 Plan 04: Grid Skill Emitters + Allowlist 36→39 (Wave 2) Summary

**One-liner:** Three sole-producer emitters created in grid/src/skills/ with 10-step validation; ALLOWLIST_MEMBERS extended from 36 to 39 (skill.taught pos 37, skill.inferred pos 38, skill.rejected pos 39); three NousRunner dispatch cases wired with 3-keys-not-5 Grid composition pattern.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create grid/src/skills/ module (types.ts + 3 emitters + index.ts) | 1754149 | types.ts, appendSkillTaught.ts, appendSkillInferred.ts, appendSkillRejected.ts, index.ts |
| 2 | Extend ALLOWLIST_MEMBERS 36→39 + wire 3 NousRunner dispatch cases | 074e276 | broadcast-allowlist.ts, nous-runner.ts |

## What Was Built

**Task 1 — grid/src/skills/ module:**

- `types.ts`: Three payload interfaces (`SkillTaughtPayload`, `SkillInferredPayload`, `SkillRejectedPayload`), three alphabetically-sorted key tuples (`SKILL_TAUGHT_KEYS` 5-key, `SKILL_INFERRED_KEYS` 4-key, `SKILL_REJECTED_KEYS` 3-key), and `VALID_REJECTION_REASONS` Set (`{low_trust, structural_invalid, quota_exceeded}`).

- `appendSkillTaught.ts`: Sole producer for `skill.taught` (pos 37). 10-step validation:
  1. actorDid DID_RE, 2. learner_did DID_RE, 3. self-report (learner_did===actorDid), 4. tick ≥0 int, 5. teacher_did DID_RE, 6. skill_hash HEX64_RE, 6b. parent_hash HEX64_RE, 7. closed-tuple, 8. explicit reconstruction, 9. payloadPrivacyCheck, 10. audit.append.
  Re-exports `DID_RE` and `HEX64_RE` as the canonical project-wide definitions for this module group.

- `appendSkillInferred.ts`: Sole producer for `skill.inferred` (pos 38). 4-key variant — no teacher_did/parent_hash; validates skill_hash and source_event_hash with HEX64_RE.

- `appendSkillRejected.ts`: Sole producer for `skill.rejected` (pos 39). 3-key variant — step 5 is `VALID_REJECTION_REASONS.has()` enum check instead of a hash check; 9 steps total (no second-DID).

- `index.ts`: Re-exports all three emitters plus `DID_RE`, `HEX64_RE`, all three payload types, all three key tuples, and `VALID_REJECTION_REASONS`.

**Task 2 — Allowlist + NousRunner:**

- `broadcast-allowlist.ts`: Added Phase 18 comment block in the header (positions 37-39 description). Added 3 entries after `iris.prior_seeded`: `skill.taught` (37), `skill.inferred` (38), `skill.rejected` (39). Updated header to "exactly these 39 event types".

- `nous-runner.ts`: Added import block for `appendSkillTaught`, `appendSkillInferred`, `appendSkillRejected` from `../skills/index.js`. Added three dispatch cases after `iris_prior_seeded` and before `noop`:
  - `skill_taught`: Grid composes `{learner_did: this.nousDid, tick, skill_hash, teacher_did, parent_hash}` from Brain metadata
  - `skill_inferred`: Grid composes `{learner_did: this.nousDid, tick, skill_hash, source_event_hash}`
  - `skill_rejected`: Grid composes `{learner_did: this.nousDid, tick, rejection_reason}`
  All three catch and log dispatch failures via `console.warn({event: 'skill.dispatch.rejected', ...})` — not re-thrown.

## Verification

```
# ALLOWLIST_MEMBERS.length === 39 ✓
node --input-type=module -e "import { ALLOWLIST_MEMBERS } from './grid/src/audit/broadcast-allowlist.ts'; console.log(ALLOWLIST_MEMBERS.length, ALLOWLIST_MEMBERS[36], ALLOWLIST_MEMBERS[37], ALLOWLIST_MEMBERS[38]);"
# 39 skill.taught skill.inferred skill.rejected

# Sole-producer boundary clean (no rogue callers) ✓
grep -rn "audit\.append.*skill\." grid/src/ | grep -v "appendSkill"
# no hits

# NousRunner cases wired (13 hits: 3 case labels + 3 action_type strings + 3 appendSkill* calls + 3 import lines + 1 comment) ✓
grep -c "skill_taught\|skill_inferred\|skill_rejected\|appendSkillTaught\|appendSkillInferred\|appendSkillRejected" grid/src/integration/nous-runner.ts
# 13

# TypeScript: 0 errors in grid/src/skills/ ✓
cd grid && npx tsc --noEmit 2>&1 | grep "skills/"
# (no output)
```

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. The only minor adaptation was in `appendSkillRejected.ts`: the validation sequence has 9 steps instead of 10 (the plan template specifies 10 for `appendSkillTaught` which has two DID checks beyond actorDid; `appendSkillRejected` has only `actorDid` + `learner_did` DIDs and uses an enum check for step 5, naturally collapsing to 9 steps). This matches the plan's explicit description of the rejection emitter.

## Threat Model Coverage

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-18-01: Tampering — skill.taught payload | 10-step emitter validation: DID_RE on both DIDs + teacher_did, HEX64_RE on both hashes, closed-tuple, explicit reconstruction, payloadPrivacyCheck | Mitigated |
| T-18-02: Tampering — skill.rejected enum bypass | VALID_REJECTION_REASONS set membership check in appendSkillRejected step 5; unknown rejection_reason throws TypeError, logged via console.warn, not appended to chain | Mitigated |
| T-18-03: Information disclosure — sole-producer boundary | Only appendSkill*.ts files call audit.append with skill.* events; grep-verified no rogue callers | Mitigated |

## Known Stubs

None — all emitters are fully wired. Brain→NousRunner→appendSkill*→audit.append path is complete. Plan 05 (producer boundary test) will add a grep-based CI gate to enforce the sole-producer invariant permanently.

## Threat Flags

None — no new network endpoints or auth paths. Changes are Grid-internal: new module in grid/src/skills/, two additions to existing Grid files (broadcast-allowlist.ts, nous-runner.ts). Trust boundary is NousRunner→AuditChain, already present in the threat model.

## Self-Check: PASSED

- `grid/src/skills/types.ts` — exists ✓
- `grid/src/skills/appendSkillTaught.ts` — exists, contains `audit.append('skill.taught'` ✓
- `grid/src/skills/appendSkillInferred.ts` — exists, contains `audit.append('skill.inferred'` ✓
- `grid/src/skills/appendSkillRejected.ts` — exists, contains `audit.append('skill.rejected'` ✓
- `grid/src/skills/index.ts` — exists, exports SKILL_TAUGHT_KEYS, VALID_REJECTION_REASONS ✓
- `grid/src/audit/broadcast-allowlist.ts` — ALLOWLIST_MEMBERS.length === 39 ✓
- `grid/src/integration/nous-runner.ts` — contains case 'skill_taught', 'skill_inferred', 'skill_rejected' ✓
- Commit 1754149 exists ✓
- Commit 074e276 exists ✓
- TypeScript: 0 errors in grid/src/skills/ ✓
- Sole-producer boundary: no rogue callers ✓
