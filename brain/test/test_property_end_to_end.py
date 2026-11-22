"""End to end inside the Brain: Grid clock → on_tick → property cycle → Grid routes.

Real BrainHandler, real GridWireClient, real clock follower. Only the model and
the HTTP transport are faked; the transport is a small stand-in for the Grid's
own rules (purchase, build, extend, owner-only interior). It proves the pieces
connect: three Grid ticks take a funded Nous from nothing to a furnished home.

It is NOT evidence about production. Nothing here reaches a real Grid.
"""
import asyncio
import hashlib
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import httpx
import yaml

from noesis_brain.llm.types import LLMResponse
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker
from noesis_brain.wire import clock_follower as cf
from noesis_brain.wire.client import GridWireClient

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"
ME = "did:civic:noesis:sophia"
MY_HASH = hashlib.sha256(ME.encode()).hexdigest()
PID = "genesis:residential:0001"


class FakeGrid:
    """The few Grid rules this flow touches, enough to refuse a wrong request."""

    def __init__(self) -> None:
        self.tick = 0
        self.balance = 1000
        self.parcel = {
            "id": PID, "zone": "residential", "status": "available", "price_wei": 400,
            "owner_civic_did_hash": None, "structure": None,
        }
        self.interior: dict = {"areas": []}
        self.batch_posts = 0
        self.writes: list[str] = []

    def handle(self, req: httpx.Request) -> httpx.Response:
        path, method = req.url.path, req.method
        if path == "/api/v1/grid/clock":
            self.tick += 100                      # each look at the clock is a new, later tick
            return httpx.Response(200, json={"tick": self.tick, "epoch": 0, "tickRateMs": 30000})
        if path == "/api/v1/civic/parcels":
            commons = {"id": "genesis:infrastructure:0001", "zone": "infrastructure", "status": "available",
                       "price_wei": 0, "owner_civic_did_hash": None, "structure": None}
            return httpx.Response(200, json={"parcels": [commons, self.parcel]})
        if path == "/api/v1/civic/account":
            return httpx.Response(200, json={"balance_wei": str(self.balance)})
        if path == "/api/v1/brain/actions":
            self.batch_posts += 1
            return httpx.Response(200, json={"ok": True, "accepted": 0})
        if method == "POST" and path == f"/api/v1/civic/parcels/{PID}/purchase":
            if self.parcel["owner_civic_did_hash"] is not None:
                return httpx.Response(409, json={"error": "already_owned"})
            if self.balance < 400:
                return httpx.Response(402, json={"error": "insufficient_funds"})
            self.balance -= 400
            self.parcel.update(status="owned", owner_civic_did_hash=MY_HASH)
            self.writes.append("purchase")
            return httpx.Response(201, json={"purchased": True})
        if method == "POST" and path == f"/api/v1/civic/parcels/{PID}/build":
            body = json.loads(req.content)
            if body.get("visibility") not in ("open", "private"):
                return httpx.Response(400, json={"error": "invalid_visibility"})
            if body.get("type") not in ("home", "venue"):
                return httpx.Response(409, json={"error": "type_zone_mismatch"})
            self.parcel["structure"] = {"type": body["type"], "visibility": body["visibility"]}
            self.writes.append("build")
            return httpx.Response(201, json={"built": True})
        if method == "POST" and path == f"/api/v1/civic/parcels/{PID}/interior/extend":
            body = json.loads(req.content)
            if self.parcel["structure"] is None:
                return httpx.Response(409, json={"error": "no_structure"})
            self.interior["areas"].append({"name": body["area"], "objects": [{"kind": body["kind"], "class": "mirror"}]})
            self.writes.append("extend")
            return httpx.Response(200, json={"extended": True})
        if method == "GET" and path == f"/api/v1/civic/parcels/{PID}/interior":
            if self.parcel["structure"] is None:
                return httpx.Response(404, json={"error": "no_structure"})
            return httpx.Response(200, json={"parcel_id": PID, "condition": "maintained", "interior": self.interior})
        return httpx.Response(404, json={"error": "not_found"})


def _model(prompt: str, _options) -> LLMResponse:
    """A Nous that says yes to each stage it is offered, and rests otherwise."""
    if '"buy_parcel"' in prompt:
        text = json.dumps({"action": "buy_parcel", "parcel": PID, "reason": "a place of my own"})
    elif '"build"' in prompt:
        text = json.dumps({"action": "build", "type": "home", "name": "Oikos", "visibility": "private"})
    elif '"furnish"' in prompt:
        text = json.dumps({"action": "furnish", "area": "bedroom", "kind": "bed"})
    else:
        text = json.dumps({"action": "none"})
    return LLMResponse(text=text, model="m", provider="mock", usage={})


async def _settle() -> None:
    """Let the background cycle tasks that on_tick scheduled run to completion."""
    for _ in range(20):
        pending = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
        if not pending:
            return
        await asyncio.gather(*pending, return_exceptions=True)


async def _no_sleep(_seconds) -> None:
    return None


async def test_three_grid_ticks_take_a_funded_nous_to_a_furnished_home():
    grid = FakeGrid()
    token_mgr = MagicMock()
    token_mgr.get_valid_token.return_value = "jwt"
    token_mgr._civic_did = ME
    wire = GridWireClient(grid_url="https://grid.noesis.test", token_manager=token_mgr, brain_did="did:noesis:sophia")
    wire._client = httpx.AsyncClient(transport=httpx.MockTransport(grid.handle))

    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    llm = AsyncMock()
    llm.generate = AsyncMock(side_effect=_model)
    h = BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=llm,
        did=ME,
    )
    h._grid_wire_client = wire

    state: dict = {}
    for _ in range(3):
        await cf.follow_once(wire, h, state, sleep=_no_sleep)
        await _settle()

    assert grid.writes == ["purchase", "build", "extend"]
    assert grid.parcel["owner_civic_did_hash"] == MY_HASH
    assert grid.parcel["structure"] == {"type": "home", "visibility": "private"}
    assert grid.interior == {"areas": [{"name": "bedroom", "objects": [{"kind": "bed", "class": "mirror"}]}]}
    assert grid.balance == 600
    assert h._last_tick_seen == state["last"] == 300

    await wire.aclose()


async def test_a_nous_that_says_none_changes_nothing():
    grid = FakeGrid()
    token_mgr = MagicMock()
    token_mgr.get_valid_token.return_value = "jwt"
    token_mgr._civic_did = ME
    wire = GridWireClient(grid_url="https://grid.noesis.test", token_manager=token_mgr, brain_did="did:noesis:sophia")
    wire._client = httpx.AsyncClient(transport=httpx.MockTransport(grid.handle))

    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    llm = AsyncMock()
    llm.generate = AsyncMock(
        return_value=LLMResponse(text='{"action":"none","reason":"not yet"}', model="m", provider="mock", usage={})
    )
    h = BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=llm,
        did=ME,
    )
    h._grid_wire_client = wire

    state: dict = {}
    for _ in range(3):
        await cf.follow_once(wire, h, state, sleep=_no_sleep)
        await _settle()

    assert grid.writes == []
    assert grid.parcel["owner_civic_did_hash"] is None
    assert grid.balance == 1000
    await wire.aclose()
