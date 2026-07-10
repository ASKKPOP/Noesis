"""v3.3 Mind — synopsis handler-hookup integration.

Proves the background-cycle wiring in BrainHandler.on_tick: when the synopsis
store is enabled and enough recent memories exist, a synthesis runs and persists,
and get_state surfaces the latest digest. Disabled (no db dir) → no-op.
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


def _handler(mem, synopsis_db_dir=None):
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    return BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=QuietLLM(),
        did="did:noesis:sophia",
        memory=mem,
        synopsis_db_dir=synopsis_db_dir,
    )


@pytest.mark.asyncio
async def test_on_tick_synthesizes_and_persists(tmp_path):
    mem = MemoryStream(MemoryStore(":memory:"))
    for i, c in enumerate([
        "The ring needs energy. Solar relays are efficient.",
        "Solar relays are efficient. Demand peaks at dusk.",
        "Demand peaks at dusk. Storage smooths the curve.",
    ]):
        mem.record_event(content=c, source_did="did:noesis:sophia", tick=i)

    h = _handler(mem, synopsis_db_dir=str(tmp_path))
    h._SYNOPSIS_COOLDOWN_TICKS = 1  # fire immediately

    await h.on_tick({"tick": 5})
    await _drain()

    snap = h.get_state()["synopsis"]
    assert snap["count"] >= 1
    assert snap["latest"] is not None
    assert snap["latest"]["source_count"] >= 2


@pytest.mark.asyncio
async def test_disabled_without_db_dir_is_noop():
    mem = MemoryStream(MemoryStore(":memory:"))
    h = _handler(mem, synopsis_db_dir=None)
    await h.on_tick({"tick": 1})
    await _drain()
    snap = h.get_state()["synopsis"]
    assert snap == {"count": 0, "latest": None}
