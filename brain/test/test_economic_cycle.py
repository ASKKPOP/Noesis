"""W3b — the per-tick economic decision cycle.

When a Nous has an outstanding due or an open RFP, it autonomously decides (one
LLM call) whether to pay / bid / do nothing, and dispatches the chosen economic
action via the wire client. Cost-gated (no LLM call when nothing is actionable),
cooldown-gated, and every LLM-chosen value is validated Brain-side.
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


def _wire(*, dues=None, rfps=None, balance="1000"):
    w = MagicMock()
    w.fetch_dues = AsyncMock(return_value=dues or [])
    w.fetch_open_rfps = AsyncMock(return_value=rfps or [])
    w.fetch_account = AsyncMock(return_value={"balance_wei": balance})
    w.post_economic_action = AsyncMock(return_value=True)
    return w


def _llm_saying(text: str) -> AsyncMock:
    llm = AsyncMock()
    llm.generate = AsyncMock(return_value=LLMResponse(text=text, model="m", provider="mock", usage={}))
    return llm


DUE = {"due_id": "11111111-1111-4111-8111-111111111111", "amount_wei": "500", "amount_credit": "10", "status": "assessed"}
RFP = {"notice_id": "22222222-2222-4222-8222-222222222222", "function_type": "energy", "budget_wei": "400", "status": "open"}


# ── gate ─────────────────────────────────────────────────────────────────────
def test_should_run_false_without_wire_client():
    h = _handler()
    h._grid_wire_client = None
    assert h._should_run_economic_cycle(100) is False


def test_should_run_false_within_cooldown():
    h = _handler()
    h._grid_wire_client = _wire()
    h._last_econ_tick = 100
    assert h._should_run_economic_cycle(110) is False  # < 50-tick cooldown


def test_should_run_true_when_wire_present_and_cooldown_elapsed():
    h = _handler()
    h._grid_wire_client = _wire()
    h._last_econ_tick = 0
    assert h._should_run_economic_cycle(100) is True


# ── decisions ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_pays_outstanding_due_when_llm_chooses_pay():
    h = _handler()
    h.llm = _llm_saying('{"action": "pay_due", "method": "wei"}')
    h._grid_wire_client = _wire(dues=[DUE])
    await h._run_economic_cycle(100)

    h._grid_wire_client.post_economic_action.assert_awaited_once()
    action = h._grid_wire_client.post_economic_action.await_args[0][0]
    assert action.action_type == ActionType.PAY_DUE
    assert action.metadata["due_id"] == DUE["due_id"]   # Brain supplies the id, not the LLM
    assert action.metadata["method"] == "wei"


@pytest.mark.asyncio
async def test_bids_on_rfp_when_llm_chooses_bid():
    h = _handler()
    h.llm = _llm_saying('{"action":"bid_rfp","notice_id":"22222222-2222-4222-8222-222222222222","price_wei":"300","artifact_spec":"solar"}')
    h._grid_wire_client = _wire(rfps=[RFP])
    await h._run_economic_cycle(100)

    action = h._grid_wire_client.post_economic_action.await_args[0][0]
    assert action.action_type == ActionType.BID_RFP
    assert action.metadata["notice_id"] == RFP["notice_id"]
    assert action.metadata["price_wei"] == "300"
    assert action.metadata["artifact_spec"] == "solar"


@pytest.mark.asyncio
async def test_no_llm_call_and_no_action_when_nothing_actionable():
    h = _handler()
    h.llm = _llm_saying('{"action": "pay_due", "method": "wei"}')  # would act IF asked
    h._grid_wire_client = _wire(dues=[], rfps=[])
    await h._run_economic_cycle(100)

    h.llm.generate.assert_not_awaited()                         # cost guard: no LLM call
    h._grid_wire_client.post_economic_action.assert_not_awaited()


@pytest.mark.asyncio
async def test_no_action_when_llm_chooses_none():
    h = _handler()
    h.llm = _llm_saying('{"action": "none", "reason": "saving up"}')
    h._grid_wire_client = _wire(dues=[DUE])
    await h._run_economic_cycle(100)
    h._grid_wire_client.post_economic_action.assert_not_awaited()


# ── guardrails ───────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_rejects_bid_above_budget():
    h = _handler()
    h.llm = _llm_saying('{"action":"bid_rfp","notice_id":"22222222-2222-4222-8222-222222222222","price_wei":"999","artifact_spec":"x"}')
    h._grid_wire_client = _wire(rfps=[RFP])  # budget 400 < 999
    await h._run_economic_cycle(100)
    h._grid_wire_client.post_economic_action.assert_not_awaited()


@pytest.mark.asyncio
async def test_rejects_bid_for_unknown_notice():
    h = _handler()
    h.llm = _llm_saying('{"action":"bid_rfp","notice_id":"deadbeef-dead-4ead-8ead-deaddeaddead","price_wei":"10","artifact_spec":"x"}')
    h._grid_wire_client = _wire(rfps=[RFP])
    await h._run_economic_cycle(100)
    h._grid_wire_client.post_economic_action.assert_not_awaited()


@pytest.mark.asyncio
async def test_rejects_pay_in_wei_when_unaffordable():
    h = _handler()
    h.llm = _llm_saying('{"action": "pay_due", "method": "wei"}')
    h._grid_wire_client = _wire(dues=[DUE], balance="100")  # due is 500 wei, balance 100
    await h._run_economic_cycle(100)
    h._grid_wire_client.post_economic_action.assert_not_awaited()
