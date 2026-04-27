"""brain/src/noesis_brain/governance/proposer.py

Brain-side governance proposer — builds a PROPOSE Action for the Grid.

Phase 12 Wave 3 — VOTE-01 / D-12-07.

The Grid NousRunner (nous-runner.ts case 'propose') receives the Action,
extracts metadata, injects proposer_did=this.nousDid and currentTick=tick,
then calls appendProposalOpened() directly (in-process, no HTTP hop).

This module's responsibility:
  - Validate inputs before emitting (fail-fast, no RPC made on bad input).
  - Return a typed Action with action_type=PROPOSE.
  - DO NOT call Grid HTTP endpoints — actions are emitted through the protocol.
  - DO NOT use datetime / time.time / random (D-12-11 wall-clock ban).

Stdlib only: no external imports beyond noesis_brain.rpc.types.
"""
from __future__ import annotations

from noesis_brain.rpc.types import Action, ActionType

# Body text size limit (32 KiB) matches Grid appendProposalOpened validation.
_MAX_BODY_BYTES = 32 * 1024

# Default quorum / supermajority percentages (match GOVERNANCE_CONFIG in Grid).
_DEFAULT_QUORUM_PCT = 50
_DEFAULT_SUPERMAJORITY_PCT = 67


def build_propose_action(
    body_text: str,
    deadline_tick: int,
    opened_at_tick: int,
    quorum_pct: int = _DEFAULT_QUORUM_PCT,
    supermajority_pct: int = _DEFAULT_SUPERMAJORITY_PCT,
) -> Action:
    """Build a PROPOSE Action for submission to the Grid.

    Args:
        body_text: Full proposal text (stored server-side only, never in audit
            payload — the Grid emitter computes title_hash from this). Must be
            non-empty and <= 32 KiB (utf-8 encoded).
        deadline_tick: The tick at which voting closes. Must be strictly greater
            than opened_at_tick (future-tick invariant, D-12-03).
        opened_at_tick: The current tick at proposal time. Grid injects its own
            tick into appendProposalOpened, so this is used only for validation
            here — it is NOT forwarded in the Action metadata.
        quorum_pct: Required participation percentage (1–100, default 50).
        supermajority_pct: Required yes-vote ratio among decisive votes (1–100,
            default 67).

    Returns:
        Action(action_type=PROPOSE, channel='', text='',
               metadata={'body_text', 'deadline_tick', 'quorum_pct',
                         'supermajority_pct'}).

    Raises:
        ValueError: if body_text is empty or > 32 KiB, quorum_pct or
            supermajority_pct are out of [1, 100], or deadline_tick is not
            strictly greater than opened_at_tick.
    """
    # Validate body_text
    if not isinstance(body_text, str) or len(body_text.strip()) == 0:
        raise ValueError("proposer: body_text must be a non-empty string")
    if len(body_text.encode("utf-8")) > _MAX_BODY_BYTES:
        raise ValueError(
            f"proposer: body_text exceeds {_MAX_BODY_BYTES}-byte limit "
            f"({len(body_text.encode('utf-8'))} bytes)"
        )

    # Validate percentages
    if not isinstance(quorum_pct, int) or not (1 <= quorum_pct <= 100):
        raise ValueError(
            f"proposer: quorum_pct must be an integer in [1, 100], got {quorum_pct!r}"
        )
    if not isinstance(supermajority_pct, int) or not (1 <= supermajority_pct <= 100):
        raise ValueError(
            f"proposer: supermajority_pct must be an integer in [1, 100], got {supermajority_pct!r}"
        )

    # Validate deadline_tick is strictly in the future
    if not isinstance(deadline_tick, int) or deadline_tick <= opened_at_tick:
        raise ValueError(
            f"proposer: deadline_tick ({deadline_tick}) must be strictly greater than "
            f"opened_at_tick ({opened_at_tick})"
        )

    return Action(
        action_type=ActionType.PROPOSE,
        channel="",
        text="",
        metadata={
            "body_text": body_text,
            "deadline_tick": deadline_tick,
            "quorum_pct": quorum_pct,
            "supermajority_pct": supermajority_pct,
        },
    )
