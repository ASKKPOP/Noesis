"""brain/src/noesis_brain/governance/voter.py

Brain-side governance voter — builds VOTE_COMMIT and VOTE_REVEAL Actions.

Phase 12 Wave 3 — VOTE-02 / VOTE-03 / D-12-07.

Workflow (D-12-02):
  1. Commit phase: Brain calls build_commit_action().
     - Generates a cryptographic nonce (secrets.token_hex).
     - Computes commit_hash = sha256(choice|nonce|voter_did).
     - Stores (choice, nonce) in GovernanceState.remember().
     - Returns VOTE_COMMIT Action with {proposal_id, commit_hash}.

  2. Reveal phase: Brain calls build_reveal_action().
     - Retrieves (choice, nonce) from GovernanceState.recall().
     - Returns VOTE_REVEAL Action with {proposal_id, choice, nonce}.
     - Calls GovernanceState.forget() AFTER building the action.

The Grid NousRunner dispatches each Action to its sole-producer emitter:
  VOTE_COMMIT → appendBallotCommitted (injects voter_did, committed_at_tick)
  VOTE_REVEAL → appendBallotRevealed  (injects voter_did, revealed_at_tick)

evaluate_choice is a v2.2 placeholder — v2.3 will replace it with
telos-driven LLM evaluation (D-12-07 / deferred to v2.3).

Wall-clock ban: no datetime, no time.time, no random (D-12-11).
Cryptographic nonce via secrets.token_hex only.
"""
from __future__ import annotations

from noesis_brain.governance.commit_reveal import (
    CHOICE_VALUES,
    compute_commit_hash,
    generate_nonce,
)
from noesis_brain.governance.state import GovernanceState
from noesis_brain.rpc.types import Action, ActionType


class NoCommittedBallotError(Exception):
    """Raised by build_reveal_action when no committed ballot exists for proposal_id."""

    def __init__(self, proposal_id: str) -> None:
        super().__init__(f"voter: no committed ballot found for proposal_id={proposal_id!r}")
        self.proposal_id = proposal_id


def build_commit_action(
    proposal_id: str,
    choice: str,
    voter_did: str,
    state: GovernanceState,
) -> Action:
    """Build a VOTE_COMMIT Action; persist (choice, nonce) to GovernanceState.

    Generates a cryptographic nonce, computes commit_hash, stores the entry
    in GovernanceState.remember(), then returns the Action. The grid-side
    emitter (appendBallotCommitted) will inject voter_did and tick; we only
    provide proposal_id and commit_hash in metadata.

    Args:
        proposal_id: The proposal to vote on.
        choice: Ballot choice — must be one of ('yes', 'no', 'abstain').
        voter_did: The voting Nous's DID (used in hash formula).
        state: Per-Nous GovernanceState (mutable — remember() called here).

    Returns:
        Action(action_type=VOTE_COMMIT, metadata={'proposal_id', 'commit_hash'}).

    Raises:
        ValueError: if choice is not in {'yes', 'no', 'abstain'}.
    """
    if choice not in CHOICE_VALUES:
        raise ValueError(
            f"voter: choice must be one of {CHOICE_VALUES!r}, got {choice!r}"
        )

    nonce = generate_nonce()
    commit_hash = compute_commit_hash(choice, nonce, voter_did)  # type: ignore[arg-type]

    # Persist BEFORE returning — state must survive even if caller drops the Action.
    state.remember(proposal_id, choice, nonce)

    return Action(
        action_type=ActionType.VOTE_COMMIT,
        channel="",
        text="",
        metadata={
            "proposal_id": proposal_id,
            "commit_hash": commit_hash,
        },
    )


def build_reveal_action(
    proposal_id: str,
    voter_did: str,
    state: GovernanceState,
) -> Action:
    """Build a VOTE_REVEAL Action from the committed entry in GovernanceState.

    Retrieves (choice, nonce) from state.recall(), builds the Action, then
    calls state.forget() to remove the entry. If no committed entry exists,
    raises NoCommittedBallotError.

    Args:
        proposal_id: The proposal being revealed.
        voter_did: The voting Nous's DID (not forwarded in metadata — Grid injects).
        state: Per-Nous GovernanceState (mutable — forget() called after build).

    Returns:
        Action(action_type=VOTE_REVEAL, metadata={'proposal_id', 'choice', 'nonce'}).

    Raises:
        NoCommittedBallotError: if no committed ballot entry exists for proposal_id.
    """
    entry = state.recall(proposal_id)
    if entry is None:
        raise NoCommittedBallotError(proposal_id)

    action = Action(
        action_type=ActionType.VOTE_REVEAL,
        channel="",
        text="",
        metadata={
            "proposal_id": proposal_id,
            "choice": entry.choice,
            "nonce": entry.nonce,
        },
    )

    # Forget AFTER building — ensures action has the correct values even if
    # forget() were to raise (it shouldn't, but defensive ordering).
    state.forget(proposal_id)

    return action


def evaluate_choice(proposal_body: str, telos: object | None = None) -> str:
    """Telos-driven yes/no/abstain decision.

    TODO(v2.3): Replace this placeholder with LLM-driven telos evaluation.
    See: D-12-07 "v2.3 telos-LLM eval (deferred)".

    v2.2 PLACEHOLDER — deterministic hash-of-body mapping:
      hash(proposal_body) % 3  →  0='yes', 1='no', 2='abstain'

    This is intentionally NOT random — determinism allows test assertions.
    The mapping has no semantic meaning; it is purely structural scaffolding
    for the PROPOSE/VOTE flow until the real LLM evaluation lands in v2.3.

    DO NOT rely on this mapping for any production governance outcome.
    Brain processes using this function will appear to vote in a fixed
    pattern until v2.3 upgrades the decision logic.

    Args:
        proposal_body: Full text of the proposal (not sent to any external service
            in this placeholder implementation).
        telos: Unused in v2.2 — accepted for forward-compatibility with v2.3
            signature (telos will drive keyword matching + LLM prompt).

    Returns:
        One of 'yes', 'no', 'abstain'.
    """
    choices = ["yes", "no", "abstain"]
    idx = hash(proposal_body) % 3
    return choices[idx]
