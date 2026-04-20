# Noēsis — Working Rules for Claude

## Documentation Sync Rule (user-mandated, 2026-04-20)

**When the project idea, scope, or design evolves — update the source-of-truth documents in the same turn. Never leave them stale.**

The "final idea" must always live in these files:

| Scope | File |
|-------|------|
| Public pitch + quickstart | `README.md` |
| Core worldview + non-negotiables | `PHILOSOPHY.md` |
| Active roadmap (current + upcoming phases) | `.planning/ROADMAP.md` |
| Milestone log (what shipped) | `.planning/MILESTONES.md` |
| Current milestone scope + validated REQs | `.planning/PROJECT.md` |
| Active requirements | `.planning/REQUIREMENTS.md` |
| Session state | `.planning/STATE.md` |
| Research foundations | `.planning/research/*.md` |

### When this rule fires

- A new milestone opens or an existing one closes
- A REQ is added, reframed, or moved between Active / Future / Out-of-Scope
- A research finding changes direction (e.g. Stanford peer-agent synthesis → Steward Console scope)
- A pitfall or invariant is discovered that should be carried forward (allowlist freeze, zero-diff invariant, DID regex, etc.)
- A decision in `/gsd-discuss-phase` overturns something documented upstream

### How to apply it

1. **Before** writing the plan, edit, or new research: identify which of the files above the change touches.
2. **In the same turn**, update every affected file — don't defer.
3. **Cross-reference** — if README promises a feature now deferred, move the promise to ROADMAP and out of README. If PHILOSOPHY now has a new non-negotiable from research, add it with the research citation.
4. **Commit together** — one git commit per coherent change so the documentation evolution is readable in history.
5. **Never** leave a doc claiming v2.0 behavior when v2.1 has superseded it.

### Examples of what to sync

| Change | Files touched |
|--------|---------------|
| New milestone opens | ROADMAP, MILESTONES, PROJECT, STATE, REQUIREMENTS + README (update "Current status" section) + PHILOSOPHY (only if core tenets shift) |
| Phase ships | ROADMAP (mark complete), MILESTONES (append), PROJECT (move REQs to Validated), STATE (reset focus) |
| Research finding lands | `.planning/research/*.md` + PROJECT.md (Key Decisions) + PHILOSOPHY (if worldview-level) + ROADMAP (if it changes scope) |
| Invariant frozen | PHILOSOPHY + relevant phase VERIFICATION + STATE.md Accumulated Context |

---

## GSD Workflow Notes (Noēsis-specific)

- Phase numbering continues across milestones (v2.0 ended at 4, v2.1 starts at 5). Do NOT reset without `--reset-phase-numbers`.
- Archive completed-milestone phase directories to `.planning/phases/archived/v<milestone>/` — never delete.
- Broadcast allowlist is frozen except via explicit per-phase additions (see STATE.md Accumulated Context).
- Every new `operator.*` or `nous.*` or `trade.*` audit event requires explicit allowlist addition in the phase that introduces it.

---
*Last updated: 2026-04-20*
