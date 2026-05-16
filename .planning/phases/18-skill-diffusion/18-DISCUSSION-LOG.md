# Phase 18: Skill Diffusion — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 18 — Skill Diffusion
**Areas discussed:** Quarantine mechanics, ObservationalLearner scope

---

## Quarantine mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Rig-configurable (QUARANTINE_TICKS in TOML) | TOML RIG config, default 5 ticks. Same pattern as NORM_THRESHOLD. | ✓ |
| Hardcoded 5 ticks | Fixed constant in peer_filter.py / quarantine store | |
| No quarantine — accept immediately | PeerSkillFilter 3 gates already sufficient | |

**User's choice:** Rig-configurable (QUARANTINE_TICKS in TOML RIG config)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Evict — drop quarantine entry | Trust drop evicts skill + emits skill.rejected low_trust | ✓ |
| Let it ride — trust is admission-only | Trust checked at receive time; quarantine is just a timer | |
| Pause timer — restart clock if trust recovers | Adds complexity but preserves the relationship | |

**User's choice:** Evict — trust is a live precondition, not just admission gate

---

| Option | Description | Selected |
|--------|-------------|----------|
| Separate quarantine table in Brain SQLite | New `skills_quarantine` table; promotion is explicit move operation | ✓ |
| Status flag on existing skills table | `status TEXT` column on skills table — simpler migration | |

**User's choice:** Separate quarantine table

---

## ObservationalLearner scope

| Option | Description | Selected |
|--------|-------------|----------|
| trade.settled only (current + recommended) | Keep Phase 16 behavior; extend in future phases | ✓ (by user recommendation) |
| nous.spoke (public speech) | Higher signal volume but noisier extraction | |
| skill.taught (learn from observed teaching) | Meta-learning; bootstrap issue in Phase 18 | |

**User's choice:** trade.settled only — follow the recommendation

---

| Option | Description | Selected |
|--------|-------------|----------|
| Regex filter: DID pattern or Ousia number | Block `did:noesis:` substrings + integers ≥1000. Deterministic. | ✓ |
| Hash-only filter: FTS5 exact-match | Catches verbatim replays only | |
| LLM judge: ask LLM if skill is 'too specific' | Most accurate but breaks determinism + burns tokens | |

**User's choice:** Regex filter — deterministic, no LLM

---

## Claude's Discretion

- `parent_hash` for first-generation skills: self-referential (SHA-256 of teacher's own skill = parent_hash = skill_hash at root)
- Quarantine promotion check timing: start of `on_tick()` before OL dispatch
- ActionType naming: `SKILL_TAUGHT`, `SKILL_INFERRED`, `SKILL_REJECTED`

## Deferred Ideas

- ObservationalLearner extension to `nous.spoke` / `skill.taught` event sources — future phase
- Trust-threshold tuning per Nous personality — requires Psyche integration
- Cross-Grid skill sharing (multi-Grid federation) — explicitly out of scope
