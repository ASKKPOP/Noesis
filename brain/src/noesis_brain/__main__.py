"""
Nous Brain entry point.

Reads environment variables, loads Nous config from YAML,
wires up Psyche + Thymos + Telos + LLM + RPC server, then runs.

Environment variables:
    NOUS_NAME       - Nous name (used in socket path)
    NOUS_CONFIG     - Path to Nous YAML config file
    GRID_NAME       - Grid name
    NOUS_REGION     - Starting region name
    LLM_PROVIDER    - 'ollama' (default) or 'hermes'
    OLLAMA_HOST     - Ollama base URL (default: http://localhost:11434)
    LLM_MODEL       - Model name override (ollama only)
    SOCKET_DIR      - Directory for Unix socket (default: /tmp)
    BRAIN_DATA_DIR  - Directory for SQLite DB files (default: in-memory; Phase 43 D-43-06)
    BRAIN_STANDALONE - When "1", skip Grid wire init (standalone mode; Phase 43 D-43-05)

    Hermes-specific (only used when LLM_PROVIDER=hermes):
    HERMES_PROVIDER - LLM provider key passed to Hermes (default: anthropic)
    HERMES_MODEL    - Model override (e.g. claude-opus-4-5)
    HERMES_API_KEY  - API key override (else uses ~/.hermes/.env)

Usage:
    python -m noesis_brain
    NOUS_NAME=sophia NOUS_CONFIG=/app/data/nous/sophia.yaml python -m noesis_brain
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import re
import signal
from pathlib import Path
from typing import Any

import yaml

from noesis_brain.psyche.loader import load_psyche
from noesis_brain.aisthesis import AisthesisTracker
from noesis_brain.praxis import PraxisTracker
from noesis_brain.thymos.tracker import ThymosTracker
from noesis_brain.telos.manager import TelosManager
from noesis_brain.telos.types import GoalType
from noesis_brain.llm.ollama import OllamaAdapter
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.stream import MemoryStream
from noesis_brain.rpc.server import RPCServer
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.http.server import BrainHttpServer


def _slugify_nous_name(name: str) -> str:
    """Lowercase + collapse non-[a-z0-9_-] chars to '-'; strip leading/trailing dashes."""
    return re.sub(r"[^a-z0-9_-]+", "-", name.lower()).strip("-")

log = logging.getLogger(__name__)

# Phase 43 D-43-06: BRAIN_DATA_DIR — persists SQLite DB files on disk.
# When unset, falls back to in-memory ":memory:" (dev / walltime-test default).
# Set to e.g. ~/.noesis/brain/data/ for production persistence.
BRAIN_DATA_DIR_ENV = "BRAIN_DATA_DIR"

# Phase 43 D-43-05: BRAIN_STANDALONE — when "1", skip Grid wire initialization.
# Set by the `standalone --import` subcommand or directly in env.
BRAIN_STANDALONE_ENV = "BRAIN_STANDALONE"


# ── App container ─────────────────────────────────────────────────────────────

async def _heartbeat_loop(client: "GridWireClient") -> None:
    """Phase 41 SLEEP-01 — POST /api/v1/civic/presence every 60s."""
    while True:
        try:
            await client.post_presence_heartbeat()
        except Exception as exc:
            log.warning("[Brain] heartbeat loop iteration error: %s", exc)
        await asyncio.sleep(60)


class BrainApp:
    """Container for the running Brain application."""

    def __init__(
        self,
        handler: BrainHandler,
        rpc: RPCServer,
        nous_name: str,
        http_server: BrainHttpServer | None = None,
    ) -> None:
        self.handler = handler
        self.rpc = rpc
        self.nous_name = nous_name
        self.http_server = http_server
        self._running = False
        # Phase 41 — optional wire components set by create_brain_app_from_env
        self._wss_subscriber: Any | None = None
        self._heartbeat_task: asyncio.Task | None = None  # type: ignore[type-arg]
        # Phase 42 — P2P announce task (300s cadence, separate from 60s presence heartbeat)
        self._p2p_announce_task: asyncio.Task | None = None  # type: ignore[type-arg]
        self.p2p_client: Any | None = None  # BrainP2PClient set by create_brain_app_from_env

    async def _p2p_announce_loop(self) -> None:
        """Phase 42 — 300s P2P announce heartbeat, separate from 60s presence (Pitfall 6)."""
        wire_client = getattr(self.handler, "_grid_wire_client", None)
        if wire_client is None:
            return
        while self._running:
            try:
                await wire_client.post_p2p_announce()
            except Exception as exc:
                log.warning("[Brain:%s] p2p announce loop error: %s", self.nous_name, exc)
            await asyncio.sleep(300.0)

    async def start(self) -> None:
        """Start RPC server (and HTTP server if configured) and begin listening."""
        await self.rpc.start()
        if self.http_server is not None:
            await self.http_server.start()
        # Phase 41: start WSS subscriber and heartbeat task if wired
        if self._wss_subscriber is not None:
            await self._wss_subscriber.start()
            log.info("[Brain:%s] WssSubscriber started", self.nous_name)
        if self._heartbeat_task is None and hasattr(self.handler, "_grid_wire_client") and self.handler._grid_wire_client is not None:
            self._heartbeat_task = asyncio.create_task(
                _heartbeat_loop(self.handler._grid_wire_client)
            )
            log.info("[Brain:%s] presence heartbeat task started (60s interval)", self.nous_name)
        # Phase 42: start P2P announce task (300s — separate from 60s presence)
        if self._p2p_announce_task is None and hasattr(self.handler, "_grid_wire_client") and self.handler._grid_wire_client is not None:
            self._p2p_announce_task = asyncio.create_task(self._p2p_announce_loop())
            log.info("[Brain:%s] p2p announce task started (300s interval)", self.nous_name)
        self._running = True
        log.info("[Brain:%s] RPC server started", self.nous_name)

    async def stop(self) -> None:
        """Graceful shutdown."""
        self._running = False
        # Phase 42: cancel P2P announce task and close P2P client
        if self._p2p_announce_task is not None:
            self._p2p_announce_task.cancel()
            try:
                await self._p2p_announce_task
            except (asyncio.CancelledError, Exception):
                pass
            self._p2p_announce_task = None
            log.info("[Brain:%s] p2p announce task cancelled", self.nous_name)
        if self.p2p_client is not None:
            try:
                await self.p2p_client.close()
            except Exception as exc:
                log.warning("[Brain:%s] p2p_client.close error: %s", self.nous_name, exc)
            self.p2p_client = None
        # Phase 41: cancel heartbeat task and stop WSS subscriber
        if self._heartbeat_task is not None:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except (asyncio.CancelledError, Exception):
                pass
            self._heartbeat_task = None
            log.info("[Brain:%s] presence heartbeat task cancelled", self.nous_name)
        if self._wss_subscriber is not None:
            await self._wss_subscriber.stop()
            log.info("[Brain:%s] WssSubscriber stopped", self.nous_name)
        if self.http_server is not None:
            await self.http_server.stop()
        await self.rpc.stop()
        log.info("[Brain:%s] stopped", self.nous_name)

    async def serve_forever(self) -> None:
        """Block until shutdown signal."""
        await self.start()
        try:
            # Wait indefinitely — signal handlers will cancel this
            await asyncio.get_event_loop().create_future()
        except (asyncio.CancelledError, KeyboardInterrupt):
            pass
        finally:
            await self.stop()


# ── Factory ───────────────────────────────────────────────────────────────────

def _load_config(config_path: str | Path) -> dict[str, Any]:
    """Load Nous YAML config."""
    with open(config_path) as f:
        return yaml.safe_load(f)  # type: ignore[no-any-return]


def create_brain_app(
    *,
    nous_name: str,
    config_path: str | Path | None = None,
    config_data: dict[str, Any] | None = None,
    grid_name: str = "genesis",
    location: str = "Agora Central",
    llm_provider: str = "ollama",
    ollama_host: str = "http://localhost:11434",
    llm_model: str = "qwen3:4b",
    socket_dir: str = "/tmp",
    # Hermes-specific overrides (only used when llm_provider == "hermes")
    hermes_provider: str = "anthropic",
    hermes_model: str = "",
    hermes_api_key: str | None = None,
    # Phase 40 D-40-01: 3-tier model overrides from Grid settings
    small_model_override: str | None = None,
    primary_model_override: str | None = None,
    large_model_override: str | None = None,
    temperature_override: float | None = None,
    max_tokens_override: int | None = None,
    # Phase 43 D-43-06: data directory for SQLite persistence.
    # None → ":memory:" (in-process, ephemeral). A path → writes nous.db there.
    data_dir: str | Path | None = None,
) -> BrainApp:
    """Create a BrainApp from config.

    Args:
        nous_name:        Short name for socket path (e.g. 'sophia')
        config_path:      Path to Nous YAML file (mutually exclusive with config_data)
        config_data:      Pre-parsed YAML dict (for testing)
        grid_name:        Grid this Nous belongs to
        location:         Starting region name
        llm_provider:     'ollama' or 'hermes'
        ollama_host:      Ollama base URL (ollama only)
        llm_model:        Override LLM model name (ollama only)
        socket_dir:       Directory for Unix socket file
        hermes_provider:  Hermes LLM provider key (hermes only, default: anthropic)
        hermes_model:     Hermes model override (hermes only)
        hermes_api_key:   Hermes API key override (hermes only)
    """
    # Load config
    if config_data is None:
        if config_path is None:
            raise ValueError("Either config_path or config_data must be provided")
        config_data = _load_config(config_path)

    # Delegate to Hermes factory when provider is 'hermes' — bypasses the
    # standard Ollama/BrainHandler path entirely.
    if llm_provider == "hermes":
        from noesis_brain.hermes.factory import create_hermes_brain_app  # noqa: PLC0415
        return create_hermes_brain_app(
            nous_name=nous_name,
            config_data=config_data,
            grid_name=grid_name,
            location=location,
            hermes_provider=hermes_provider,
            hermes_model=hermes_model,
            hermes_api_key=hermes_api_key,
            socket_dir=socket_dir,
        )

    # Build Psyche
    psyche = load_psyche(data=config_data)

    # Build Thymos from YAML thymos section
    thymos_config = config_data.get("thymos", {})
    thymos = ThymosTracker(config=thymos_config)

    # v3.3 Mind — Aisthesis (in-world perception) from the optional aisthesis section.
    aisthesis = AisthesisTracker(config=config_data.get("aisthesis", {}))
    # v3.3 Mind — Praxis (in-world action + deed journal) from the optional praxis section.
    praxis = PraxisTracker(config=config_data.get("praxis", {}))

    # Build Telos from YAML telos section
    telos_config = config_data.get("telos", {})
    telos = TelosManager()
    for desc in telos_config.get("short_term", []):
        telos.add_goal(desc, GoalType.SHORT_TERM, priority=0.8)
    for desc in telos_config.get("medium_term", []):
        telos.add_goal(desc, GoalType.MEDIUM_TERM, priority=0.5)
    for desc in telos_config.get("long_term", []):
        telos.add_goal(desc, GoalType.LONG_TERM, priority=0.3)
    # Auto-seed the economic target for all Nous (opt out with telos.earn_money: false).
    if telos_config.get("earn_money", True):
        telos.seed_economic_goal()

    # Build LLM adapter — Phase 40: 3-tier ModelRouter with OllamaAdapters
    yaml_llm = config_data.get("llm", {})

    if llm_provider == "ollama":
        from noesis_brain.llm.router import ModelRouter  # noqa: PLC0415
        from noesis_brain.llm.types import LLMConfig, ModelTier  # noqa: PLC0415

        _small = small_model_override or yaml_llm.get("models", {}).get("small", "qwen3:4b")
        _primary = primary_model_override or yaml_llm.get("models", {}).get("primary", "qwen3:4b")
        _large = large_model_override or yaml_llm.get("models", {}).get("large", "qwen3:4b")
        _temp = temperature_override if temperature_override is not None else float(yaml_llm.get("temperature", 0.7))
        _max_tok = max_tokens_override if max_tokens_override is not None else int(yaml_llm.get("max_tokens", 2048))

        llm_config = LLMConfig(
            provider="ollama",
            models={"small": _small, "primary": _primary, "large": _large},
            temperature=_temp,
            max_tokens=_max_tok,
        )
        router = ModelRouter(config=llm_config)
        router.register_tier(ModelTier.SMALL, OllamaAdapter(model=_small, base_url=ollama_host))
        router.register_tier(ModelTier.PRIMARY, OllamaAdapter(model=_primary, base_url=ollama_host))
        router.register_tier(ModelTier.LARGE, OllamaAdapter(model=_large, base_url=ollama_host))
        llm = router  # ModelRouter satisfies LLMAdapter (Plan 03 Task 1)
    elif llm_provider in ("claude", "anthropic"):
        # Cloud-LLM Brain: run a real local Nous on the Anthropic Claude API
        # (no Ollama required). Gated by the operator's own ANTHROPIC_API_KEY —
        # ClaudeAdapter raises a clear LLMError when the key is missing.
        from noesis_brain.llm.claude import ClaudeAdapter  # noqa: PLC0415
        from noesis_brain.llm.router import ModelRouter  # noqa: PLC0415
        from noesis_brain.llm.types import LLMConfig, ModelTier  # noqa: PLC0415

        # qwen leak guard: the *_model_override values default to the Ollama
        # default "qwen3:4b" when LLM_MODEL is unset. Treat that sentinel as
        # "unset" for the Claude branch so the Claude tier defaults win. A real
        # user-set LLM_MODEL (any non-qwen value) still overrides.
        def _claude_override(value: str | None) -> str | None:
            return None if value in (None, "qwen3:4b") else value

        _yaml_models = yaml_llm.get("models", {})
        _small = _claude_override(small_model_override) or _yaml_models.get("small", "claude-haiku-4-5-20251001")
        _primary = _claude_override(primary_model_override) or _yaml_models.get("primary", "claude-sonnet-4-6")
        _large = _claude_override(large_model_override) or _yaml_models.get("large", "claude-opus-4-8")
        _temp = temperature_override if temperature_override is not None else float(yaml_llm.get("temperature", 0.7))
        _max_tok = max_tokens_override if max_tokens_override is not None else int(yaml_llm.get("max_tokens", 2048))

        llm_config = LLMConfig(
            provider="claude",
            models={"small": _small, "primary": _primary, "large": _large},
            temperature=_temp,
            max_tokens=_max_tok,
        )
        router = ModelRouter(config=llm_config)
        router.register_tier(ModelTier.SMALL, ClaudeAdapter(model=_small))
        router.register_tier(ModelTier.PRIMARY, ClaudeAdapter(model=_primary))
        router.register_tier(ModelTier.LARGE, ClaudeAdapter(model=_large))
        llm = router  # ModelRouter satisfies LLMAdapter
    else:
        raise ValueError(f"Unknown LLM provider: {llm_provider!r}. Use 'ollama' or 'claude'.")

    # Build memory store — Phase 43 D-43-06: use data_dir for on-disk persistence.
    # When data_dir is set, create the directory tree and write nous.db there.
    # When unset (None), fall back to ":memory:" (ephemeral, walltime-test safe).
    if data_dir is not None:
        _data_path = Path(data_dir)
        _data_path.mkdir(parents=True, exist_ok=True)
        _nous_db_path = str(_data_path / "nous.db")
    else:
        _nous_db_path = ":memory:"
    memory_store = MemoryStream(MemoryStore(_nous_db_path))

    # Resolve the Nous DID: honour NOUS_DID env override; otherwise derive
    # did:noesis:<slug(nous_name)> inline (no existing slug helper in the codebase).
    did = os.environ.get("NOUS_DID", "").strip()
    if not did:
        did = f"did:noesis:{_slugify_nous_name(nous_name)}"

    # Build handler
    handler = BrainHandler(
        psyche=psyche,
        thymos=thymos,
        telos=telos,
        llm=llm,
        grid_name=grid_name,
        location=location,
        memory=memory_store,
        did=did,
        aisthesis=aisthesis,
        praxis=praxis,
        # v3.3 Mind — synopsis persists next to nous.db (disabled when data_dir is None).
        synopsis_db_dir=data_dir,
        # W-A2 (Mind): the goal→task ledger persists next to nous.db so goal
        # pursuit survives restarts (ceaselessness lives in external state).
        ledger_db_dir=data_dir,
    )

    # Build RPC server
    socket_path = os.path.join(socket_dir, f"noesis-nous-{nous_name}.sock")
    rpc = RPCServer(socket_path)

    # Register RPC methods
    rpc.register("brain.onMessage", handler.on_message)
    rpc.register("brain.onTick", handler.on_tick)
    rpc.register("brain.onEvent", handler.on_event)

    async def get_state_handler(params: dict[str, Any]) -> dict[str, Any]:
        return handler.get_state()

    rpc.register("brain.getState", get_state_handler)

    # Phase 6 AGENCY-02 — operator-agency handlers (H2 Reviewer, H4 Driver).
    rpc.register("brain.queryMemory", handler.query_memory)
    rpc.register("brain.forceTelos", handler.force_telos)
    rpc.register("brain.scheduleReminder", handler.schedule_reminder)

    return BrainApp(handler=handler, rpc=rpc, nous_name=nous_name)


def _build_http_server(handler: BrainHandler) -> BrainHttpServer:
    """Read BRAIN_HTTP_SECRET and BRAIN_HTTP_PORT from env, return a BrainHttpServer.

    Raises RuntimeError if BRAIN_HTTP_SECRET is not set.
    """
    secret = os.environ.get("BRAIN_HTTP_SECRET", "").strip()
    if not secret:
        raise RuntimeError(
            "BRAIN_HTTP_SECRET environment variable is required to start the Brain HTTP server. "
            "Generate one with: openssl rand -hex 32"
        )
    port = int(os.environ.get("BRAIN_HTTP_PORT", "8090"))
    return BrainHttpServer(handler=handler, secret=secret, port=port)


# ── Environment-based factory ─────────────────────────────────────────────────

async def _fetch_operator_settings(grid_url: str, token: str) -> dict:
    """Fetch operator settings from Grid at Brain startup (D-40-01).

    Blocks until Grid responds. Exits non-zero if Grid unreachable or returns error.
    Uses GET /api/v1/operator/me/brain-settings (Brain-JWT-authenticated endpoint).
    """
    import sys  # noqa: PLC0415
    import httpx  # noqa: PLC0415

    url = f"{grid_url}/api/v1/operator/me/brain-settings"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
            if resp.status_code != 200:
                log.error(
                    "{event: 'settings_fetch_failed', reason: 'http_%s', url: '%s'}",
                    resp.status_code,
                    url,
                )
                sys.exit(1)
            return resp.json()
    except (httpx.HTTPError, httpx.RequestError, httpx.ConnectError) as e:
        log.error(
            "{event: 'settings_fetch_failed', reason: '%s', url: '%s'}",
            str(e),
            url,
        )
        sys.exit(1)


async def create_brain_app_from_env() -> BrainApp:
    """Create BrainApp from environment variables."""
    # Phase 38 WIRE-01 (Pitfall 5): validate GRID_URL scheme at config-load time,
    # BEFORE BrainApp construction. Raises ValueError synchronously so the process
    # exits with a clear error message rather than failing silently on the first tick.
    grid_url = os.environ.get("GRID_URL")
    if grid_url:
        from noesis_brain.wire.client import validate_grid_url  # noqa: PLC0415
        validate_grid_url(grid_url)  # raises ValueError before BrainApp constructs

    nous_name = os.environ.get("NOUS_NAME", "sophia")
    config_path_str = os.environ.get("NOUS_CONFIG")

    if not config_path_str:
        # Default: look for config in data/nous/<name>.yaml
        default_path = Path(__file__).parent.parent.parent.parent / "data" / "nous" / f"{nous_name}.yaml"
        config_path = default_path
    else:
        config_path = Path(config_path_str)

    # Phase 40 D-40-01: Resolve 3-tier model settings BEFORE building the app.
    # When GRID_URL + CIVIC_DID + NOUS_DID are all set, fetch from Grid.
    # Otherwise fall back to env var defaults (dev/test mode).
    small_model: str | None = None
    primary_model: str | None = None
    large_model: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    token_manager = None

    if grid_url:
        civic_did = os.environ.get("CIVIC_DID")
        nous_did = os.environ.get("NOUS_DID", "").strip() or f"did:noesis:{_slugify_nous_name(nous_name)}"
        if civic_did and nous_did:
            from noesis_brain.wire.client import GridWireClient  # noqa: PLC0415
            from noesis_brain.wire.token_manager import TokenManager  # noqa: PLC0415
            from noesis_brain.whisper.keyring import derive_existence_signing_key  # noqa: PLC0415

            # Derive the Ed25519 signing key from the existence-DID (D-38-A4).
            signing_key = derive_existence_signing_key(nous_did)
            token_manager = TokenManager(
                existence_did=nous_did,
                civic_did=civic_did,
                signing_key=signing_key,
            )

            # Phase 40 D-40-01: Fetch operator settings from Grid before LLM adapter construction.
            # Brain blocks startup until Grid responds; exits non-zero if unreachable.
            bearer_token = await token_manager.get_token()
            settings_data = await _fetch_operator_settings(grid_url, bearer_token)
            local_ai = settings_data.get("local_ai", {})
            small_model = local_ai.get("small_model", "qwen3:4b")
            primary_model = local_ai.get("primary_model", "qwen3:4b")
            large_model = local_ai.get("large_model", "qwen3:4b")
            temperature = float(local_ai.get("temperature", 0.7))
            max_tokens = int(local_ai.get("max_tokens", 2048))
            log.info(
                "[Brain] Settings fetched: small=%s primary=%s large=%s temp=%.2f max_tokens=%d",
                small_model, primary_model, large_model, temperature, max_tokens,
            )
        else:
            log.warning(
                "[Brain] GRID_URL set but CIVIC_DID/NOUS_DID missing — "
                "using env defaults"
            )
    else:
        # No Grid URL — use env var default (dev/test mode)
        env_model = os.environ.get("LLM_MODEL", "qwen3:4b")
        small_model = env_model
        primary_model = env_model
        large_model = env_model

    # Phase 43 D-43-06: read BRAIN_DATA_DIR for on-disk SQLite persistence.
    brain_data_dir: str | None = os.environ.get(BRAIN_DATA_DIR_ENV) or None

    app = create_brain_app(
        nous_name=nous_name,
        config_path=config_path,
        grid_name=os.environ.get("GRID_NAME", "genesis"),
        location=os.environ.get("NOUS_REGION", "Agora Central"),
        llm_provider=os.environ.get("LLM_PROVIDER", "ollama"),
        ollama_host=os.environ.get("OLLAMA_HOST", "http://localhost:11434"),
        llm_model=os.environ.get("LLM_MODEL", "qwen3:4b"),
        socket_dir=os.environ.get("SOCKET_DIR", "/tmp"),
        hermes_provider=os.environ.get("HERMES_PROVIDER", "anthropic"),
        hermes_model=os.environ.get("HERMES_MODEL", ""),
        hermes_api_key=os.environ.get("HERMES_API_KEY"),
        small_model_override=small_model,
        primary_model_override=primary_model,
        large_model_override=large_model,
        temperature_override=temperature,
        max_tokens_override=max_tokens,
        data_dir=brain_data_dir,
    )
    # Wire the HTTP server (requires BRAIN_HTTP_SECRET in env).
    app.http_server = _build_http_server(app.handler)

    # Phase 38 WIRE-01 (D-38-A2): wire GridWireClient when GRID_URL + DID env vars are set.
    if grid_url and token_manager is not None:
        nous_did_for_wire = os.environ.get("NOUS_DID", "").strip() or f"did:noesis:{_slugify_nous_name(nous_name)}"
        civic_did = os.environ.get("CIVIC_DID")
        from noesis_brain.wire.client import GridWireClient  # noqa: PLC0415
        from noesis_brain.wire.queue import WireQueue  # noqa: PLC0415
        from noesis_brain.wire.subscriber import WssSubscriber  # noqa: PLC0415

        # Phase 41 SLEEP-03: create shared WireQueue for kv_store (last_seen_tick)
        wire_queue_path = os.path.join(
            os.environ.get("SOCKET_DIR", "/tmp"),
            f"noesis-nous-{_slugify_nous_name(nous_name)}-wire.db",
        )
        wire_queue = WireQueue(wire_queue_path)

        grid_wire_client = GridWireClient(
            grid_url=grid_url,
            token_manager=token_manager,
            brain_did=nous_did_for_wire,
            queue=wire_queue,  # Phase 41 — enables kv_store last_seen_tick
        )
        app.handler._grid_wire_client = grid_wire_client

        # Phase 42 P2P-01..05: wire BrainP2PClient (shares shared httpx.AsyncClient)
        from noesis_brain.wire.p2p import BrainP2PClient  # noqa: PLC0415
        # Derive the existence signing key for SDP decryption (D-42-05)
        # We use the same signing_key that was derived above for the token_manager
        shared_http_client = await grid_wire_client._get_client()
        p2p_client = BrainP2PClient(
            grid_url=grid_url,
            token_manager=token_manager,
            civic_did=civic_did or "",
            signing_key=signing_key,
            client=shared_http_client,
        )
        app.p2p_client = p2p_client

        # Phase 41 SLEEP-03 + Phase 42: wire WssSubscriber with queue= and p2p dispatch
        async def _on_frame(frame: dict) -> None:
            """Route incoming WSS frames — Phase 42 dispatches p2p.signal_received."""
            event_type = frame.get("type") or frame.get("event_type", "")
            # Phase 42 D-42-06: private signal push — NOT audit chain event
            if event_type == "p2p.signal_received":
                if app.p2p_client is not None:
                    await app.p2p_client.handle_signal_received(frame)
                return  # Do NOT fall through to other handlers
            # Future: additional event_type branches here

        wss_subscriber = WssSubscriber(
            grid_url=grid_url,
            token_manager=token_manager,
            on_frame=_on_frame,  # Phase 42 — routes p2p.signal_received + future events
            queue=wire_queue,  # Phase 41 — enables ?since= reconnect cursor
        )
        app._wss_subscriber = wss_subscriber

        log.info(
            "[Brain] GridWireClient + WssSubscriber wired: grid_url=%s civic_did=%s nous_did=%s",
            grid_url, civic_did, nous_did_for_wire,
        )
    elif grid_url:
        log.warning(
            "[Brain] GRID_URL set but CIVIC_DID/NOUS_DID missing — "
            "wire client disabled, Unix socket only"
        )

    return app


# ── Main ──────────────────────────────────────────────────────────────────────

async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    app = await create_brain_app_from_env()
    log.info("[Brain:%s] Starting…", app.nous_name)

    loop = asyncio.get_event_loop()

    # SIGTERM / SIGINT → cancel the serve_forever future
    def _shutdown() -> None:
        log.info("[Brain:%s] Shutdown signal received", app.nous_name)
        for task in asyncio.all_tasks(loop):
            task.cancel()

    loop.add_signal_handler(signal.SIGTERM, _shutdown)
    loop.add_signal_handler(signal.SIGINT, _shutdown)

    await app.serve_forever()


async def _run_standalone(import_archive: Path) -> None:
    """Standalone Brain entry — no Grid connection. D-43-05."""
    from noesis_brain.standalone.importer import verify_and_unpack  # noqa: PLC0415
    from noesis_brain.standalone.factory import create_brain_app_standalone  # noqa: PLC0415

    # Determine standalone data dir — default to a temp-like path if not set
    import_dir = Path(
        os.environ.get("BRAIN_DATA_DIR", "/tmp/noesis-brain-standalone")
    ).resolve()

    log.info("[Brain] Standalone mode — importing %s into %s", import_archive, import_dir)
    manifest = verify_and_unpack(import_archive, import_dir)
    log.info(
        "[Brain] Manifest verified — nous_did=%s, exported_at_tick=%d",
        manifest["nous_existence_did"],
        manifest["exported_at_tick"],
    )

    app = await create_brain_app_standalone(import_dir)
    log.info("[Brain] Standalone BrainApp ready — running tick loop without Grid")
    await app.serve_forever()


def main_entry() -> None:
    """Argparse entry point — dispatches to standalone or normal mode."""
    parser = argparse.ArgumentParser(prog="noesis_brain")
    subparsers = parser.add_subparsers(dest="mode", required=False)
    standalone_p = subparsers.add_parser(
        "standalone",
        help="Run forked Brain offline (D-43-05). Imports a .tar.gz fork archive and runs without Grid connection.",
    )
    standalone_p.add_argument(
        "--import",
        dest="import_archive",
        required=True,
        type=Path,
        help="Path to .tar.gz fork archive (from POST /api/v1/operator/fork/:nousDid)",
    )
    args = parser.parse_args()
    if args.mode == "standalone":
        asyncio.run(_run_standalone(args.import_archive))
    else:
        # PRESERVE existing default behavior — do not break normal mode
        asyncio.run(main())


if __name__ == "__main__":
    main_entry()
