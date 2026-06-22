"""W3 — Brain economic action-types (capabilities, not autoplay).

Locks the contract for four economic ActionType verbs:
  pay_due / bid_rfp / request_approval / post_conversation

Asserts:
  - the 4 ActionType values exist with the documented string values;
  - metadata validation accepts correct keys and rejects missing ones;
  - a non-economic verb raises ValueError from build_economic_action;
  - the wire route table maps each verb to the correct (METHOD, path-template)
    with path-params substituted from metadata.

Routes target the live Grid endpoints built in this session:
  PAY_DUE         → POST /api/v1/civic/dues/{due_id}/pay
  BID_RFP         → POST /api/v1/procurement/notices/{notice_id}/bids
  REQUEST_APPROVAL→ POST /api/v1/civic/approvals
  POST_CONVERSATION→POST /api/v1/civic/conversation/{partner_did}/messages
"""

from __future__ import annotations

import pytest

from noesis_brain.rpc.types import ActionType, build_economic_action
from noesis_brain.wire.client import ECONOMIC_ROUTES, economic_route


# ── 1. ActionType members exist with documented string values ──────────────


class TestEconomicActionTypes:
    def test_four_members_exist(self) -> None:
        assert ActionType.PAY_DUE == "pay_due"
        assert ActionType.BID_RFP == "bid_rfp"
        assert ActionType.REQUEST_APPROVAL == "request_approval"
        assert ActionType.POST_CONVERSATION == "post_conversation"

    def test_members_are_string_enum(self) -> None:
        assert isinstance(ActionType.PAY_DUE, str)
        assert ActionType.BID_RFP.value == "bid_rfp"


# ── 2. Capability builder validates metadata shapes ────────────────────────


class TestBuildEconomicAction:
    # PAY_DUE: required {due_id, method}
    def test_pay_due_happy_path(self) -> None:
        action = build_economic_action(ActionType.PAY_DUE, due_id="d1", method="wei")
        assert action.action_type == ActionType.PAY_DUE
        assert action.metadata == {"due_id": "d1", "method": "wei"}

    def test_pay_due_missing_due_id_raises(self) -> None:
        with pytest.raises(ValueError):
            build_economic_action(ActionType.PAY_DUE, method="wei")

    def test_pay_due_missing_method_raises(self) -> None:
        with pytest.raises(ValueError):
            build_economic_action(ActionType.PAY_DUE, due_id="d1")

    # BID_RFP: required {notice_id, price_wei, artifact_spec}
    def test_bid_rfp_happy_path(self) -> None:
        action = build_economic_action(
            ActionType.BID_RFP,
            notice_id="n42",
            price_wei=100,
            artifact_spec="ipfs://Qm123",
        )
        assert action.action_type == ActionType.BID_RFP
        assert action.metadata == {
            "notice_id": "n42",
            "price_wei": 100,
            "artifact_spec": "ipfs://Qm123",
        }

    def test_bid_rfp_missing_notice_id_raises(self) -> None:
        with pytest.raises(ValueError):
            build_economic_action(ActionType.BID_RFP, price_wei=100, artifact_spec="s")

    def test_bid_rfp_missing_price_wei_raises(self) -> None:
        with pytest.raises(ValueError):
            build_economic_action(ActionType.BID_RFP, notice_id="n1", artifact_spec="s")

    def test_bid_rfp_missing_artifact_spec_raises(self) -> None:
        with pytest.raises(ValueError):
            build_economic_action(ActionType.BID_RFP, notice_id="n1", price_wei=1)

    # REQUEST_APPROVAL: required {human_did, kind, summary, payload, deadline_tick}
    def test_request_approval_happy_path(self) -> None:
        action = build_economic_action(
            ActionType.REQUEST_APPROVAL,
            human_did="did:civic:henry",
            kind="purchase",
            summary="Buy parcel 7",
            payload={"parcel": "p7"},
            deadline_tick=500,
        )
        assert action.action_type == ActionType.REQUEST_APPROVAL
        assert action.metadata["human_did"] == "did:civic:henry"
        assert action.metadata["kind"] == "purchase"
        assert action.metadata["deadline_tick"] == 500

    def test_request_approval_missing_human_did_raises(self) -> None:
        with pytest.raises(ValueError):
            build_economic_action(
                ActionType.REQUEST_APPROVAL,
                kind="purchase",
                summary="s",
                payload={},
                deadline_tick=1,
            )

    def test_request_approval_missing_deadline_tick_raises(self) -> None:
        with pytest.raises(ValueError):
            build_economic_action(
                ActionType.REQUEST_APPROVAL,
                human_did="did:civic:henry",
                kind="purchase",
                summary="s",
                payload={},
            )

    # POST_CONVERSATION: required {partner_did, text}
    def test_post_conversation_happy_path(self) -> None:
        action = build_economic_action(
            ActionType.POST_CONVERSATION,
            partner_did="did:civic:alice",
            text="Hello!",
        )
        assert action.action_type == ActionType.POST_CONVERSATION
        assert action.metadata == {"partner_did": "did:civic:alice", "text": "Hello!"}

    def test_post_conversation_missing_partner_did_raises(self) -> None:
        with pytest.raises(ValueError):
            build_economic_action(ActionType.POST_CONVERSATION, text="Hello!")

    def test_post_conversation_missing_text_raises(self) -> None:
        with pytest.raises(ValueError):
            build_economic_action(
                ActionType.POST_CONVERSATION, partner_did="did:civic:alice"
            )

    # Non-economic verb raises
    def test_non_economic_verb_raises(self) -> None:
        with pytest.raises(ValueError):
            build_economic_action(ActionType.SPEAK, text="hello")

    def test_civic_land_verb_raises(self) -> None:
        with pytest.raises(ValueError):
            build_economic_action(ActionType.BUY_PARCEL, zone="res", max_price=1)


# ── 3. Wire route table maps each verb to the correct endpoint ─────────────


class TestEconomicRoutes:
    def test_all_four_verbs_in_route_table(self) -> None:
        for verb in (
            ActionType.PAY_DUE,
            ActionType.BID_RFP,
            ActionType.REQUEST_APPROVAL,
            ActionType.POST_CONVERSATION,
        ):
            assert verb in ECONOMIC_ROUTES, f"{verb!r} missing from ECONOMIC_ROUTES"

    def test_pay_due_route_template(self) -> None:
        method, template = ECONOMIC_ROUTES[ActionType.PAY_DUE]
        assert method == "POST"
        assert template == "/api/v1/civic/dues/{due_id}/pay"

    def test_bid_rfp_route_template(self) -> None:
        method, template = ECONOMIC_ROUTES[ActionType.BID_RFP]
        assert method == "POST"
        assert template == "/api/v1/procurement/notices/{notice_id}/bids"

    def test_request_approval_route_template(self) -> None:
        method, template = ECONOMIC_ROUTES[ActionType.REQUEST_APPROVAL]
        assert method == "POST"
        assert template == "/api/v1/civic/approvals"

    def test_post_conversation_route_template(self) -> None:
        method, template = ECONOMIC_ROUTES[ActionType.POST_CONVERSATION]
        assert method == "POST"
        assert template == "/api/v1/civic/conversation/{partner_did}/messages"

    # economic_route() resolves path-param substitution from metadata
    def test_pay_due_route_resolved(self) -> None:
        method, path = economic_route(
            ActionType.PAY_DUE, due_id="d99", method="labor"
        )
        assert method == "POST"
        assert path == "/api/v1/civic/dues/d99/pay"

    def test_bid_rfp_route_resolved(self) -> None:
        method, path = economic_route(
            ActionType.BID_RFP, notice_id="n42", price_wei=100, artifact_spec="s"
        )
        assert method == "POST"
        assert path == "/api/v1/procurement/notices/n42/bids"

    def test_request_approval_route_no_path_params(self) -> None:
        method, path = economic_route(
            ActionType.REQUEST_APPROVAL,
            human_did="did:civic:henry",
            kind="purchase",
            summary="s",
            payload={},
            deadline_tick=1,
        )
        assert method == "POST"
        assert path == "/api/v1/civic/approvals"

    def test_post_conversation_route_resolved(self) -> None:
        method, path = economic_route(
            ActionType.POST_CONVERSATION,
            partner_did="did:civic:alice",
            text="Hi",
        )
        assert method == "POST"
        assert path == "/api/v1/civic/conversation/did:civic:alice/messages"

    def test_non_economic_verb_raises(self) -> None:
        with pytest.raises(ValueError):
            economic_route(ActionType.SPEAK, text="hello")

    def test_missing_path_param_raises(self) -> None:
        """economic_route must raise when a required path param is absent."""
        with pytest.raises(ValueError):
            economic_route(ActionType.PAY_DUE, method="wei")  # missing due_id
