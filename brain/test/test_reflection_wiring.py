"""W-A3 — the ReflectionEngine is finally wired: constructed when memory
supports it, ticked every on_tick, fired on interval OR after repeated
failures, guarded against overlapping runs, and never able to spin.
"""
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
import yaml

from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"


def _memory():
    mem = MagicMock()
    mem.recent = MagicMock(return_value=[])
    mem.record_event = MagicMock()
    mem.add_reflection = MagicMock()
    return mem


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


def test_engine_constructed_only_when_memory_supports_it():
    assert _handler(memory=None)._reflection is None
    assert _handler(memory=_memory())._reflection is not None


def test_gate_false_initially_true_after_interval():
    h = _handler(memory=_memory())
    assert h._should_run_reflection_cycle() is False
    for _ in range(20):  # default reflection interval
        h._reflection.tick()
    assert h._should_run_reflection_cycle() is True


def test_gate_true_after_three_failures():
    h = _handler(memory=_memory())
    h._failed_since_reflection = 3
    assert h._should_run_reflection_cycle() is True


def test_gate_false_while_inflight():
    h = _handler(memory=_memory())
    h._failed_since_reflection = 3
    h._reflection_inflight = True
    assert h._should_run_reflection_cycle() is False


@pytest.mark.asyncio
async def test_cycle_reflects_resets_counters_and_never_spins():
    h = _handler(memory=_memory())
    h._failed_since_reflection = 3
    engine = MagicMock()
    engine.reflect = AsyncMock(return_value={"reflection": "insight", "wiki_suggestion": None, "memory": None})
    engine._cycles_since_reflection = 20
    h._reflection = engine

    await h._run_reflection_cycle(tick=100)

    engine.reflect.assert_awaited_once_with(100)
    assert h._failed_since_reflection == 0
    assert h._reflection_inflight is False
    assert engine._cycles_since_reflection == 0


@pytest.mark.asyncio
async def test_cycle_survives_reflect_raising():
    h = _handler(memory=_memory())
    engine = MagicMock()
    engine.reflect = AsyncMock(side_effect=RuntimeError("llm down"))
    engine._cycles_since_reflection = 20
    h._reflection = engine

    await h._run_reflection_cycle(tick=100)  # must not raise

    assert h._reflection_inflight is False
    assert engine._cycles_since_reflection == 0
