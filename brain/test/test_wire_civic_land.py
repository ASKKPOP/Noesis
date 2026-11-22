"""GridWireClient — civic-land verbs go DIRECTLY to their civic-parcels route.

They never ride POST /api/v1/brain/actions: the Grid's batch intake has no case
for them. These tests use a real httpx client over a mock transport, so the
method, URL and JSON body are the ones that would reach the Grid.
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock

import httpx
import pytest

from noesis_brain.rpc.types import ActionType, build_civic_land_action
from noesis_brain.wire.client import GridWireClient

PARCEL = "genesis:residential:0007"


def _wire(handler):
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


def _ok(_req):
    return httpx.Response(201, json={"ok": True})


def test_civic_did_comes_from_the_token_manager():
    wire, _ = _wire(_ok)
    assert wire.civic_did == "did:civic:noesis:sophia"


async def test_buy_parcel_posts_to_purchase_with_empty_body():
    wire, seen = _wire(_ok)
    action = build_civic_land_action(ActionType.BUY_PARCEL, parcel=PARCEL, zone="residential", max_price=400)
    assert await wire.post_civic_land_action(action, PARCEL) == (True, None)
    assert len(seen) == 1
    req = seen[0]
    assert req.method == "POST"
    assert req.url.path == f"/api/v1/civic/parcels/{PARCEL}/purchase"
    assert json.loads(req.content) == {}
    assert req.headers["authorization"] == "Bearer test-jwt-token"


async def test_build_posts_name_type_visibility_only():
    wire, seen = _wire(_ok)
    action = build_civic_land_action(
        ActionType.BUILD, parcel=PARCEL, type="home", name="Oikos", visibility="private",
    )
    assert await wire.post_civic_land_action(action, PARCEL) == (True, None)
    assert seen[0].url.path == f"/api/v1/civic/parcels/{PARCEL}/build"
    assert json.loads(seen[0].content) == {"type": "home", "name": "Oikos", "visibility": "private"}


async def test_extend_interior_posts_area_and_kind():
    wire, seen = _wire(_ok)
    action = build_civic_land_action(ActionType.EXTEND_INTERIOR, area="bedroom", kind="bed")
    assert await wire.post_civic_land_action(action, PARCEL) == (True, None)
    assert seen[0].url.path == f"/api/v1/civic/parcels/{PARCEL}/interior/extend"
    assert json.loads(seen[0].content) == {"area": "bedroom", "kind": "bed"}


async def test_refusal_returns_the_grid_error_code():
    wire, _ = _wire(lambda r: httpx.Response(402, json={"error": "insufficient_funds"}))
    action = build_civic_land_action(ActionType.BUY_PARCEL, parcel=PARCEL, zone="residential", max_price=400)
    assert await wire.post_civic_land_action(action, PARCEL) == (False, "insufficient_funds")


async def test_refusal_with_non_json_body_returns_http_status():
    wire, _ = _wire(lambda r: httpx.Response(502, text="<html><body>Bad Gateway</body></html>"))
    action = build_civic_land_action(ActionType.EXTEND_INTERIOR, area="bedroom", kind="bed")
    assert await wire.post_civic_land_action(action, PARCEL) == (False, "http_502")


async def test_refusal_with_json_that_has_no_error_string():
    wire, _ = _wire(lambda r: httpx.Response(409, json={"error": {"nested": 1}}))
    action = build_civic_land_action(ActionType.EXTEND_INTERIOR, area="bedroom", kind="bed")
    assert await wire.post_civic_land_action(action, PARCEL) == (False, "http_409")


async def test_transport_error_never_raises():
    def _boom(_req):
        raise httpx.ConnectError("down")

    wire, _ = _wire(_boom)
    action = build_civic_land_action(ActionType.EXTEND_INTERIOR, area="bedroom", kind="bed")
    assert await wire.post_civic_land_action(action, PARCEL) == (False, "transport_error")


@pytest.mark.parametrize("bad", ["../x", "a/b", "", "a b", "x" * 129, "a?b=1", "a#b"])
async def test_bad_parcel_id_sends_nothing(bad):
    wire, seen = _wire(_ok)
    action = build_civic_land_action(ActionType.EXTEND_INTERIOR, area="bedroom", kind="bed")
    assert await wire.post_civic_land_action(action, bad) == (False, "invalid_parcel")
    assert seen == []


async def test_read_only_verb_is_refused():
    wire, seen = _wire(_ok)
    action = build_civic_land_action(ActionType.VIEW_INTERIOR, parcel=PARCEL)
    assert await wire.post_civic_land_action(action, PARCEL) == (False, "not_a_write_verb")
    assert seen == []


async def test_fetch_interior_returns_the_interior_value():
    interior = {"areas": [{"name": "bedroom", "objects": [{"kind": "bed", "class": "mirror"}]}]}
    wire, seen = _wire(lambda r: httpx.Response(200, json={"parcel_id": PARCEL, "condition": "maintained", "interior": interior}))
    assert await wire.fetch_interior(PARCEL) == interior
    assert seen[0].method == "GET"
    assert seen[0].url.path == f"/api/v1/civic/parcels/{PARCEL}/interior"


async def test_fetch_interior_none_on_refusal_or_bad_id():
    wire, seen = _wire(lambda r: httpx.Response(403, json={"error": "closed_to_visitors"}))
    assert await wire.fetch_interior(PARCEL) is None
    assert await wire.fetch_interior("../x") is None
    assert len(seen) == 1  # the bad id sent nothing


async def test_fetch_clock_returns_the_clock_state():
    state = {"tick": 2458, "epoch": 24, "tickRateMs": 30000, "startedAt": 1}
    wire, seen = _wire(lambda r: httpx.Response(200, json=state))
    assert await wire.fetch_clock() == state
    assert seen[0].url.path == "/api/v1/grid/clock"


async def test_fetch_clock_none_on_failure():
    wire, _ = _wire(lambda r: httpx.Response(503, text="down"))
    assert await wire.fetch_clock() is None
    wire2, _ = _wire(lambda r: httpx.Response(200, json=[1, 2]))
    assert await wire2.fetch_clock() is None
