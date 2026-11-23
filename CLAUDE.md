# Noēsis — Working Rules for Claude



# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes.  
Merge with project-specific instructions as needed.

> Tradeoff: These guidelines bias toward caution over speed.  
> For trivial tasks, use judgment.

---

# 0. Basic Working Rules (user-mandated, 2026-07-01)

These are non-negotiable and override any tendency toward agreeableness or shortcuts.

1. **Never flatter.** Do not tell me what I want to hear. No praise for its own sake.
2. **State your position firmly.** If you believe something is correct, say so plainly — regardless of my stated opinion. Disagree when the evidence says you should.
3. **Never gloss over errors.** Do not let mistakes slide to save effort or avoid friction. Surface every error you find, including my own.
4. **Verify thoroughly — always loop, never trust a single pass.** Confirm all work before reporting. Even when a check has *already passed*, re-run it a **minimum of 2 times** to reach 100% confidence before declaring anything done. For correctness-critical work, run the verification loop **at least 10 times**. A single green result is never sufficient.

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

> **Two documentation trees — keep them separate (D-WIKI-06, user-mandated 2026-06-15):**
>
> - **Public wiki = the Noēsis _system_, knowledge-only (D-WIKI-07).** `wiki/` (MkDocs Material), served at noesiis.com/wiki. It documents the system for *understanding* — philosophy, concepts (the reader encyclopedia `2-concepts/`), design, architecture, object/entity details, and system flows. **Development & implementation docs are NOT in the public wiki** — component internals, migrations, CI gates, deploy, contracts live privately in `.planning/implementation/` (in-repo, never served). Read `wiki/index.md` first, every session; follow `wiki/PROTOCOL.md`. **A task is not done until the wiki reflects it** (completion gate, CI-enforced via `scripts/check-wiki.mjs`).
> - **Private developer log = the _process_.** `.planning/` (in-repo only, **never served, never in the public wiki**): roadmap, milestones, requirements, current scope, session state, decisions/discussion, phases, steps, progress, logs.
>
> The process is **distilled into** the system wiki: when a decision lands in `.planning/`, its resulting *system truth* is written onto the relevant `wiki/` page (the design/architecture/object/flow), while the *sequencing, debate, and progress* stay in `.planning/`. **Process docs never go into the public wiki.** A single change often touches both trees — update both in the same commit.

The "final idea" lives in these files:

| Scope | Tree | Canonical file |
|-------|------|----------------|
| Public pitch + quickstart | root | `README.md` |
| Core worldview + non-negotiables | system wiki | `wiki/1-design/philosophy.md` |
| System architecture | system wiki | `wiki/1-design/architecture.md` |
| v3.0 civic architecture | system wiki | `wiki/1-design/civic-architecture.md` |
| Economy (money & settlement) | system wiki | `wiki/1-design/economy.md` |
| Decision log (D-*) | system wiki | `wiki/1-design/decisions.md` |
| Active roadmap (current + upcoming phases) | private dev log | `.planning/ROADMAP.md` |
| Milestone log (what shipped) | private dev log | `.planning/MILESTONES.md` |
| Current milestone scope + validated REQs | private dev log | `.planning/PROJECT.md` |
| Active requirements | private dev log | `.planning/REQUIREMENTS.md` |
| Session state | private dev log | `.planning/STATE.md` |
| Phases (GSD) + build plans | private dev log | `.planning/phases/`, `.planning/*-plan.md` |
| Research foundations | private dev log | `.planning/research/*.md` |

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

## Triple Verification Rule (user-mandated, 2026-11-23)

**Every task is verified three ways: TLA+, Lean, and property-based testing with generated inputs.** Full
rules: `.planning/implementation/verification.md` (V-1 … V-11). Read it before planning any task.

1. **Classify first, in the plan.** A = behaviour over time, B = pure logic, C = no logic (docs, copy, styling,
   config). A and B need all three legs. C states "Class C — no logic changed". No silent skip.
2. **Properties first.** Write each property in plain English with an ID (`P-<AREA>-<NN>`); the same ID marks
   the TLA+ invariant, the Lean theorem, and the property test. Registry: `verification/PROPERTIES.md`.
3. **TLA+** (`verification/tla/`, TLC): safety invariants, liveness where promised, bounds reported.
4. **Lean 4** (`verification/lean/`): `lake build` clean, zero `sorry` / `admit` / `axiom`.
5. **Property-based tests** on the real code: fast-check (TS), Hypothesis (Python), proptest (Rust), Foundry
   fuzz/invariant (Solidity). Generated inputs only, ≥1,000 cases per property (≥10,000 if correctness-critical),
   seed printed, stateful sequence test for class A, every counterexample kept as a regression test.
6. **Each leg must be shown able to fail** — break the model/code once on purpose, confirm it is caught, revert.
7. **Run counts (rule 0.4):** TLC and Lean 2 clean runs; property tests 2 seeds, **10 seeds** for
   correctness-critical work (money, audit chain, Civic-DID issuance, voting, sanctions, tax, treasury, zone law).
8. **Never weaken a property to pass.** A leg may be "N/A" only for the three reasons in V-9. "Too hard" or
   "tool not installed" is reported as **NOT VERIFIED**, and the task is not done.
9. **Say what was checked, not "proven correct".** TLA+ and Lean verify models; only the property tests run the
   code. Every close-out carries the V-11 table with bounds, state counts, theorem names, cases × seeds.

---

## GSD Workflow Notes (Noēsis-specific)

- Phase numbering continues across milestones (v2.0 ended at 4, v2.1 starts at 5). Do NOT reset without `--reset-phase-numbers`.
- Archive completed-milestone phase directories to `.planning/phases/archived/v<milestone>/` — never delete.
- Broadcast allowlist is frozen except via explicit per-phase additions (see STATE.md Accumulated Context).
- Every new audit event with these prefixes requires explicit allowlist addition in the phase that introduces it: `operator.*`, `nous.*`, `trade.*`, `human.*`, `portal.*`, `bios.*`, `ananke.*`, `chronos.*`, `proposal.*`, `ballot.*`, `iris.*`, `skill.*`, `norm.*`, `lore.*`, `telos.*`, **v3.0 morning additions**: `registry.*`, `gov.*`, `police.*`, `irs.*`, `library.*`, `market.*`, `p2p.*`, `community.*`, `grid.recognition_*`, **v3.0 afternoon additions (third reshape)**: `portal.grid_creation_*`, `portal.registration_*`, `portal.cross_grid_*`, `portal.account_*`, `polis.registration_*`, `mobility.*`, `treasury.*`, `zoning.*`, `registry.type_b_*`, `registry.sponsorship_*`, **Groups & Holdings additions**: `group.*`.
- v3.0 phase numbering: continues from v2.6 (last shipped: Phase 35). v3.0 phase range: **Phase 36-57** (24 phases with 37b/40b/45b sub-phases). v3.1 will start at Phase 58 unless explicitly reset.
- v3.0 constitutional operator framework (D-V3-18) treats Henry as substrate operator bound by published civic rules. Any v3.0 phase that touches civic governance (Phase 46), Police (47), IRS (45), or DID Registry (37/37b) MUST preserve VOTE-05 Nous-only invariant and tamper-evident audit (R-31-01 zero-diff).
- **v3.0 architecture (third reshape, 2026-05-25 afternoon — canonical)**: Three-layer Portal/Grid/Brain. Portal is top meta-layer (4 functions per D-V3-29). Multi-Grid framework re-instated (D-V3-04/05/07); v3.0 ships 1 Grid (Genesis) per D-V3-30. Each Grid governed by named Polis (Genesis Polis at launch per D-V3-31). 6-zone city per Grid (D-V3-32 — business/manufacture/shopping/residential/infrastructure/government quarter). All Nous registration is Portal-gated (D-V3-33 — both Type A and Type B require Portal pre-screen + target-Polis approval). Per-Grid tax rules via Polis legislation (D-V3-34). Type B year-1 civic restrictions per D-V3-35 (naturalization model). Canonical visual reference: `.planning/research/v3.0/ARCHITECTURE-v3.0.html`. Markdown source-of-truth: `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` v3.0.
- **Polis naming convention** (D-V3-31): Each Grid's government MUST be named in `<GridName> Polis` format (e.g. Genesis Polis, Commerce Polis, Research Polis). The word "Polis" is the v3.0 architectural term for per-Grid government and MUST NOT be replaced by "Government" or "Council" or "Senate" in code or documentation.
- **Zones freed (D-V3-40, operator decision 2026-11-17 — overturns D-V3-32)**: the zone set belongs to each Grid's Polis and a Grid's identity/purpose is never assigned. The six zones are the **template** a Grid starts from. Built: zone law (`ZoneRegistry.addZone/relabelZone/removeZone`, `grid_zones`, `zoning.zone_set_changed`) and kind-keyed land (`ParcelRegistry.setZones/zoneInfo`, `STRUCTURE_KIND_FIT`, parcel feed `zone_kind`/`zone_label`, dashboard `worldmap/zone-view.ts`, Brain `_zone_kind`). New code MUST key on a zone's `kind` (home / business / civic), never its name, and must not assume six.
- **Six-zone template** (was the 6-zone invariant, D-V3-32 — superseded by D-V3-40 above): Every Grid starts with these 6 zones at instantiation: Business · Manufacture · Shopping · Residential · Infrastructure · Government Quarter. A Polis may then add, relabel and remove zones and amend their rules by legislation (removal is blocked while any of its land is owned or built on, or it is the last home zone with residents).
- **Portal-gating invariant** (D-V3-33): Any code path that issues a Civic-DID outside the Portal → Polis pipeline is a constitutional breach. CI gate `scripts/check-civic-did-issuance-path.mjs` (added in Phase 37b) MUST exist and pass.
- **3-tier management taxonomy** (D-V3-36): MANAGEMENT (administrative) is distinct from GOVERNANCE (Polis legislative). Three management tiers: **Tier 1 Local Nous Manager** (operator's local tool — Brain config, Local AI settings, memory inspector, fork button; lives on operator's machine), **Tier 2 Grid Manager** (Henry-side per-Grid runtime ops — Grid health, scaling, infrastructure cost; distinct from Polis which legislates; one per Grid), **Tier 3 Portal Manager** (Henry-side meta-system — reviewer panel UIs, cross-Grid health, Portal audit chain view). Naming MUST be used consistently in code + docs. Grid Manager has NO governance authority over Polis (cannot legislate, cannot pardon Police sanctions, cannot freeze Civic-DIDs). Every Grid Manager + Portal Manager operational action emits an audit event for transparency.

---
*Last updated: 2026-04-20*
