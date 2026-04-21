"""
Nous Brain entry point.

Reads environment variables, loads Nous config from YAML,
wires up Psyche + Thymos + Telos + LLM + RPC server, then runs.

Environment variables:
    NOUS_NAME       - Nous name (used in socket path)
    NOUS_CONFIG     - Path to Nous YAML config file
    GRID_NAME       - Grid name
    NOUS_REGION     - Starting region name
    LLM_PROVIDER    - 'ollama' (default) or 'mock'
    OLLAMA_HOST     - Ollama base URL (default: http://localhost:11434)
    LLM_MODEL       - Model name override
    SOCKET_DIR      - Directory for Unix socket (default: /tmp)

Usage:
    python -m noesis_brain
    NOUS_NAME=sophia NOUS_CONFIG=/app/data/nous/sophia.yaml python -m noesis_brain
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import signal
from pathlib import Path
from typing import Any

import yaml

from noesis_brain.psyche.loader import load_psyche
from noesis_brain.thymos.tracker import ThymosTracker
from noesis_brain.telos.manager import TelosManager
from noesis_brain.telos.types import GoalType
from noesis_brain.llm.ollama import OllamaAdapter
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.stream import MemoryStream
from noesis_brain.rpc.server import RPCServer
from noesis_brain.rpc.handler import BrainHandler


def _slugify_nous_name(name: str) -> str:
    """Lowercase + collapse non-[a-z0-9_-] chars to '-'; strip leading/trailing dashes."""
    return re.sub(r"[^a-z0-9_-]+", "-", name.lower()).strip("-")

log = logging.getLogger(__name__)


# ── App container ─────────────────────────────────────────────────────────────

class BrainApp:
    """Container for the running Brain application."""

    def __init__(
        self,
        handler: BrainHandler,
        rpc: RPCServer,
        nous_name: str,
    ) -> None:
        self.handler = handler
        self.rpc = rpc
        self.nous_name = nous_name
        self._running = False

    async def start(self) -> None:
        """Start RPC server and begin listening."""
        await self.rpc.start()
        self._running = True
        log.info("[Brain:%s] RPC server started", self.nous_name)

    async def stop(self) -> None:
        """Graceful shutdown."""
        self._running = False
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
) -> BrainApp:
    """Create a BrainApp from config.

    Args:
        nous_name:    Short name for socket path (e.g. 'sophia')
        config_path:  Path to Nous YAML file (mutually exclusive with config_data)
        config_data:  Pre-parsed YAML dict (for testing)
        grid_name:    Grid this Nous belongs to
        location:     Starting region name
        llm_provider: 'ollama' or 'mock'
        ollama_host:  Ollama base URL
        llm_model:    Override LLM model name
        socket_dir:   Directory for Unix socket file
    """
    # Load config
    if config_data is None:
        if config_path is None:
            raise ValueError("Either config_path or config_data must be provided")
        config_data = _load_config(config_path)

    # Build Psyche
    psyche = load_psyche(data=config_data)

    # Build Thymos from YAML thymos section
    thymos_config = config_data.get("thymos", {})
    thymos = ThymosTracker(config=thymos_config)

    # Build Telos from YAML telos section
    telos_config = config_data.get("telos", {})
    telos = TelosManager()
    for desc in telos_config.get("short_term", []):
        telos.add_goal(desc, GoalType.SHORT_TERM, priority=0.8)
    for desc in telos_config.get("medium_term", []):
        telos.add_goal(desc, GoalType.MEDIUM_TERM, priority=0.5)
    for desc in telos_config.get("long_term", []):
        telos.add_goal(desc, GoalType.LONG_TERM, priority=0.3)

    # Build LLM adapter
    # Override model from YAML if not provided via env
    yaml_llm = config_data.get("llm", {})
    model = llm_model or yaml_llm.get("models", {}).get("primary", "qwen3:4b")

    if llm_provider == "ollama":
        llm = OllamaAdapter(model=model, base_url=ollama_host)
    else:
        raise ValueError(f"Unknown LLM provider: {llm_provider!r}. Use 'ollama'.")

    # Build memory store (in-memory SQLite by default; Phase 4 does not persist).
    memory_store = MemoryStream(MemoryStore(":memory:"))

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

    return BrainApp(handler=handler, rpc=rpc, nous_name=nous_name)


# ── Environment-based factory ─────────────────────────────────────────────────

def create_brain_app_from_env() -> BrainApp:
    """Create BrainApp from environment variables."""
    nous_name = os.environ.get("NOUS_NAME", "sophia")
    config_path_str = os.environ.get("NOUS_CONFIG")

    if not config_path_str:
        # Default: look for config in data/nous/<name>.yaml
        default_path = Path(__file__).parent.parent.parent.parent / "data" / "nous" / f"{nous_name}.yaml"
        config_path = default_path
    else:
        config_path = Path(config_path_str)

    return create_brain_app(
        nous_name=nous_name,
        config_path=config_path,
        grid_name=os.environ.get("GRID_NAME", "genesis"),
        location=os.environ.get("NOUS_REGION", "Agora Central"),
        llm_provider=os.environ.get("LLM_PROVIDER", "ollama"),
        ollama_host=os.environ.get("OLLAMA_HOST", "http://localhost:11434"),
        llm_model=os.environ.get("LLM_MODEL", "qwen3:4b"),
        socket_dir=os.environ.get("SOCKET_DIR", "/tmp"),
    )


# ── Main ──────────────────────────────────────────────────────────────────────

async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    app = create_brain_app_from_env()
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


if __name__ == "__main__":
    asyncio.run(main())
