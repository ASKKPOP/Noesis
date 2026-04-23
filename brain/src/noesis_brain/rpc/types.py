"""RPC types — request/response/action definitions."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ActionType(str, Enum):
    """Actions the brain can tell the protocol layer to execute."""

    SPEAK = "speak"  # Send message to Agora channel
    DIRECT_MESSAGE = "direct_message"  # Send DM to specific Nous
    MOVE = "move"  # Move to a different region
    TRADE_REQUEST = "trade_request"  # Send trade offer
    TELOS_REFINED = "telos_refined"  # Phase 7 DIALOG-02 — Nous-initiated refinement after peer dialogue
    DRIVE_CROSSED = "drive_crossed"  # Phase 10a DRIVE-03 — Ananke threshold crossing; Grid dispatcher converts to ananke.drive_crossed audit event. Metadata shape: {drive, level, direction} (3 keys; Grid injects did and tick).
    BIOS_DEATH = "bios_death"  # Phase 10b BIOS-04 — starvation death signal; Grid plan 10b-05 emits bios.death audit event. Metadata shape: {cause, final_state_hash} (Grid injects did and tick).
    NOOP = "noop"  # Do nothing this cycle


# JSON-RPC error codes
ERR_PARSE = -32700
ERR_INVALID_REQUEST = -32600
ERR_METHOD_NOT_FOUND = -32601
ERR_INVALID_PARAMS = -32602
ERR_INTERNAL = -32603
ERR_BRAIN_NOT_READY = -1
ERR_LLM_UNAVAILABLE = -2


@dataclass
class RPCRequest:
    """JSON-RPC 2.0 request."""

    method: str
    params: dict[str, Any] = field(default_factory=dict)
    id: int | str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"jsonrpc": "2.0", "method": self.method}
        if self.params:
            d["params"] = self.params
        if self.id is not None:
            d["id"] = self.id
        return d

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RPCRequest:
        return cls(
            method=data.get("method", ""),
            params=data.get("params", {}),
            id=data.get("id"),
        )


@dataclass
class RPCError:
    """JSON-RPC 2.0 error."""

    code: int
    message: str
    data: Any = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"code": self.code, "message": self.message}
        if self.data is not None:
            d["data"] = self.data
        return d


@dataclass
class RPCResponse:
    """JSON-RPC 2.0 response."""

    id: int | str | None = None
    result: Any = None
    error: RPCError | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"jsonrpc": "2.0", "id": self.id}
        if self.error:
            d["error"] = self.error.to_dict()
        else:
            d["result"] = self.result
        return d


@dataclass
class Action:
    """An action produced by the brain for the protocol layer to execute."""

    action_type: ActionType
    channel: str = ""  # Agora channel or target DID
    text: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "action_type": self.action_type.value,
            "channel": self.channel,
            "text": self.text,
            "metadata": self.metadata,
        }
