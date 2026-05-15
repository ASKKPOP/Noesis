---
phase: 17-iris-theory-of-mind
plan: wave-3
subsystem: brain
tags: [iris, theory-of-mind, handler, prompt, elicit, context_for]
dependency_graph:
  requires: [wave-0, wave-1, wave-2]
  provides: [iris-runtime-wired, tom-prompt-section]
  affects: [brain/rpc/handler.py, brain/prompts/system.py]
tech_stack:
  added: []
  patterns: [optional-dep-injection, fail-soft-guard, additive-widening]
key_files:
  modified:
    - brain/src/noesis_brain/rpc/handler.py
    - brain/src/noesis_brain/prompts/system.py
decisions:
  - "IrisRuntime initialized with optional iris_db_dir param; None disables all iris logic (D-17-14)"
  - "elicit() called once per peer in dialogue_context after seed_priors(), before early-return (D-17-15)"
  - "context_for() called in on_tick() after elicit() (IRIS_CONTEXT_INVOKED reflects fresh writes) and in on_message() at prompt-build time (D-17-16)"
  - "IRIS_CONTEXT_INVOKED emitted in on_tick() only; on_message() does pure read via context_for() with no audit event"
  - "_theory_of_mind_section() injected after peer_voices and before directives in system prompt (D-17-11, D-17-12)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-15"
  tasks_completed: 2
  files_modified: 2
  insertions: 162
  deletions: 1
---

# Phase 17 Plan wave-3: IrisRuntime Wiring + Theory of Mind Prompt Summary

IrisRuntime fully wired into BrainHandler with optional-dep injection, per-peer elicit() trigger, context_for() prompt injection, and four iris audit events emitted from on_tick().

## What Was Built

### Task 1: IrisRuntime init + elicit() wiring (handler.py)

**Imports added** (after `seed_priors` import, line 24):
- `from pathlib import Path`
- `from noesis_brain.iris.store import IrisStore`
- `from noesis_brain.iris.elicit import IrisRuntime`
- `from noesis_brain.iris.integration import context_for`

**`__init__` signature extended** with `iris_db_dir: str | Path | None = None` keyword arg. When provided, constructs `IrisStore(db_path=Path(iris_db_dir)/f"iris_{did}.db", nous_did=did)` and wraps in `IrisRuntime(store, self.llm)`. When None, `self._iris_runtime = None` (fail-soft no-op on all guards).

**`on_tick()` additions** (after seed_priors block, before early-return):
- Loops over `dialogue_ctxs`; for each dict with `counterparty_did`, calls `self._iris_runtime.elicit()` in try/except (fail-soft)
- Emits `IRIS_BELIEF_REVISED` when `result.beliefs` is non-empty (once per call)
- Emits `IRIS_CONTRADICTION_DETECTED` when `result.contradiction` is True
- Emits `IRIS_PRIOR_SEEDED` when `result.new_hash` present and `result.prior_hash` empty (first belief for pair)
- After the elicit loop: calls `context_for()` for up to 3 unique peers; emits `IRIS_CONTEXT_INVOKED` once with `belief_count = sum(len(tc.beliefs) for tc in tom_contexts)` when > 0

### Task 2: context_for() + Theory of Mind prompt section

**`build_system_prompt()` extended** with `tom_context: "list | None" = None` kwarg (additive widening, backward-compatible). Injects `_theory_of_mind_section()` between peer_voices and directives when non-empty.

**`_theory_of_mind_section()` helper** renders "## What You Know About Others" with up to 3 peers, up to 5 beliefs each, labelled by dimension and confidence bucket ("confidently" > 0.7, "tentatively" otherwise). Returns empty string when no beliefs to inject (section omitted entirely per D-17-12).

**`on_message()` updated**: calls `context_for()` for the sender DID (pure read, no elicit, no audit event — ToM is tick-driven). Passes result as `tom_context` to `build_system_prompt()`.

## Deviation: on_tick() prompt injection scope

The plan (Task 2 action) noted: "If on_tick() never calls build_system_prompt, skip this wiring and note it in the summary." Confirmed: `on_tick()` does not call `build_system_prompt()` — it returns actions directly. The `context_for()` + `IRIS_CONTEXT_INVOKED` call was placed in `on_tick()` (after elicit()) per D-17-13/D-17-16. The prompt injection (`tom_context=...`) is wired into `on_message()` only, where the system prompt is built. This is correct behavior per the plan's ordering invariant.

## Deviations from Plan

None beyond the on_tick() prompt scope note above (anticipated in plan text). Plan executed exactly as written with the documented structural adaptation.

## Verification Results

All checks passed:

```
brain/src/noesis_brain/rpc/handler.py syntax ok
brain/src/noesis_brain/prompts/system.py syntax ok
OK: iris_db_dir in BrainHandler.__init__
OK: tom_context in build_system_prompt
wall-clock free OK (comments only)
```

## Known Stubs

None. All iris calls are fully wired to implemented modules (IrisRuntime, IrisStore, context_for from Waves 0-2).

## Threat Surface Scan

No new network endpoints or auth paths introduced. All changes are Brain-internal. `belief.content` appears only in the LLM system prompt (Brain-private, never serialized to Grid or AuditChain) — matches T-17-W3-01 accepted disposition. All iris calls are guarded by `_iris_runtime is not None` with try/except fail-soft — T-17-W3-02 mitigated. T-17-W3-04 mitigated: `total_injected` counts actual `result.beliefs` entries; `IRIS_CONTEXT_INVOKED` gated on `total_injected > 0`.

## Commits

| Hash | Message |
|------|---------|
| `f4cce57` | feat(17-wave-3): wire IrisRuntime into BrainHandler + ToM prompt injection |

## Self-Check: PASSED

- `brain/src/noesis_brain/rpc/handler.py` — modified, committed, pushed
- `brain/src/noesis_brain/prompts/system.py` — modified, committed, pushed
- Commit `f4cce57` exists in git log
- `iris_db_dir` in `BrainHandler.__init__` — verified via inspect
- `tom_context` in `build_system_prompt` — verified via inspect
- Both files parse without syntax error
