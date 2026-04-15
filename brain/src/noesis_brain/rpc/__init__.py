"""JSON-RPC bridge — connects Python brain to TypeScript protocol layer."""

from noesis_brain.rpc.types import RPCRequest, RPCResponse, RPCError, Action, ActionType
from noesis_brain.rpc.server import RPCServer
from noesis_brain.rpc.handler import BrainHandler

__all__ = [
    "RPCRequest",
    "RPCResponse",
    "RPCError",
    "Action",
    "ActionType",
    "RPCServer",
    "BrainHandler",
]
