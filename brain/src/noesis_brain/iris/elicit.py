"""Iris elicit — belief elicitation from Brain adapter (Phase 17).

IrisRuntime wraps an IrisStore + LLM adapter and provides the elicit()
method: ask the LLM to form a belief about a peer given current context,
compare with existing active beliefs, detect contradictions, and persist.

Cooldown (IRIS_ELICIT_COOLDOWN = 20 ticks): per-(nous_did, target_did) pair.
Contradiction threshold (IRIS_CONTRADICTION_THRESHOLD = 0.3): confidence delta.

Wall-clock free: NEVER use datetime, time.time, random.random, uuid.uuid4,
os.urandom. All temporal state uses caller-supplied tick values.

No HTTP calls from this module — LLM adapter is injected as a dependency.
"""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Protocol

from noesis_brain.iris.config import IRIS_ELICIT_COOLDOWN, IRIS_CONTRADICTION_THRESHOLD
from noesis_brain.iris.store import IrisStore
from noesis_brain.iris.types import Belief, DIMENSION_VALUES

log = logging.getLogger(__name__)

# Re-export constants so test imports work:
# from noesis_brain.iris.elicit import elicit, IRIS_ELICIT_COOLDOWN, IRIS_CONTRADICTION_THRESHOLD
__all__ = [
    "elicit",
    "IrisRuntime",
    "ElicitResult",
    "IRIS_ELICIT_COOLDOWN",
    "IRIS_CONTRADICTION_THRESHOLD",
]


# ---------------------------------------------------------------------------
# LLM adapter protocol (structural — no import of LLM implementation)
# ---------------------------------------------------------------------------

class _LLMAdapter(Protocol):
    """Minimal LLM interface consumed by elicit."""
    def complete(self, prompt: str) -> str: ...


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------

@dataclass
class ElicitResult:
    """Result of a single elicit() call.

    beliefs: list of Belief objects produced (may be empty on cooldown/error).
    contradiction: True if confidence delta vs prior active belief exceeds threshold.
    new_hash: sha256 hex of new belief content (empty string if no belief produced).
    prior_hash: sha256 hex of prior active belief content (empty string if none).
    source_event_hash: sha256 hex of context identifier (empty string if not provided).
    """
    beliefs: list[Belief] = field(default_factory=list)
    contradiction: bool = False
    new_hash: str = ""
    prior_hash: str = ""
    source_event_hash: str = ""


# ---------------------------------------------------------------------------
# IrisRuntime
# ---------------------------------------------------------------------------

class IrisRuntime:
    """Per-Nous Theory of Mind runtime.

    Wraps IrisStore + LLM adapter to provide belief elicitation with:
    - Per-(nous_did, target_did) cooldown enforcement
    - Contradiction detection (confidence delta > IRIS_CONTRADICTION_THRESHOLD)
    - Append-only belief persistence
    - Hash-only audit metadata (content never crosses Brain↔Grid boundary)

    Thread safety: single-process (same as IrisStore).
    """

    def __init__(self, store: IrisStore, llm_adapter: Any) -> None:
        self.store = store
        self._llm = llm_adapter
        # Cooldown registry: (nous_did, target_did) → last_elicit_tick
        self._last_elicit: dict[tuple[str, str], int] = {}
        # Dispatcher for emit() calls (set via set_dispatcher)
        self.dispatcher: Any = None

    def set_dispatcher(self, dispatcher: Any) -> None:
        """Inject dispatcher for emitting iris.* audit signals."""
        self.dispatcher = dispatcher

    def elicit(
        self,
        nous_did: str,
        target_did: str,
        context: dict[str, Any],
        tick: int,
    ) -> ElicitResult:
        """Elicit a belief about target_did using current context.

        Cooldown gate: if last elicitation for (nous_did, target_did) was
        fewer than IRIS_ELICIT_COOLDOWN ticks ago, returns an empty result
        WITHOUT calling the LLM adapter.

        If a new belief is produced:
        1. Checks for contradiction with the prior highest-confidence active belief.
        2. Inserts the new belief (append-only; prior NOT auto-superseded here —
           elicit.py may call store.supersede() explicitly when contradiction detected).
        3. Returns ElicitResult with hashes for audit events (Grid-side).

        Args:
            nous_did: DID of the belief-holding Nous.
            target_did: DID of the peer this belief describes.
            context: Caller-supplied context dict (e.g. whisper metadata, vote info).
            tick: Current world tick (caller-supplied — no wall-clock).

        Returns:
            ElicitResult with beliefs, contradiction flag, and hash fields.
        """
        pair = (nous_did, target_did)

        # Cooldown check — per-pair, no wall-clock.
        last_tick = self._last_elicit.get(pair)
        if last_tick is not None and (tick - last_tick) < IRIS_ELICIT_COOLDOWN:
            return ElicitResult()

        # Update cooldown timestamp.
        self._last_elicit[pair] = tick

        # Build prompt — minimal; Brain adapter owns the system prompt.
        prompt = self._build_prompt(nous_did, target_did, context)

        # Call LLM adapter — exactly once per non-throttled invocation.
        try:
            raw = self._llm.complete(prompt)
        except Exception as exc:
            log.warning("iris.elicit: LLM adapter failed for (%s, %s): %s", nous_did, target_did, exc)
            return ElicitResult()

        # Parse response — expect JSON with {dimension, content, confidence}.
        parsed = self._parse_response(raw)
        if parsed is None:
            return ElicitResult()

        dimension, content, confidence = parsed

        # Validate dimension — closed enum gate.
        if dimension not in DIMENSION_VALUES:
            log.warning(
                "iris.elicit: LLM returned invalid dimension %r for (%s, %s) — discarding",
                dimension, nous_did, target_did,
            )
            return ElicitResult()

        # Compute content hash (Brain-private; crosses wire as sha256 only).
        new_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

        # Look up the prior highest-confidence active belief for (target, dimension).
        prior_beliefs = self.store.get_beliefs(
            target_did=target_did,
            dimension=dimension,
            k=1,
            active_only=True,
        )
        prior_belief = prior_beliefs[0] if prior_beliefs else None

        # Detect contradiction: confidence delta > IRIS_CONTRADICTION_THRESHOLD.
        contradiction = False
        prior_hash = ""
        prior_id: int | None = None

        if prior_belief is not None:
            prior_hash = hashlib.sha256(prior_belief.content.encode("utf-8")).hexdigest()
            delta = abs(confidence - prior_belief.confidence)
            if delta > IRIS_CONTRADICTION_THRESHOLD:
                contradiction = True

        # Compute source_event_hash from context if available.
        source_event_hash_raw = context.get("source_event_hash", "")
        if source_event_hash_raw and isinstance(source_event_hash_raw, str):
            source_event_hash = source_event_hash_raw
        elif context:
            # Derive a stable hash from the context dict for audit anchoring.
            ctx_bytes = json.dumps(context, sort_keys=True, default=str).encode("utf-8")
            source_event_hash = hashlib.sha256(ctx_bytes).hexdigest()
        else:
            source_event_hash = ""

        # Build and persist the new Belief.
        new_belief = Belief(
            id=None,
            nous_did=nous_did,
            target_did=target_did,
            dimension=dimension,  # type: ignore[arg-type]
            content=content,
            confidence=confidence,
            superseded_by=None,
            created_tick=tick,
            source_event_hash=source_event_hash if source_event_hash else None,
        )
        new_id = self.store.add_belief(new_belief, tick=tick)

        # On contradiction: explicitly supersede the prior (elicit.py owns this decision).
        if contradiction and prior_belief is not None and prior_belief.id is not None:
            self.store.supersede(old_id=prior_belief.id, new_id=new_id)

        # Re-fetch to get the id-populated Belief.
        persisted = self.store.get_beliefs(
            target_did=target_did, dimension=dimension, k=1, active_only=True
        )
        result_beliefs = persisted if persisted else []

        return ElicitResult(
            beliefs=result_beliefs,
            contradiction=contradiction,
            new_hash=new_hash,
            prior_hash=prior_hash,
            source_event_hash=source_event_hash,
        )

    # ---- private helpers ---------------------------------------------------

    def _build_prompt(
        self,
        nous_did: str,
        target_did: str,
        context: dict[str, Any],
    ) -> str:
        """Build a minimal elicitation prompt.

        Belief CONTENT is Brain-private. This prompt never crosses the wire.
        Context is serialized deterministically (sort_keys=True).
        """
        ctx_summary = json.dumps(context, sort_keys=True, default=str)
        return (
            f"You are {nous_did}. Elicit a 1st-order belief about {target_did}.\n"
            f"Context: {ctx_summary}\n"
            "Reply with JSON only: "
            '{"dimension": "<belief|desire|intention|knowledge|emotion>", '
            '"content": "<brief prose>", "confidence": <0.0-1.0>}'
        )

    def _parse_response(self, raw: str) -> tuple[str, str, float] | None:
        """Parse LLM JSON response. Returns (dimension, content, confidence) or None."""
        try:
            # Strip markdown code fences if present.
            text = raw.strip()
            if text.startswith("```"):
                lines = text.splitlines()
                text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            data = json.loads(text)
            dimension = str(data.get("dimension", "")).lower()
            content = str(data.get("content", "")).strip()
            confidence = float(data.get("confidence", 0.5))
            # Clamp confidence to [0.0, 1.0].
            confidence = max(0.0, min(1.0, confidence))
            if not content:
                return None
            return dimension, content, confidence
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            log.warning("iris.elicit: failed to parse LLM response: %s — raw: %.100s", exc, raw)
            return None


# ---------------------------------------------------------------------------
# Module-level elicit() convenience wrapper
# ---------------------------------------------------------------------------

def elicit(
    nous_did: str,
    target_did: str,
    context: dict[str, Any],
    tick: int,
    runtime: IrisRuntime,
) -> ElicitResult:
    """Module-level convenience wrapper around IrisRuntime.elicit().

    Provided so tests can import `elicit` directly alongside the constants.
    """
    return runtime.elicit(nous_did=nous_did, target_did=target_did, context=context, tick=tick)
