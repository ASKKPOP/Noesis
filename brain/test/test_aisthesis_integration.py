"""v3.3 Mind — aisthesis handler-hookup integration.

Proves the input-edge wiring in BrainHandler.on_tick: perception runs off the
world-sight feed, and salient change is committed to episodic memory + surfaced
in get_state. Mirrors the LoopWire harness shape from test_loop_integration.py.
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


class PerceptionWire:
    """Minimal wire whose built world (objects) is configurable per test."""

    def __init__(self):
        self.objects: list[dict] = []
        self.parcels: list[dict] = []

    async def fetch_dues(self): return []
    async def fetch_open_rfps(self): return []
    async def fetch_parcels(self): return list(self.parcels)
    async def fetch_objects(self): return list(self.objects)


async def _drain():
    for _ in range(8):
        pending = [x for x in asyncio.all_tasks()
                   if x is not asyncio.current_task() and not x.done()]
        if not pending:
            break
        await asyncio.gather(*pending, return_exceptions=True)


def _handler(mem):
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    return BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=QuietLLM(),
        did="did:noesis:sophia",
        memory=mem,
    )


@pytest.mark.asyncio
async def test_on_tick_perceives_and_remembers_salient_change():
    mem = MemoryStream(MemoryStore(":memory:"))
    h = _handler(mem)
    wire = PerceptionWire()
    h._grid_wire_client = wire

    # Pre-seed an empty baseline so the first real perception registers as change.
    h.aisthesis.perceive({"parcels": [], "objects": []})
    # A foundry gets built in the world.
    wire.objects = [{"id": 2, "kind": "foundry", "zone": "Manufacture"}]

    await h.on_tick({"tick": 5})
    await _drain()

    contents = [m.content for m in mem.recent(limit=50)]
    assert any("foundry" in c for c in contents), contents


@pytest.mark.asyncio
async def test_get_state_exposes_aisthesis_snapshot():
    mem = MemoryStream(MemoryStore(":memory:"))
    h = _handler(mem)
    state = h.get_state()
    assert "aisthesis" in state
    assert set(state["aisthesis"].keys()) == {"percept_count", "percepts", "world_size"}


@pytest.mark.asyncio
async def test_on_tick_without_wire_is_a_noop():
    mem = MemoryStream(MemoryStore(":memory:"))
    h = _handler(mem)  # no _grid_wire_client set → None
    await h.on_tick({"tick": 1})
    await _drain()
    # No perception memory written, no crash.
    assert h.get_state()["aisthesis"]["percept_count"] == 0
