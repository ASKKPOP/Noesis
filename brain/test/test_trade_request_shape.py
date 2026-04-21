"""Contract test — Phase 5 REV-01 (D-05): trade_request actions MUST carry memoryRefs + telosHash.

This test locks the schema so any producer that forgets the new metadata keys fails a unit test
before the action ever reaches the grid (where it would bounce to trade.rejected{malformed_metadata}).

Also validates the deterministic Telos-hashing utility that the brain uses to self-attest its
currently active goal set to the Grid-side reviewer (structural check only in Phase 5 — Phase 7
TelosRegistry will upgrade to a registry-backed lookup).
"""

from __future__ import annotations

import re

from noesis_brain.rpc.types import Action, ActionType
from noesis_brain.telos.hashing import compute_active_telos_hash
from noesis_brain.telos.types import Goal, GoalStatus, GoalType


MEM_ID_PATTERN = re.compile(r"^mem:\d+$")
SHA256_HEX_64 = re.compile(r"^[a-f0-9]{64}$")


def _make_goal(
    description: str = "stay alive",
    status: GoalStatus = GoalStatus.ACTIVE,
    goal_type: GoalType = GoalType.SHORT_TERM,
) -> Goal:
    """Fixture helper — Goal dataclass has sensible defaults for priority/progress."""
    return Goal(
        description=description,
        goal_type=goal_type,
        status=status,
    )


# ─── compute_active_telos_hash ────────────────────────────────────────────────


def test_compute_active_telos_hash_returns_lowercase_64_hex() -> None:
    h = compute_active_telos_hash([_make_goal()])
    assert SHA256_HEX_64.match(h), f"expected 64-lowercase-hex, got {h!r}"


def test_compute_active_telos_hash_is_deterministic() -> None:
    goals = [_make_goal("a"), _make_goal("b")]
    assert compute_active_telos_hash(goals) == compute_active_telos_hash(goals)


def test_compute_active_telos_hash_ignores_inactive_goals() -> None:
    active_only = [_make_goal("a", GoalStatus.ACTIVE)]
    mixed = [
        _make_goal("a", GoalStatus.ACTIVE),
        _make_goal("b", GoalStatus.COMPLETED),
        _make_goal("c", GoalStatus.ABANDONED),
        _make_goal("d", GoalStatus.BLOCKED),
    ]
    assert compute_active_telos_hash(active_only) == compute_active_telos_hash(mixed)


def test_empty_goals_produces_deterministic_hash() -> None:
    h1 = compute_active_telos_hash([])
    h2 = compute_active_telos_hash([])
    assert h1 == h2
    assert SHA256_HEX_64.match(h1)


def test_different_goals_produce_different_hashes() -> None:
    """Sanity: two different active-goal sets must NOT collide."""
    h1 = compute_active_telos_hash([_make_goal("a")])
    h2 = compute_active_telos_hash([_make_goal("b")])
    assert h1 != h2


# ─── trade_request action schema contract ────────────────────────────────────


def test_trade_request_action_schema_includes_memory_refs_and_telos_hash() -> None:
    """Fixture-build a TRADE_REQUEST action and assert the new metadata shape.

    This test is the schema gate: any brain producer must populate both keys.
    """
    goals = [_make_goal()]
    metadata = {
        "counterparty": "did:noesis:beta",
        "amount": 10,
        "nonce": "nonce-1",
        "memoryRefs": ["mem:1", "mem:42"],
        "telosHash": compute_active_telos_hash(goals),
    }
    action = Action(
        action_type=ActionType.TRADE_REQUEST,
        channel="",
        text="",
        metadata=metadata,
    )
    assert "memoryRefs" in action.metadata
    assert "telosHash" in action.metadata

    refs = action.metadata["memoryRefs"]
    assert isinstance(refs, list)
    assert len(refs) >= 1
    for r in refs:
        assert MEM_ID_PATTERN.match(r), f"bad memoryRef {r!r}"

    assert SHA256_HEX_64.match(action.metadata["telosHash"])


def test_trade_request_action_to_dict_roundtrip_preserves_new_fields() -> None:
    """The Action.to_dict JSON boundary must preserve memoryRefs + telosHash verbatim."""
    metadata = {
        "counterparty": "did:noesis:beta",
        "amount": 5,
        "nonce": "nonce-rt",
        "memoryRefs": ["mem:7"],
        "telosHash": compute_active_telos_hash([_make_goal()]),
    }
    action = Action(
        action_type=ActionType.TRADE_REQUEST,
        metadata=metadata,
    )
    d = action.to_dict()
    assert d["metadata"]["memoryRefs"] == ["mem:7"]
    assert SHA256_HEX_64.match(d["metadata"]["telosHash"])
