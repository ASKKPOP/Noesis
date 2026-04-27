"""brain/test/governance/test_voter_commit.py

Phase 12 Wave 3 — VOTE-02 / D-12-07.

Tests for build_commit_action in noesis_brain.governance.voter.

Cases:
  - happy path returns Action with valid commit_hash matching compute_commit_hash
  - state.recall returns the committed (choice, nonce) entry after build
  - raises ValueError on invalid choice

Cross-language fixture parity (D-12-02):
  The canonical fixture ('yes', '00...0', 'did:noesis:alice') produces the same
  sha256 hex as grid/test/governance/governance-commit-hash.test.ts.
"""
import pytest

from noesis_brain.governance.commit_reveal import compute_commit_hash
from noesis_brain.governance.state import GovernanceState
from noesis_brain.governance.voter import build_commit_action
from noesis_brain.rpc.types import ActionType

ALICE = "did:noesis:alice"
CANONICAL_NONCE = "00000000000000000000000000000000"
# Must match grid/test/governance/governance-commit-hash.test.ts
CANONICAL_HASH = "0cf5f7c6716a14ead21fea90c208612472843151494e341a90cc15017cb3e0f2"
PROPOSAL_ID = "test-proposal-001"


def make_state() -> GovernanceState:
    return GovernanceState()


def test_happy_path_returns_commit_action():
    state = make_state()
    action = build_commit_action(
        proposal_id=PROPOSAL_ID,
        choice="yes",
        voter_did=ALICE,
        state=state,
    )
    assert action.action_type == ActionType.VOTE_COMMIT
    assert action.metadata["proposal_id"] == PROPOSAL_ID
    # commit_hash must be a 64-char hex string
    commit_hash = action.metadata["commit_hash"]
    assert isinstance(commit_hash, str)
    assert len(commit_hash) == 64
    assert commit_hash == commit_hash.lower()
    # Verify hash matches compute_commit_hash with the stored nonce
    entry = state.recall(PROPOSAL_ID)
    assert entry is not None
    expected = compute_commit_hash("yes", entry.nonce, ALICE)
    assert commit_hash == expected


def test_state_recall_returns_committed_entry():
    state = make_state()
    build_commit_action(
        proposal_id=PROPOSAL_ID,
        choice="no",
        voter_did=ALICE,
        state=state,
    )
    entry = state.recall(PROPOSAL_ID)
    assert entry is not None
    assert entry.choice == "no"
    assert len(entry.nonce) == 32  # 32 hex chars


def test_cross_language_fixture_parity():
    """Inject a fixed nonce to verify cross-language parity (D-12-02).

    The canonical test vector is:
      choice='yes', nonce='00...0', voter_did='did:noesis:alice'
      expected_hash = '0cf5f7c6716a14ead21fea90c208612472843151494e341a90cc15017cb3e0f2'

    This is the SAME hex literal used in:
      grid/test/governance/governance-commit-hash.test.ts (TypeScript side)
    """
    # We can't inject a nonce into build_commit_action (it calls generate_nonce internally).
    # Instead, verify that compute_commit_hash with the canonical inputs matches the expected value.
    # build_commit_action will produce a DIFFERENT hash (random nonce) but the formula is the same.
    actual = compute_commit_hash("yes", CANONICAL_NONCE, ALICE)
    assert actual == CANONICAL_HASH, (
        f"Cross-language parity FAILED: expected {CANONICAL_HASH!r}, got {actual!r}. "
        "This must match grid/test/governance/governance-commit-hash.test.ts."
    )


def test_raises_on_invalid_choice():
    state = make_state()
    with pytest.raises(ValueError, match="choice"):
        build_commit_action(
            proposal_id=PROPOSAL_ID,
            choice="maybe",  # type: ignore[arg-type]
            voter_did=ALICE,
            state=state,
        )


def test_channel_and_text_are_empty():
    """Governance actions are Nous-internal — not spoken utterances."""
    state = make_state()
    action = build_commit_action(PROPOSAL_ID, "abstain", ALICE, state)
    assert action.channel == ""
    assert action.text == ""
