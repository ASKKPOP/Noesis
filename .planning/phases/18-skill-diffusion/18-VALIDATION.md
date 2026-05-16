---
phase: 18
slug: skill-diffusion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (Brain) + Vitest (Grid) |
| **Config file** | `brain/pytest.ini` / `grid/vitest.config.ts` |
| **Quick run command** | `cd brain && python -m pytest tests/skills/ tests/learning/ -x -q` |
| **Full suite command** | `cd brain && python -m pytest -x -q && cd ../grid && npx vitest run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd brain && python -m pytest tests/skills/ tests/learning/ -x -q`
- **After every plan wave:** Run full suite (both brain + grid)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 18-W0-01 | 01 | 0 | SKILL-03 | T-18-03 | FORBIDDEN_KEY_PATTERN rejects skill_body\|skill_text\|rule_text | unit | `cd grid && npx vitest run broadcast-allowlist` | ⬜ pending |
| 18-W0-02 | 01 | 0 | SKILL-03 | T-18-01 | ALLOWLIST_MEMBERS.length === 36 before new events added | unit | `cd grid && npx vitest run allowlist-count` | ⬜ pending |
| 18-W1-01 | 01 | 1 | SKILL-01 | T-18-01 | __skill_share: dispatch wired in BrainHandler.on_message() | unit | `cd brain && python -m pytest tests/skills/test_peer_filter.py -x -q` | ⬜ pending |
| 18-W1-02 | 01 | 1 | SKILL-01 | T-18-01 | QuarantineStore enqueues and promotes after QUARANTINE_TICKS | unit | `cd brain && python -m pytest tests/skills/test_quarantine.py -x -q` | ⬜ pending |
| 18-W1-03 | 01 | 1 | SKILL-01 | T-18-02 | Trust eviction fires skill.rejected with low_trust | unit | `cd brain && python -m pytest tests/skills/test_quarantine.py::test_eviction -x -q` | ⬜ pending |
| 18-W1-04 | 01 | 1 | SKILL-01 | T-18-01 | Flood gate counts quarantine rows (not just active skills) | unit | `cd brain && python -m pytest tests/skills/test_peer_filter.py::test_flood_gate -x -q` | ⬜ pending |
| 18-W2-01 | 02 | 2 | SKILL-02 | T-18-02 | DID/numeric filter rejects skills containing did:noesis: or \d{4,} | unit | `cd brain && python -m pytest tests/learning/test_observational.py::test_did_filter -x -q` | ⬜ pending |
| 18-W2-02 | 02 | 2 | SKILL-02 | T-18-02 | OL rate-limit: max 1 skill per 30-tick epoch per Nous-pair | unit | `cd brain && python -m pytest tests/learning/test_observational.py::test_rate_limit -x -q` | ⬜ pending |
| 18-W2-03 | 02 | 2 | SKILL-02 | — | Inferred skills tagged source: observed | unit | `cd brain && python -m pytest tests/learning/test_observational.py::test_provenance -x -q` | ⬜ pending |
| 18-W3-01 | 03 | 3 | SKILL-03 | T-18-03 | skill.taught payload has exactly {learner_did,parent_hash,skill_hash,teacher_did,tick} | unit | `cd grid && npx vitest run appendSkillTaught` | ⬜ pending |
| 18-W3-02 | 03 | 3 | SKILL-03 | T-18-03 | skill.inferred payload has exactly {learner_did,skill_hash,source_event_hash,tick} | unit | `cd grid && npx vitest run appendSkillInferred` | ⬜ pending |
| 18-W3-03 | 03 | 3 | SKILL-03 | T-18-03 | skill.rejected payload has exactly {learner_did,rejection_reason,tick} | unit | `cd grid && npx vitest run appendSkillRejected` | ⬜ pending |
| 18-W3-04 | 03 | 3 | SKILL-03 | — | ALLOWLIST_MEMBERS.length === 39 after additions | unit | `cd grid && npx vitest run allowlist-count` | ⬜ pending |
| 18-W4-01 | 04 | 4 | SKILL-04 | — | 3-hop lineage (A→B→C→D) reconstructable via SQL self-join on skill_hash/parent_hash | integration | `cd brain && python -m pytest tests/skills/test_lineage.py -x -q` | ⬜ pending |
| 18-W4-02 | 04 | 4 | SKILL-04 | — | First-gen skill parent_hash == skill_hash (self-referential root) | unit | `cd brain && python -m pytest tests/skills/test_lineage.py::test_root_self_ref -x -q` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/src/audit/__tests__/broadcast-allowlist.test.ts` — assert ALLOWLIST_MEMBERS.length === 36 pre-extension
- [ ] `grid/src/audit/__tests__/broadcast-allowlist.test.ts` — assert FORBIDDEN_KEY_PATTERN covers skill_body|skill_text|rule_text
- [ ] Existing `brain/tests/skills/` directory — confirm pytest can discover new test files

*Wave 0 must pass before any Brain or Grid emitter code lands.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 3-hop transmission chain observable without operator intervention | SKILL-04 | Requires live rig run with 4+ Nous | Run `docker compose up` with 4-Nous rig; observe audit chain for `skill.taught` events with matching `parent_hash` chain; verify SQL self-join reconstructs A→B→C→D |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
