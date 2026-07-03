"""W-A2 — the slow planner cycle: decompose the top goal into ledger tasks.

Mirrors the W3b economic-cycle test conventions (AsyncMock LLM, direct cycle
calls, gate tests). The planner runs only when the ledger is dry for the top
goal — the mind never re-plans over a live task queue.
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


def _memory(recent=None):
    mem = MagicMock()
    mem.recent = MagicMock(return_value=recent or [])
    mem.record_event = MagicMock()
    mem.add_reflection = MagicMock()
    return mem


def _llm_saying(text: str) -> AsyncMock:
    llm = AsyncMock()
    llm.generate = AsyncMock(return_value=LLMResponse(text=text, model="m", provider="mock", usage={}))
    return llm


# ── gate ─────────────────────────────────────────────────────────────────────
def test_gate_false_without_wire_client():
    h = _handler()
    h._grid_wire_client = None  # live-wired minds only (mirrors the W3b gate)
    assert h._should_run_planner_cycle(500) is False


def test_gate_false_within_cooldown():
    h = _handler()
    h._grid_wire_client = MagicMock()
    h._last_plan_tick = 100
    assert h._should_run_planner_cycle(150) is False  # < 200-tick cooldown


def test_gate_false_without_goals():
    h = _handler()
    h._grid_wire_client = MagicMock()
    h.telos = TelosManager()  # empty
    h._last_plan_tick = -10_000
    assert h._should_run_planner_cycle(500) is False


def test_gate_false_when_tasks_pending():
    h = _handler()
    h._grid_wire_client = MagicMock()
    goal = h.telos.top_priority(1)[0]
    h._goal_ledger.add_tasks(goal.description, ["already planned"], tick=1)
    assert h._should_run_planner_cycle(500) is False


def test_gate_true_when_dry_and_cooldown_elapsed():
    h = _handler()
    h._grid_wire_client = MagicMock()
    assert h._should_run_planner_cycle(500) is True


# ── cycle ────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_planner_decomposes_goal_into_ledger_tasks():
    h = _handler()
    h.memory = _memory()
    h.llm = _llm_saying('{"tasks": ["survey the ring", "estimate demand"]}')
    goal = h.telos.top_priority(1)[0]

    await h._run_planner_cycle(500)

    assert h._goal_ledger.pending_count(goal.description) == 2
    assert h._goal_ledger.next_task(goal.description).description == "survey the ring"
    h.memory.record_event.assert_called_once()
    assert "Planned" in h.memory.record_event.call_args.kwargs["content"]


@pytest.mark.asyncio
async def test_planner_tolerates_garbage_llm_output():
    h = _handler()
    h.memory = _memory()
    h.llm = _llm_saying("I cannot plan today, sorry.")
    goal = h.telos.top_priority(1)[0]

    await h._run_planner_cycle(500)

    assert h._goal_ledger.pending_count(goal.description) == 0
    h.memory.record_event.assert_not_called()


@pytest.mark.asyncio
async def test_planner_prompt_carries_reflections_from_memory():
    from noesis_brain.memory.types import MemoryType

    h = _handler()
    h.memory = _memory(recent=[
        SimpleNamespace(content="power is scarce in ring 3", memory_type=MemoryType.REFLECTION, tick=490, importance=8.0),
        SimpleNamespace(content="saw a brownout", memory_type=MemoryType.EVENT, tick=495, importance=6.0),
    ])
    h.llm = _llm_saying('{"tasks": ["fix it"]}')

    await h._run_planner_cycle(500)

    prompt = h.llm.generate.await_args[0][0]
    assert "power is scarce in ring 3" in prompt
    assert "saw a brownout" in prompt
