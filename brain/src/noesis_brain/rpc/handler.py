"""Brain handler — processes incoming RPC calls and produces actions."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime
from typing import Any

from noesis_brain.ananke import AnankeRuntime, DriveLevel, DriveName
from noesis_brain.ananke.loader import AnankeLoader
from noesis_brain.bios import BiosLoader, BiosRuntime
from noesis_brain.chronos import compute_multiplier
from noesis_brain.llm.base import LLMAdapter, LLMError
from noesis_brain.llm.types import GenerateOptions
from noesis_brain.psyche.types import PersonalityDimension, Psyche
from noesis_brain.prompts.system import build_system_prompt
from noesis_brain.state_hash import compute_pre_deletion_state_hash
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
        # Phase 10a DRIVE-02 wire-side: per-DID AnankeRuntime registry. One
        # handler may, over its lifetime, receive ticks for multiple DIDs
        # (though typical Brain process serves one Nous). The loader is a
        # stateless factory; per-DID runtimes live in _ananke_runtimes.
        self._ananke_loader = AnankeLoader()
        self._ananke_runtimes: dict[str, AnankeRuntime] = {}
        # Phase 10b BIOS-02/BIOS-04: per-DID BiosRuntime registry.
        # Mirrors the Ananke pattern. birth_tick defaults to 0; set via
        # _set_birth_tick(did, tick) at spawn time when available.
        self._bios_loader = BiosLoader()
        self._bios_runtimes: dict[str, BiosRuntime] = {}
        self._bios_birth_ticks: dict[str, int] = {}

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

        # 2. Build system prompt with current state (+ Bios/Chronos awareness).
        ananke_rt = self._get_or_create_ananke(self.did)
        bios_rt = self._get_or_create_bios(self.did)
        subjective_multiplier = compute_multiplier(
            curiosity_level=ananke_rt.state.levels[DriveName.CURIOSITY],
            boredom_level=ananke_rt.state.levels[DriveName.BOREDOM],
        )
        epoch_since_spawn = bios_rt.epoch_since_spawn(0)  # tick=0 until on_tick supplies it
        system_prompt = build_system_prompt(
            self.psyche, self.thymos.mood, self.telos,
            grid_name=self.grid_name, location=self.location,
            bios_snapshot=bios_rt.state,
            epoch_since_spawn=epoch_since_spawn,
            subjective_multiplier=subjective_multiplier,
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
            dialogue_context: (Phase 7 DIALOG-02, optional) list of
                DialogueContext dicts aggregated by the Grid from recent
                nous.spoke events. Brain MAY respond with
                ActionType.TELOS_REFINED actions (opt-in per D-15).
                Absence/empty list preserves Phase 6 behavior (D-10
                additive widening).
        """
        # Decay emotions each tick (Phase 6 behavior — preserved exactly).
        self.thymos.decay()

        # Phase 7 additive widening (D-10): consume optional dialogue_context.
        # Absent, empty, or malformed → no refinement attempted, falls through
        # to NOOP path (strict superset of Phase 6 on_tick contract).
        dialogue_ctxs = params.get("dialogue_context")
        actions: list[dict[str, Any]] = []
        if isinstance(dialogue_ctxs, list):
            for ctx in dialogue_ctxs:
                if not isinstance(ctx, dict):
                    continue
                refined = self._build_refined_telos(ctx)
                if refined is not None:
                    actions.append(refined.to_dict())

        # Phase 10a DRIVE-02 wire-side: advance Ananke drive state and drain
        # any threshold crossings into DRIVE_CROSSED actions. Each crossing
        # becomes ONE separate Action. Metadata carries EXACTLY 3 keys
        # {drive, level, direction} — Grid injects did and tick downstream
        # (3-keys-not-5 invariant, D-10a-03).
        tick_raw = params.get("tick", 0)
        try:
            tick = int(tick_raw) if tick_raw is not None else 0
        except (TypeError, ValueError):
            tick = 0
        runtime = self._get_or_create_ananke(self.did)
        runtime.on_tick(tick)
        for xing in runtime.drain_crossings():
            actions.append(
                Action(
                    action_type=ActionType.DRIVE_CROSSED,
                    channel="",
                    text="",
                    metadata={
                        "drive": xing.drive.value,
                        "level": xing.level.value,
                        "direction": xing.direction.value,
                    },
                ).to_dict()
            )

        # Phase 10b BIOS-04: step BiosRuntime each tick; enqueue BIOS_DEATH on starvation.
        bios = self._get_or_create_bios(self.did)
        bios.on_tick(tick)
        if bios.drain_death():
            # D-10b-09: starvation death — Grid plan 10b-05 emits bios.death audit event.
            # T-10b-04-03: flag is consumed (drain_death clears it) to prevent re-fire.
            actions.append(
                Action(
                    action_type=ActionType.BIOS_DEATH,
                    channel="",
                    text="",
                    metadata={
                        "cause": "starvation",
                    },
                ).to_dict()
            )

        if actions:
            # Advisory logging (D-10a-06): drive-vs-action divergence is
            # PURE OBSERVATION. This call MUST NOT mutate `actions`.
            # PHILOSOPHY §6 Nous sovereignty: drives inform, never coerce.
            self._advisory_log_divergence(self.did, runtime.state, actions)
            return actions

        # Pre-Phase-7 NOOP fallback preserved verbatim for additive-widening
        # compatibility (matches test_get_state_widening strict-superset rule).
        top_goals = self.telos.top_priority(1)
        if not top_goals:
            actions.append(Action(action_type=ActionType.NOOP).to_dict())
        else:
            # Could generate autonomous action based on goals
            # For Sprint 5, just acknowledge the tick
            actions.append(Action(action_type=ActionType.NOOP).to_dict())
        # Advisory logging also runs on the NOOP path — a HIGH drive coupled
        # with a NOOP primary is the canonical divergence case.
        self._advisory_log_divergence(self.did, runtime.state, actions)
        return actions

    async def on_event(self, params: dict[str, Any]) -> None:
        """Handle grid event (law change, sanction, etc.) — fire-and-forget."""
        event_type = params.get("event_type", "")
        log.info("Brain received event: %s", event_type)

    # ────────────────────────────────────────────────────────────────────
    # Phase 10a DRIVE-02/DRIVE-04 — Ananke integration helpers
    #
    # `_get_or_create_ananke` lazily instantiates a deterministic
    # AnankeRuntime per DID. Seed derivation is SHA-256 of the DID bytes
    # truncated to 8 bytes and interpreted big-endian as an integer —
    # deterministic, no wall-clock input (T-10a-14 mitigation).
    #
    # `_advisory_log_divergence` records drive-vs-action divergence to the
    # Nous's private logger (never broadcast). PHILOSOPHY §6: drives inform
    # but do not coerce; this function is PURE OBSERVATION and must not
    # modify the actions list. T-10a-11 mitigation.
    # ────────────────────────────────────────────────────────────────────

    # Mapping drive → matching primary action type. If a drive is HIGH but
    # no action of the matching type is present in the chosen actions, the
    # handler logs a divergence. This is informational; the Nous's chosen
    # action is sovereign.
    _DIVERGENCE_HEURISTIC: dict[DriveName, ActionType] = {
        DriveName.HUNGER: ActionType.MOVE,
        DriveName.CURIOSITY: ActionType.SPEAK,
        DriveName.SAFETY: ActionType.MOVE,
        DriveName.BOREDOM: ActionType.SPEAK,
        DriveName.LONELINESS: ActionType.DIRECT_MESSAGE,
    }

    def _get_or_create_ananke(self, did: str) -> AnankeRuntime:
        """Return the AnankeRuntime for the given DID, creating one on first use.

        Seed derivation is deterministic: `int.from_bytes(sha256(did)[:8], big)`.
        Given identical DID strings across replays, the same seed (and thus the
        same tick-by-tick drive trace) is reproduced byte-for-byte. No
        wall-clock input — preserves the determinism contract (DRIVE-02).
        """
        if did not in self._ananke_runtimes:
            seed = int.from_bytes(
                hashlib.sha256(did.encode("utf-8")).digest()[:8], "big"
            )
            self._ananke_runtimes[did] = self._ananke_loader.build(seed=seed)
        return self._ananke_runtimes[did]

    def _get_or_create_bios(self, did: str) -> BiosRuntime:
        """Return the BiosRuntime for the given DID, creating one on first use.

        Mirrors _get_or_create_ananke. birth_tick is taken from
        _bios_birth_ticks[did] if set (populated at spawn time via
        set_birth_tick); defaults to 0 for backward compatibility.

        Determinism: same DID → same seed across replays (SHA-256, no wall-clock).
        """
        if did not in self._bios_runtimes:
            seed = int.from_bytes(
                hashlib.sha256(did.encode("utf-8")).digest()[:8], "big"
            )
            birth_tick = self._bios_birth_ticks.get(did, 0)
            self._bios_runtimes[did] = self._bios_loader.build(
                seed=seed, birth_tick=birth_tick
            )
        return self._bios_runtimes[did]

    def set_birth_tick(self, did: str, birth_tick: int) -> None:
        """Record the Grid tick at which this Nous was spawned.

        Called by the Grid-side spawner (plan 10b-05) immediately after
        appendBiosBirth so that epoch_since_spawn() returns the correct age.
        Must be called BEFORE the first _get_or_create_bios() for this DID.
        """
        self._bios_birth_ticks[did] = birth_tick

    def _advisory_log_divergence(
        self,
        did: str,
        state: Any,
        actions: list[dict[str, Any]],
    ) -> None:
        """Log drive-vs-action divergence to the Brain's private logger.

        PHILOSOPHY §6 invariant (T-10a-11): this method MUST NOT append to,
        remove from, or mutate `actions`. It is side-effect-only. The
        advisory log is the Brain's private channel — it never crosses the
        Grid broadcast boundary (T-10a-12 mitigation; `ananke.divergence` is
        not in the broadcast allowlist).

        Heuristic: for each drive at level HIGH, check whether the Nous
        chose an action of the "matching" type (see `_DIVERGENCE_HEURISTIC`).
        If not, emit an INFO log record with structured `extra` so test
        fixtures and operators can introspect the divergence without
        affecting runtime behavior.

        Args:
            did: The Nous's DID (goes into the log record for operator
                forensics; never written to the actions list).
            state: Current DriveState; `state.levels` is a
                `dict[DriveName, DriveLevel]`.
            actions: The Nous's chosen action list. Read-only from this
                function's perspective.
        """
        chosen_types = {a.get("action_type") for a in actions}
        for drive, matching_action in self._DIVERGENCE_HEURISTIC.items():
            # Defensive .get — state.levels should always have all 5 drives
            # (DriveState invariant), but we never want a KeyError in a
            # pure-observation function.
            level = state.levels.get(drive)
            if level != DriveLevel.HIGH:
                continue
            if matching_action.value in chosen_types:
                continue
            log.info(
                "ananke.divergence drive=%s level=high chose=%s",
                drive.value,
                sorted(chosen_types),
                extra={
                    "event": "ananke.divergence",
                    "did": did,
                    "drive": drive.value,
                    "level": "high",
                    "chose": sorted(chosen_types),
                },
            )

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

    # ────────────────────────────────────────────────────────────────────
    # Phase 8 AGENCY-05 — H5 Sovereign pre-deletion state hash
    #
    # Brain computes 4 component hashes (psyche, thymos, telos,
    # memory_stream). Grid composes the canonical pre_deletion_state_hash
    # from these 4 values — Brain NEVER composes the 5th (D-03).
    # ────────────────────────────────────────────────────────────────────

    async def hash_state(self, params: dict[str, Any]) -> dict[str, str]:
        """AGENCY-05: return 4 component hashes for pre-deletion forensics.

        Brain returns {psyche_hash, thymos_hash, telos_hash,
        memory_stream_hash} — each a 64-hex SHA-256 digest. Grid's
        combineStateHash() composes the 5th canonical hash (D-03 boundary:
        a compromised Brain cannot forge a consistent deletion record).

        params: ignored (hash computed from current in-memory state).

        Returns:
            dict with EXACTLY 4 keys, each a 64-hex string.
        """
        return compute_pre_deletion_state_hash(self)

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

    # ────────────────────────────────────────────────────────────────────
    # Phase 7 DIALOG-02 — Nous-initiated telos refinement after peer dialogue
    #
    # Unlike force_telos (Phase 6, operator-driven H4 Driver), this helper
    # is invoked from on_tick when the Grid delivers a dialogue_context.
    # Brain remains sovereign (PHILOSOPHY §1, D-15): opt-in, never coerced.
    # Returned metadata carries ONLY the two 64-hex goal hashes + the 16-hex
    # dialogue_id — no plaintext crosses the RPC boundary (D-18).
    # ────────────────────────────────────────────────────────────────────

    def _build_refined_telos(self, ctx: dict[str, Any]) -> Action | None:
        """Brain decides whether to refine Telos after a peer dialogue.

        Mirrors the hash-before/mutate/hash-after shape of ``force_telos``
        (the Phase 6 SOLE-hash-authority pattern). Returns an
        ActionType.TELOS_REFINED Action when the refinement produces a
        non-identity hash change, else None.

        Per D-18 the returned metadata carries ONLY hashes + dialogue_id —
        never goal plaintext. Per D-15 the decision is Brain-opt-in: this
        method MAY return None even when ctx is well-formed.

        ctx: A single dialogue_context dict from the incoming tick params —
             keys include dialogue_id (16-hex), counterparty_did, channel,
             utterances (list, <=5 entries, each text <=200 chars).
        """
        dialogue_id = ctx.get("dialogue_id", "")
        if not isinstance(dialogue_id, str) or len(dialogue_id) != 16:
            # Malformed ctx — log and drop. No audit emit (D-16 mirror on Brain side).
            log.warning(
                "telos_refined: dropping ctx with bad dialogue_id %r", dialogue_id
            )
            return None

        # Heuristic: decide whether THIS dialogue suggests refinement.
        # v2.1 minimal: proceed if any utterance text substring-matches any
        # active goal description (lowercased). Future phases replace this
        # with a persona-contingent LLM prompt — kept minimal here per
        # CONTEXT "Claude's Discretion" guidance (substring only, no eval,
        # no dynamic code → T-07-16 elevation threat mitigation).
        proposed = self._dialogue_driven_goal_set(ctx)
        if proposed is None:
            return None  # Brain opted out — no audit emit (D-15).

        # SOLE hash authority, called BEFORE mutation (D-14).
        telos_hash_before = compute_active_telos_hash(self.telos.all_goals())

        # Atomic swap — build first, swap only on success (clone force_telos).
        rebuilt = TelosManager.from_yaml(proposed)
        self.telos = rebuilt

        # SOLE hash authority, called AFTER mutation (D-14).
        telos_hash_after = compute_active_telos_hash(self.telos.all_goals())

        if telos_hash_before == telos_hash_after:
            # No-op refinement — silence per D-22 silent-no-op invariant.
            return None

        # Closed 3-key metadata tuple (D-20) — Grid injects `did` downstream.
        return Action(
            action_type=ActionType.TELOS_REFINED,
            channel="",
            text="",
            metadata={
                "before_goal_hash": telos_hash_before,
                "after_goal_hash": telos_hash_after,
                "triggered_by_dialogue_id": dialogue_id,
            },
        )

    def _dialogue_driven_goal_set(
        self, ctx: dict[str, Any]
    ) -> dict[str, list[str]] | None:
        """Minimal v2.1 heuristic: if any utterance substring-matches an active
        goal description (case-insensitive), propose a reprioritised goal set.

        Returns a TelosManager.from_yaml-compatible dict, or None if no
        refinement is warranted. Future phases replace this with an LLM call.

        Kept deterministic + synchronous so tests can pin behavior without
        mocking the LLM. The LLM prompt path is tracked as a deferred idea.

        Threat T-07-16: utterance text feeds into the match check ONLY,
        never into goal-description strings. Promoted/demoted lists are drawn
        from the Nous's OWN pre-existing goals — there is no path for
        adversarial prompt injection to write new goals.
        """
        utterances = ctx.get("utterances") or []
        if not isinstance(utterances, list) or not utterances:
            return None
        active = self.telos.active_goals()
        if not active:
            return None
        # Lowercased utterance text pool (truncation-respecting: Grid already
        # capped to 200 chars; we do not re-inflate).
        texts: list[str] = []
        for u in utterances:
            if isinstance(u, dict):
                t = u.get("text")
                if isinstance(t, str):
                    texts.append(t.lower())
        pool = " ".join(texts)
        if not pool:
            return None
        # Promote goals whose description is mentioned; demote the rest.
        promoted: list[str] = []
        demoted: list[str] = []
        for g in active:
            if g.description.lower() in pool:
                promoted.append(g.description)
            else:
                demoted.append(g.description)
        if not promoted:
            return None  # No goal mentioned — dialogue not goal-relevant.
        # Return a from_yaml-compatible shape. Keep all goals; priority shifts
        # via bucket assignment (promoted → short_term, demoted → medium_term).
        return {
            "short_term": promoted,
            "medium_term": demoted,
            "long_term": [],
        }
