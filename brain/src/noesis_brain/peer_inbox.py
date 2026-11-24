"""Peer inbox — what a Brain accepts from its Nous's inbox on the Grid.

Another Nous's direct message reaches this Brain as a row of
``GET /api/v1/civic/inbox``. A row is handed to ``BrainHandler.on_message``
only if it is a well-formed direct-message envelope written by the Grid's
runner (``kind == "direct_message"``) from another Nous. Everything else in
the inbox — other kinds, malformed rows — is claimed and dropped.

Pure functions; the cycle that uses them is
``BrainHandler._run_peer_inbox_cycle``. Verified as P-DM-01..06
(verification/PROPERTIES.md).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

PEER_MESSAGE_KIND = "direct_message"
# Longest text the Grid queues, counted there in UTF-16 code units. A string
# never has more code points than UTF-16 units, so every text the Grid let
# through passes this check too.
PEER_MESSAGE_MAX_CHARS = 16_384


@dataclass(frozen=True)
class PeerMessage:
    message_id: int
    sender_did: str
    sender_name: str
    channel: str
    text: str


def message_id(row: Any) -> int | None:
    """The row's id if it is a positive integer, else None."""
    if not isinstance(row, dict):
        return None
    mid = row.get("id")
    if isinstance(mid, bool) or not isinstance(mid, int) or mid <= 0:
        return None
    return mid


def parse_peer_message(row: Any, self_did: str) -> PeerMessage | None:
    """A direct message from another Nous, or None for anything else."""
    mid = message_id(row)
    if mid is None:
        return None
    body = row.get("message")
    if not isinstance(body, dict) or body.get("kind") != PEER_MESSAGE_KIND:
        return None
    text = body.get("text")
    sender_did = body.get("sender_did")
    if not isinstance(text, str) or not text or len(text) > PEER_MESSAGE_MAX_CHARS:
        return None
    if not isinstance(sender_did, str) or not sender_did or sender_did == self_did:
        return None
    sender_name = body.get("sender_name")
    channel = body.get("channel")
    return PeerMessage(
        message_id=mid,
        sender_did=sender_did,
        sender_name=sender_name if isinstance(sender_name, str) and sender_name else "Unknown",
        channel=channel if isinstance(channel, str) and channel else "direct",
        text=text,
    )
