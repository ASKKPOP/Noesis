"""W-A4 — outcome feedback: action results update goal progress and store
Reflexion lessons. The loop finally learns from acting.
"""
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
import yaml

from noesis_brain.llm.types import LLMResponse
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"

DUE = {"due_id": "11111111-1111-4111-8111-111111111111", "amount_wei": "500", "amount_credit": "10", "status": "assessed"}


def _handler() -> BrainHandler:
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    return BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=AsyncMock(),
        did="did:civic:noesis:sophia",
    )


def _memory():
    mem = MagicMock()
    mem.recent = MagicMock(return_value=[])
    mem.record_event = MagicMock()
    mem.add_reflection = MagicMock()
    return mem


def test_success_marks_done_and_advances_matching_goal():
    h = _handler()
    h.memory = _memory()
    goal = h.telos.top_priority(1)[0]
    h._goal_ledger.add_tasks(goal.description, ["a", "b"], tick=1)
    task = h._goal_ledger.next_task(goal.description)

    h.record_task_outcome(task, success=True, note="done well", tick=5)

    assert goal.progress == pytest.approx(0.5)   # 1 of 2 tasks
    assert goal.last_advanced_tick == 5
    assert h._goal_ledger.pending_count(goal.description) == 1


def test_all_tasks_done_completes_the_goal():
    h = _handler()
    h.memory = _memory()
    goal = h.telos.top_priority(1)[0]
    h._goal_ledger.add_tasks(goal.description, ["only task"], tick=1)
    task = h._goal_ledger.next_task(goal.description)

    h.record_task_outcome(task, success=True, tick=5)

    assert goal.progress == pytest.approx(1.0)
    assert not goal.is_active()                 # COMPLETED — planner moves to next goal


def test_failure_stores_reflexion_lesson_and_counts_toward_reflection():
    h = _handler()
    h.memory = _memory()
    goal = h.telos.top_priority(1)[0]
    h._goal_ledger.add_tasks(goal.description, ["hard"], tick=1)
    task = h._goal_ledger.next_task(goal.description)

    h.record_task_outcome(task, success=False, note="ran out of data", tick=5)

    assert goal.progress == 0.0
    assert h._failed_since_reflection == 1
    content = h.memory.record_event.call_args.kwargs["content"]
    assert content.startswith("Lesson:")
    assert "hard" in content and "ran out of data" in content


@pytest.mark.asyncio
async def test_economic_rejection_stores_lesson():
    h = _handler()
    h.memory = _memory()
    llm = AsyncMock()
    llm.generate = AsyncMock(return_value=LLMResponse(
        text='{"action": "pay_due", "method": "wei"}', model="m", provider="mock", usage={}))
    h.llm = llm
    wire = MagicMock()
    wire.fetch_dues = AsyncMock(return_value=[DUE])
    wire.fetch_open_rfps = AsyncMock(return_value=[])
    wire.fetch_account = AsyncMock(return_value={"balance_wei": "1000"})
    wire.fetch_grids = AsyncMock(return_value=[])
    wire.fetch_grid_recommendations = AsyncMock(return_value=[])
    wire.fetch_parcels = AsyncMock(return_value=[])
    wire.fetch_objects = AsyncMock(return_value=[])
    wire.post_economic_action = AsyncMock(return_value=False)   # Grid rejects
    h._grid_wire_client = wire

    await h._run_economic_cycle(100)

    assert h._failed_since_reflection == 1
    contents = [c.kwargs["content"] for c in h.memory.record_event.call_args_list]
    assert any(c.startswith("Lesson:") and "rejected" in c for c in contents)
