"""brain/test/governance/test_proposer.py

Phase 12 Wave 3 — VOTE-01 / D-12-07.

Tests for build_propose_action in noesis_brain.governance.proposer.

Cases:
  - happy path returns valid Action with correct metadata
  - raises ValueError on empty body_text
  - raises ValueError on body_text > 32 KiB
  - raises ValueError on quorum_pct out-of-range
  - raises ValueError on deadline_tick <= opened_at_tick
"""
import pytest

from noesis_brain.governance.proposer import build_propose_action
from noesis_brain.rpc.types import ActionType


def test_happy_path_returns_action():
    action = build_propose_action(
        body_text="Let us build a library.",
        deadline_tick=10,
        opened_at_tick=5,
        quorum_pct=50,
        supermajority_pct=67,
    )
    assert action.action_type == ActionType.PROPOSE
    assert action.metadata["body_text"] == "Let us build a library."
    assert action.metadata["deadline_tick"] == 10
    assert action.metadata["quorum_pct"] == 50
    assert action.metadata["supermajority_pct"] == 67
    # Governance actions have empty channel/text (Nous-internal, not spoken)
    assert action.channel == ""
    assert action.text == ""


def test_raises_on_empty_body_text():
    with pytest.raises(ValueError, match="body_text"):
        build_propose_action(
            body_text="",
            deadline_tick=10,
            opened_at_tick=5,
        )


def test_raises_on_body_text_too_large():
    big = "x" * (32 * 1024 + 1)  # 32 KiB + 1 byte
    with pytest.raises(ValueError, match="body_text"):
        build_propose_action(
            body_text=big,
            deadline_tick=10,
            opened_at_tick=5,
        )


def test_raises_on_quorum_pct_out_of_range_low():
    with pytest.raises(ValueError, match="quorum_pct"):
        build_propose_action(
            body_text="Some proposal",
            deadline_tick=10,
            opened_at_tick=5,
            quorum_pct=0,
        )


def test_raises_on_quorum_pct_out_of_range_high():
    with pytest.raises(ValueError, match="quorum_pct"):
        build_propose_action(
            body_text="Some proposal",
            deadline_tick=10,
            opened_at_tick=5,
            quorum_pct=101,
        )


def test_raises_on_deadline_tick_not_future():
    with pytest.raises(ValueError, match="deadline_tick"):
        build_propose_action(
            body_text="Some proposal",
            deadline_tick=5,
            opened_at_tick=5,  # equal — not strictly future
        )


def test_raises_on_deadline_tick_in_past():
    with pytest.raises(ValueError, match="deadline_tick"):
        build_propose_action(
            body_text="Some proposal",
            deadline_tick=4,
            opened_at_tick=5,
        )


def test_default_quorum_and_supermajority():
    """Defaults: quorum=50, supermajority=67."""
    action = build_propose_action(
        body_text="Proposal with defaults",
        deadline_tick=100,
        opened_at_tick=1,
    )
    assert action.metadata["quorum_pct"] == 50
    assert action.metadata["supermajority_pct"] == 67
