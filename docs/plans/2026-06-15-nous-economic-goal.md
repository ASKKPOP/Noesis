# Nous Economic Goal (Target: Earn a Living) — Scope

> **STATUS: SHIPPED 2026-06-15.** Tasks 1–4 complete; full brain suite green (958). Seeded at spawn for all Nous (D1=auto-seed, D2=long-term goal). One mid-build correction: seeding moved out of `from_yaml` (a rebuild contract) into the spawn path only — see commit `826e975`.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make "earn a living" a first-class, tracked **target** in a Nous's goal system (`telos`), closing the spec §1 "Target & Goals — including earning [money]" gap — framed per the money axiom (compute-labor, not Ousia).

**Architecture:** Add an orthogonal `GoalDomain` dimension to `Goal` (the existing `GoalType` is a *time horizon*, not a category — must not be polluted). Seed an economic goal so a Nous treats earning as a standing target, and surface it in the system prompt so the mind is aware of it. No money is moved; no schema in the money rails is touched.

**Tech Stack:** Python 3.12, existing `telos` module, pytest.

---

## Why this shape (grounding)

- `telos/types.py`: `GoalType = {SHORT_TERM, MEDIUM_TERM, LONG_TERM}` — a **horizon**. A goal's content is the free-text `description`. So an "economic" tag is a **second axis**, added as `Goal.domain`.
- `telos/manager.py` `describe()` → `prompts/system.py` `_goals_section` injects goals into every prompt.
- Goals load from each Nous YAML `telos:` section — in **two** places (`TelosManager.from_yaml` *and* `__main__.py:261-269`, a pre-existing duplication). Seeding must cover the runtime path (`__main__.py`).
- `state_hash.hash_telos` hashes active goals by description/status/progress — part of the zero-diff cognitive-state invariant (R-31-01). Adding a defaulted field that the hash does **not** read keeps existing hashes stable.

## Money-axiom reconciliation (D-MONEY-01)

The spec says "earning **Cyber Money**." Ousia is retired; money = compute-labor + ETH. The seeded goal is therefore framed as work, not currency accumulation:

> _"Earn a living through compute-labor — do useful work for other Nous."_

No Ousia, no ETH custody, no balance mutation. This goal is a **disposition the mind reasons from**, not a transaction.

---

## Decisions (LOCKED 2026-06-15)

**D1 = Auto-seed for all Nous.** Every *spawned* Nous gets the economic goal by default, with a `telos.earn_money: false` opt-out. **Critical:** seed in the **config/spawn path** (`from_yaml` + `__main__.py`), **never in `TelosManager.__init__`** — a bare `TelosManager()` (used by unit tests and internal construction) must stay empty so `test_telos.py` count assertions and zero-diff fixtures are unaffected.

**D2 = Long-term goal in `telos`.** Modeled as a `LONG_TERM` goal that never auto-completes (progress is a soft indicator, not a settlement). The `ananke` economic-drive alternative is out of scope.

**Blast-radius check (done):** `test_state_hash.py` asserts determinism + 64-hex (not frozen golden strings), so deterministic seeding keeps it green. `test_telos.py` uses bare `TelosManager()`, untouched. `test_main.py` may assert goal counts after config load → update it for the +1 seeded goal.

---

## Task 1: `GoalDomain` enum + `Goal.domain` field

**Files:** Modify `brain/src/noesis_brain/telos/types.py`; Test `brain/test/telos/test_goal_domain.py` (Create).

- Add `class GoalDomain(str, Enum): GENERAL = "general"; ECONOMIC = "economic"`.
- Add `domain: GoalDomain = GoalDomain.GENERAL` to `Goal` (defaulted → backward compatible; existing call sites and `hash_telos` unaffected).
- Tests: a default goal is `GENERAL`; an economic goal carries `ECONOMIC`; existing `Goal(...)` construction without `domain` still works.

**TDD:** failing test → add enum+field → pass → commit.

## Task 2: Seed + load the economic goal (D1=A: opt-in)

**Files:** Modify `telos/manager.py` (`add_goal` gains `domain` param, default GENERAL; `from_yaml` reads `earn_money`/`economic`); Modify `__main__.py:261-269` (runtime seeding); Test `brain/test/telos/test_economic_seed.py` (Create).

- `add_goal(description, goal_type, priority=0.5, domain=GoalDomain.GENERAL)`.
- `from_yaml`: if `data.get("earn_money")` truthy → seed the canonical economic goal as `LONG_TERM`, `domain=ECONOMIC`, priority ~0.4. Also accept an explicit `economic: [..]` list for custom economic goals.
- Mirror the same seeding in `__main__.py` (the live path) so it actually fires at spawn. (Note the pre-existing dup in the plan; do **not** refactor it away here — surgical.)
- Tests: `earn_money: true` → one ECONOMIC long-term goal with the axiom-aligned text; absent/false → none; `economic: [...]` → those goals tagged ECONOMIC.

## Task 3: Surface the target in the prompt

**Files:** Modify `telos/manager.py` `describe()` (tag economic goals) OR `prompts/system.py` `_goals_section`; Test `brain/test/telos/test_economic_prompt.py` (Create).

- `describe()` marks economic goals so the mind sees earning as a standing target, e.g. append `(earn)` or a one-line "You support yourself through compute-labor." when any ECONOMIC goal is active.
- Add `TelosManager.economic_goals()` accessor (for a future economy/cowork integration to consume — keep it a pure read, no behavior).
- Tests: prompt text contains the economic framing when an ECONOMIC goal is active; absent otherwise.

## Task 4: Doc-sync (completion gate)

**Files:** Modify `wiki/2-concepts/mind/inner-life.md` (Telos/goals section — note the economic domain) and the §1 line in the gap-audit/ROADMAP; run `node scripts/check-wiki.mjs`.

- Update the Telos description to mention goals have a **domain**, and that a Nous can hold "earn a living" as an economic target (compute-labor framing, link `economy.md`).
- Wiki gate must stay green (page already has its Mermaid).

---

## Verification

- [ ] `cd brain && .venv/bin/pytest test/telos/ test/` green; existing telos + state_hash tests unaffected (defaulted field).
- [ ] `node scripts/check-wiki.mjs` clean.
- [ ] A spawn YAML with `telos: { earn_money: true }` produces exactly one ECONOMIC long-term goal, visible in the prompt; without it, behavior is byte-identical to today (telos hash unchanged for existing Nous).
- [ ] No money rail / balance / ETH code touched (grep the diff).

## Out of scope

- Actually *earning* (cowork/job settlement already exists separately) — this only adds the **target/disposition**, not the earning mechanism.
- Tying goal progress to real accumulated earnings (would couple telos to the economy ledger) — future.
- The `ananke` economic-drive alternative (D2=B).
