"""W-A5/A6/A7 — the learning half of the mind loop.

A5: scored memory retrieval (Stanford recency×importance×relevance, tick-based
    and deterministic) feeds the planner and the decision lessons.
A6: skills retrieved into the decision prompt; outcomes update the skill EMA;
    a completed goal queues sleep-time distillation (Voyager verify-then-add).
A7: sleep-time compute — after Hypnos consolidation, distill pending goals and
    force a reflection (Letta pattern: idle compute becomes learning).
"""
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
import yaml

from noesis_brain.llm.types import LLMResponse
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"


def _handler(memory=None) -> BrainHandler:
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    return BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=AsyncMock(),
        did="did:civic:noesis:sophia",
        memory=memory,
    )


def _memory(recent=None):
    mem = MagicMock()
    mem.recent = MagicMock(return_value=recent or [])
    mem.record_event = MagicMock()
    mem.add_reflection = MagicMock()
    return mem


def _mem_item(content, tick=0, importance=5.0):
    return SimpleNamespace(content=content, tick=tick, importance=importance)


def _llm_saying(text: str) -> AsyncMock:
    llm = AsyncMock()
    llm.generate = AsyncMock(return_value=LLMResponse(text=text, model="m", provider="mock", usage={}))
    return llm


# ── A5: scored retrieval ─────────────────────────────────────────────────────
def test_ranked_memories_prefers_important_relevant_recent():
    h = _handler(memory=_memory(recent=[
        _mem_item("energy survey of the ring", tick=95, importance=9.0),   # relevant+recent+important
        _mem_item("energy gossip", tick=10, importance=1.0),               # relevant but old+trivial
        _mem_item("unrelated lunch note", tick=99, importance=9.0),        # recent+important, irrelevant
    ]))
    out = h._ranked_memories("energy survey ring", tick=100, k=2)
    assert out[0] == "energy survey of the ring"
    assert len(out) == 2


def test_ranked_memories_prefix_filter_selects_lessons_only():
    h = _handler(memory=_memory(recent=[
        _mem_item("Lesson: bids over budget get rejected", tick=90, importance=6.0),
        _mem_item("Worked on 'survey': fine", tick=95, importance=6.0),
        _mem_item("Lesson: pay dues before bidding", tick=80, importance=6.0),
    ]))
    out = h._ranked_memories("bids budget", tick=100, k=3, prefix="Lesson:")
    assert all(o.startswith("Lesson:") for o in out)
    assert out[0] == "Lesson: bids over budget get rejected"


def test_ranked_memories_without_memory_is_empty():
    h = _handler(memory=None)
    assert h._ranked_memories("anything", tick=100) == []


# ── A6: skills in the decision prompt + outcome EMA ──────────────────────────
@pytest.mark.asyncio
async def test_decision_cycle_retrieves_skills_and_updates_outcome_on_completion():
    h = _handler(memory=_memory())
    goal = h.telos.top_priority(1)[0]
    h._goal_ledger.add_tasks(goal.description, ["survey parcels"], tick=1)
    skill = SimpleNamespace(name="survey_ring", to_prompt_block=lambda: "- survey_ring: walk each sector")
    store = MagicMock()
    store.retrieve = MagicMock(return_value=[skill])
    store.update_outcome = MagicMock()
    h._skill_store = store
    h.llm = _llm_saying('{"action": "work_task", "note": "done", "completed": true}')

    await h._run_decision_cycle(100)

    store.retrieve.assert_called_once()
    assert "survey parcels" in store.retrieve.call_args[0][0]
    store.update_outcome.assert_called_once_with("survey_ring", True)
    # the retrieved skill reaches the system prompt
    opts = h.llm.generate.await_args[0][1]
    assert "walk each sector" in opts.system_prompt


@pytest.mark.asyncio
async def test_decision_cycle_updates_outcome_false_when_incomplete():
    h = _handler(memory=_memory())
    goal = h.telos.top_priority(1)[0]
    h._goal_ledger.add_tasks(goal.description, ["survey parcels"], tick=1)
    store = MagicMock()
    store.retrieve = MagicMock(return_value=[SimpleNamespace(name="survey_ring", to_prompt_block=lambda: "- survey_ring: i")])
    store.update_outcome = MagicMock()
    h._skill_store = store
    h.llm = _llm_saying('{"action": "work_task", "note": "stuck", "completed": false}')

    await h._run_decision_cycle(100)

    store.update_outcome.assert_called_once_with("survey_ring", False)


def test_goal_completion_queues_distillation():
    h = _handler(memory=_memory())
    goal = h.telos.top_priority(1)[0]
    h._goal_ledger.add_tasks(goal.description, ["only task"], tick=1)
    task = h._goal_ledger.next_task(goal.description)

    h.record_task_outcome(task, success=True, tick=5)

    assert not goal.is_active()                      # completed
    assert goal.description in h._pending_distill    # queued for sleep-time


# ── A6/A7: sleep-time distillation + forced reflection ───────────────────────
@pytest.mark.asyncio
async def test_distill_skill_from_goal_adds_validated_skill():
    h = _handler(memory=_memory())
    goal_key = "Map the energy needs of the residential ring"
    h._goal_ledger.add_tasks(goal_key, ["survey", "estimate"], tick=1)
    for _ in range(2):
        t = h._goal_ledger.next_task(goal_key)
        h._goal_ledger.mark_done(t.task_id, tick=2)
    store = MagicMock()
    h._skill_store = store
    h.llm = _llm_saying('{"name": "map_energy_needs", "description": "how to map ring energy", "instructions": "survey then estimate", "triggers": ["energy"]}')

    await h._distill_skill_from_goal(goal_key, tick=10)

    store.add.assert_called_once()
    added = store.add.call_args[0][0]
    assert added.name == "map_energy_needs"
    assert added.source_did == ""                    # self-authored


@pytest.mark.asyncio
async def test_sleep_time_compute_distills_pending_and_forces_reflection():
    h = _handler(memory=_memory())
    h._pending_distill = ["goal one"]
    h._distill_skill_from_goal = AsyncMock()
    engine = MagicMock()
    engine.reflect = AsyncMock(return_value={"reflection": "r", "wiki_suggestion": None, "memory": None})
    engine._cycles_since_reflection = 5
    h._reflection = engine

    await h._sleep_time_compute(tick=300)

    h._distill_skill_from_goal.assert_awaited_once_with("goal one", 300)
    engine.reflect.assert_awaited_once()             # forced, even mid-interval
    assert h._pending_distill == []


@pytest.mark.asyncio
async def test_sleep_time_compute_survives_errors():
    h = _handler(memory=_memory())
    h._pending_distill = ["goal one"]
    h._distill_skill_from_goal = AsyncMock(side_effect=RuntimeError("boom"))
    h._reflection = None

    await h._sleep_time_compute(tick=300)            # must not raise
