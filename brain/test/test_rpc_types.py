"""Tests for RPC types — request, response, error, action."""

import pytest

from noesis_brain.rpc.types import (
    ActionType,
    RPCRequest,
    RPCResponse,
    RPCError,
    Action,
    ERR_PARSE,
    ERR_INVALID_REQUEST,
    ERR_METHOD_NOT_FOUND,
    ERR_INTERNAL,
    ERR_BRAIN_NOT_READY,
    ERR_LLM_UNAVAILABLE,
)


# ── ActionType ──────────────────────────────────────────────

class TestActionType:
    def test_all_values(self):
        assert ActionType.SPEAK == "speak"
        assert ActionType.DIRECT_MESSAGE == "direct_message"
        assert ActionType.MOVE == "move"
        assert ActionType.TRADE_REQUEST == "trade_request"
        assert ActionType.NOOP == "noop"

    def test_is_string_enum(self):
        assert isinstance(ActionType.SPEAK, str)
        assert ActionType.SPEAK == "speak"


# ── RPCRequest ──────────────────────────────────────────────

class TestRPCRequest:
    def test_minimal_request(self):
        req = RPCRequest(method="brain.onMessage")
        assert req.method == "brain.onMessage"
        assert req.params == {}
        assert req.id is None

    def test_full_request(self):
        req = RPCRequest(method="brain.onTick", params={"tick": 42}, id=7)
        assert req.method == "brain.onTick"
        assert req.params == {"tick": 42}
        assert req.id == 7

    def test_to_dict_with_id(self):
        req = RPCRequest(method="test", params={"a": 1}, id=1)
        d = req.to_dict()
        assert d["jsonrpc"] == "2.0"
        assert d["method"] == "test"
        assert d["params"] == {"a": 1}
        assert d["id"] == 1

    def test_to_dict_notification(self):
        req = RPCRequest(method="test")
        d = req.to_dict()
        assert d["jsonrpc"] == "2.0"
        assert d["method"] == "test"
        assert "id" not in d

    def test_to_dict_no_empty_params(self):
        req = RPCRequest(method="test")
        d = req.to_dict()
        assert "params" not in d

    def test_from_dict(self):
        data = {"jsonrpc": "2.0", "method": "brain.onMessage", "params": {"text": "hi"}, "id": 3}
        req = RPCRequest.from_dict(data)
        assert req.method == "brain.onMessage"
        assert req.params == {"text": "hi"}
        assert req.id == 3

    def test_from_dict_missing_fields(self):
        req = RPCRequest.from_dict({})
        assert req.method == ""
        assert req.params == {}
        assert req.id is None

    def test_string_id(self):
        req = RPCRequest(method="test", id="abc")
        d = req.to_dict()
        assert d["id"] == "abc"


# ── RPCError ────────────────────────────────────────────────

class TestRPCError:
    def test_basic_error(self):
        err = RPCError(code=-32600, message="Invalid request")
        assert err.code == -32600
        assert err.message == "Invalid request"
        assert err.data is None

    def test_error_with_data(self):
        err = RPCError(code=-1, message="Not ready", data={"detail": "init"})
        d = err.to_dict()
        assert d["code"] == -1
        assert d["message"] == "Not ready"
        assert d["data"] == {"detail": "init"}

    def test_error_no_data(self):
        err = RPCError(code=-32700, message="Parse error")
        d = err.to_dict()
        assert "data" not in d

    def test_error_codes(self):
        assert ERR_PARSE == -32700
        assert ERR_INVALID_REQUEST == -32600
        assert ERR_METHOD_NOT_FOUND == -32601
        assert ERR_INTERNAL == -32603
        assert ERR_BRAIN_NOT_READY == -1
        assert ERR_LLM_UNAVAILABLE == -2


# ── RPCResponse ─────────────────────────────────────────────

class TestRPCResponse:
    def test_success_response(self):
        resp = RPCResponse(id=1, result={"actions": []})
        d = resp.to_dict()
        assert d["jsonrpc"] == "2.0"
        assert d["id"] == 1
        assert d["result"] == {"actions": []}
        assert "error" not in d

    def test_error_response(self):
        err = RPCError(code=-32601, message="Method not found")
        resp = RPCResponse(id=2, error=err)
        d = resp.to_dict()
        assert d["id"] == 2
        assert d["error"]["code"] == -32601
        assert "result" not in d

    def test_null_id(self):
        resp = RPCResponse(result="ok")
        d = resp.to_dict()
        assert d["id"] is None


# ── Action ──────────────────────────────────────────────────

class TestAction:
    def test_speak_action(self):
        action = Action(
            action_type=ActionType.SPEAK,
            channel="town-square",
            text="Hello everyone!",
        )
        d = action.to_dict()
        assert d["action_type"] == "speak"
        assert d["channel"] == "town-square"
        assert d["text"] == "Hello everyone!"
        assert d["metadata"] == {}

    def test_noop_action(self):
        action = Action(action_type=ActionType.NOOP)
        d = action.to_dict()
        assert d["action_type"] == "noop"
        assert d["channel"] == ""
        assert d["text"] == ""

    def test_action_with_metadata(self):
        action = Action(
            action_type=ActionType.TRADE_REQUEST,
            channel="did:key:z6Mk...",
            text="Want to trade?",
            metadata={"amount": 50, "item": "knowledge"},
        )
        d = action.to_dict()
        assert d["metadata"]["amount"] == 50

    def test_move_action(self):
        action = Action(
            action_type=ActionType.MOVE,
            channel="marketplace",
        )
        d = action.to_dict()
        assert d["action_type"] == "move"
        assert d["channel"] == "marketplace"

    def test_direct_message_action(self):
        action = Action(
            action_type=ActionType.DIRECT_MESSAGE,
            channel="did:key:z6Mk123",
            text="Private hello",
        )
        d = action.to_dict()
        assert d["action_type"] == "direct_message"
