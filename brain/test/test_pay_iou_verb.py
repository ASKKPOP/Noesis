"""pay_iou — a Nous can pay a debt it owes, and can see its debts and credits.

A capability, like pay_due: nothing pays on the Nous's behalf. The economic cycle
puts to the Nous only debts it can cover in full, and it may answer "none".

The economic prompt and its parser are part of the parity contract the Rust Brain
reproduces (brain/parity/, D-V3-42): a change here is re-recorded there and made in
brain-rs as well.
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
import yaml

from noesis_brain.llm.types import LLMResponse
from noesis_brain.prompts.economic_decision import build_economic_decision_prompt, parse_economic_decision
from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.rpc.types import ActionType, build_economic_action
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker
from noesis_brain.wire.client import ECONOMIC_ROUTES, GridWireClient, economic_route

IOU = "iou:3"
SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"
DEBT = {"iou_id": IOU, "counterparty_civic_did": "did:civic:noesis:hermes", "amount_wei": 50, "created_tick": 7}


def _client(handler):
    token_mgr = MagicMock()
    token_mgr.get_valid_token.return_value = "test-jwt-token"
    token_mgr._civic_did = "did:civic:noesis:sophia"
    wire = GridWireClient(
        grid_url="https://grid.noesis.test", token_manager=token_mgr, brain_did="did:noesis:sophia",
    )
    seen: list[httpx.Request] = []

    def _handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    wire._client = httpx.AsyncClient(transport=httpx.MockTransport(_handle))
    return wire, seen


# ── the verb ─────────────────────────────────────────────────────────────────
def test_the_verb_and_its_route():
    assert ActionType.PAY_IOU == "pay_iou"
    assert ECONOMIC_ROUTES[ActionType.PAY_IOU] == ("POST", "/api/v1/civic/ious/{iou_id}/pay")
    assert economic_route(ActionType.PAY_IOU, iou_id=IOU) == ("POST", f"/api/v1/civic/ious/{IOU}/pay")


def test_building_the_action_requires_the_debts_id():
    action = build_economic_action(ActionType.PAY_IOU, iou_id=IOU)
    assert action.action_type is ActionType.PAY_IOU
    assert action.metadata == {"iou_id": IOU}
    with pytest.raises(ValueError, match="iou_id"):
        build_economic_action(ActionType.PAY_IOU)


async def test_paying_posts_to_the_debts_own_route_with_an_empty_body():
    wire, seen = _client(lambda _r: httpx.Response(200, json={"paid": True, "iou_id": IOU, "amount_wei": 50}))
    assert await wire.post_economic_action(build_economic_action(ActionType.PAY_IOU, iou_id=IOU)) is True
    assert len(seen) == 1
    assert seen[0].method == "POST"
    assert seen[0].url.path == f"/api/v1/civic/ious/{IOU}/pay"
    assert json.loads(seen[0].content) == {}
    assert seen[0].headers["authorization"] == "Bearer test-jwt-token"


async def test_a_refusal_is_reported_as_not_done():
    wire, _ = _client(lambda _r: httpx.Response(402, json={"error": "insufficient_funds"}))
    assert await wire.post_economic_action(build_economic_action(ActionType.PAY_IOU, iou_id=IOU)) is False


# ── sight ────────────────────────────────────────────────────────────────────
async def test_a_nous_reads_what_it_owes_and_what_it_is_owed():
    body = {"i_owe": [DEBT], "owed_to_me": []}
    wire, seen = _client(lambda _r: httpx.Response(200, json=body))
    assert await wire.fetch_ious() == body
    assert seen[0].method == "GET"
    assert seen[0].url.path == "/api/v1/civic/ious"


@pytest.mark.parametrize("response", [
    httpx.Response(503, json={"error": "civic_parcels_unavailable"}),
    httpx.Response(200, json=["not", "an", "object"]),
    httpx.Response(200, json={"i_owe": "nope", "owed_to_me": [1, {"iou_id": "iou:1"}]}),
])
async def test_reading_debts_never_raises_and_keeps_only_well_formed_rows(response):
    wire, _ = _client(lambda _r: response)
    out = await wire.fetch_ious()
    assert set(out) == {"i_owe", "owed_to_me"}
    assert all(isinstance(r, dict) for rows in out.values() for r in rows)


# ── the prompt ───────────────────────────────────────────────────────────────
def test_the_prompt_names_each_payable_debt_and_offers_the_choice():
    prompt = build_economic_decision_prompt({"balance_wei": "80"}, None, [], [DEBT])
    assert f"  - debt {IOU}: 50 wei to {DEBT['counterparty_civic_did']}." in prompt
    assert '"action": "pay_due" | "pay_iou" | "bid_rfp" | "none"' in prompt
    assert '"iou_id": "<one of the debt ids above>"' in prompt


def test_without_a_debt_the_prompt_is_what_it_was():
    """Nothing about debts is said, and the choice is not offered, when there is none to pay:
    the wording small models were tuned on stays as it is."""
    for debts in (None, []):
        prompt = build_economic_decision_prompt({"balance_wei": "80"}, None, [], debts)
        assert prompt == build_economic_decision_prompt({"balance_wei": "80"}, None, [])
        assert "pay_iou" not in prompt and "iou_id" not in prompt and "ebt" not in prompt


def test_the_parser_accepts_the_choice_and_carries_the_id():
    decision = parse_economic_decision('I will. {"action": "pay_iou", "iou_id": "iou:3", "reason": "I keep my word"}')
    assert decision["action"] == "pay_iou" and decision["iou_id"] == IOU
    assert parse_economic_decision('{"action": "none"}')["iou_id"] is None


# ── the cycle ────────────────────────────────────────────────────────────────
def _handler(llm_text: str) -> BrainHandler:
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    llm = AsyncMock()
    llm.generate = AsyncMock(return_value=LLMResponse(text=llm_text, model="m", provider="mock", usage={}))
    return BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=llm,
        did="did:civic:noesis:sophia",
    )


def _wire(*, debts, balance="80", dues=None):
    w = MagicMock()
    w.fetch_dues = AsyncMock(return_value=dues or [])
    w.fetch_open_rfps = AsyncMock(return_value=[])
    w.fetch_ious = AsyncMock(return_value={"i_owe": debts, "owed_to_me": []})
    w.fetch_account = AsyncMock(return_value={"balance_wei": balance})
    w.fetch_grids = AsyncMock(return_value=[])
    w.fetch_grid_recommendations = AsyncMock(return_value=[])
    w.fetch_parcels = AsyncMock(return_value=[])
    w.fetch_objects = AsyncMock(return_value=[])
    w.post_economic_action = AsyncMock(return_value=True)
    return w


async def test_the_nous_pays_a_debt_when_it_chooses_to():
    h = _handler('{"action": "pay_iou", "iou_id": "iou:3", "reason": "I keep my word"}')
    h._grid_wire_client = _wire(debts=[DEBT])
    await h._run_economic_cycle(100)
    h._grid_wire_client.post_economic_action.assert_awaited_once()
    action = h._grid_wire_client.post_economic_action.await_args[0][0]
    assert action.action_type == ActionType.PAY_IOU
    assert action.metadata == {"iou_id": IOU}
    assert IOU in h.llm.generate.await_args[0][0]          # the debt was put to it


async def test_the_nous_may_choose_not_to_pay():
    h = _handler('{"action": "none", "reason": "not yet"}')
    h._grid_wire_client = _wire(debts=[DEBT])
    await h._run_economic_cycle(100)
    h.llm.generate.assert_awaited_once()
    h._grid_wire_client.post_economic_action.assert_not_awaited()


async def test_a_debt_it_cannot_cover_is_not_put_to_it_and_costs_no_thought():
    h = _handler('{"action": "pay_iou", "iou_id": "iou:3"}')
    h._grid_wire_client = _wire(debts=[DEBT], balance="49")
    await h._run_economic_cycle(100)
    h.llm.generate.assert_not_awaited()
    h._grid_wire_client.post_economic_action.assert_not_awaited()


async def test_of_two_debts_only_the_one_it_can_cover_is_put_to_it():
    big = {"iou_id": "iou:4", "counterparty_civic_did": "did:civic:noesis:themis", "amount_wei": 500, "created_tick": 8}
    h = _handler('{"action": "pay_iou", "iou_id": "iou:4"}')         # asks for the one it was not offered
    h._grid_wire_client = _wire(debts=[DEBT, big])
    await h._run_economic_cycle(100)
    prompt = h.llm.generate.await_args[0][0]
    assert IOU in prompt and "iou:4" not in prompt
    h._grid_wire_client.post_economic_action.assert_not_awaited()


async def test_a_debt_id_the_model_made_up_is_not_paid():
    h = _handler('{"action": "pay_iou", "iou_id": "iou:999"}')
    h._grid_wire_client = _wire(debts=[DEBT])
    await h._run_economic_cycle(100)
    h._grid_wire_client.post_economic_action.assert_not_awaited()


async def test_a_ledger_that_cannot_be_read_does_not_stop_the_cycle():
    h = _handler('{"action": "none"}')
    w = _wire(debts=[], dues=[{"due_id": "d1", "amount_wei": "5", "amount_credit": "1", "status": "assessed"}])
    w.fetch_ious = AsyncMock(side_effect=RuntimeError("grid down"))
    h._grid_wire_client = w
    await h._run_economic_cycle(100)
    h.llm.generate.assert_awaited_once()                   # the due was still put to it


async def test_a_refused_payment_is_not_put_to_it_again_until_some_time_has_passed():
    """The Grid may refuse a payment it listed (the debt closed, or the money went
    elsewhere). Asking again every cycle would cost a thought and a refusal each time."""
    h = _handler('{"action": "pay_iou", "iou_id": "iou:3"}')
    w = _wire(debts=[DEBT])
    w.post_economic_action = AsyncMock(return_value=False)
    h._grid_wire_client = w
    await h._run_economic_cycle(100)
    assert h.llm.generate.await_count == 1 and w.post_economic_action.await_count == 1
    await h._run_economic_cycle(150)                       # the next cycle: not asked, not posted
    assert h.llm.generate.await_count == 1 and w.post_economic_action.await_count == 1
    await h._run_economic_cycle(100 + BrainHandler._IOU_RETRY_TICKS)   # later: asked again
    assert h.llm.generate.await_count == 2 and w.post_economic_action.await_count == 2


async def test_a_refused_debt_does_not_hide_another_one():
    other = {"iou_id": "iou:4", "counterparty_civic_did": "did:civic:noesis:themis", "amount_wei": 10, "created_tick": 8}
    h = _handler('{"action": "pay_iou", "iou_id": "iou:3"}')
    w = _wire(debts=[DEBT, other])
    w.post_economic_action = AsyncMock(return_value=False)
    h._grid_wire_client = w
    await h._run_economic_cycle(100)
    await h._run_economic_cycle(150)
    prompt = h.llm.generate.await_args[0][0]
    assert "iou:4" in prompt and f"debt {IOU}" not in prompt


async def test_a_debt_that_is_gone_is_forgotten():
    h = _handler('{"action": "pay_iou", "iou_id": "iou:3"}')
    w = _wire(debts=[DEBT])
    w.post_economic_action = AsyncMock(return_value=False)
    h._grid_wire_client = w
    await h._run_economic_cycle(100)
    assert IOU in h._refused_iou_ticks
    w.fetch_ious = AsyncMock(return_value={"i_owe": [], "owed_to_me": []})
    w.fetch_dues = AsyncMock(return_value=[{"due_id": "d1", "amount_wei": "5", "amount_credit": "1", "status": "assessed"}])
    await h._run_economic_cycle(150)
    assert h._refused_iou_ticks == {}


async def test_with_a_due_and_a_debt_it_can_still_pay_the_due():
    h = _handler('{"action": "pay_due", "method": "wei", "reason": "the city first"}')
    h._grid_wire_client = _wire(
        debts=[DEBT], dues=[{"due_id": "d1", "amount_wei": "5", "amount_credit": "1", "status": "assessed"}],
    )
    await h._run_economic_cycle(100)
    prompt = h.llm.generate.await_args[0][0]
    assert "d1" in prompt and IOU in prompt                # both were put to it
    action = h._grid_wire_client.post_economic_action.await_args[0][0]
    assert action.action_type == ActionType.PAY_DUE
    assert action.metadata == {"due_id": "d1", "method": "wei"}


async def test_it_remembers_what_it_paid_and_to_whom():
    h = _handler('{"action": "pay_iou", "iou_id": "iou:3"}')
    h.memory = MagicMock()
    h._grid_wire_client = _wire(debts=[DEBT])
    await h._run_economic_cycle(100)
    remembered = h.memory.record_event.call_args.kwargs["content"]
    assert "50 wei" in remembered and DEBT["counterparty_civic_did"] in remembered and IOU in remembered


async def test_a_refusal_does_not_outlast_a_city_that_starts_counting_again():
    """The Grid's tick starts from zero when it restarts. A refusal stamped with a later
    tick than now must not hide the debt for longer than the wait was meant to be."""
    h = _handler('{"action": "pay_iou", "iou_id": "iou:3"}')
    w = _wire(debts=[DEBT])
    w.post_economic_action = AsyncMock(return_value=False)
    h._grid_wire_client = w
    await h._run_economic_cycle(10_000)
    await h._run_economic_cycle(50)                        # the city restarted: asked again
    assert h.llm.generate.await_count == 2


# ── the standing view of its finances (the system prompt) ────────────────────
def _system(economic_state) -> str:
    from noesis_brain.prompts.system import build_system_prompt

    h = _handler("{}")
    return build_system_prompt(h.psyche, h.thymos.mood, h.telos, economic_state=economic_state)


def test_the_standing_view_lists_what_it_owes():
    big = {"iou_id": "iou:4", "counterparty_civic_did": "did:civic:noesis:themis", "amount_wei": 500}
    prompt = _system({"balance_wei": "80", "outstanding_due": None, "open_rfps": [], "debts": [DEBT, big]})
    assert "- debts you owe to other Nous for work done:" in prompt
    assert f"  - {IOU}: 50 wei to {DEBT['counterparty_civic_did']}" in prompt
    assert "  - iou:4: 500 wei to did:civic:noesis:themis" in prompt     # also one it cannot cover yet


def test_the_standing_view_without_a_debt_is_what_it_was():
    base = {"balance_wei": "80", "outstanding_due": None, "open_rfps": []}
    for debts in ([], None):
        assert _system({**base, "debts": debts}) == _system(base)
    assert "debt" not in _system(base)


def test_a_debt_alone_is_enough_for_the_standing_view_to_appear():
    prompt = _system({"debts": [DEBT]})
    assert "## Your economic position" in prompt and f"  - {IOU}: 50 wei" in prompt


async def test_the_economic_cycle_tells_the_mind_everything_it_owes():
    """The question names only what it can pay now; the standing view names all of it,
    so the two do not contradict each other."""
    big = {"iou_id": "iou:4", "counterparty_civic_did": "did:civic:noesis:themis", "amount_wei": 500, "created_tick": 8}
    h = _handler('{"action": "none"}')
    h._grid_wire_client = _wire(debts=[DEBT, big])
    await h._run_economic_cycle(100)
    question = h.llm.generate.await_args[0][0]
    standing = h.llm.generate.await_args[0][1].system_prompt
    assert "iou:4" not in question
    assert f"  - {IOU}: 50 wei" in standing and "  - iou:4: 500 wei" in standing


def _many(n):
    return [{"iou_id": f"iou:{i}", "counterparty_civic_did": "did:civic:noesis:hermes", "amount_wei": 1} for i in range(1, n + 1)]


def test_the_standing_view_names_at_most_twenty_debts_and_says_how_many_more():
    """The Grid bounds what a mind may owe by amount, not by count."""
    prompt = _system({"balance_wei": "80", "debts": _many(23)})
    assert "  - iou:20: 1 wei" in prompt and "iou:21" not in prompt
    assert "  - … and 3 more" in prompt
    assert "more" not in _system({"balance_wei": "80", "debts": _many(20)}).split("## Your economic position")[1].split("\n\n")[0]


async def test_the_question_names_at_most_twenty_debts():
    h = _handler('{"action": "pay_iou", "iou_id": "iou:21"}')            # one beyond what it was asked about
    h._grid_wire_client = _wire(debts=_many(23), balance="1000")
    await h._run_economic_cycle(100)
    question = h.llm.generate.await_args[0][0]
    assert "debt iou:20:" in question and "debt iou:21:" not in question
    h._grid_wire_client.post_economic_action.assert_not_awaited()
