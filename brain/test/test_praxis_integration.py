"""v3.3 Mind — praxis handler-hookup integration.

Proves the output-edge wiring in BrainHandler.on_tick: an outbound in-world
action is journaled as a deed and surfaced in get_state, and internal actions
(NOOP) are not counted as deeds.
"""

import asyncio
from pathlib import Path

import pytest
import yaml

from noesis_brain.llm.types import LLMResponse
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.stream import MemoryStream
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.rpc.types import Action, ActionType
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"


class QuietLLM:
    async def generate(self, prompt, options=None):
        return LLMResponse(text='{"action": "none"}', model="scripted", provider="test", usage={})


async def _drain():
    for _ in range(8):
        pending = [x for x in asyncio.all_tasks()
                   if x is not asyncio.current_task() and not x.done()]
        if not pending:
            break
        await asyncio.gather(*pending, return_exceptions=True)


def _handler():
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    mem = MemoryStream(MemoryStore(":memory:"))
    return BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=QuietLLM(),
        did="did:noesis:sophia",
        memory=mem,
    )


@pytest.mark.asyncio
async def test_on_tick_journals_an_outward_deed():
    h = _handler()
    # Queue an outward act; on_tick drains it into the outbound batch, praxis journals it.
    h._pending_actions.append(Action(action_type=ActionType.SPEAK, metadata={"body_text": "hello Agora"}))
    await h.on_tick({"tick": 5})
    await _drain()
    snap = h.get_state()["praxis"]
    assert snap["total_deeds"] >= 1
    assert any(d["verb"] == "speak" for d in snap["recent"])


@pytest.mark.asyncio
async def test_noop_tick_records_no_deed():
    h = _handler()
    await h.on_tick({"tick": 1})  # produces a NOOP fallback — internal, not a deed
    await _drain()
    assert h.get_state()["praxis"]["total_deeds"] == 0


@pytest.mark.asyncio
async def test_get_state_exposes_praxis_snapshot():
    h = _handler()
    snap = h.get_state()["praxis"]
    assert set(snap.keys()) == {"total_deeds", "verb_counts", "recent", "repertoire_size"}
    assert snap["repertoire_size"] > 0
