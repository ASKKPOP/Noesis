"""W3b — GridWireClient economic sight + dispatch.

The Brain gains economic perception (read its balance / dues / open RFPs) and a
real dispatch method for economic actions (the W3 route table had no POSTer).
All reads are non-fatal: any error returns an empty value, never raises.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from noesis_brain.rpc.types import ActionType, build_economic_action


def _make_client(*, get_status=200, get_json=None, post_status=200, raise_exc=None):
    from noesis_brain.wire.client import GridWireClient

    token_mgr = MagicMock()
    token_mgr.get_valid_token.return_value = "test-jwt-token"
    wire = GridWireClient(
        grid_url="https://grid.noesis.test",
        token_manager=token_mgr,
        brain_did="did:noesis:nous:test",
    )
    mock_http = AsyncMock()
    if raise_exc is not None:
        mock_http.get = AsyncMock(side_effect=raise_exc)
        mock_http.post = AsyncMock(side_effect=raise_exc)
    else:
        get_resp = MagicMock(); get_resp.status_code = get_status; get_resp.json.return_value = get_json or {}
        post_resp = MagicMock(); post_resp.status_code = post_status; post_resp.json.return_value = {}
        mock_http.get = AsyncMock(return_value=get_resp)
        mock_http.post = AsyncMock(return_value=post_resp)
    wire._client = mock_http
    return wire, mock_http


# ── Reads ────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_fetch_account_returns_balance_dict():
    wire, http = _make_client(get_json={"civic_did": "did:civic:noesis:a", "balance_wei": "1000"})
    out = await wire.fetch_account()
    assert out == {"civic_did": "did:civic:noesis:a", "balance_wei": "1000"}
    url = http.get.call_args[0][0]
    assert url.endswith("/api/v1/civic/account")
    assert http.get.call_args.kwargs["headers"]["Authorization"] == "Bearer test-jwt-token"


@pytest.mark.asyncio
async def test_fetch_dues_returns_list():
    wire, _ = _make_client(get_json={"dues": [{"due_id": "d1", "amount_wei": "500", "status": "assessed"}], "count": 1})
    out = await wire.fetch_dues()
    assert isinstance(out, list) and out[0]["due_id"] == "d1"


@pytest.mark.asyncio
async def test_fetch_open_rfps_returns_list():
    wire, http = _make_client(get_json={"notices": [{"notice_id": "n1", "budget_wei": "400", "status": "open"}], "count": 1})
    out = await wire.fetch_open_rfps()
    assert out[0]["notice_id"] == "n1"
    assert http.get.call_args[0][0].endswith("/api/v1/procurement/notices")


@pytest.mark.asyncio
async def test_fetch_grids_returns_join_list():
    wire, http = _make_client(get_json={"grids": [
        {"grid_id": "genesis", "name": "Genesis", "polis": "Genesis Polis", "status": "active", "celestial_body": "Earth-orbit"},
    ], "count": 1})
    out = await wire.fetch_grids()
    assert out[0]["name"] == "Genesis" and out[0]["polis"] == "Genesis Polis"
    assert http.get.call_args[0][0].endswith("/api/v1/portal/grids")


@pytest.mark.asyncio
async def test_reads_are_non_fatal_on_transport_error():
    wire, _ = _make_client(raise_exc=httpx.ConnectError("boom"))
    assert await wire.fetch_account() == {}
    assert await wire.fetch_dues() == []
    assert await wire.fetch_open_rfps() == []
    assert await wire.fetch_grids() == []


@pytest.mark.asyncio
async def test_reads_are_non_fatal_on_non_2xx():
    wire, _ = _make_client(get_status=503)
    assert await wire.fetch_account() == {}
    assert await wire.fetch_dues() == []


# ── Dispatch ─────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_post_economic_action_pay_due_posts_to_route_with_method_body():
    wire, http = _make_client(post_status=200)
    action = build_economic_action(ActionType.PAY_DUE, due_id="11111111-1111-4111-8111-111111111111", method="wei")
    ok = await wire.post_economic_action(action)
    assert ok is True
    url = http.post.call_args[0][0]
    assert url.endswith("/api/v1/civic/dues/11111111-1111-4111-8111-111111111111/pay")
    # due_id is a PATH param → must NOT be in the JSON body; method IS the body.
    body = http.post.call_args.kwargs["json"]
    assert body == {"method": "wei"}
    assert http.post.call_args.kwargs["headers"]["Authorization"] == "Bearer test-jwt-token"


@pytest.mark.asyncio
async def test_post_economic_action_bid_rfp_posts_price_and_spec_body():
    wire, http = _make_client(post_status=200)
    action = build_economic_action(
        ActionType.BID_RFP, notice_id="22222222-2222-4222-8222-222222222222",
        price_wei="300", artifact_spec="solar array",
    )
    ok = await wire.post_economic_action(action)
    assert ok is True
    url = http.post.call_args[0][0]
    assert url.endswith("/api/v1/procurement/notices/22222222-2222-4222-8222-222222222222/bids")
    body = http.post.call_args.kwargs["json"]
    assert body == {"price_wei": "300", "artifact_spec": "solar array"}


@pytest.mark.asyncio
async def test_post_economic_action_returns_false_on_non_2xx():
    wire, _ = _make_client(post_status=402)
    action = build_economic_action(ActionType.PAY_DUE, due_id="11111111-1111-4111-8111-111111111111", method="wei")
    assert await wire.post_economic_action(action) is False


@pytest.mark.asyncio
async def test_post_economic_action_non_fatal_on_transport_error():
    wire, _ = _make_client(raise_exc=httpx.ConnectError("boom"))
    action = build_economic_action(ActionType.PAY_DUE, due_id="11111111-1111-4111-8111-111111111111", method="wei")
    assert await wire.post_economic_action(action) is False
