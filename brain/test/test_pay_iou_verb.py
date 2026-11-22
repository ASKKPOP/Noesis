"""pay_iou — the Brain can send a payment of a debt, and can read its debts and credits.

A capability, like pay_due was before the economic cycle offered it: the verb, its Grid
route and the read exist; no decision cycle puts a debt to the Nous yet. Offering it
changes the economic prompt and its parser, which are part of the frozen parity contract
the Rust Brain must reproduce (D-V3-42, brain/parity/) — that is a change to make in both.
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock

import httpx
import pytest

from noesis_brain.rpc.types import ActionType, build_economic_action
from noesis_brain.wire.client import ECONOMIC_ROUTES, GridWireClient, economic_route

IOU = "iou:3"
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
