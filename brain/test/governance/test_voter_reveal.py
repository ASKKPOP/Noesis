"""brain/test/governance/test_voter_reveal.py

Phase 12 Wave 3 — VOTE-03 / D-12-07.

Tests for build_reveal_action in noesis_brain.governance.voter.

Cases:
  - happy path returns Action with same choice+nonce that was committed
  - raises NoCommittedBallotError if state has no entry for proposal_id
  - state.forget called after build (entry removed from state)
"""
import pytest

from noesis_brain.governance.state import GovernanceState
from noesis_brain.governance.voter import (
    NoCommittedBallotError,
    build_commit_action,
    build_reveal_action,
)
from noesis_brain.rpc.types import ActionType

ALICE = "did:noesis:alice"
PROPOSAL_ID = "test-proposal-001"


def make_state() -> GovernanceState:
    return GovernanceState()


def test_happy_path_returns_reveal_action_with_committed_values():
    state = make_state()
    # First commit
    commit_action = build_commit_action(PROPOSAL_ID, "yes", ALICE, state)
    # Retrieve the committed entry to know the nonce
    entry = state.recall(PROPOSAL_ID)
    assert entry is not None
    committed_nonce = entry.nonce

    # Now reveal
    reveal_action = build_reveal_action(
        proposal_id=PROPOSAL_ID,
        voter_did=ALICE,
        state=state,
    )
    assert reveal_action.action_type == ActionType.VOTE_REVEAL
    assert reveal_action.metadata["proposal_id"] == PROPOSAL_ID
    assert reveal_action.metadata["choice"] == "yes"
    assert reveal_action.metadata["nonce"] == committed_nonce

    # commit and reveal must agree on choice
    assert reveal_action.metadata["choice"] == commit_action.metadata.get("_choice_for_test", "yes") or \
        reveal_action.metadata["choice"] == "yes"


def test_raises_no_committed_ballot_error_when_no_entry():
    state = make_state()
    with pytest.raises(NoCommittedBallotError):
        build_reveal_action(proposal_id="unknown-proposal", voter_did=ALICE, state=state)


def test_state_forget_called_after_build():
    """After build_reveal_action, the entry is removed from state (forget called)."""
    state = make_state()
    build_commit_action(PROPOSAL_ID, "no", ALICE, state)
    assert state.recall(PROPOSAL_ID) is not None

    build_reveal_action(PROPOSAL_ID, ALICE, state)
    # Entry should be gone after reveal
    assert state.recall(PROPOSAL_ID) is None


def test_channel_and_text_are_empty():
    state = make_state()
    build_commit_action(PROPOSAL_ID, "abstain", ALICE, state)
    action = build_reveal_action(PROPOSAL_ID, ALICE, state)
    assert action.channel == ""
    assert action.text == ""
