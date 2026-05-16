"""Hypnos data types — Phase 16.

Wall-clock FORBIDDEN: no wall-clock imports allowed (see T-16-03).
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Episode:
    """A single Working Memory episode derived from MemoryStore. D-16-01."""
    content: str
    memory_type: str  # e.g. "observation", "conversation", "event"


@dataclass
class ConceptNode:
    """A node in the LTM concept graph. node_id = sha256(content)[:16].hex(). D-16-03."""
    node_id: str        # 16-hex content-hash ID
    content_hash: str   # full SHA-256 hexdigest (64 chars)
    first_seen_tick: int


@dataclass
class ConceptEdge:
    """An undirected edge in the LTM concept graph. src < dst canonical. D-16-03."""
    src: str            # node_id (16-hex)
    dst: str            # node_id (16-hex), always src < dst
    weight: float       # current Hebbian weight after SHY downscale
    last_updated_tick: int
