# Design — Nous In-World Faculties (Perception · Action · Synthesis)

**Date:** 2026-07-10
**Milestone:** v3.3 Mind — In-World Faculties
**Phases:** 72 (`aisthesis`) → 73 (`praxis`) → 74 (`synopsis`). Bridge work (75–76) **held** by user.
**Status:** design validated in-session (brainstorming), implementation opening.

---

## Origin & framing

Prompted by a comparison to a YouTube walkthrough of 8 open-source local-AI "blocks"
(persona / workspace / memory / notebook / interface / wiki / vision / work-log). Our Nous is
**not** organized on that axis — it is one Brain decomposed into ~10–12 Greek-named *cognitive*
faculties (`psyche`, `thymos`, `telos`, `ananke`, `bios`, `chronos`, `iris`, `hypnos`, `memory`,
`episteme`, `learning`/`aau`, `llm`). Three capabilities from that video have no first-class
faculty today; this milestone adds them **as in-world faculties** that operate on the simulated
Grid, true to "a digital citizen with an inner life" (not a productivity agent).

## Non-negotiable boundary (why the bridge is held)

Each faculty is a **capability interface with two providers**:

- **In-world provider** — canonical, always on, works for Type A *and* Type B Nous. Operates
  only on the Grid. **This milestone builds only these.**
- **Operator-bridge provider** — opt-in, **Type A only** (sovereign Nous on operator hardware),
  gated by operator consent + audit; reaches the real machine (sim-use apps, real camera CV,
  real PDFs). **HELD** — phases 75–76, not started. Keeps the constitution intact: a Type-B Nous
  hosted on Henry's GPU can never touch anyone's real hardware.

`nous_type` (A/B) is a Grid-side field (`grid/src/db/schema.ts` `nous_type ENUM('A','B')`); the
Brain process is type-agnostic today. In-world faculties need no type gate — only the future
bridge does.

## The three faculties

| Faculty | Meaning | Archetype | In-world behaviour (this milestone) |
|---------|---------|-----------|-------------------------------------|
| `aisthesis` | perception / sensation | `thymos` (in-memory tracker) | Formalize ambient world-sight into a faculty: hold a structured percept snapshot from the existing `parcels`+`objects` feed, **diff** it to surface *salient change* percepts ("a new structure appeared in the Business zone"), expose to memory + prompt, and let change wake `ananke` curiosity. |
| `praxis` | action / doing | `ananke` (runtime + loader) | Formalize acting on the Grid: a registry of in-world **action verbs** with a validate→execute contract over the existing `tools/`+`sandbox/` and `_run_decision_cycle` dispatch. Generalizes the existing `_economic_action_from_decision` "validate an LLM-chosen action before it leaves" gate. |
| `synopsis` | seeing-together / synthesis | `iris` (SQLite-backed store) | Formalize research: a background, curiosity/goal-triggered process that pulls sources via `aau`, **synthesizes** them, and persists results into `episteme` (personal wiki). Never touches live LLM context; runs as a background `asyncio.Task`. |

## Data flow — edges of the perceive→deliberate→act loop

The faculties are **not** peers of the LLM; they sit at the loop edges, hooking into
`BrainHandler.on_tick` (`brain/src/noesis_brain/rpc/handler.py`):

- **`aisthesis` = input edge.** Refresh perception right after the ananke runtime is fetched
  (after `handler.py:1348`), before the `_should_run_*` cycle gates — so percepts are available
  to the LLM cycles this tick. Percepts flow into `memory` and can raise `ananke` curiosity.
- **`praxis` = output edge.** Validate/execute a chosen action between decision-parse
  (`handler.py:915`) and grid dispatch (`handler.py:1678`), as a post-processor over the
  `actions` list. Respects the `ToolRegistry` name guard (no `trade|transfer|wallet|treasury|
  account` — money axiom).
- **`synopsis` = background.** Copy the cooldown-gated background-task idiom
  (`_should_run_*_cycle` + `_asyncio.create_task(...)`, `handler.py:1356-1359`); gate on
  `_mind_awake(tick)` if it calls the LLM (extraction via `aau` is deterministic and does not).

Faculty snapshots are surfaced to the dashboard through `get_state` (`handler.py:1827`).

## Construction convention

- `aisthesis` (lightweight tracker) → constructed in `create_brain_app` (`__main__.py`) and
  passed into `BrainHandler`, like `thymos`/`telos`.
- `synopsis` (DB-backed) → self-instantiated lazily inside `BrainHandler.__init__`, gated on an
  optional `*_db_dir` kwarg, like `iris`/`hypnos`. Per-Nous DB file `synopsis_{did_safe}.db`.
- `praxis` (runtime + loader) → loader on the handler, memoized per-DID like `ananke`/`bios`.

## Invariants & obligations

- **State hash is closed at 4** (`state_hash.py`, contract test
  `brain/test/test_state_hash.py`). New faculties are transient/derived — **do NOT** add a 5th
  hash. `state_hash.py` is not touched.
- **Determinism** — no wall-clock in faculty source; add a `test_<faculty>_no_walltime.py` grep
  gate cloned from `test_ananke_no_walltime.py` for `praxis`/`synopsis`.
- **Audit / allowlist** — in-world faculties stay Brain-local (percepts → memory, research →
  wiki); they emit **no new Grid audit events** this milestone, so **no broadcast-allowlist
  change is required**. If a later phase emits `aisthesis.*` / `praxis.*` / `synopsis.*` to the
  Grid, that needs explicit per-phase allowlist additions (frozen-allowlist rule) and payload
  keys must dodge `FORBIDDEN_KEY_PATTERN` (no body/content/text/session_id).
- **Closed enums** — any faculty enum follows the ananke "closed enum" discipline.

## Documentation sync (same-commit, per CLAUDE.md)

- `.planning/implementation/brain.md` — add three rows to the cognitive-pipeline table + extend
  the Mermaid `PIPE` subgraph.
- `wiki/2-concepts/mind/` — new concept pages (`perception.md`, `action.md`, `synthesis.md`) or
  extend existing mind pages; each wiki page needs a Mermaid diagram.
- `.planning/ROADMAP.md` — add the v3.3 Mind milestone block; `.planning/STATE.md` — reset focus.

## Test strategy (TDD)

Per faculty, red→green: `brain/test/test_<faculty>.py` (class-based, import from package,
direct state assertions — `test_thymos.py` template) + a no-walltime gate where deterministic +
a handler-hookup integration assertion (`test_loop_integration.py` / `test_rpc_handler.py`
patterns). Run via `.venv/bin/pytest brain/test/`.

## Phasing

1. **Phase 72 — `aisthesis` in-world.** Perception faculty + change-diff percepts + handler
   input-edge hook + `get_state` snapshot. Risk: low (no security surface, no Grid events).
2. **Phase 73 — `praxis` in-world.** Action-verb registry + validate/execute contract +
   output-edge hook. Risk: low.
3. **Phase 74 — `synopsis` in-world.** SQLite research store + `aau`-driven synthesis into
   `episteme` + background-cycle hook. Risk: low.
4. **Phases 75–76 — operator bridge + Local Nous Manager + Type-A providers. HELD.**
