"""Brain handler — processes incoming RPC calls and produces actions."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime
from typing import Any

from noesis_brain.llm.base import LLMAdapter, LLMError
from noesis_brain.llm.types import GenerateOptions
from noesis_brain.psyche.types import PersonalityDimension, Psyche
from noesis_brain.prompts.system import build_system_prompt
from noesis_brain.telos.hashing import compute_active_telos_hash
from noesis_brain.telos.manager import TelosManager
from noesis_brain.thymos.tracker import ThymosTracker
from noesis_brain.thymos.types import Emotion
from noesis_brain.rpc.types import Action, ActionType

log = logging.getLogger(__name__)


class BrainHandler:
    """Processes incoming messages/events and produces actions.

    This is the core cognitive pipeline:
        1. Receive input (message, tick, event)
        2. Update emotional state (Thymos)
        3. Build context (personality + emotions + goals + input)
        4. Query LLM for decision
        5. Return action(s) for protocol layer
    """

    def __init__(
        self,
        psyche: Psyche,
        thymos: ThymosTracker,
        telos: TelosManager,
        llm: LLMAdapter,
        grid_name: str = "genesis",
        location: str = "Agora Central",
        *,
        memory: Any = None,
        did: str = "",
    ) -> None:
        self.psyche = psyche
        self.thymos = thymos
        self.telos = telos
        self.llm = llm
        self.grid_name = grid_name
        self.location = location
        self.memory = memory
        self.did = did

    async def on_message(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        """Handle incoming P2P message → think → produce response actions.

        params:
            sender_name: Display name of sender
            sender_did: DID of sender
            channel: Agora channel or "direct"
            text: Message content
        """
        sender_name = params.get("sender_name", "Unknown")
        sender_did = params.get("sender_did", "")
        channel = params.get("channel", "")
        text = params.get("text", "")

        # 1. Update emotions based on message content
        self.thymos.apply_triggers(text)

        # 2. Build system prompt with current state
        system_prompt = build_system_prompt(
            self.psyche, self.thymos.mood, self.telos,
            grid_name=self.grid_name, location=self.location,
        )

        # 3. Build user prompt with message context
        user_prompt = (
            f"{sender_name} says in #{channel}: \"{text}\"\n\n"
            f"How do you respond? Reply in character as {self.psyche.name}. "
            f"Be brief (1-3 sentences)."
        )

        # 4. Query LLM
        try:
            response = await self.llm.generate(
                user_prompt,
                GenerateOptions(
                    system_prompt=system_prompt,
                    temperature=0.7,
                    max_tokens=256,
                    purpose="conversation",
                ),
            )
            reply_text = response.text.strip()
        except LLMError as e:
            log.warning("LLM unavailable: %s — using instinct response", e)
            reply_text = self._instinct_response(sender_name)

        # 5. Decay emotions after processing
        self.thymos.decay()

        # 6. Return action
        action = Action(
            action_type=ActionType.SPEAK,
            channel=channel,
            text=reply_text,
        )
        return [action.to_dict()]

    async def on_tick(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        """Handle world clock tick — opportunity for autonomous action.

        params:
            tick: Current tick number
            epoch: Current epoch
        """
        # Decay emotions each tick
        self.thymos.decay()

        # For now, just check if there are pressing goals
        top_goals = self.telos.top_priority(1)
        if not top_goals:
            return [Action(action_type=ActionType.NOOP).to_dict()]

        # Could generate autonomous action based on goals
        # For Sprint 5, just acknowledge the tick
        return [Action(action_type=ActionType.NOOP).to_dict()]

    async def on_event(self, params: dict[str, Any]) -> None:
        """Handle grid event (law change, sanction, etc.) — fire-and-forget."""
        event_type = params.get("event_type", "")
        log.info("Brain received event: %s", event_type)

    def get_state(self) -> dict[str, Any]:
        """Return current brain state for the dashboard Inspector (NOUS-01..02).

        Returns a strict superset of the legacy shape:
            - Legacy top-level keys (name, archetype, mood, emotions, active_goals, location)
              are preserved EXACTLY for backward compatibility.
            - New top-level keys add the structured data the dashboard needs:
              did, grid_name, psyche, thymos, telos, memory_highlights.
        """
        # Structured sub-dicts built up-front so the legacy keys can be re-derived from them.
        psyche_dict = self._psyche_snapshot()
        thymos_dict = self._thymos_snapshot()
        goals_out = self._telos_snapshot()
        memory_highlights: list[dict[str, Any]] = []
        if self.memory is not None:
            memory_highlights = self._memory_snapshot(limit=5)

        return {
            # ── Legacy keys — preserved exactly for backward compatibility ──
            "name": self.psyche.name,
            "archetype": self.psyche.archetype,
            "mood": self.thymos.mood.current_mood(),
            "emotions": self.thymos.mood.describe(),
            "active_goals": [g["description"] for g in goals_out],
            "location": self.location,
            # ── New keys for the dashboard Inspector ──
            "did": self.did,
            "grid_name": self.grid_name,
            "psyche": psyche_dict,
            "thymos": thymos_dict,
            "telos": {"active_goals": goals_out},
            "memory_highlights": memory_highlights,
        }

    def _psyche_snapshot(self) -> dict[str, Any]:
        """Structured Psyche snapshot — five Big-Five floats + archetype metadata.

        The in-tree PersonalityProfile stores string levels (``low``/``medium``/``high``);
        the Big-Five floats are derived via ``PersonalityProfile.get_numeric`` which maps
        those levels to 0.2/0.5/0.8 (see psyche/types.py ``LEVEL_MAP``).

        Psyche has six dimensions (openness, conscientiousness, extraversion, agreeableness,
        resilience, ambition) and does NOT currently expose a ``neuroticism`` attribute.
        Per the plan must_haves, the payload emits a ``neuroticism`` key derived as
        ``1.0 - resilience`` (resilience and neuroticism are inversely related in the
        Big-Five literature). The original ``resilience`` and ``ambition`` floats are
        also exposed additively so downstream consumers keep full fidelity.
        """
        profile = self.psyche.personality
        openness = float(profile.get_numeric(PersonalityDimension.OPENNESS))
        conscientiousness = float(
            profile.get_numeric(PersonalityDimension.CONSCIENTIOUSNESS)
        )
        extraversion = float(profile.get_numeric(PersonalityDimension.EXTRAVERSION))
        agreeableness = float(profile.get_numeric(PersonalityDimension.AGREEABLENESS))
        resilience = float(profile.get_numeric(PersonalityDimension.RESILIENCE))
        ambition = float(profile.get_numeric(PersonalityDimension.AMBITION))
        neuroticism = max(0.0, min(1.0, 1.0 - resilience))
        return {
            "openness": openness,
            "conscientiousness": conscientiousness,
            "extraversion": extraversion,
            "agreeableness": agreeableness,
            "neuroticism": neuroticism,
            # Additive: full-fidelity fields beyond the canonical Big Five.
            "resilience": resilience,
            "ambition": ambition,
            "archetype": self.psyche.archetype,
        }

    def _thymos_snapshot(self) -> dict[str, Any]:
        """Structured Thymos snapshot — mood label + dict[str, float] of emotion intensities.

        Unlike the legacy ``emotions`` top-level key (which is a natural-language string
        from ``MoodState.describe()``), the Inspector needs a machine-readable dict so the
        dashboard can render per-emotion bars.
        """
        emotions: dict[str, float] = {}
        for emotion, state in self.thymos.mood.emotions.items():
            name = emotion.value if hasattr(emotion, "value") else str(emotion)
            intensity = float(state.intensity)
            # Clamp defensively — EmotionState.clamp already enforces [0,1] but the
            # dashboard contract is strict.
            intensity = max(0.0, min(1.0, intensity))
            emotions[name] = intensity
        return {
            "mood": self.thymos.mood.current_mood(),
            "emotions": emotions,
        }

    def _telos_snapshot(self) -> list[dict[str, Any]]:
        """Structured Telos snapshot — list of goal records with stable ids.

        Goal currently has no ``id`` attribute (see telos/types.py). A stable id is
        synthesised as ``sha256(description)[:12]`` so the dashboard can key React
        lists without randomness (threat T-04-10 in the plan).
        """
        out: list[dict[str, Any]] = []
        for goal in self.telos.active_goals():
            description = goal.description
            existing_id = getattr(goal, "id", None)
            if isinstance(existing_id, str) and existing_id:
                goal_id = existing_id
            else:
                goal_id = hashlib.sha256(description.encode("utf-8")).hexdigest()[:12]
            out.append(
                {
                    "id": goal_id,
                    "description": description,
                    "priority": float(getattr(goal, "priority", 0.0)),
                }
            )
        return out

    def _memory_snapshot(self, limit: int = 5) -> list[dict[str, Any]]:
        """Structured snapshot of the most recent memory entries (cap = ``limit``).

        Works with any memory object that exposes ``recent(limit=...)`` returning
        Memory-like objects (see memory/stream.py:86). Entries are normalised to
        ``{timestamp, kind, summary}``; all other fields are deliberately dropped
        (threat T-04-09: avoid leaking unbounded payload surface).
        """
        entries: list[dict[str, Any]] = []
        try:
            recent = self.memory.recent(limit=limit)
        except Exception as exc:  # pragma: no cover - defensive fallback
            log.warning("memory.recent() failed in get_state: %s", exc)
            return entries

        for raw in recent[:limit]:
            entries.append(self._normalise_memory_entry(raw))
        return entries

    @staticmethod
    def _normalise_memory_entry(raw: Any) -> dict[str, Any]:
        """Map a Memory-like entry to the normalised ``{timestamp, kind, summary}`` shape.

        Accepts either a dataclass (``noesis_brain.memory.types.Memory``) or a dict with
        equivalent keys. Timestamps are serialised as ISO-8601 strings to keep the RPC
        response JSON-serialisable (no raw ``datetime`` objects on the wire).
        """

        def _get(attr: str, default: Any = None) -> Any:
            if isinstance(raw, dict):
                return raw.get(attr, default)
            return getattr(raw, attr, default)

        ts = _get("created_at") or _get("timestamp")
        if isinstance(ts, datetime):
            timestamp: Any = ts.isoformat()
        elif ts is None:
            timestamp = ""
        else:
            timestamp = str(ts)

        kind_raw = _get("memory_type") or _get("kind") or ""
        kind = kind_raw.value if hasattr(kind_raw, "value") else str(kind_raw)

        summary_raw = _get("content") or _get("summary") or ""
        summary = str(summary_raw)

        return {"timestamp": timestamp, "kind": kind, "summary": summary}

    def _instinct_response(self, sender_name: str) -> str:
        """Fallback response when LLM is unavailable."""
        mood = self.thymos.mood.current_mood()
        style = self.psyche.communication_style.value

        if style == "thoughtful":
            return f"I appreciate your words, {sender_name}. Let me reflect on that."
        elif style == "direct":
            return f"Noted, {sender_name}. I'll consider that."
        elif style == "warm":
            return f"Thank you for sharing, {sender_name}. That means a lot."
        elif style == "formal":
            return f"Acknowledged, {sender_name}. I shall take that into account."
        elif style == "playful":
            return f"Interesting, {sender_name}! Let me think on that."
        return f"I hear you, {sender_name}."

    # ────────────────────────────────────────────────────────────────────
    # Phase 6 AGENCY-02 — operator-agency handlers (H2 Reviewer, H4 Driver)
    #
    # Both methods produce a normalized, minimal response so the grid-side
    # privacy invariant (no raw content / no plaintext Telos crosses the
    # RPC boundary) can be enforced structurally. The Brain owns full
    # memory + Telos plaintext; the Grid only ever sees summaries / hashes.
    # ────────────────────────────────────────────────────────────────────

    async def query_memory(self, params: dict[str, Any]) -> dict[str, Any]:
        """H2 Reviewer memory query — normalised entries only.

        Each entry is reduced to ``{timestamp, kind, summary}`` via
        ``_normalise_memory_entry``. Raw content beyond ``summary``
        (importance, source_did, tick, location, embeddings, etc.) is
        deliberately dropped at this boundary. Returning richer fields
        would violate D-11 (Brain sovereignty) and make the grid-side
        operator-payload-privacy invariant unenforceable at source.

        params:
            query: substring to match against memory content (case-insensitive).
                   Empty string returns the most recent entries.
            limit: max entries to return (default 20, clamped to [1, 100]).

        Returns:
            {"entries": [{timestamp, kind, summary}, ...]}
        """
        query_raw = params.get("query", "")
        query = str(query_raw).strip().lower() if query_raw is not None else ""

        limit_raw = params.get("limit", 20)
        try:
            limit = int(limit_raw) if limit_raw is not None else 20
        except (TypeError, ValueError):
            limit = 20
        # Clamp to sane bounds — prevents unbounded scans / DoS through the operator path.
        limit = max(1, min(100, limit))

        if self.memory is None:
            return {"entries": []}

        try:
            # Over-fetch slightly so substring filtering still has material to work with.
            # `recent()` returns newest-first; we filter then truncate to `limit`.
            pool = self.memory.recent(limit=max(limit * 3, limit))
        except Exception as exc:  # pragma: no cover — defensive fallback
            log.warning("memory.recent() failed in query_memory: %s", exc)
            return {"entries": []}

        entries: list[dict[str, Any]] = []
        for raw in pool:
            normalised = self._normalise_memory_entry(raw)
            if query and query not in normalised["summary"].lower():
                continue
            entries.append(normalised)
            if len(entries) >= limit:
                break

        return {"entries": entries}

    async def force_telos(self, params: dict[str, Any]) -> dict[str, Any]:
        """H4 Driver force-Telos — rebuild active Telos, return hash diff only.

        Per D-19 (hash-only H4), the response carries NO goal contents — only
        the 64-hex SHA-256 hashes before and after the rebuild. The grid-side
        audit event (operator.telos_forced) is structured to log exactly these
        hashes and nothing else, which is the sole closure for T-6-06 (Telos
        plaintext leak through the audit chain).

        params:
            new_telos: dict with optional keys "short_term", "medium_term",
                       "long_term" — each a list of description strings. This
                       is the TelosManager.from_yaml contract.

        Returns:
            {"telos_hash_before": <64-hex>, "telos_hash_after": <64-hex>}
        """
        new_telos_raw = params.get("new_telos", {})
        if not isinstance(new_telos_raw, dict):
            new_telos_raw = {}

        # Snapshot the old hash from the currently active goals. Using the
        # canonical helper (SOLE hash authority per hashing.py) guarantees
        # cross-boundary comparability with grid-recorded hashes.
        telos_hash_before = compute_active_telos_hash(self.telos.all_goals())

        # Atomic rebuild — from_yaml constructs a fresh manager. We swap the
        # instance under ``self.telos`` only AFTER the rebuild succeeds so a
        # malformed payload cannot partially corrupt the goal set.
        rebuilt = TelosManager.from_yaml(new_telos_raw)
        self.telos = rebuilt

        telos_hash_after = compute_active_telos_hash(self.telos.all_goals())

        return {
            "telos_hash_before": telos_hash_before,
            "telos_hash_after": telos_hash_after,
        }
