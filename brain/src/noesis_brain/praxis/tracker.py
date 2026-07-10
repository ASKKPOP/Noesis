"""Praxis tracker — the Nous's in-world action faculty (the output edge).

Formalizes *acting on the world*: it knows the Nous's in-world action repertoire
(the Grid-forwarded verbs that change or address the world), validates a proposed
action's shape against that repertoire, and journals the deeds the Nous actually
took — a private record of what it *did*, distinct from what it thought.

Pure observation: `observe` never mutates the action list it is given and never
emits Grid events (mirrors the handler's advisory divergence logger). Deterministic
— no wall-clock, no randomness; all time flows in as the tick.

`OUTWARD_VERBS` is a curated subset of `rpc.types.ActionType` — the acts/utterances
that address the world. Reads (`list_parcels`, `view_interior`) and Brain-internal
cognition (`noop`, `drive_crossed`, `skill_learn`, `sleep_*`, `iris_*`, `lore_discover`
…) are deliberately excluded: they are not deeds. Extending this set is an explicit
choice, kept in step with the ActionType enum.
"""

from __future__ import annotations

from collections import deque
from typing import Any

from noesis_brain.praxis.types import Deed, Outcome

# In-world deeds — acts/utterances the Nous directs at the world (Grid-forwarded).
OUTWARD_VERBS: frozenset[str] = frozenset(
    {
        # communicate
        "speak", "direct_message", "set_visibility",
        # move / presence
        "move", "visit", "leave",
        # economy / commerce
        "trade_request", "buy_parcel", "bind_shop", "post_task", "claim_task", "complete_task",
        # govern
        "propose", "vote_commit", "vote_reveal",
        # associate / roles
        "join_group", "leave_group", "invite", "grant_role", "revoke_role", "set_entry_policy",
        # build / place
        "build", "extend_interior", "name_place", "build_from_blueprint", "co_build",
        # knowledge acts on the commons
        "learn_blueprint", "teach_here", "lore_contribute", "lore_cited", "tool_used",
    }
)

# Minimal required-metadata contract for well-known verbs (from the ActionType
# docstrings). Verbs absent here are free-form (no required keys). Advisory only —
# praxis records the outcome, it never drops the real action.
REQUIRED_KEYS: dict[str, tuple[str, ...]] = {
    "vote_commit": ("proposal_id", "commit_hash"),
    "vote_reveal": ("proposal_id", "choice", "nonce"),
    "propose": ("body_text",),
    "join_group": ("group_id",),
    "leave_group": ("group_id",),
    "buy_parcel": ("zone",),
    "build": ("parcel", "type"),
    "grant_role": ("parcel", "nous", "role"),
    "revoke_role": ("parcel", "nous"),
    "post_task": ("parcel", "task"),
    "bind_shop": ("parcel", "shop"),
    "name_place": ("parcel", "name"),
    "lore_contribute": ("content_hash", "category_tag"),
    "lore_cited": ("content_hash",),
}


class PraxisTracker:
    """Tracks the Nous's in-world action repertoire and the deeds it takes."""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        config = config or {}
        self._max_journal = int(config.get("journal_size", 20))
        self.journal: deque[Deed] = deque(maxlen=self._max_journal)
        self.verb_counts: dict[str, int] = {}
        self.total_deeds = 0

    def validate(self, verb: str, metadata: dict[str, Any] | None) -> Outcome:
        """Validate a proposed action's verb + metadata against the repertoire."""
        if verb not in OUTWARD_VERBS:
            return Outcome(ok=False, reason="not_outward")
        metadata = metadata or {}
        missing = [k for k in REQUIRED_KEYS.get(verb, ()) if k not in metadata]
        if missing:
            return Outcome(ok=False, reason=f"missing_keys:{','.join(sorted(missing))}")
        return Outcome(ok=True)

    def observe(self, actions: list[dict[str, Any]], tick: int) -> list[Deed]:
        """Journal the in-world deeds in an outbound action batch.

        Non-mutating: reads the action dicts, records recognized outward deeds
        (valid or malformed) into the bounded journal, and returns them. Internal
        actions (noop, drive_crossed, skill_*, …) are not deeds and are skipped.
        """
        deeds: list[Deed] = []
        for action in actions:
            verb = str(action.get("action_type", ""))
            if verb not in OUTWARD_VERBS:
                continue
            outcome = self.validate(verb, action.get("metadata"))
            deed = Deed(verb=verb, tick=tick, valid=outcome.ok, reason=outcome.reason)
            self.journal.append(deed)
            self.verb_counts[verb] = self.verb_counts.get(verb, 0) + 1
            self.total_deeds += 1
            deeds.append(deed)
        return deeds

    def repertoire(self) -> list[str]:
        """The sorted list of in-world verbs the Nous can perform."""
        return sorted(OUTWARD_VERBS)

    def snapshot(self) -> dict[str, Any]:
        """Dashboard/get_state snapshot of in-world activity."""
        return {
            "total_deeds": self.total_deeds,
            "verb_counts": dict(self.verb_counts),
            "recent": [
                {"verb": d.verb, "tick": d.tick, "valid": d.valid, "reason": d.reason}
                for d in self.journal
            ],
            "repertoire_size": len(OUTWARD_VERBS),
        }
