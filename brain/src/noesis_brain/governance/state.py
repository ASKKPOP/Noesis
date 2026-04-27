"""brain/src/noesis_brain/governance/state.py

Per-Nous in-memory governance state: maps proposal_id → (choice, nonce).

Phase 12 Wave 3 — VOTE-02 / VOTE-03 / D-12-07.

NOT persisted across Brain restarts in v2.2 — committed-but-unrevealed
ballots count as abstain at tally (D-12-03 pessimistic quorum), so a
Brain restart after commit is acceptable behaviour, not a bug.

Wall-clock ban: no datetime, no time.time, no random (D-12-11).
Stdlib only: dataclasses. No external imports.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CommittedBallot:
    """Immutable record of a committed (but not yet revealed) ballot.

    Frozen so that callers cannot accidentally mutate the stored entry.
    """

    choice: str
    nonce: str


class GovernanceState:
    """Per-Nous in-memory map: proposal_id → CommittedBallot.

    Entries are added on commit (remember) and removed on reveal (forget).
    Cleared only explicitly — no time-based expiry in v2.2.

    Thread-safety: single-threaded Brain process; no locking needed.
    """

    def __init__(self) -> None:
        self._ballots: dict[str, CommittedBallot] = {}

    def remember(self, proposal_id: str, choice: str, nonce: str) -> None:
        """Store (choice, nonce) for proposal_id.

        If an entry already exists for proposal_id it is overwritten
        (last-write-wins — Brain may re-commit if it forgot).
        """
        self._ballots[proposal_id] = CommittedBallot(choice=choice, nonce=nonce)

    def recall(self, proposal_id: str) -> CommittedBallot | None:
        """Return the stored CommittedBallot for proposal_id, or None."""
        return self._ballots.get(proposal_id)

    def forget(self, proposal_id: str) -> None:
        """Remove the entry for proposal_id.

        Idempotent — forgetting an unknown proposal_id is a no-op.
        """
        self._ballots.pop(proposal_id, None)

    def all_committed(self) -> dict[str, CommittedBallot]:
        """Return a shallow copy of the committed-ballots map.

        Callers must NOT mutate the returned dict.
        """
        return dict(self._ballots)
