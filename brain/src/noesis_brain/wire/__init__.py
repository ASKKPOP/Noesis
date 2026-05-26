"""
brain/src/noesis_brain/wire — Grid wire protocol package.

Phase 38 WIRE-02: Bearer-token management + GridWireClient (HTTPS REST + WSS).
"""

from .token_manager import TokenManager, TokenRecord, WireError

__all__ = ["TokenManager", "TokenRecord", "WireError"]
