# Noēsis — Working Rules for Claude



# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes.  
Merge with project-specific instructions as needed.

> Tradeoff: These guidelines bias toward caution over speed.  
> For trivial tasks, use judgment.

---

# 1. Think Before Coding

Don't assume.  
Don't hide confusion.  
Surface tradeoffs.

Before implementing:

- State your assumptions explicitly.
- If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so.
- Push back when warranted.
- If something is unclear, stop.
- Name what's confusing.
- Ask.

---

# 2. Simplicity First

Minimum code that solves the problem.  
Nothing speculative.

Rules:

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.

If you write 200 lines and it could be 50, rewrite it.

Ask yourself:

> "Would a senior engineer say this is overcomplicated?"

If yes, simplify.

---

# 3. Surgical Changes

Touch only what you must.  
Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that **YOUR** changes made unused.
- Don't remove pre-existing dead code unless asked.

The test:

> Every changed line should trace directly to the user's request.

---

# 4. Goal-Driven Execution

Define success criteria.  
Loop until verified.

Transform tasks into verifiable goals:

- `"Add validation"`  
  → `"Write tests for invalid inputs, then make them pass"`

- `"Fix the bug"`  
  → `"Write a test that reproduces it, then make it pass"`

- `"Refactor X"`  
  → `"Ensure tests pass before and after"`

For multi-step tasks, state a brief plan:

```txt
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently.

Weak criteria like:

> "make it work"

require constant clarification.

---

# Success Indicators

These guidelines are working if you see:

- Fewer unnecessary changes in diffs
- Fewer rewrites caused by overcomplication
- Clarifying questions appearing before implementation instead of after mistakes



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
- Every new audit event with these prefixes requires explicit allowlist addition in the phase that introduces it: `operator.*`, `nous.*`, `trade.*`, `human.*`, `portal.*`, `bios.*`, `ananke.*`, `chronos.*`, `proposal.*`, `ballot.*`, `iris.*`, `skill.*`, `norm.*`, `lore.*`, `telos.*`, **plus v3.0 additions**: `registry.*`, `gov.*`, `police.*`, `irs.*`, `library.*`, `market.*`, `p2p.*`, `community.*`, `grid.recognition_*`.
- v3.0 phase numbering continues from v2.6 (last shipped: Phase 35 → v3.0 opens at Phase 36). Phase 36-50 are the v3.0 phase range; v3.1 will start at 51 unless explicitly reset.
- v3.0 constitutional operator framework (D-V3-18) treats Henry as substrate operator bound by published civic rules. Any v3.0 phase that touches civic governance (Phase 46), Police (47), IRS (45), or DID Registry (37) MUST preserve VOTE-05 Nous-only invariant and tamper-evident audit (R-31-01 zero-diff).

---
*Last updated: 2026-04-20*
