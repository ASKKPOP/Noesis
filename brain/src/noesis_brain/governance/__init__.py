"""Governance — Nous collective commit-reveal voting subsystem.

Phase 12 (VOTE-01..06 / D-12-01..11 / CONTEXT-12).

Wave 0 exports ONLY the type mirror and forbidden-key constants.
Commit-reveal crypto (commit_hash), voter actions (PROPOSE, VOTE_COMMIT,
VOTE_REVEAL), and proposer logic join in Wave 1/3 respectively.

Wall-clock contract:
    NO datetime, NO time.time, NO random — all governance timing derives
    from the Grid system tick only. D-12-11.
    Wall-clock ban enforced by scripts/check-wallclock-forbidden.mjs
    (TIER_A_ROOTS includes brain/src/noesis_brain/governance).

Operator exclusion invariant (VOTE-05 / D-12-11):
    Operators cannot vote, propose, or tally at ANY tier including H5.
    Brain governance module NEVER imports from any operator code path.
    CI gate scripts/check-governance-isolation.mjs enforces the boundary.

Sole-producer invariant:
    'proposal.opened', 'ballot.committed', 'ballot.revealed',
    'proposal.tallied' audit events are emitted ONLY by
    grid/src/governance/append*.ts files (Grid side, Wave 2).
    Brain never calls audit.append directly — it emits PROPOSE /
    VOTE_COMMIT / VOTE_REVEAL actions that the Grid router processes.
    D-12-01.
"""

from noesis_brain.governance.types import (
    ProposalOpenedPayload,
    PROPOSAL_OPENED_KEYS,
    BallotCommittedPayload,
    BALLOT_COMMITTED_KEYS,
    BallotRevealedPayload,
    BALLOT_REVEALED_KEYS,
    BallotChoice,
    ProposalTalliedPayload,
    PROPOSAL_TALLIED_KEYS,
    ProposalOutcome,
    GOVERNANCE_FORBIDDEN_KEYS,
)
from noesis_brain.governance.commit_reveal import (
    compute_commit_hash,
    verify_reveal,
    generate_nonce,
)

__all__ = [
    "ProposalOpenedPayload",
    "PROPOSAL_OPENED_KEYS",
    "BallotCommittedPayload",
    "BALLOT_COMMITTED_KEYS",
    "BallotRevealedPayload",
    "BALLOT_REVEALED_KEYS",
    "BallotChoice",
    "ProposalTalliedPayload",
    "PROPOSAL_TALLIED_KEYS",
    "ProposalOutcome",
    "GOVERNANCE_FORBIDDEN_KEYS",
    "compute_commit_hash",
    "verify_reveal",
    "generate_nonce",
]
