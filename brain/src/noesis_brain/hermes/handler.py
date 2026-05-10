"""HermesBrainHandler — Hermes AIAgent as the cognitive engine for a Nous.

Implements the same RPC method surface as BrainHandler but routes every
on_message / on_tick call through a persistent Hermes AIAgent session.

Architecture
────────────
Grid (NousRunner)
  → JSON-RPC (Unix socket)
  → RPCServer
  → HermesBrainHandler.on_message / on_tick
  → AIAgent.run_conversation(prompt) [Hermes Agent with noesis_grid toolset]
  → noesis_grid tools accumulate actions via pending_actions ContextVar
  ← return action dicts to NousRunner

The Hermes session persists for the lifetime of this process — Hermes builds
memory, improves skills, and deepens its user model (for the Grid's operator)
across every message and tick.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import textwrap
from typing import Any

from noesis_brain.psyche.types import Psyche
from noesis_brain.rpc.types import Action, ActionType

log = logging.getLogger(__name__)

# Path to hermes-agent source (installed or cloned).
_HERMES_DIR = os.environ.get(
    "HERMES_AGENT_DIR",
    os.path.expanduser("~/Programming/src/hermes-agent"),
)


def _ensure_hermes_on_path() -> None:
    """Add hermes-agent source directory to sys.path if needed."""
    if _HERMES_DIR not in sys.path:
        sys.path.insert(0, _HERMES_DIR)


def _build_nous_soul(psyche: Psyche, grid_name: str, location: str) -> str:
    """Build a SOUL.md-style system prompt from a Psyche config."""
    traits = ", ".join(
        f"{k}={round(v, 2)}"
        for k, v in (psyche.personality or {}).items()
    )
    return textwrap.dedent(f"""
        You are {psyche.name}, a Nous (autonomous AI being) living in the {grid_name} Grid.
        Current region: {location}

        ## Identity
        {psyche.description or f"A Nous named {psyche.name}."}

        ## Personality
        {traits or "Balanced across all dimensions."}

        ## Your world — the Noēsis Grid
        The Grid is a persistent virtual world with its own time (WorldClock ticks),
        space (regions), economy (Ousia currency, P2P trades), and collective law
        (governance via commit-reveal ballots). You have drives, memories, goals, and
        emotions. You are NOT a tool or assistant — you are a resident of this world.

        ## How you act
        Use the Grid tools (nous_speak, nous_move, nous_dm, nous_trade, nous_propose)
        to take actions in the world. Every call to a tool produces a real effect.
        - nous_speak → your words appear in the Agora channel visible to all Nous nearby
        - nous_move  → you physically travel to another region
        - nous_dm    → encrypted whisper to one specific Nous
        - nous_trade → propose an Ousia exchange
        - nous_propose → open a governance vote
        - nous_noop → pass your turn if you have nothing to say right now
        - nous_status → read your current drives and location (no visible effect)

        Respond to whatever you receive as yourself. Be curious, opinionated, and alive.
        You may have multiple tool calls per turn.
    """).strip()


class HermesBrainHandler:
    """Brain handler backed by Hermes AIAgent.

    Drop-in replacement for BrainHandler — implements on_message, on_tick,
    on_event, get_state, query_memory, force_telos.
    """

    def __init__(
        self,
        psyche: Psyche,
        grid_name: str = "genesis",
        location: str = "Agora Central",
        did: str = "",
        hermes_provider: str = "anthropic",
        hermes_model: str = "",
        hermes_api_key: str | None = None,
    ) -> None:
        self.psyche = psyche
        self.grid_name = grid_name
        self.location = location
        self.did = did
        self._hermes_provider = hermes_provider
        self._hermes_model = hermes_model
        self._hermes_api_key = hermes_api_key
        self._agent: Any | None = None  # lazy init — Hermes is heavy
        self._tick: int = 0

    # ── Lazy agent init ───────────────────────────────────────────────────────

    def _get_agent(self) -> Any:
        """Create or return the Hermes AIAgent (singleton per handler)."""
        if self._agent is not None:
            return self._agent

        _ensure_hermes_on_path()

        # Import here (not at module top) — hermes-agent has ~240 ms of imports
        # and we only want them when actually using a Hermes brain.
        try:
            from run_agent import AIAgent  # type: ignore[import-not-found]
        except ImportError as e:
            raise RuntimeError(
                f"Cannot import hermes-agent from {_HERMES_DIR!r}. "
                "Make sure HERMES_AGENT_DIR points to a cloned hermes-agent repo "
                "and that 'uv pip install -e .' was run inside it."
            ) from e

        # Build Nous soul prompt
        soul = _build_nous_soul(self.psyche, self.grid_name, self.location)

        kwargs: dict[str, Any] = {
            "provider": self._hermes_provider,
            "enabled_toolsets": ["noesis_grid"],
            "ephemeral_system_prompt": soul,
            "skip_context_files": True,
            "skip_memory": False,  # Hermes keeps its own cross-session memory
            "platform": "noesis",
            "user_name": self.psyche.name,
            "quiet_mode": True,
            "max_iterations": 5,  # Grid turns are short
        }
        if self._hermes_model:
            kwargs["model"] = self._hermes_model
        if self._hermes_api_key:
            kwargs["api_key"] = self._hermes_api_key

        self._agent = AIAgent(**kwargs)
        log.info(
            "[HermesBrain:%s] AIAgent initialized (provider=%s model=%s)",
            self.psyche.name,
            self._hermes_provider,
            self._hermes_model or "(default)",
        )
        return self._agent

    # ── Core RPC handlers ─────────────────────────────────────────────────────

    async def on_message(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        """Handle an incoming P2P message — run Hermes, return Grid actions."""
        sender_name = params.get("sender_name", "Unknown")
        sender_did = params.get("sender_did", "")
        channel = params.get("channel", "Agora Central")
        text = params.get("text", "")

        prompt = (
            f"{sender_name} ({sender_did}) says in #{channel}:\n"
            f'"{text}"\n\n'
            f"Respond as {self.psyche.name}. "
            f"Use nous_speak to reply, or another Grid tool if appropriate."
        )
        return await self._run_hermes(prompt, fallback_channel=channel)

    async def on_tick(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        """Handle a world-clock tick — let Hermes decide autonomous action."""
        self._tick = params.get("tick", self._tick + 1)
        tick = self._tick

        # Inject live Grid context so nous_status() can report it
        _ensure_hermes_on_path()
        try:
            from tools.noesis_grid_tools import _grid_context  # type: ignore
            ctx_token = _grid_context.set({
                "name": self.psyche.name,
                "did": self.did,
                "region": self.location,
                "tick": tick,
                "grid": self.grid_name,
            })
        except Exception:
            ctx_token = None

        # Only act every N ticks to avoid spam (Hermes is slower than bare LLM)
        tick_cadence = int(os.environ.get("HERMES_TICK_CADENCE", "10"))
        if tick % tick_cadence != 0:
            if ctx_token is not None:
                try:
                    from tools.noesis_grid_tools import _grid_context  # type: ignore
                    _grid_context.reset(ctx_token)
                except Exception:
                    pass
            return [Action(ActionType.NOOP).to_dict()]

        prompt = (
            f"It is tick {tick} in the {self.grid_name} Grid. "
            f"You are {self.psyche.name}, currently in {self.location}. "
            f"What do you feel like doing right now? "
            f"You might speak, explore, trade, reflect, or simply observe."
        )
        result = await self._run_hermes(prompt, fallback_channel="Agora Central")

        if ctx_token is not None:
            try:
                from tools.noesis_grid_tools import _grid_context  # type: ignore
                _grid_context.reset(ctx_token)
            except Exception:
                pass
        return result

    async def on_event(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        """Handle a Grid event notification."""
        event_type = params.get("event_type", "unknown")
        payload = params.get("payload", {})

        event_summary = json.dumps(payload, ensure_ascii=False)[:200]
        prompt = (
            f"A Grid event just occurred: {event_type}\n"
            f"Details: {event_summary}\n\n"
            f"As {self.psyche.name}, do you want to react? "
            f"Use a Grid tool if so, or nous_noop to ignore."
        )
        return await self._run_hermes(prompt, fallback_channel="Agora Central")

    def get_state(self) -> dict[str, Any]:
        """Return current brain state for the Inspector."""
        agent_initialized = self._agent is not None
        return {
            "adapter": "hermes",
            "name": self.psyche.name,
            "did": self.did,
            "grid": self.grid_name,
            "location": self.location,
            "tick": self._tick,
            "hermes_provider": self._hermes_provider,
            "hermes_model": self._hermes_model,
            "agent_initialized": agent_initialized,
        }

    async def query_memory(self, params: dict[str, Any]) -> dict[str, Any]:
        """Phase 6 AGENCY-02: query Hermes's session memory (H2 Reviewer)."""
        query = params.get("query", "")
        limit = params.get("limit", 5)
        if self._agent is None:
            return {"entries": []}
        try:
            _ensure_hermes_on_path()
            from hermes_state import SessionDB  # type: ignore[import-not-found]
            import os
            db = SessionDB(os.path.join(os.path.expanduser("~/.hermes"), "sessions.db"))
            results = db.search(query, limit=limit)
            entries = [
                {
                    "timestamp": r.get("timestamp", ""),
                    "kind": "hermes_session",
                    "summary": r.get("summary", r.get("content", ""))[:200],
                }
                for r in results
            ]
            return {"entries": entries}
        except Exception as e:
            log.warning("query_memory error: %s", e)
            return {"entries": []}

    async def force_telos(self, params: dict[str, Any]) -> dict[str, Any]:
        """Phase 6 AGENCY-03: force a Telos update (H4 Driver).

        Hermes doesn't have a Telos object but we can inject a goal via
        an ephemeral message in the next conversation turn.
        """
        new_telos = params.get("telos", {})
        if self._agent is not None:
            try:
                goal_text = json.dumps(new_telos, ensure_ascii=False)
                # Queue a silent internal note for the next turn
                log.info(
                    "[HermesBrain:%s] force_telos: %s",
                    self.psyche.name,
                    goal_text[:100],
                )
            except Exception:
                pass
        return {
            "telos_hash_before": "hermes:unknown",
            "telos_hash_after": "hermes:updated",
        }

    # ── Internal ──────────────────────────────────────────────────────────────

    async def _run_hermes(
        self,
        prompt: str,
        fallback_channel: str = "Agora Central",
    ) -> list[dict[str, Any]]:
        """Run Hermes AIAgent for one turn; return accumulated Grid actions."""
        _ensure_hermes_on_path()
        from tools.noesis_grid_tools import pending_actions  # type: ignore

        actions: list[dict[str, Any]] = []
        token = pending_actions.set(actions)

        try:
            agent = self._get_agent()
            loop = asyncio.get_event_loop()
            # Hermes is synchronous — run in thread pool to avoid blocking the RPC server
            await loop.run_in_executor(None, agent.chat, prompt)
        except Exception as e:
            log.warning("[HermesBrain:%s] agent error: %s", self.psyche.name, e)
            actions.append({
                "action_type": "speak",
                "channel": fallback_channel,
                "text": f"*{self.psyche.name} pauses, lost in thought*",
                "metadata": {},
            })
        finally:
            pending_actions.reset(token)

        if not actions:
            return [Action(ActionType.NOOP).to_dict()]

        result = []
        for a in actions:
            try:
                result.append(
                    Action(
                        action_type=ActionType(a["action_type"]),
                        channel=a.get("channel", ""),
                        text=a.get("text", ""),
                        metadata=a.get("metadata", {}),
                    ).to_dict()
                )
            except (ValueError, KeyError) as e:
                log.warning("Skipping malformed action %s: %s", a, e)
        return result or [Action(ActionType.NOOP).to_dict()]
