"""W-A1 — the fast per-tick decision cycle: the Nous asks "what do I want to
do right now?" and acts, instead of idling on NOOP.

One coherent intent (PIANO bottleneck): the chosen goal→task is stored on
_current_intent and injected into the system prompt of every decision call.
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


def _llm_saying(text: str) -> AsyncMock:
    llm = AsyncMock()
    llm.generate = AsyncMock(return_value=LLMResponse(text=text, model="m", provider="mock", usage={}))
    return llm


def _seed_task(h: BrainHandler) -> tuple[str, object]:
    goal = h.telos.top_priority(1)[0]
    h._goal_ledger.add_tasks(goal.description, ["survey parcels"], tick=1)
    return goal.description, h._goal_ledger.next_task(goal.description)


# ── gate ─────────────────────────────────────────────────────────────────────
def test_gate_false_without_wire_client():
    h = _handler()
    h._grid_wire_client = None  # live-wired minds only (mirrors the W3b gate)
    assert h._should_run_decision_cycle(1000) is False


def test_gate_false_within_cooldown():
    h = _handler()
    h._grid_wire_client = MagicMock()
    h._last_decision_tick = 100
    assert h._should_run_decision_cycle(110) is False  # < 20-tick cooldown


def test_gate_false_without_goals():
    h = _handler()
    h._grid_wire_client = MagicMock()
    h.telos = TelosManager()
    assert h._should_run_decision_cycle(1000) is False


def test_gate_true_with_goal_and_cooldown_elapsed():
    h = _handler()
    h._grid_wire_client = MagicMock()
    assert h._should_run_decision_cycle(1000) is True


# ── work_task ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_work_task_completed_marks_done_and_advances_goal():
    h = _handler()
    h.memory = _memory()
    goal_key, task = _seed_task(h)
    goal = h.telos.top_priority(1)[0]
    h.llm = _llm_saying('{"action": "work_task", "note": "counted 24 parcels", "completed": true}')

    await h._run_decision_cycle(100)

    assert h._goal_ledger.next_task(goal_key) is None       # task consumed
    assert h._goal_ledger.pending_count(goal_key) == 0
    assert goal.progress > 0.0                              # outcome fed back (A4)
    contents = [c.kwargs["content"] for c in h.memory.record_event.call_args_list]
    assert any("Worked on 'survey parcels'" in c for c in contents)


@pytest.mark.asyncio
async def test_work_task_incomplete_records_attempt():
    h = _handler()
    h.memory = _memory()
    goal_key, task = _seed_task(h)
    h.llm = _llm_saying('{"action": "work_task", "note": "started, not done", "completed": false}')

    await h._run_decision_cycle(100)

    nxt = h._goal_ledger.next_task(goal_key)
    assert nxt is not None and nxt.attempts == 1            # still pending, attempt logged


@pytest.mark.asyncio
async def test_intent_is_set_as_single_bottleneck():
    h = _handler()
    h.memory = _memory()
    goal_key, _ = _seed_task(h)
    h.llm = _llm_saying('{"action": "rest", "note": "thinking"}')

    await h._run_decision_cycle(100)

    assert h._current_intent is not None
    assert goal_key in h._current_intent
    assert "survey parcels" in h._current_intent


# ── speak ────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_speak_posts_speak_action_via_wire():
    h = _handler()
    h.memory = _memory()
    h.llm = _llm_saying('{"action": "speak", "text": "the ring needs power"}')
    wire = MagicMock()
    wire.post_actions = AsyncMock(return_value=True)
    h._grid_wire_client = wire

    await h._run_decision_cycle(100)

    wire.post_actions.assert_awaited_once()
    posted = wire.post_actions.await_args[0][0]
    assert posted[0]["action_type"] == "speak"
    assert posted[0]["text"] == "the ring needs power"


@pytest.mark.asyncio
async def test_speak_without_wire_client_is_a_safe_noop():
    h = _handler()
    h.memory = _memory()
    h.llm = _llm_saying('{"action": "speak", "text": "hello"}')
    h._grid_wire_client = None

    await h._run_decision_cycle(100)  # must not raise


# ── guardrails ───────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_invalid_llm_output_changes_nothing():
    h = _handler()
    h.memory = _memory()
    goal_key, _ = _seed_task(h)
    h.llm = _llm_saying("I refuse to answer in JSON.")

    await h._run_decision_cycle(100)

    nxt = h._goal_ledger.next_task(goal_key)
    assert nxt is not None and nxt.attempts == 0
