# W-A (Mind) — Autonomous Decision Loop, Goal Ledger, Reflection, Outcome Feedback

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the four broken autonomy links found by the 2026-07-02 full-system audit (`docs/noesis-system-analysis-2026-07.html`): the Nous idles (NOOP) outside the economic/tool cycles, reflection is orphaned, goals never grow, outcomes teach nothing. After this plan a Nous holds a goal, decomposes it into tasks (slow planner), works the next task every ~20 ticks (fast actor, one coherent intent — PIANO pattern), records Reflexion lessons on failure, reflects periodically, and its goal progress moves from real outcomes.

**Architecture:** All Brain-side (Python), zero Grid changes, allowlist +0. Mirrors the shipped W3b economic-cycle pattern exactly: cooldown-gated `_should_run_*` + async `_run_*_cycle` launched as background tasks from `on_tick` (the returned-action contract is untouched → all existing tick tests stay green). New `GoalLedger` (SQLite when `BRAIN_DATA_DIR`-style dir given, else in-memory) holds goal→task decomposition; `TelosManager.Goal.advance()` (already existing, never called) becomes the outcome sink. `ReflectionEngine` (existing, orphaned) is finally instantiated and scheduled; its reflections land in the memory stream, which the planner prompt consumes — closing reflect→plan.

**Tech Stack:** Python 3.12, pytest+AsyncMock (mirror `brain/test/test_economic_cycle.py`), sqlite3, existing `LLMAdapter`/`GenerateOptions`, existing `GridWireClient.post_actions`.

**Decision protocol (small-model safe):** one tiny JSON object per decision, parsed tolerantly, every value validated Brain-side (W3b guardrail discipline). Decision space v1: `work_task` · `speak` · `rest`.

---

### Task 1: GoalLedger data layer (A2 foundation)

**Files:**
- Create: `brain/src/noesis_brain/telos/ledger.py`
- Modify: `brain/src/noesis_brain/telos/__init__.py` (export)
- Test: `brain/test/test_goal_ledger.py`

Behavior: `LedgerTask(task_id, goal_key, description, status['pending'|'done'|'failed'], attempts, created_tick, updated_tick)`. `GoalLedger(db_dir=None, did="")` → sqlite file `ledger_<did-sanitized>.db` under db_dir, else `:memory:`. API: `add_tasks(goal_key, descs, tick)`, `next_task(goal_key) -> LedgerTask|None` (oldest pending), `pending_count/total_count(goal_key)`, `mark_done(task_id, tick)`, `mark_attempt(task_id, tick) -> LedgerTask` (attempts+=1; status→'failed' at 3 attempts), `clear_goal(goal_key)`. Persistence: re-open same dir/did → tasks survive.

Steps: write failing tests (add/next/done/attempt-cap/persistence roundtrip via tmp_path/counts/clear) → `pytest test/test_goal_ledger.py` RED → implement → GREEN → commit.

### Task 2: Decision + planning prompts (A1/A2 protocol)

**Files:**
- Create: `brain/src/noesis_brain/prompts/decision.py`
- Test: `brain/test/test_decision_prompts.py`

`build_planning_prompt(goal_desc, memories_text, reflections)` → asks for `{"tasks": ["…", 2–4 items]}`. `build_decision_prompt(goal_desc, task_desc, lessons)` → asks for `{"action": "work_task"|"speak"|"rest", "note": "…", "completed": false, "text": "…"}` (text only for speak). `parse_task_list(text) -> list[str]|None` (cap 4, strip empties), `parse_decision(text) -> dict|None` — tolerant first-JSON-object extraction (mirror `parse_economic_decision`), unknown action → None.

TDD same rhythm; commit.

### Task 3: Planner cycle — slow timescale (A2)

**Files:**
- Modify: `brain/src/noesis_brain/rpc/handler.py` (init fields + `_should_run_planner_cycle` + `_run_planner_cycle`)
- Test: `brain/test/test_planner_cycle.py`

Gate: llm set, `(tick - _last_plan_tick) >= _PLAN_COOLDOWN_TICKS(=200)`, a top-priority goal exists, and `ledger.pending_count(goal_key)==0`. Cycle: prompt with recent memories + recent reflections (from `memory.recent`) → `parse_task_list` → `ledger.add_tasks` → record memory `Planned '<goal>': N tasks`. purpose="planning", max_tokens=256. Never raises.

### Task 4: Decision cycle — fast timescale (A1)

**Files:**
- Modify: `brain/src/noesis_brain/rpc/handler.py` (`_should_run_decision_cycle`, `_run_decision_cycle`, `_current_intent`), `brain/src/noesis_brain/prompts/system.py` (additive kwarg `intent: str|None`)
- Test: `brain/test/test_decision_cycle.py`

Gate: llm set, cooldown `_DECISION_COOLDOWN_TICKS(=20)`, top goal exists. Cycle: task = `ledger.next_task`; lessons = last 3 memory contents starting `Lesson:`; system prompt gets `intent="<goal> → <task>"` (PIANO single-intent bottleneck, also stored on `self._current_intent`); LLM decides:
- `work_task` (requires a task): record memory `Worked on '<task>': <note>`; if `completed` → Task 5's `record_task_outcome(success=True)` else `ledger.mark_attempt`.
- `speak`: `Action(SPEAK, channel="agora", text=<validated non-empty ≤500 chars>)` posted via `wire.post_actions([...], tick=tick)` (tool-cycle pattern) — only when wire client present.
- `rest`/None/invalid → record nothing but a short memory on explicit rest.

on_tick wiring (after econ block, background task, `elif` so planner and decider never double-spend one tick's LLM budget; NOOP fallback contract untouched):
```python
if self._should_run_planner_cycle(tick):
    self._last_plan_tick = tick
    _asyncio.create_task(self._run_planner_cycle(tick))
elif self._should_run_decision_cycle(tick):
    self._last_decision_tick = tick
    _asyncio.create_task(self._run_decision_cycle(tick))
```

### Task 5: Outcome feedback (A4)

**Files:**
- Modify: `brain/src/noesis_brain/rpc/handler.py` (`record_task_outcome`; economic-cycle failure lesson)
- Test: `brain/test/test_outcome_feedback.py`

`record_task_outcome(task, success, note, tick)`: success → `ledger.mark_done` + matching active `Goal.advance(1/total_count, tick)` (match by `description == goal_key`); failure → `ledger.mark_attempt` + memory `Lesson: failed '<task>' — <note>` (Reflexion) + `_failed_since_reflection += 1`. Economic cycle: `post_economic_action` returning False → memory `Lesson: my <action> was rejected by the Grid` (+ counter). Goal completion (progress→1.0) is already handled by `Goal.advance` (status→COMPLETED) — planner then decomposes the next goal.

### Task 6: Reflection wiring (A3)

**Files:**
- Modify: `brain/src/noesis_brain/rpc/handler.py` (instantiate `ReflectionEngine` when memory supports it; tick + gate + `_run_reflection_cycle`)
- Test: `brain/test/test_reflection_wiring.py`

Init: `self._reflection = ReflectionEngine(memory, llm) if memory has add_reflection/recent else None`. Each on_tick: `_reflection.tick()`; run (background) when `should_reflect()` OR `_failed_since_reflection >= 3`. `_run_reflection_cycle` awaits `reflect(tick)` (stores the reflection into memory itself), resets the failure counter, never raises. Closing the loop: reflections surface in `memory.recent` → planning prompt (Task 3) → next decomposition. 

### Task 7: Wire-up in `__main__` + full-suite verify + docs sync

**Files:**
- Modify: `brain/src/noesis_brain/__main__.py` (pass `ledger_db_dir` from `BRAIN_DATA_DIR`, mirroring hypnos)
- Modify: `.planning/ROADMAP.md` (W-A program entry) · `.planning/STATE.md` (focus) · `docs/TASK-LOG.html` · `wiki/2-concepts/mind/nous.md` + `wiki/1-design/decisions.md` (D-MIND-01: two-timescale mind loop) · `.planning/research/log.md`
- Verify: full `brain: .venv/bin/pytest test/` green; `node scripts/check-wiki.mjs` green; commit + push per task.

**Invariants preserved:** on_tick returned-action contract (all new work is background, additive); allowlist +0 (SPEAK/no new event types); R-31-01 zero-diff untouched; D-MONEY-01 untouched; cost-gating discipline (cooldowns; planner and decider mutually exclusive per tick; no LLM call without a goal).
