"""
brain/src/noesis_brain/wire — Grid wire protocol package.

Phase 38 WIRE-02: Bearer-token management + GridWireClient (HTTPS REST + WSS).
Phase 38 WIRE-03/WIRE-04: WireQueue (SQLite offline buffer) + derive_idempotency_key.
Phase 38 WIRE-01 (WSS) + WIRE-05: WssSubscriber (auto-reconnect firehose client).
"""

from .token_manager import TokenManager, TokenRecord, WireError
from .client import GridWireClient, validate_grid_url
from .queue import WireQueue, QueuedEvent, derive_idempotency_key, QUEUE_CAPACITY
from .subscriber import WssSubscriber

__all__ = [
    "TokenManager",
    "TokenRecord",
    "WireError",
    "GridWireClient",
    "validate_grid_url",
    "WireQueue",
    "QueuedEvent",
    "derive_idempotency_key",
    "QUEUE_CAPACITY",
    "WssSubscriber",
]
