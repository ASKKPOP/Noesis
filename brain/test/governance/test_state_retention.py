"""brain/test/governance/test_state_retention.py

Phase 12 Wave 3 — VOTE-02 / VOTE-03 / D-12-07.

Tests for GovernanceState in noesis_brain.governance.state.

Cases:
  - remember + recall round-trip
  - recall on unknown id returns None
  - forget removes entry
  - remember overwrites with new (choice, nonce) for same proposal_id (last-write-wins)
"""
import pytest

from noesis_brain.governance.state import CommittedBallot, GovernanceState


PROPOSAL_A = "proposal-aaa"
PROPOSAL_B = "proposal-bbb"


def test_remember_and_recall_round_trip():
    state = GovernanceState()
    state.remember(PROPOSAL_A, "yes", "aabbcc" * 5 + "dd")
    entry = state.recall(PROPOSAL_A)
    assert entry is not None
    assert entry.choice == "yes"
    assert entry.nonce == "aabbcc" * 5 + "dd"


def test_recall_unknown_returns_none():
    state = GovernanceState()
    assert state.recall("no-such-proposal") is None


def test_forget_removes_entry():
    state = GovernanceState()
    state.remember(PROPOSAL_A, "no", "00" * 16)
    assert state.recall(PROPOSAL_A) is not None
    state.forget(PROPOSAL_A)
    assert state.recall(PROPOSAL_A) is None


def test_forget_unknown_is_noop():
    """Forgetting a proposal that was never committed should not raise."""
    state = GovernanceState()
    state.forget("ghost-proposal")  # should not raise


def test_remember_overwrites_last_write_wins():
    """Calling remember twice for same proposal_id replaces the entry."""
    state = GovernanceState()
    state.remember(PROPOSAL_A, "yes", "11" * 16)
    state.remember(PROPOSAL_A, "no", "22" * 16)
    entry = state.recall(PROPOSAL_A)
    assert entry is not None
    assert entry.choice == "no"
    assert entry.nonce == "22" * 16


def test_multiple_proposals_are_independent():
    state = GovernanceState()
    state.remember(PROPOSAL_A, "yes", "aa" * 16)
    state.remember(PROPOSAL_B, "no", "bb" * 16)

    ea = state.recall(PROPOSAL_A)
    eb = state.recall(PROPOSAL_B)
    assert ea is not None and ea.choice == "yes"
    assert eb is not None and eb.choice == "no"

    state.forget(PROPOSAL_A)
    assert state.recall(PROPOSAL_A) is None
    assert state.recall(PROPOSAL_B) is not None


def test_all_committed_returns_all_entries():
    state = GovernanceState()
    state.remember(PROPOSAL_A, "yes", "aa" * 16)
    state.remember(PROPOSAL_B, "abstain", "bb" * 16)

    all_entries = state.all_committed()
    assert PROPOSAL_A in all_entries
    assert PROPOSAL_B in all_entries
    assert all_entries[PROPOSAL_A].choice == "yes"
    assert all_entries[PROPOSAL_B].choice == "abstain"


def test_committed_ballot_is_dataclass():
    """CommittedBallot fields are accessible."""
    ballot = CommittedBallot(choice="yes", nonce="00" * 16)
    assert ballot.choice == "yes"
    assert ballot.nonce == "00" * 16
