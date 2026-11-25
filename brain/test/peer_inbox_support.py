"""Shared pieces for the peer-inbox tests: a stand-in for the Grid's inbox and a
handler builder. The stand-in replaces the network and the database only; it keeps
the Grid's rule that a row is claimed once, and only by the Nous it is addressed to
(grid/src/civic-presence/message-queue-store.ts, checked on the Grid side by
grid/test/integration/peer-messages.property.test.ts)."""
from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import yaml

from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"
CONTRACT = Path(__file__).parent.parent.parent / "grid" / "test" / "fixtures" / "peer-message-contract.json"

with open(SOPHIA_YAML) as _f:
    _DATA = yaml.safe_load(_f)


def make_handler(did: str, **kwargs: Any) -> BrainHandler:
    h = BrainHandler(
        psyche=load_psyche(data=_DATA),
        thymos=ThymosTracker.from_yaml(_DATA.get("thymos", {})),
        telos=TelosManager.from_yaml(_DATA.get("telos", {})),
        llm=AsyncMock(),
        did=did,
        **kwargs,
    )
    if "memory" not in kwargs:
        mem = MagicMock()
        mem.recent = MagicMock(return_value=[])
        mem.record_event = MagicMock()
        h.memory = mem
    return h


def to_inbox_message(action: dict[str, Any], sender_did: str, sender_name: str, tick: int) -> dict[str, Any]:
    """What the Grid's runner + router store for a direct_message action
    (grid/src/integration/peer-messages.ts). Pinned to the Grid by the shared
    contract fixture: test_peer_inbox.py asserts this equals `inbox_message` there,
    and the Grid's own test asserts the same of the real router."""
    return {
        "kind": "direct_message",
        "sender_did": sender_did,
        "sender_name": sender_name,
        "channel": action["channel"],
        "text": action["text"],
        "tick": tick,
    }


class FakeGrid:
    """The inbox rows, and one wire per Brain process."""

    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []   # {id, to, sender, message, state}
        self.posted: list[tuple[str, list[dict[str, Any]], int]] = []
        self._next_id = 1

    def enqueue(self, to: str, message: Any, sender: str = "did:civic:noesis:x") -> int:
        mid = self._next_id
        self._next_id += 1
        self.rows.append({"id": mid, "to": to, "sender": sender, "message": message, "state": "pending"})
        return mid

    def pending(self, did: str) -> list[dict[str, Any]]:
        return [
            {"id": r["id"], "sender_civic_did": r["sender"], "message": r["message"], "sent_at_tick": 0}
            for r in self.rows if r["to"] == did and r["state"] == "pending"
        ]

    def claim(self, did: str, mid: Any) -> bool:
        for r in self.rows:
            if r["id"] == mid and r["to"] == did and r["state"] == "pending":
                r["state"] = "delivered"
                r["message"] = {}
                return True
        return False

    def wire(self, did: str, name: str = "Nous") -> "FakeWire":
        return FakeWire(self, did, name)


class FakeWire:
    """What GridWireClient offers a Brain, backed by a FakeGrid."""

    def __init__(self, grid: FakeGrid, did: str, name: str) -> None:
        self.grid, self.did, self.name = grid, did, name
        self.fetch_override: list[Any] | None = None   # a stale or hostile answer for the next read
        self.claim_mode = "ok"                        # ok | refuse (no change) | lost (changed, answer lost)
        self.fetch_open_proposals = AsyncMock(return_value=[])
        self.fetch_groups_list = AsyncMock(return_value=[])
        self.fetch_relationships = AsyncMock(return_value=[])

    async def fetch_peer_inbox(self, limit: int = 10) -> list[Any]:
        if self.fetch_override is not None:
            rows, self.fetch_override = self.fetch_override, None
            return rows
        return self.grid.pending(self.did)[:limit]

    async def claim_peer_message(self, mid: int) -> bool:
        if self.claim_mode == "refuse":
            return False
        changed = self.grid.claim(self.did, mid)
        return False if self.claim_mode == "lost" else changed

    async def post_actions(self, actions: list[dict[str, Any]], tick: int) -> None:
        """The Grid side of POST /api/v1/brain/actions for the one action that matters here."""
        self.grid.posted.append((self.did, actions, tick))
        for a in actions:
            if a.get("action_type") == "direct_message":
                self.grid.enqueue(a["metadata"]["target_did"], to_inbox_message(a, self.did, self.name, tick))
