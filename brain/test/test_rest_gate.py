"""D-MIND-08 — the local-AI rest gate.

When the model substrate (Ollama / any provider) is unreachable, the Nous *rests*:
its LLM-driven cognition idles while the deterministic body keeps running, and it
wakes automatically the moment the model answers again. It never dies. The gate is
probed lazily (only when a cycle is due) and cached per tick.
"""
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import yaml

from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"


def _handler(*, available: bool) -> BrainHandler:
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    llm = AsyncMock()
    llm.is_available = AsyncMock(return_value=available)
    llm.supports_tools = False  # keep the tool cycle out of the way
    return BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=llm,
        did="did:civic:noesis:sophia",
    )


def _wire() -> MagicMock:
    """A wire that always has an outstanding due, so the economic cycle is 'due'."""
    w = MagicMock()
    w.fetch_dues = AsyncMock(return_value=[{"due_id": "d1", "amount_wei": "500", "status": "assessed"}])
    w.fetch_open_rfps = AsyncMock(return_value=[])
    w.fetch_account = AsyncMock(return_value={"balance_wei": "1000"})
    w.fetch_grids = AsyncMock(return_value=[])
    w.fetch_grid_recommendations = AsyncMock(return_value=[])
    w.fetch_parcels = AsyncMock(return_value=[])
    w.fetch_objects = AsyncMock(return_value=[])
    w.post_economic_action = AsyncMock(return_value=True)
    return w


# ── _mind_awake unit behaviour ────────────────────────────────────────────────
async def test_mind_rests_when_substrate_unreachable():
    h = _handler(available=False)
    awake = await h._mind_awake(100)
    assert awake is False
    assert h._resting is True
    assert h._rest_since_tick == 100


async def test_mind_awake_when_substrate_reachable():
    h = _handler(available=True)
    awake = await h._mind_awake(100)
    assert awake is True
    assert h._resting is False


async def test_probe_cached_within_a_tick():
    h = _handler(available=False)
    await h._mind_awake(100)
    await h._mind_awake(100)
    await h._mind_awake(100)
    # cache means at most one round-trip per tick regardless of how many cycles ask
    assert h.llm.is_available.await_count == 1


async def test_wakes_when_substrate_returns():
    h = _handler(available=False)
    await h._mind_awake(100)
    assert h._resting is True
    # next tick: substrate back + cache cleared
    h.llm.is_available = AsyncMock(return_value=True)
    h._mind_awake_cache = None
    awake = await h._mind_awake(105)
    assert awake is True
    assert h._resting is False
    assert h._rest_since_tick is None


# ── on_tick integration ───────────────────────────────────────────────────────
async def test_on_tick_skips_cognition_while_resting():
    h = _handler(available=False)
    h._grid_wire_client = _wire()
    h._last_econ_tick = 0  # cooldown elapsed at tick 100 → economic cycle is due
    await h.on_tick({"tick": 100})
    await asyncio.sleep(0.05)  # let any scheduled tasks drain
    # resting → the economic cycle was never scheduled, so no state read / dispatch
    assert h._resting is True
    assert h._grid_wire_client.fetch_dues.await_count == 0
    assert h._grid_wire_client.post_economic_action.await_count == 0
    assert h.llm.is_available.await_count >= 1  # the gate was consulted


async def test_on_tick_runs_cognition_when_awake():
    h = _handler(available=True)
    h._grid_wire_client = _wire()
    h._last_econ_tick = 0
    await h.on_tick({"tick": 100})
    await asyncio.sleep(0.05)
    # awake → the economic cycle ran and read Grid state
    assert h._resting is False
    assert h._grid_wire_client.fetch_dues.await_count >= 1


async def test_idle_tick_does_not_probe():
    """A tick with no cognition due must not cost an availability round-trip."""
    h = _handler(available=False)
    h._grid_wire_client = None  # economic/tool cycles need a wire → nothing is due
    await h.on_tick({"tick": 1})
    assert h.llm.is_available.await_count == 0
    assert h._resting is False  # never probed, never rested
