"""Brain inbox — a Nous answers the humans who wrote to it in the Portal.

The cycle reads the threads waiting on this Nous, generates a reply in its own
voice, posts it back to the same thread, and remembers the exchange locally.
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
HUMAN = "did:noesis:human:0xabc"
THREAD = {"human_did": HUMAN, "messages": [
    {"sender": "human", "text": "hello", "tick": 1},
    {"sender": "nous", "text": "Well met.", "tick": 1},
    {"sender": "human", "text": "what are you building?", "tick": 3},
]}


def _handler(reply: str = "A lighthouse, slowly.") -> BrainHandler:
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    llm = AsyncMock()
    llm.generate = AsyncMock(return_value=LLMResponse(text=reply, model="m", provider="mock", usage={}))
    h = BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=llm,
        did="did:noesis:sophia",
    )
    h.memory = MagicMock()
    h._mind_awake = AsyncMock(return_value=True)
    return h


def _wire(threads=None, post_ok=True):
    w = MagicMock()
    w.fetch_conversation_inbox = AsyncMock(return_value=threads or [])
    w.post_conversation_reply = AsyncMock(return_value=post_ok)
    return w


def test_gate_needs_a_live_wire_and_an_llm():
    h = _handler()
    h._grid_wire_client = None
    assert h._should_run_conversation_cycle(10) is False
    h._grid_wire_client = _wire()
    assert h._should_run_conversation_cycle(10) is True
    h._last_conversation_tick = 10
    assert h._should_run_conversation_cycle(10) is False
    assert h._should_run_conversation_cycle(11) is True


@pytest.mark.asyncio
async def test_answers_a_waiting_human_in_its_own_voice_and_remembers():
    h = _handler()
    h._grid_wire_client = _wire([THREAD])
    await h._run_conversation_cycle(40)

    h._grid_wire_client.post_conversation_reply.assert_awaited_once_with(HUMAN, "A lighthouse, slowly.")
    prompt, options = h.llm.generate.call_args[0]
    assert "what are you building?" in prompt and "Well met." in prompt
    assert h.psyche.name in options.system_prompt
    assert "what are you building?" in h.memory.record_event.call_args.kwargs["content"]


@pytest.mark.asyncio
async def test_empty_inbox_never_wakes_the_model():
    h = _handler()
    h._grid_wire_client = _wire([])
    await h._run_conversation_cycle(40)
    h._mind_awake.assert_not_awaited()
    h.llm.generate.assert_not_awaited()


@pytest.mark.asyncio
async def test_resting_mind_leaves_the_message_waiting():
    h = _handler()
    h._mind_awake = AsyncMock(return_value=False)
    h._grid_wire_client = _wire([THREAD])
    await h._run_conversation_cycle(40)
    h.llm.generate.assert_not_awaited()
    h._grid_wire_client.post_conversation_reply.assert_not_awaited()


@pytest.mark.asyncio
async def test_bounded_replies_per_cycle_and_skips_answered_threads():
    answered = {"human_did": "did:noesis:human:0x1", "messages": [{"sender": "nous", "text": "done", "tick": 1}]}
    waiting = [dict(THREAD, human_did=f"did:noesis:human:0x{i}") for i in range(2, 6)]
    h = _handler()
    h._grid_wire_client = _wire([answered, *waiting])
    await h._run_conversation_cycle(40)
    # 2 threads considered per cycle; the first is already answered, so one reply.
    assert h._grid_wire_client.post_conversation_reply.await_count == 1


@pytest.mark.asyncio
async def test_failed_post_is_not_remembered_and_errors_never_escape():
    h = _handler()
    h._grid_wire_client = _wire([THREAD], post_ok=False)
    await h._run_conversation_cycle(40)
    h.memory.record_event.assert_not_called()

    h._grid_wire_client.fetch_conversation_inbox = AsyncMock(side_effect=RuntimeError("boom"))
    await h._run_conversation_cycle(41)  # must not raise
