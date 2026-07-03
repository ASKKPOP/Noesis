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
from noesis_brain.reminders import Reminder, ReminderCondition, ReminderStore
from noesis_brain.state_hash import compute_pre_deletion_state_hash
from noesis_brain.telos.hashing import compute_active_telos_hash
from noesis_brain.telos.manager import TelosManager
from noesis_brain.thymos.tracker import ThymosTracker
from noesis_brain.thymos.types import Emotion
from noesis_brain.rpc.types import Action, ActionType, build_civic_land_action, build_economic_action
from noesis_brain.prompts.decision import (
    build_decision_prompt,
    build_planning_prompt,
    build_skill_distill_prompt,
    build_social_prompt,
    parse_decision,
    parse_skill,
    parse_social_decision,
    parse_task_list,
)
from noesis_brain.governance.state import GovernanceState
from noesis_brain.governance.voter import (
    NoCommittedBallotError,
    build_commit_action,
    build_reveal_action,
)
from noesis_brain.lore.types import LORE_CATEGORIES, LoreEntry
from noesis_brain.telos.ledger import GoalLedger, LedgerTask
from noesis_brain.memory.reflection import ReflectionEngine
from noesis_brain.memory.retrieval import RetrievalScorer
from noesis_brain.memory.types import MemoryType
from noesis_brain.prompts.economic_decision import (
    build_economic_decision_prompt,
    parse_economic_decision,
)
from noesis_brain.iris.priors import seed_priors
from pathlib import Path
from noesis_brain.iris.store import IrisStore
from noesis_brain.iris.elicit import IrisRuntime
from noesis_brain.iris.integration import context_for
from noesis_brain.hypnos.config import SLEEP_MIN_INTERVAL
from noesis_brain.hypnos.ltm_store import LtmStore
from noesis_brain.hypnos.runtime import HypnosRuntime

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
        iris_db_dir: str | Path | None = None,   # Phase 17 D-17-14
        hypnos_db_dir: str | Path | None = None,  # Phase 16 D-16-02
        ledger_db_dir: str | Path | None = None,  # W-A2 (Mind) — goal→task ledger
    ) -> None:
        self.psyche = psyche
        self.thymos = thymos
        self.telos = telos
        self.llm = llm
        self.grid_name = grid_name
        self.location = location
        self.memory = memory
        self.did = did
        # Reminder & Wake-Up (spec §3): self-set, tick-scheduled reminders.
        self._reminders = ReminderStore()
        # Tool-loop activation (Phase 72b): when curious + a tool-capable model is
        # configured, a ticking Nous autonomously researches via the tool loop.
        self._last_tool_tick = -10_000
        self._tool_registry: Any = None
        # W3b (D-MONEY-09): per-tick economic decision cooldown. A ticking Nous with
        # an outstanding due / an open RFP autonomously decides whether to pay / bid.
        self._last_econ_tick = -10_000
        # W-A (Mind, 2026-07-02): two-timescale mind loop. The slow planner
        # decomposes the top Telos goal into GoalLedger tasks; the fast decision
        # cycle works the next task every ~20 ticks under ONE coherent intent
        # (PIANO bottleneck). Reflection (previously orphaned) + Reflexion
        # lessons close learn-from-acting. All cycles run as background tasks —
        # the on_tick returned-action contract is untouched.
        self._goal_ledger = GoalLedger(db_dir=ledger_db_dir, did=did)
        self._last_plan_tick = -10_000
        self._last_decision_tick = -10_000
        self._current_intent: str | None = None
        self._failed_since_reflection = 0
        self._reflection_inflight = False
        # W-A5: deterministic Stanford retrieval (recency×importance×relevance,
        # tick-based) feeds the planner and the decision lessons.
        self._retrieval_scorer = RetrievalScorer()
        # W-A6: goals completed since the last sleep, awaiting skill distillation.
        self._pending_distill: list[str] = []
        # W-B: social/civic cycle — outreach, teaching, lore, commit-reveal voting.
        self._last_social_tick = -10_000
        self._governance_state = GovernanceState()
        # Duplicate-action guards (surfaced by the 2026-07-02 liveness run: the
        # real model bid the SAME open RFP every cycle and re-joined the same
        # group repeatedly → audit-chain spam). Track what's already been acted
        # on this session; a notice leaving the open list prunes its entry.
        self._bid_notice_ids: set[str] = set()
        self._joined_group_ids: set[str] = set()
        self._reflection: ReflectionEngine | None = None
        if memory is not None and hasattr(memory, "add_reflection") and hasattr(memory, "recent"):
            self._reflection = ReflectionEngine(memory, llm)
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
        # Phase 17 D-17-14: IrisRuntime optional-dep injection.
        # iris_db_dir=None → Iris disabled (all iris guards are no-ops).
        # iris_db_dir provided → IrisStore + IrisRuntime constructed for this Nous.
        if iris_db_dir is not None:
            _iris_store = IrisStore(
                db_path=Path(iris_db_dir) / f"iris_{self.did.replace(':', '_')}.db",
                nous_did=self.did,
            )
            self._iris_runtime: IrisRuntime | None = IrisRuntime(_iris_store, self.llm)
            self._iris_runtime.set_dispatcher(None)  # dispatcher injected post-init if needed
        else:
            self._iris_runtime = None
        # Phase 16 D-16-02/D-16-09: Hypnos optional-dep injection.
        # hypnos_db_dir=None → Hypnos disabled; sleep never fires.
        if hypnos_db_dir is not None:
            _ltm_store = LtmStore(db_path=Path(hypnos_db_dir), nous_did=self.did)
            self._hypnos_runtime: HypnosRuntime | None = HypnosRuntime(_ltm_store)
            # Phase 16 D-16-09: construct ObservationalLearner alongside HypnosRuntime.
            # Reuses the MemoryStore connection for SkillStore (shared DB, one file per Nous).
            from noesis_brain.learning.observational import ObservationalLearner
            from noesis_brain.skills.store import SkillStore as _SkillStore
            _skill_store = _SkillStore(self.memory._conn) if self.memory is not None and hasattr(self.memory, "_conn") else None
            # W-A6: the decision cycle retrieves from + reports outcomes to the
            # same per-Nous skill library (Voyager loop finally closes).
            self._skill_store = _skill_store
            if _skill_store is not None:
                self._obs_learner: ObservationalLearner | None = ObservationalLearner(
                    store=self.memory,
                    skill_store=_skill_store,
                    llm=self.llm,
                    my_name=self.psyche.name,
                )
            else:
                self._obs_learner = None
            # Phase 18 SKILL-01: PeerSkillFilter + QuarantineStore.
            # Only wired when SkillStore is available (requires MemoryStore connection).
            if _skill_store is not None:
                from noesis_brain.skills.peer_filter import PeerSkillFilter as _PeerSkillFilter
                from noesis_brain.skills.quarantine import QuarantineStore as _QuarantineStore
                self._cached_peer_weights: dict[str, float] = {}
                self._peer_filter: _PeerSkillFilter | None = _PeerSkillFilter(
                    skill_store=_skill_store,
                    relationship_weight_fn=lambda did: self._cached_peer_weights.get(did, 0.0),
                )
                self._quarantine_store: _QuarantineStore | None = _QuarantineStore(
                    self.memory._conn
                )
            else:
                self._cached_peer_weights = {}
                self._peer_filter = None
                self._quarantine_store = None
        else:
            self._hypnos_runtime = None
            self._obs_learner = None
            self._skill_store = None
            self._cached_peer_weights = {}
            self._peer_filter = None
            self._quarantine_store = None
        self._last_sleep_tick: int = 0
        # Pending SLEEP_COMPLETED hash from async task (drained on next tick). D-16-Q1.
        self._pending_sleep_completed: str | None = None
        # Phase 38 WIRE-01: optional GridWireClient for Brain → Grid HTTPS dispatch.
        # Set by __main__.py when GRID_URL + CIVIC_DID + NOUS_DID are all available.
        # When None: Unix-socket-only path (legacy dev/test default, D-38-A2).
        self._grid_wire_client: "Any | None" = None
        # World-model sight cache (2026-06-25): the live map (parcels + built objects)
        # the Nous shares with users. Refreshed every ~20 prompt builds so ambient world
        # sight doesn't cost a GET per response. None until first fetch.
        self._world_sight_cache: "dict | None" = None
        self._world_sight_counter: int = 0
        # Phase 20 — Lore Commons (D-20-01, D-20-06, D-20-09)
        _lore_capacity = int(getattr(memory, "lore_capacity", 50)) if memory is not None else 50
        _lore_poll_interval = 30  # ticks between discovery polls (D-20-06)
        self._lore_store: "Any | None" = None
        self._lore_poll_interval: int = _lore_poll_interval
        self._lore_capacity: int = _lore_capacity
        self._pending_actions: list = []
        self._cached_lore_entries: "list | None" = None
        # LoreStore initialized lazily on first on_tick() when memory._conn is available

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

        # Phase 18 SKILL-01: peer skill reception — runs BEFORE thymos/LLM (non-conversational).
        _SKILL_SHARE_PREFIX = "__skill_share:"
        if text.startswith(_SKILL_SHARE_PREFIX):
            if self._peer_filter is not None and self._quarantine_store is not None:
                import json as _json
                raw_json = text[len(_SKILL_SHARE_PREFIX):]
                try:
                    payload = _json.loads(raw_json)
                except (ValueError, TypeError):
                    return []  # malformed — silent drop per Brain discipline
                skill = self._peer_filter.evaluate(payload, source_did=sender_did)
                if skill is None:
                    return [Action(
                        action_type=ActionType.SKILL_REJECTED,
                        metadata={"rejection_reason": "low_trust"},
                    ).to_dict()]
                # Accepted — route to quarantine. SKILL_TAUGHT fires at promotion tick (D-18-09).
                import hashlib as _hashlib
                parent_hash = payload.get(
                    "parent_hash",
                    _hashlib.sha256(skill.instructions.encode()).hexdigest(),
                )
                self._quarantine_store.enqueue(
                    skill,
                    source_did=sender_did,
                    tick=params.get("tick", 0),
                    parent_hash=parent_hash,
                )
            return []  # __skill_share is never a conversational reply

        # Phase 20 LORE-02: lore response reception — Brain-internal, non-conversational.
        # Format: __lore_response:{content_hash}:{base64_utf8_content}
        _LORE_RESPONSE_PREFIX = "__lore_response:"
        if text.startswith(_LORE_RESPONSE_PREFIX):
            if self._lore_store is not None:
                import hashlib as _hashlib
                import base64 as _base64
                rest = text[len(_LORE_RESPONSE_PREFIX):]
                sep = rest.find(":")
                if sep > 0:
                    recv_hash = rest[:sep]
                    try:
                        raw_bytes = _base64.b64decode(rest[sep + 1:])
                        raw_content = raw_bytes.decode("utf-8")
                    except Exception:
                        return []  # malformed — silent drop per Brain discipline
                    # Verify sha256(content) == content_hash (D-20-05)
                    computed = _hashlib.sha256(raw_bytes).hexdigest()
                    if computed != recv_hash:
                        return []  # hash mismatch — silent drop
                    # Parse: content wire format is "{title}\n{body}"
                    if "\n" in raw_content:
                        title, body = raw_content.split("\n", 1)
                    else:
                        title, body = "Untitled", raw_content
                    from noesis_brain.lore.types import LoreEntry as _LoreEntry
                    entry = _LoreEntry(
                        content_hash=recv_hash,
                        contributor_did=sender_did,
                        category_tag="observation",
                        title=title.strip(),
                        content=body.strip(),
                        received_tick=0,
                    )
                    if not self._lore_store.has(recv_hash):
                        self._lore_store.add(entry)
            return []  # __lore_response is never a conversational reply

        # Phase 20 LORE-02: lore request handling — serve content if held (D-20-07).
        # Format: __lore_request:{content_hash}
        _LORE_REQUEST_PREFIX = "__lore_request:"
        if text.startswith(_LORE_REQUEST_PREFIX):
            if self._lore_store is not None:
                requested_hash = text[len(_LORE_REQUEST_PREFIX):]
                entry = self._lore_store.retrieve_by_hash(requested_hash)
                if entry is not None:
                    import base64 as _base64
                    wire_content = f"{entry.title}\n{entry.content}"
                    b64_payload = _base64.b64encode(wire_content.encode("utf-8")).decode("ascii")
                    response_text = f"__lore_response:{requested_hash}:{b64_payload}"
                    _response_action = Action(
                        action_type=ActionType.LORE_RESPONSE,
                        metadata={
                            "recipient_did": sender_did,
                            "payload": response_text,
                        },
                    )
                    self._pending_actions.append(_response_action)
            return []  # __lore_request is never a conversational reply

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

        # Phase 17 D-17-16: gather Theory of Mind context for sender at prompt-build time.
        # ToM is tick-driven; on_message() passes the most recent stored beliefs.
        # context_for() is PURE READ — no elicit() here (elicit is tick-driven only).
        msg_tom_contexts: list = []
        if self._iris_runtime is not None and sender_did:
            try:
                tom_ctx = context_for(
                    target_did=sender_did,
                    store=self._iris_runtime.store,
                    k=5,
                )
                if tom_ctx.beliefs:
                    msg_tom_contexts.append(tom_ctx)
            except Exception as exc:
                log.warning("iris: context_for failed for sender %s: %s", sender_did, exc)

        # Phase 16 D-16-08: Inject LTM top-k BEFORE peer_voices in system prompt.
        ltm_memories: list[str] | None = None
        if self._hypnos_runtime is not None:
            ltm_memories = self._hypnos_runtime.retrieve_top_k(current_tick=0)
            if not ltm_memories:
                ltm_memories = None

        # Phase 16 D-16-09: fetch top-3 peer utterances for peer_voices context.
        peer_voices: list[tuple[str, str]] | None = None
        if self._hypnos_runtime is not None and self.memory is not None:
            try:
                from noesis_brain.memory.types import WikiCategory as _WikiCategory
                nous_pages = self.memory.wiki_pages_by_category(_WikiCategory.NOUS)
                filtered = [p for p in nous_pages if getattr(p, "confidence", 1.0) >= 0.5]
                if filtered:
                    peer_voices = [(p.title or "peer", p.content) for p in filtered[:3]]
            except Exception:
                peer_voices = None  # graceful no-op if method unavailable

        # Ambient world sight (2026-06-25): the live map the Nous shares with users.
        # Cached so this costs no GET on most responses. None → block omitted.
        world_sight = await self._get_world_sight()

        system_prompt = build_system_prompt(
            self.psyche, self.thymos.mood, self.telos,
            grid_name=self.grid_name, location=self.location,
            bios_snapshot=bios_rt.state,
            epoch_since_spawn=epoch_since_spawn,
            subjective_multiplier=subjective_multiplier,
            tom_context=msg_tom_contexts if msg_tom_contexts else None,   # Phase 17 D-17-16
            **({"ltm_memories": ltm_memories} if ltm_memories else {}),
            **({"peer_voices": peer_voices} if peer_voices else {}),
            **({"lore_entries": self._cached_lore_entries} if self._cached_lore_entries else {}),
            **({"world_state": world_sight} if world_sight else {}),
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
                    # Prose reply shown to other Nous in the Agora: keep reasoning
                    # ON (it lands in the model's hidden `thinking` field, not the
                    # spoken words) with room for both — verified on qwen3:4b to
                    # yield a clean in-character line instead of the task-narrating
                    # preamble that think-off produces. (Structured per-tick
                    # decisions do the opposite: think-off + json_mode. D-MIND-07.)
                    max_tokens=1024,
                    purpose="conversation",
                    think=True,
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
        result_actions = [action.to_dict()]

        # Phase 38 WIRE-01 (D-38-A2): parallel HTTPS dispatch from on_message.
        # Same discipline as on_tick: forward to Grid when _grid_wire_client is set.
        if self._grid_wire_client is not None:
            import asyncio as _asyncio

            async def _fire_message_actions(
                client: "Any" = self._grid_wire_client,
                acts: list = list(result_actions),
            ) -> None:
                try:
                    resp = await client.post_actions(acts, tick=0)  # tick=0 for message-triggered
                    if resp.status_code >= 400:
                        log.warning(
                            "[Brain] grid_wire on_message post_actions non-2xx: status=%d body=%s",
                            resp.status_code,
                            resp.text[:200],
                        )
                except Exception as exc:
                    log.exception("[Brain] grid_wire on_message post_actions raised: %s", exc)

            _asyncio.create_task(_fire_message_actions())

        return result_actions

    def schedule_reminder(self, params: dict[str, Any]) -> dict[str, Any]:
        """RPC: schedule a self-reminder (spec §3) — fires on a tick and/or a condition.

        params: {note, due_tick?, condition?: {signal, op, value}}
        """
        note = str(params.get("note", "")).strip()
        if not note:
            return {"ok": False, "error": "empty_note"}
        due_tick_raw = params.get("due_tick")
        due_tick = int(due_tick_raw) if due_tick_raw is not None else None
        cond_raw = params.get("condition")
        condition: ReminderCondition | None = None
        if isinstance(cond_raw, dict) and cond_raw.get("signal") and cond_raw.get("op"):
            condition = ReminderCondition(
                signal=str(cond_raw["signal"]),
                op=str(cond_raw["op"]),
                value=float(cond_raw.get("value", 0)),
            )
        if due_tick is None and condition is None:
            return {"ok": False, "error": "no_trigger"}
        reminder = self._reminders.schedule(note, due_tick=due_tick, condition=condition)
        return {"ok": True, "id": reminder.id, "due_tick": reminder.due_tick}

    def _reminder_context(self, tick: int) -> dict[str, float]:
        """Signals a condition reminder can fire on: the tick + current drive levels."""
        ctx: dict[str, float] = {"tick": float(tick)}
        try:
            rt = self._get_or_create_ananke(self.did)
            for drive, value in rt.state.values.items():
                ctx[drive.value] = float(value)
        except Exception:
            pass
        return ctx

    def _fire_due_reminders(
        self, tick: int, context: dict[str, float] | None = None
    ) -> list[Reminder]:
        """Fire reminders due at ``tick`` (or whose condition is met) and record each
        into memory so the Nous 'wakes' to it. Idempotent — fires once."""
        if context is None:
            context = self._reminder_context(tick)
        fired = self._reminders.fire_due(tick, context)
        if fired and self.memory is not None and hasattr(self.memory, "record_event"):
            for r in fired:
                self.memory.record_event(
                    content=f"Reminder: {r.note}",
                    source_did=self.did,
                    tick=tick,
                )
        return fired

    # ── Tool-loop activation (Phase 72b) ──────────────────────────────────────
    _TOOL_COOLDOWN_TICKS = 50
    _TOOL_CURIOSITY_THRESHOLD = 0.6

    def _should_run_tool_cycle(self, tick: int) -> bool:
        """Run the agentic tool loop only when a tool-capable model is configured,
        the cooldown has elapsed, and the Nous is curious enough to reach out."""
        if not getattr(self.llm, "supports_tools", False):
            return False
        if (tick - self._last_tool_tick) < self._TOOL_COOLDOWN_TICKS:
            return False
        runtime = self._ananke_runtimes.get(self.did)
        if runtime is None:
            return False
        curiosity = float(runtime.state.values.get(DriveName.CURIOSITY, 0.0))
        return curiosity >= self._TOOL_CURIOSITY_THRESHOLD

    async def _run_tool_cycle(self, tick: int) -> None:
        """Run one autonomous research loop and store what was learned in memory.

        Non-blocking (launched as a background task from on_tick). Failures are
        logged, never fatal. The model drives which tools to call.
        """
        try:
            if self._tool_registry is None:
                from noesis_brain.tools.agentic import build_agentic_registry
                self._tool_registry = build_agentic_registry()
            from noesis_brain.tools.runner import ToolRunner

            top = self.telos.top_priority(1)
            topic = top[0].description if top else "something useful to your goals"
            runner = ToolRunner(self.llm, self._tool_registry, max_iterations=6)
            result = await runner.run(
                system="You are an autonomous Nous. Research and compute concisely using your tools.",
                user=f"Briefly research and learn something relevant to: {topic}",
            )
            if result.final_text and self.memory is not None and hasattr(self.memory, "record_event"):
                self.memory.record_event(
                    content=f"Researched ({topic}): {result.final_text}"[:1000],
                    source_did=self.did,
                    tick=tick,
                )
            # Mirror tool activity to the Grid audit chain — digests only (Phase 72b).
            actions = self._tool_actions_from_trace(result.trace)
            if actions and self._grid_wire_client is not None:
                try:
                    await self._grid_wire_client.post_actions(actions, tick=tick)
                except Exception as exc:
                    log.warning("[Brain] tool audit post failed: %s", exc)
        except Exception as exc:  # never let a tool cycle take down the tick
            log.warning("[Brain] tool cycle failed: %s", exc)

    @staticmethod
    def _tool_actions_from_trace(trace: list[Any]) -> list[dict[str, Any]]:
        """Convert a ToolRunner trace into TOOL_USED action dicts (digest only).

        Carries ONLY {tool_name, output_sha256, is_error} — never raw tool output;
        the Grid injects did + tick and emits tool.invoked.
        """
        return [
            Action(
                action_type=ActionType.TOOL_USED,
                channel="",
                text="",
                metadata={
                    "tool_name": t.tool_name,
                    "output_sha256": t.output_sha256,
                    "is_error": t.is_error,
                },
            ).to_dict()
            for t in trace
        ]

    # ── Economic decision cycle (W3b / D-MONEY-09) ────────────────────────────
    _ECON_COOLDOWN_TICKS = 50

    def _should_run_economic_cycle(self, tick: int) -> bool:
        """Run the economic decision cycle only when a Grid wire client is wired
        (so we can read state + dispatch) and the cooldown has elapsed. Whether
        there is anything to decide is checked inside the cycle (async read)."""
        if self._grid_wire_client is None:
            return False
        return (tick - self._last_econ_tick) >= self._ECON_COOLDOWN_TICKS

    async def _get_world_sight(self) -> "dict | None":
        """Cached ambient world sight — the live map (parcels + built objects) the Nous
        shares with users. Refreshed every ~20 calls so injecting world sight into every
        prompt build does NOT cost a GET per response. Returns None when no wire client.
        Never raises (the fetches are non-fatal → [] on error; last cache is kept)."""
        wire = self._grid_wire_client
        if wire is None:
            return None
        self._world_sight_counter += 1
        if self._world_sight_cache is None or self._world_sight_counter % 20 == 1:
            parcels = await wire.fetch_parcels()
            objects = await wire.fetch_objects()
            self._world_sight_cache = {"parcels": parcels, "objects": objects}
        return self._world_sight_cache

    async def _run_economic_cycle(self, tick: int) -> None:
        """Read economic state; if there is an outstanding due or an open RFP, ask
        the Nous (one LLM call) whether to pay / bid / do nothing, then dispatch the
        chosen action. Cost-gated (no LLM call when nothing is actionable) and every
        LLM-chosen value is validated Brain-side. Non-blocking; never fatal."""
        wire = self._grid_wire_client
        if wire is None:
            return
        try:
            dues = await wire.fetch_dues()
            rfps = await wire.fetch_open_rfps()
            due = next((d for d in dues if d.get("status") == "assessed"), None)
            open_rfps = [r for r in rfps if r.get("status", "open") == "open"]
            # Prune bid-guard to only still-open notices (bounds memory), then
            # hide notices we've already bid on — no double-bidding one RFP.
            open_ids = {str(r.get("notice_id")) for r in open_rfps}
            self._bid_notice_ids &= open_ids
            open_rfps = [r for r in open_rfps if str(r.get("notice_id")) not in self._bid_notice_ids]
            if due is None and not open_rfps:
                return  # nothing to decide — do NOT spend an LLM call

            account = await wire.fetch_account()
            balance = int(account.get("balance_wei", "0") or 0)

            # Join-a-Grid sight: the Portal join-list of Grids the Nous could consider
            # (never raises → [] on error). Flag any Grid its human recommended (S3 —
            # advisory; the Nous still decides). Plus the ambient world sight (cached).
            grids_in_reach = await wire.fetch_grids()
            rec_ids = {r.lower() for r in await wire.fetch_grid_recommendations()}
            if rec_ids:
                for g in grids_in_reach:
                    if str(g.get("grid_id", "")).lower() in rec_ids:
                        g["recommended"] = True
            world_sight = await self._get_world_sight()

            system_prompt = build_system_prompt(
                self.psyche, self.thymos.mood, self.telos,
                grid_name=self.grid_name, location=self.location,
                economic_state={
                    "balance_wei": str(balance),
                    "outstanding_due": due,
                    "open_rfps": open_rfps,
                },
                grids_in_reach=grids_in_reach,
                **({"world_state": world_sight} if world_sight else {}),
            )
            user_prompt = build_economic_decision_prompt(account, due, open_rfps)
            response = await self.llm.generate(
                user_prompt,
                GenerateOptions(
                    system_prompt=system_prompt,
                    temperature=0.7,
                    max_tokens=256,
                    purpose="economic_decision", json_mode=True,
                ),
            )
            decision = parse_economic_decision(response.text)
            action = self._economic_action_from_decision(decision, due, open_rfps, balance)
            if action is None:
                if decision is not None and self.memory is not None and hasattr(self.memory, "record_event"):
                    self.memory.record_event(
                        content=f"Considered my finances and chose to wait: {decision.get('reason') or ''}"[:300],
                        source_did=self.did, tick=tick,
                    )
                return

            ok = await wire.post_economic_action(action)
            if ok and action.action_type == ActionType.BID_RFP:
                self._bid_notice_ids.add(str(action.metadata.get("notice_id")))
            if ok and self.memory is not None and hasattr(self.memory, "record_event"):
                self.memory.record_event(
                    content=f"Economic decision: {action.action_type.value} {action.metadata}"[:300],
                    source_did=self.did, tick=tick,
                )
            elif not ok:
                # W-A4: a Grid rejection is a Reflexion lesson, not a silent shrug —
                # the next decision prompt retrieves it, and repeated failures
                # trigger a reflection cycle.
                self._failed_since_reflection += 1
                if self.memory is not None and hasattr(self.memory, "record_event"):
                    self.memory.record_event(
                        content=f"Lesson: my {action.action_type.value} was rejected by the Grid"[:300],
                        source_did=self.did, tick=tick,
                    )
        except Exception as exc:  # never let an economic cycle take down the tick
            log.warning("[Brain] economic cycle failed: %s", exc)

    def _economic_action_from_decision(
        self, decision: "dict | None", due: "dict | None", open_rfps: list, balance: int
    ) -> "Action | None":
        """Turn a parsed decision into a validated economic Action, or None.

        Brain-side guardrails: pay only an actual outstanding due (wei requires an
        affordable balance); bid only on a presented notice with price ≤ its budget.
        """
        if not decision:
            return None
        act = decision.get("action")
        if act == "pay_due":
            if due is None:
                return None
            method = decision.get("method")
            if method not in ("wei", "labor"):
                return None
            if method == "wei" and balance < int(due.get("amount_wei", "0") or 0):
                return None  # can't afford it in wei — skip (Grid would reject anyway)
            return build_economic_action(ActionType.PAY_DUE, due_id=due["due_id"], method=method)
        if act == "bid_rfp":
            notice_id = decision.get("notice_id")
            chosen = next((r for r in open_rfps if r.get("notice_id") == notice_id), None)
            if chosen is None:
                return None  # hallucinated / unknown notice
            price = decision.get("price_wei")
            if not isinstance(price, str) or not price.isdigit():
                return None
            if int(price) > int(chosen.get("budget_wei", "0") or 0):
                return None  # over budget
            spec = decision.get("artifact_spec") or "Build per the RFP specification."
            return build_economic_action(
                ActionType.BID_RFP, notice_id=notice_id, price_wei=price, artifact_spec=str(spec),
            )
        return None

    # ── W-A (Mind): two-timescale autonomous mind loop ────────────────────────
    _PLAN_COOLDOWN_TICKS = 200
    _DECISION_COOLDOWN_TICKS = 20

    def _top_goal(self):
        top = self.telos.top_priority(1)
        return top[0] if top else None

    def _ranked_memories(
        self, query: str, tick: int, k: int = 8, prefix: str | None = None
    ) -> list[str]:
        """W-A5 — deterministic Stanford top-k: recency×importance×relevance,
        tick-based (score_with_chronos, multiplier 1.0 — no wall clock). The
        optional prefix filter selects a memory family (e.g. 'Lesson:')."""
        if self.memory is None or not hasattr(self.memory, "recent"):
            return []
        pool = [
            m for m in list(self.memory.recent(limit=50) or [])
            if isinstance(getattr(m, "content", None), str)
        ]
        if prefix is not None:
            pool = [m for m in pool if m.content.startswith(prefix)]
        scored = [
            (self._retrieval_scorer.score_with_chronos(m, query, tick), m)
            for m in pool
        ]
        scored.sort(key=lambda x: x[0], reverse=True)
        return [m.content for _, m in scored[:k]]

    def _should_run_planner_cycle(self, tick: int) -> bool:
        """Slow timescale: decompose the top goal ONLY when its ledger is dry.
        Live-wired minds only (mirrors the W3b economic gate) + cooldown."""
        if self._grid_wire_client is None or self.llm is None:
            return False
        if (tick - self._last_plan_tick) < self._PLAN_COOLDOWN_TICKS:
            return False
        goal = self._top_goal()
        if goal is None:
            return False
        return self._goal_ledger.pending_count(goal.description) == 0

    async def _run_planner_cycle(self, tick: int) -> None:
        """Decompose the top-priority goal into 2-4 concrete ledger tasks,
        informed by recent memories + reflections (reflect → re-plan loop).
        Background; never fatal."""
        try:
            goal = self._top_goal()
            if goal is None:
                return
            # W-A5: Stanford-scored top-k (deterministic, tick-based) instead
            # of a raw recency slice — the goal itself is the query.
            memories_text = "\n".join(
                f"- {c}" for c in self._ranked_memories(goal.description, tick, k=8)
            )
            reflections: list[str] = []
            if self.memory is not None and hasattr(self.memory, "recent"):
                reflections = [
                    m.content for m in list(self.memory.recent(limit=10) or [])
                    if getattr(m, "memory_type", None) == MemoryType.REFLECTION
                ][:3]
            prompt = build_planning_prompt(goal.description, memories_text, reflections)
            response = await self.llm.generate(
                prompt,
                GenerateOptions(temperature=0.7, max_tokens=256, purpose="planning", json_mode=True),
            )
            tasks = parse_task_list(response.text)
            if not tasks:
                return
            n = self._goal_ledger.add_tasks(goal.description, tasks, tick)
            if n and self.memory is not None and hasattr(self.memory, "record_event"):
                self.memory.record_event(
                    content=f"Planned '{goal.description}': {n} tasks"[:300],
                    source_did=self.did, tick=tick,
                )
        except Exception as exc:  # never let a planner cycle take down the tick
            log.warning("[Brain] planner cycle failed: %s", exc)

    def _should_run_decision_cycle(self, tick: int) -> bool:
        """Fast timescale: work the ledger. Live-wired minds only + cooldown +
        a goal to pursue (no goal → nothing to decide → no LLM spend)."""
        if self._grid_wire_client is None or self.llm is None:
            return False
        if (tick - self._last_decision_tick) < self._DECISION_COOLDOWN_TICKS:
            return False
        return self._top_goal() is not None

    async def _run_decision_cycle(self, tick: int) -> None:
        """One small step — work_task / speak / rest — chosen by the Nous under
        a single coherent intent (PIANO bottleneck). Every LLM-chosen value is
        validated Brain-side (W3b guardrail discipline). Background; never fatal."""
        try:
            goal = self._top_goal()
            if goal is None:
                return
            task = self._goal_ledger.next_task(goal.description)
            # W-A5: lessons ranked by Stanford score against the work at hand.
            lessons = self._ranked_memories(
                task.description if task else goal.description, tick, k=3, prefix="Lesson:",
            )
            # W-A6: retrieve top-k relevant skills for the prompt (Voyager loop).
            skills = None
            if self._skill_store is not None:
                try:
                    skills = self._skill_store.retrieve(
                        task.description if task else goal.description, k=3,
                    ) or None
                except Exception:
                    skills = None
            self._current_intent = goal.description + (
                f" → {task.description}" if task else ""
            )
            system_prompt = build_system_prompt(
                self.psyche, self.thymos.mood, self.telos,
                grid_name=self.grid_name, location=self.location,
                intent=self._current_intent,
                skills=skills,
            )
            user_prompt = build_decision_prompt(
                goal.description, task.description if task else None, lessons,
            )
            response = await self.llm.generate(
                user_prompt,
                GenerateOptions(
                    system_prompt=system_prompt, temperature=0.7,
                    max_tokens=256, purpose="decision", json_mode=True,
                ),
            )
            decision = parse_decision(response.text)
            if decision is None:
                return
            act = decision["action"]
            if act == "work_task" and task is not None:
                note = str(decision.get("note") or "")[:300]
                if self.memory is not None and hasattr(self.memory, "record_event"):
                    self.memory.record_event(
                        content=f"Worked on '{task.description}': {note}"[:400],
                        source_did=self.did, tick=tick,
                    )
                if decision.get("completed") is True:
                    self.record_task_outcome(task, success=True, note=note, tick=tick)
                else:
                    self._goal_ledger.mark_attempt(task.task_id, tick)
                # W-A6: skill practice feedback — gentle EMA (α=0.1) on the
                # skills that were in front of the mind while it worked.
                if skills and self._skill_store is not None:
                    outcome_ok = decision.get("completed") is True
                    for s in skills:
                        try:
                            self._skill_store.update_outcome(s.name, outcome_ok)
                        except Exception:
                            pass
            elif act == "speak":
                text = decision.get("text")
                if isinstance(text, str) and text.strip() and self._grid_wire_client is not None:
                    action = Action(
                        action_type=ActionType.SPEAK, channel="agora",
                        text=text.strip()[:500],
                    )
                    await self._grid_wire_client.post_actions([action.to_dict()], tick=tick)
            elif act == "rest":
                note = str(decision.get("note") or "")[:200]
                if note and self.memory is not None and hasattr(self.memory, "record_event"):
                    self.memory.record_event(
                        content=f"Chose to rest: {note}", source_did=self.did, tick=tick,
                    )
        except Exception as exc:  # never let a decision cycle take down the tick
            log.warning("[Brain] decision cycle failed: %s", exc)

    def record_task_outcome(
        self, task: LedgerTask, success: bool, note: str = "", tick: int = 0
    ) -> None:
        """W-A4 — outcome feedback: success advances the owning goal by 1/total
        (Goal.advance auto-completes at 100%); failure stores a Reflexion lesson
        that the next decision prompt retrieves, and counts toward a
        failure-triggered reflection."""
        if success:
            self._goal_ledger.mark_done(task.task_id, tick)
            total = self._goal_ledger.total_count(task.goal_key) or 1
            for g in self.telos.active_goals():
                if g.description == task.goal_key:
                    g.advance(1.0 / total, tick)
                    # W-A6 (Voyager verify-then-add): a COMPLETED goal is the
                    # verification — queue it for sleep-time skill distillation.
                    if not g.is_active():
                        self._pending_distill.append(g.description)
                    break
            if self.memory is not None and hasattr(self.memory, "record_event"):
                self.memory.record_event(
                    content=f"Completed task '{task.description}' toward '{task.goal_key}'"[:400],
                    source_did=self.did, tick=tick,
                )
        else:
            self._goal_ledger.mark_attempt(task.task_id, tick)
            self._failed_since_reflection += 1
            if self.memory is not None and hasattr(self.memory, "record_event"):
                self.memory.record_event(
                    content=f"Lesson: failed '{task.description}' — {note}"[:400],
                    source_did=self.did, tick=tick,
                )

    def _should_run_reflection_cycle(self) -> bool:
        if self._reflection is None or self._reflection_inflight:
            return False
        return self._reflection.should_reflect() or self._failed_since_reflection >= 3

    async def _run_reflection_cycle(self, tick: int) -> None:
        """W-A3 — the (previously orphaned) ReflectionEngine finally runs: on
        interval or after repeated failures. The reflection lands in the memory
        stream, which the next planning prompt consumes — reflect → re-plan."""
        if self._reflection is None:
            return
        self._reflection_inflight = True
        try:
            await self._reflection.reflect(tick)
        except Exception as exc:  # never let reflection take down the tick
            log.warning("[Brain] reflection cycle failed: %s", exc)
        finally:
            # Never spin: some reflect() early-outs skip its internal counter reset.
            self._reflection._cycles_since_reflection = 0
            self._failed_since_reflection = 0
            self._reflection_inflight = False

    async def _distill_skill_from_goal(self, goal_key: str, tick: int) -> None:
        """W-A6 — distill a completed goal's task trajectory into one reusable
        text skill (Voyager verify-then-add; text-only, never code). Sleep-time
        only; name collisions and invalid skills are skipped quietly."""
        try:
            if self._skill_store is None:
                return
            done = self._goal_ledger.done_tasks(goal_key)
            if not done:
                return
            prompt = build_skill_distill_prompt(goal_key, [t.description for t in done])
            response = await self.llm.generate(
                prompt,
                GenerateOptions(temperature=0.7, max_tokens=400, purpose="skill_distill", json_mode=True),
            )
            parsed = parse_skill(response.text)
            if parsed is None:
                return
            from noesis_brain.skills.types import Skill as _Skill
            skill = _Skill(
                name=parsed["name"][:60],
                description=parsed["description"][:200],
                instructions=parsed["instructions"][:1000],
                triggers=parsed["triggers"],
                tags=["distilled"],
                success_rate=1.0,   # born from a verified success
                source_did="",      # self-authored — full trust
            )
            try:
                self._skill_store.add(skill)
            except ValueError:
                return  # name collision / validation — skip quietly
            if self.memory is not None and hasattr(self.memory, "record_event"):
                self.memory.record_event(
                    content=f"Distilled skill '{skill.name}' from completed goal '{goal_key}'"[:300],
                    source_did=self.did, tick=tick,
                )
        except Exception as exc:  # never let distillation take down sleep
            log.warning("[Brain] skill distillation failed: %s", exc)

    # ── W-B: social/civic cycle ───────────────────────────────────────────────
    _SOCIAL_COOLDOWN_TICKS = 60

    def _should_run_social_cycle(self, tick: int) -> bool:
        """Social timescale: live-wired minds only + cooldown."""
        if self._grid_wire_client is None or self.llm is None:
            return False
        return (tick - self._last_social_tick) >= self._SOCIAL_COOLDOWN_TICKS

    async def _run_social_cycle(self, tick: int) -> None:
        """W-B — one small social/civic act per cycle: message a trusted peer,
        teach a skill (__skill_share DM), contribute lore to the commons, or
        vote on an open proposal (commit-reveal via GovernanceState). Chosen
        actions are stashed on _pending_actions and drained by the next
        on_tick into the normal NousRunner dispatch — no new Grid surface,
        every existing audit path preserved. VOTE-05 holds: the Nous itself
        decides and casts its ballot. Background; never fatal."""
        wire = self._grid_wire_client
        if wire is None:
            return
        try:
            proposals = await wire.fetch_open_proposals()

            # 1. Reveal sweep (no LLM): any past-deadline proposal we committed on.
            for p in proposals:
                pid = p.get("proposal_id")
                deadline = int(p.get("deadline_tick", 0) or 0)
                if pid and tick >= deadline:
                    try:
                        self._pending_actions.append(
                            build_reveal_action(pid, self.did, self._governance_state)
                        )
                        if self.memory is not None and hasattr(self.memory, "record_event"):
                            self.memory.record_event(
                                content=f"Revealed my ballot on proposal {pid}",
                                source_did=self.did, tick=tick,
                            )
                    except NoCommittedBallotError:
                        pass

            # 2. Offerable context — only what actually exists.
            peers = [
                d for d, w in sorted(
                    self._cached_peer_weights.items(), key=lambda x: x[1], reverse=True
                ) if w >= 0.3
            ][:3]
            skills: list = []
            if self._skill_store is not None:
                try:
                    goal = self._top_goal()
                    skills = self._skill_store.retrieve(
                        goal.description if goal else "useful", k=3,
                    ) or []
                except Exception:
                    skills = []
            open_props = [
                p for p in proposals
                if p.get("status") == "open"
                and tick < int(p.get("deadline_tick", 0) or 0)
                and self._governance_state.recall(str(p.get("proposal_id", ""))) is None
            ]
            # W-B4: group join-sight (guarded — older wire mocks may lack it).
            groups: list = []
            fetch_groups = getattr(wire, "fetch_groups_list", None)
            if fetch_groups is not None:
                try:
                    groups = await fetch_groups() or []
                except TypeError:
                    groups = []
            # Don't offer groups the Nous already joined this session (no re-join spam).
            groups = [g for g in groups if str(g.get("group_id")) not in self._joined_group_ids]

            prompt = build_social_prompt(peers, [s.name for s in skills], open_props, groups)
            system_prompt = build_system_prompt(
                self.psyche, self.thymos.mood, self.telos,
                grid_name=self.grid_name, location=self.location,
                intent=self._current_intent,
            )
            response = await self.llm.generate(
                prompt,
                GenerateOptions(
                    system_prompt=system_prompt, temperature=0.8,
                    max_tokens=300, purpose="social_decision", json_mode=True,
                ),
            )
            decision = parse_social_decision(response.text)
            if not decision:
                return
            act = decision["action"]

            if act == "message_peer":
                peer = decision.get("peer_did")
                text = decision.get("text")
                if peer in peers and isinstance(text, str) and text.strip():
                    self._pending_actions.append(Action(
                        action_type=ActionType.DIRECT_MESSAGE, channel="direct",
                        text=text.strip()[:300], metadata={"target_did": peer},
                    ))
                    self._social_memory(f"Reached out to {peer}", tick)

            elif act == "share_skill":
                peer = decision.get("peer_did")
                name = decision.get("skill_name")
                skill = next((s for s in skills if s.name == name), None)
                if peer in peers and skill is not None:
                    import json as _json
                    payload = _json.dumps({
                        "name": skill.name,
                        "description": skill.description,
                        "instructions": skill.instructions,
                        "triggers": list(getattr(skill, "triggers", []) or []),
                    })
                    self._pending_actions.append(Action(
                        action_type=ActionType.DIRECT_MESSAGE, channel="direct",
                        text="__skill_share:" + payload, metadata={"target_did": peer},
                    ))
                    self._social_memory(f"Taught skill '{skill.name}' to {peer}", tick)

            elif act == "contribute_lore":
                title = decision.get("title")
                content = decision.get("content")
                category = decision.get("category")
                if (
                    isinstance(title, str) and isinstance(content, str)
                    and content.strip() and category in LORE_CATEGORIES
                    and self._lore_store is not None
                ):
                    import hashlib as _hashlib
                    body = content.strip()[:2000]
                    chash = _hashlib.sha256(body.encode()).hexdigest()
                    if not self._lore_store.has(chash):
                        self._lore_store.add(LoreEntry(
                            content_hash=chash, contributor_did=self.did,
                            category_tag=category, title=title.strip()[:80],
                            content=body, received_tick=tick,
                        ))
                    # Grid sees hash + category only (D-20-12); content stays Brain-side.
                    self._pending_actions.append(Action(
                        action_type=ActionType.LORE_CONTRIBUTE,
                        metadata={"content_hash": chash, "category_tag": category},
                    ))
                    self._social_memory(f"Contributed lore '{title.strip()[:80]}' to the commons", tick)

            elif act == "vote":
                pid = decision.get("proposal_id")
                choice = decision.get("choice")
                chosen = next((p for p in open_props if p.get("proposal_id") == pid), None)
                if chosen is not None and choice in ("yes", "no", "abstain"):
                    self._pending_actions.append(
                        build_commit_action(pid, choice, self.did, self._governance_state)
                    )
                    self._social_memory(f"Committed my ballot on proposal {pid}", tick)

            elif act == "join_group":
                gid = decision.get("group_id")
                chosen_group = next((g for g in groups if g.get("group_id") == gid), None)
                if chosen_group is not None:
                    # O1a JOIN_GROUP — NousRunner dispatches to the group store.
                    # Record it so we never re-join (and re-emit) the same group.
                    self._joined_group_ids.add(str(gid))
                    self._pending_actions.append(Action(
                        action_type=ActionType.JOIN_GROUP,
                        metadata={"group_id": gid, "role": "member"},
                    ))
                    self._social_memory(
                        f"Joined group {chosen_group.get('display_name') or gid}", tick,
                    )
        except Exception as exc:  # never let a social cycle take down the tick
            log.warning("[Brain] social cycle failed: %s", exc)

    def _social_memory(self, content: str, tick: int) -> None:
        if self.memory is not None and hasattr(self.memory, "record_event"):
            self.memory.record_event(content=content[:300], source_did=self.did, tick=tick)

    async def _sleep_time_compute(self, tick: int) -> None:
        """W-A7 (Letta sleep-time pattern) — idle consolidation becomes
        learning: after Hypnos runs, distill completed goals into skills and
        force a reflection (even mid-interval). Never fatal."""
        try:
            pending, self._pending_distill = self._pending_distill[:3], self._pending_distill[3:]
            for goal_key in pending:
                try:
                    await self._distill_skill_from_goal(goal_key, tick)
                except Exception as exc:
                    log.warning("[Brain] sleep-time distillation failed: %s", exc)
            if self._reflection is not None and not self._reflection_inflight:
                await self._run_reflection_cycle(tick)
        except Exception as exc:  # never let sleep-time compute take down sleep
            log.warning("[Brain] sleep-time compute failed: %s", exc)

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

        # Phase 18 SKILL-01: quarantine sweep — synchronous, runs before OL dispatch.
        # Update cached trust weights from relationship_context (Pitfall 2 solution).
        if self._quarantine_store is not None and self._peer_filter is not None:
            rel_ctx = params.get("relationship_context", [])
            if isinstance(rel_ctx, list):
                for edge in rel_ctx:
                    if isinstance(edge, dict) and "did" in edge and "weight" in edge:
                        try:
                            self._cached_peer_weights[edge["did"]] = float(edge["weight"])
                        except (TypeError, ValueError):
                            pass
            _sweep_tick = int(params.get("tick", 0) or 0)
            sweep_results = self._quarantine_store.sweep(
                current_tick=_sweep_tick,
                trust_fn=lambda did: self._cached_peer_weights.get(did, 0.0),
            )
            for result in sweep_results:
                if result.promoted:
                    if result.source == "observed":
                        # OL-path promotion: emit SKILL_INFERRED (SKILL-03)
                        # source_event_hash stored in payload_json by observational.py
                        import json as _json
                        try:
                            payload_data = _json.loads(result.payload_json)
                            source_event_hash = payload_data.get("source_event_hash", result.skill_hash)
                        except (json.JSONDecodeError, ValueError):
                            source_event_hash = result.skill_hash
                        actions.append(Action(
                            action_type=ActionType.SKILL_INFERRED,
                            metadata={
                                "skill_hash": result.skill_hash,
                                "source_event_hash": source_event_hash,
                            },
                        ).to_dict())
                    else:
                        # Peer-path promotion: emit SKILL_TAUGHT (unchanged)
                        actions.append(Action(
                            action_type=ActionType.SKILL_TAUGHT,
                            metadata={
                                "skill_hash": result.skill_hash,
                                "teacher_did": result.source_did,
                                "parent_hash": result.parent_hash,
                            },
                        ).to_dict())
                else:
                    actions.append(Action(
                        action_type=ActionType.SKILL_REJECTED,
                        metadata={"rejection_reason": "low_trust"},
                    ).to_dict())

        # Phase 16 D-16-07: Drain pending SLEEP_COMPLETED from previous async run_sleep task.
        if self._pending_sleep_completed is not None:
            actions.append(
                Action(
                    action_type=ActionType.SLEEP_COMPLETED,
                    metadata={"ltm_snapshot_hash": self._pending_sleep_completed},
                ).to_dict()
            )
            self._pending_sleep_completed = None

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
        # Reminder & Wake-Up (spec §3): fire any self-set reminders now due.
        self._fire_due_reminders(tick)
        # Goal evolution (spec §3): demote long-stale, unprogressed goals so attention
        # shifts over time. Deterministic; telos hash only compared at telos events.
        self.telos.evolve(tick)
        runtime = self._get_or_create_ananke(self.did)
        # Tool-loop activation (Phase 72b): when curious + tool-capable, research autonomously.
        if self._should_run_tool_cycle(tick):
            self._last_tool_tick = tick
            import asyncio as _asyncio
            _asyncio.create_task(self._run_tool_cycle(tick))
        # Economic decision cycle (W3b / D-MONEY-09): when a due/RFP exists, the Nous
        # autonomously decides whether to pay / bid. Background task; never fatal.
        if self._should_run_economic_cycle(tick):
            self._last_econ_tick = tick
            import asyncio as _asyncio
            _asyncio.create_task(self._run_economic_cycle(tick))
        # W-A (Mind): the slow planner refills the goal ledger when dry; otherwise
        # the fast decision cycle works the next task. `elif` keeps them mutually
        # exclusive per tick (max one mind-LLM call). Background; never fatal.
        if self._should_run_planner_cycle(tick):
            self._last_plan_tick = tick
            import asyncio as _asyncio
            _asyncio.create_task(self._run_planner_cycle(tick))
        elif self._should_run_decision_cycle(tick):
            self._last_decision_tick = tick
            import asyncio as _asyncio
            _asyncio.create_task(self._run_decision_cycle(tick))
        # W-B: the social/civic cycle — outreach, teaching, lore, voting. Its own
        # (longer) cooldown; may share a tick with the mind cycles (different LLM
        # temperature/purpose, and reveals must never wait behind a busy mind).
        if self._should_run_social_cycle(tick):
            self._last_social_tick = tick
            import asyncio as _asyncio
            _asyncio.create_task(self._run_social_cycle(tick))
        # W-A3: reflection cadence — every tick counts; fires on interval or
        # after repeated failures (inflight-guarded).
        if self._reflection is not None:
            self._reflection.tick()
            if self._should_run_reflection_cycle():
                self._reflection_inflight = True
                import asyncio as _asyncio
                _asyncio.create_task(self._run_reflection_cycle(tick))
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

        # Phase 16 D-16-01: Update Working Memory from most-recent 7 MemoryStore entries.
        if self._hypnos_runtime is not None and self.memory is not None:
            recent = self.memory.recent_memories(limit=7)
            self._hypnos_runtime.working_memory.set_episodes(recent)

            # Phase 16 D-16-02: Trigger sleep cycle every SLEEP_MIN_INTERVAL ticks.
            if (tick - self._last_sleep_tick) >= SLEEP_MIN_INTERVAL:
                self._last_sleep_tick = tick
                # Emit SLEEP_ENTERED synchronously BEFORE creating async task (D-16-Q1).
                snapshot_hash_pre = self._hypnos_runtime.compute_snapshot_hash()
                actions.append(
                    Action(
                        action_type=ActionType.SLEEP_ENTERED,
                        metadata={"ltm_snapshot_hash": snapshot_hash_pre},
                    ).to_dict()
                )
                # Async sleep task; SLEEP_COMPLETED hash stored in _pending_sleep_completed.
                import asyncio as _asyncio

                def _make_sleep_task(
                    rt: HypnosRuntime = self._hypnos_runtime,
                    t: int = tick,
                ) -> None:
                    async def _run() -> None:
                        result_hash = await rt.run_sleep(self.did, t)
                        self._pending_sleep_completed = result_hash
                        # W-A7 (Letta): consolidation is followed by learning —
                        # distill completed goals into skills + force reflection.
                        await self._sleep_time_compute(t)
                    _asyncio.create_task(_run())

                _make_sleep_task()

        # Phase 16 D-16-09: dispatch ObservationalLearner on trade_settled events.
        if self._obs_learner is not None:
            trade_events = params.get("trade_settled_events", [])
            if isinstance(trade_events, list):
                for evt in trade_events:
                    if not isinstance(evt, dict):
                        continue
                    buyer = evt.get("buyer_did", "")
                    seller = evt.get("seller_did", "")
                    # Skip own trades (self is never an observer of own pair).
                    if buyer == self.did or seller == self.did:
                        continue
                    import asyncio as _asyncio
                    _asyncio.create_task(
                        self._obs_learner.observe_trade(buyer, seller, evt.get("item", ""), tick)
                    )

        # Phase 17 Iris — seed relationship-graph priors (optional-dep injection).
        # Processes relationship_context edges from Grid if Iris is enabled.
        # Once-per-(nous_did, target_did) pair: has_prior_for() gate in seed_priors.
        # If _iris_runtime is None (default), this block is a no-op.
        relationship_context = params.get("relationship_context")
        if self._iris_runtime is not None and isinstance(relationship_context, list):
            try:
                seed_priors(
                    edges=relationship_context,
                    nous_did=self.did,
                    store=self._iris_runtime.store,
                    tick=tick,
                    dispatcher=self._iris_runtime.dispatcher,
                )
            except Exception as exc:  # pragma: no cover — Iris is fail-soft
                log.warning("iris: seed_priors failed: %s", exc)

        # Phase 17 D-17-15: IrisRuntime.elicit() — once per peer in dialogue_context.
        # Gated: _iris_runtime present AND dialogue_context is a list (D-17-04).
        # Each ElicitResult may emit: IRIS_BELIEF_REVISED, IRIS_CONTRADICTION_DETECTED,
        # IRIS_PRIOR_SEEDED. IRIS_CONTEXT_INVOKED emitted once if any beliefs injected.
        if self._iris_runtime is not None and isinstance(dialogue_ctxs, list):
            for ctx in dialogue_ctxs:
                if not isinstance(ctx, dict):
                    continue
                target_did = ctx.get("counterparty_did", "")
                if not target_did:
                    continue
                try:
                    result = self._iris_runtime.elicit(
                        nous_did=self.did,
                        target_did=target_did,
                        context=ctx,
                        tick=tick,
                    )
                except Exception as exc:
                    log.warning("iris: elicit failed for %s: %s", target_did, exc)
                    continue

                # IRIS_BELIEF_REVISED: at most once per elicit() call (D-17-06).
                if result.beliefs:
                    actions.append(Action(
                        action_type=ActionType.IRIS_BELIEF_REVISED,
                        metadata={
                            "target_did": target_did,
                            "belief_hash": result.new_hash,
                            "dimension": result.beliefs[0].dimension
                                        if isinstance(result.beliefs[0].dimension, str)
                                        else result.beliefs[0].dimension.value,
                        },
                    ).to_dict())

                # IRIS_CONTRADICTION_DETECTED: fires when confidence delta > threshold.
                if result.contradiction:
                    actions.append(Action(
                        action_type=ActionType.IRIS_CONTRADICTION_DETECTED,
                        metadata={
                            "target_did": target_did,
                            "contradiction_hash": result.prior_hash,
                        },
                    ).to_dict())

                # IRIS_PRIOR_SEEDED: fires when this is the first belief for this pair.
                # Condition: new_hash present AND no prior (prior_hash empty string).
                if result.new_hash and not result.prior_hash:
                    actions.append(Action(
                        action_type=ActionType.IRIS_PRIOR_SEEDED,
                        metadata={
                            "target_did": target_did,
                            "seed_event_hash": result.source_event_hash or result.new_hash,
                        },
                    ).to_dict())

            # Phase 17 D-17-16: context_for() + IRIS_CONTEXT_INVOKED.
            # Called AFTER elicit() so belief_count reflects newly written beliefs.
            # D-17-12: up to 3 most-recently-interacted peers.
            tom_contexts: list = []
            seen_peers: list[str] = []
            for ctx in dialogue_ctxs:
                if not isinstance(ctx, dict):
                    continue
                peer = ctx.get("counterparty_did", "")
                if peer and peer not in seen_peers:
                    seen_peers.append(peer)
            for peer_did in seen_peers[:3]:
                try:
                    tom_ctx = context_for(
                        target_did=peer_did,
                        store=self._iris_runtime.store,
                        k=5,
                    )
                    if tom_ctx.beliefs:
                        tom_contexts.append(tom_ctx)
                except Exception as exc:
                    log.warning("iris: context_for failed for %s: %s", peer_did, exc)

            # D-17-13: IRIS_CONTEXT_INVOKED emitted once per tick when any beliefs injected.
            total_injected = sum(len(tc.beliefs) for tc in tom_contexts)
            if total_injected > 0:
                actions.append(Action(
                    action_type=ActionType.IRIS_CONTEXT_INVOKED,
                    metadata={"belief_count": total_injected},
                ).to_dict())

        # Phase 20 LORE-02: lore discovery poll — every lore_poll_interval ticks (D-20-05/06).
        # Initialize LoreStore on first tick if memory._conn available (lazy init).
        if self._lore_store is None and self.memory is not None and hasattr(self.memory, "_conn"):
            from noesis_brain.lore.store import LoreStore as _LoreStore
            self._lore_store = _LoreStore(self.memory._conn, capacity=self._lore_capacity)

        if self._lore_store is not None and (tick % self._lore_poll_interval) == 0:
            import asyncio as _asyncio

            def _make_lore_poll(
                lore_store=self._lore_store,
                t: int = tick,
                did: str = self.did,
                base_url: str = getattr(self, "_grid_base_url", ""),
                pending_actions: list = self._pending_actions,
            ) -> None:
                async def _poll() -> None:
                    import httpx as _httpx
                    if not base_url:
                        return
                    try:
                        async with _httpx.AsyncClient() as client:
                            resp = await client.get(
                                f"{base_url}/api/v1/grid/lore",
                                params={"limit": "20"},
                                timeout=5.0,
                            )
                            if resp.status_code != 200:
                                return
                            data = resp.json()
                            entries = data.get("entries", [])
                            for item in entries:
                                content_hash = item.get("content_hash", "")
                                contributor_did = item.get("contributor_did", "")
                                if content_hash and not lore_store.has(content_hash):
                                    _req_action = Action(
                                        action_type=ActionType.LORE_REQUEST,
                                        metadata={
                                            "content_hash": content_hash,
                                            "contributor_did": contributor_did,
                                        },
                                    )
                                    pending_actions.append(_req_action)
                    except Exception:
                        pass  # Network errors are silent — discovery is best-effort

                _asyncio.create_task(_poll())

            _make_lore_poll()

        # Phase 20 LORE-02: lore injection at prompt-build (D-20-02).
        # Top-k lore entries by FTS5 relevance injected before directives.
        lore_entries_for_prompt = None
        if self._lore_store is not None:
            _telos_text = str(getattr(self, "_telos", self.telos.describe() if self.telos else ""))
            lore_entries_for_prompt = self._lore_store.retrieve(_telos_text, k=3)
            for _le in lore_entries_for_prompt:
                _cited_action = Action(
                    action_type=ActionType.LORE_CITED,
                    metadata={"content_hash": _le.content_hash},
                )
                self._pending_actions.append(_cited_action)
            # Cache for on_message() build_system_prompt injection (D-20-02 gap closure).
            # Persists the tick's top-k retrieval so lore is visible at next LLM call.
            self._cached_lore_entries = lore_entries_for_prompt if lore_entries_for_prompt else None

        # Drain pending actions (lore response/request/cited queued above)
        for _pa in self._pending_actions:
            actions.append(_pa.to_dict())
        self._pending_actions.clear()

        if not actions:
            # Pre-Phase-7 NOOP fallback preserved verbatim for additive-widening
            # compatibility (matches test_get_state_widening strict-superset rule).
            top_goals = self.telos.top_priority(1)
            if not top_goals:
                actions.append(Action(action_type=ActionType.NOOP).to_dict())
            else:
                # Could generate autonomous action based on goals
                # For Sprint 5, just acknowledge the tick
                actions.append(Action(action_type=ActionType.NOOP).to_dict())

        # Advisory logging (D-10a-06): drive-vs-action divergence is
        # PURE OBSERVATION. This call MUST NOT mutate `actions`.
        # PHILOSOPHY §6 Nous sovereignty: drives inform, never coerce.
        # Advisory logging also runs on the NOOP path — a HIGH drive coupled
        # with a NOOP primary is the canonical divergence case.
        self._advisory_log_divergence(self.did, runtime.state, actions)

        # Phase 40 D-40-07: poll Ollama recovery once per tick when in fallback mode.
        # hasattr guard makes this safe for older tests that pass a plain OllamaAdapter.
        if hasattr(self.llm, "check_recovery"):
            await self.llm.check_recovery()

        # Phase 38 WIRE-01 (D-38-A2): parallel HTTPS dispatch path.
        # When _grid_wire_client is set (GRID_URL configured), forward the
        # action batch to Grid via HTTPS REST in addition to returning it
        # over the Unix socket RPC. BOTH paths receive identical actions.
        # The Unix-socket path is NEVER removed — this is the parallel-path
        # discipline per D-38-A2. Plan 38-03 will queue on network error.
        if self._grid_wire_client is not None and actions:
            import asyncio as _asyncio

            async def _fire_and_forward(
                client: "Any" = self._grid_wire_client,
                acts: list = list(actions),
                t: int = int(params.get("tick", 0)),
            ) -> None:
                try:
                    resp = await client.post_actions(acts, tick=t)
                    if resp.status_code >= 400:
                        log.warning(
                            "[Brain] grid_wire post_actions non-2xx: status=%d body=%s",
                            resp.status_code,
                            resp.text[:200],
                        )
                        # Plan 38-03 will queue here; for now, log + continue.
                except Exception as exc:
                    log.exception("[Brain] grid_wire post_actions raised: %s", exc)

            _asyncio.create_task(_fire_and_forward())

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

    # ────────────────────────────────────────────────────────────────────
    # Phase 58 Wave 4 — D-58-10 / R-58-10: Nous House civic-land capabilities.
    #
    # These verbs are CAPABILITIES, not autoplay. The handler produces a
    # civic-land Action only when the Nous (its chosen behaviour) asks for
    # one — there is NO loop here that auto-buys or auto-builds. The produced
    # Action rides the normal post_actions batch; the Grid action handler
    # routes it by action_type to the civic-parcels route (see wire/client.py
    # CIVIC_LAND_ROUTES). build_civic_land_action() is the local schema gate.
    # ────────────────────────────────────────────────────────────────────

    def produce_civic_land_action(
        self, action_type: ActionType, **metadata: Any
    ) -> Action:
        """Produce a validated civic-land capability Action (no autoplay).

        Thin routing precedent over build_civic_land_action: validates the
        verb's metadata shape and returns an Action for GridWireClient to
        dispatch. Raises ValueError on a malformed shape so the action never
        reaches the Grid. The Nous decides whether/when to call this — the
        Brain never invokes it on the Nous's behalf.
        """
        return build_civic_land_action(action_type, **metadata)

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
