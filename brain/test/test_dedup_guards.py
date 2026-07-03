"""Duplicate-action guards (surfaced by the 2026-07-02 liveness run).

The real model bid the SAME open RFP every economic cycle and re-joined the
same group every social cycle → audit-chain spam. These guards make each act
once-per-target while it stays relevant.
"""
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
import yaml

from noesis_brain.llm.types import LLMResponse
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.rpc.types import ActionType
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"
RFP = {"notice_id": "22222222-2222-4222-8222-222222222222", "function_type": "energy", "budget_wei": "5000", "status": "open"}
GROUP = {"group_id": "grp-dynamo", "display_name": "Dynamo", "domain": "energy", "status": "active"}


def _handler():
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    h = BrainHandler(
        psyche=load_psyche(data=data), thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})), llm=AsyncMock(), did="did:noesis:sophia",
    )
    mem = MagicMock(); mem.recent = MagicMock(return_value=[]); mem.record_event = MagicMock()
    h.memory = mem
    return h


def _llm(text):
    llm = AsyncMock()
    llm.generate = AsyncMock(return_value=LLMResponse(text=text, model="m", provider="mock", usage={}))
    return llm


@pytest.mark.asyncio
async def test_does_not_bid_same_rfp_twice():
    h = _handler()
    w = MagicMock()
    w.fetch_dues = AsyncMock(return_value=[])
    w.fetch_open_rfps = AsyncMock(return_value=[RFP])
    w.fetch_account = AsyncMock(return_value={"balance_wei": "1000000000000000000"})
    w.fetch_grids = AsyncMock(return_value=[]); w.fetch_grid_recommendations = AsyncMock(return_value=[])
    w.fetch_parcels = AsyncMock(return_value=[]); w.fetch_objects = AsyncMock(return_value=[])
    w.post_economic_action = AsyncMock(return_value=True)
    h._grid_wire_client = w
    h.llm = _llm('{"action":"bid_rfp","notice_id":"22222222-2222-4222-8222-222222222222","price_wei":"300","artifact_spec":"solar"}')

    await h._run_economic_cycle(100)
    assert w.post_economic_action.await_count == 1
    assert RFP["notice_id"] in h._bid_notice_ids

    # second cycle: same RFP still open → now filtered out → no LLM call, no bid
    await h._run_economic_cycle(200)
    assert w.post_economic_action.await_count == 1        # still 1
    assert h.llm.generate.await_count == 1                # cost-guard: no 2nd LLM call


@pytest.mark.asyncio
async def test_bid_guard_prunes_when_rfp_closes():
    h = _handler()
    h._bid_notice_ids = {"old-closed-notice", RFP["notice_id"]}
    w = MagicMock()
    w.fetch_dues = AsyncMock(return_value=[])
    w.fetch_open_rfps = AsyncMock(return_value=[RFP])   # only this one still open
    w.fetch_account = AsyncMock(return_value={"balance_wei": "1"})
    w.fetch_grids = AsyncMock(return_value=[]); w.fetch_grid_recommendations = AsyncMock(return_value=[])
    w.fetch_parcels = AsyncMock(return_value=[]); w.fetch_objects = AsyncMock(return_value=[])
    w.post_economic_action = AsyncMock(return_value=True)
    h._grid_wire_client = w
    h.llm = _llm('{"action":"none"}')

    await h._run_economic_cycle(100)
    assert "old-closed-notice" not in h._bid_notice_ids   # pruned to open set


@pytest.mark.asyncio
async def test_does_not_rejoin_same_group():
    h = _handler()
    w = MagicMock()
    w.fetch_open_proposals = AsyncMock(return_value=[])
    w.fetch_groups_list = AsyncMock(return_value=[GROUP])
    h._grid_wire_client = w
    h.llm = _llm('{"action":"join_group","group_id":"grp-dynamo"}')

    await h._run_social_cycle(100)
    joins = [a for a in h._pending_actions if a.action_type == ActionType.JOIN_GROUP]
    assert len(joins) == 1
    assert "grp-dynamo" in h._joined_group_ids
    h._pending_actions.clear()

    # second cycle: already joined → group filtered from the offer → no join
    await h._run_social_cycle(200)
    joins2 = [a for a in h._pending_actions if a.action_type == ActionType.JOIN_GROUP]
    assert joins2 == []
