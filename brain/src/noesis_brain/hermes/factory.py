"""Factory for Hermes-powered BrainApp instances."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import yaml

from noesis_brain.psyche.loader import load_psyche
from noesis_brain.rpc.server import RPCServer
from noesis_brain.hermes.handler import HermesBrainHandler

# Reuse the BrainApp container from the standard __main__
from noesis_brain.__main__ import BrainApp


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9_-]+", "-", name.lower()).strip("-")


def create_hermes_brain_app(
    *,
    nous_name: str,
    config_path: str | Path | None = None,
    config_data: dict[str, Any] | None = None,
    grid_name: str = "genesis",
    location: str = "Agora Central",
    hermes_provider: str = "anthropic",
    hermes_model: str = "",
    hermes_api_key: str | None = None,
    socket_dir: str = "/tmp",
) -> BrainApp:
    """Create a Hermes-powered BrainApp ready to serve a Nous.

    Args:
        nous_name:        Short name (used in socket path).
        config_path:      Path to Nous YAML (mutually exclusive with config_data).
        config_data:      Pre-parsed YAML dict (for testing).
        grid_name:        Grid this Nous belongs to.
        location:         Starting region.
        hermes_provider:  Hermes model provider (default: 'anthropic').
        hermes_model:     Model override (e.g. 'claude-opus-4-5').
        hermes_api_key:   API key override (defaults to env var).
        socket_dir:       Directory for the Unix socket file.
    """
    if config_data is None:
        if config_path is None:
            raise ValueError("Either config_path or config_data must be provided")
        with open(config_path) as f:
            config_data = yaml.safe_load(f)

    psyche = load_psyche(data=config_data)

    did = os.environ.get("NOUS_DID", "").strip() or f"did:noesis:{_slugify(nous_name)}"

    handler = HermesBrainHandler(
        psyche=psyche,
        grid_name=grid_name,
        location=location,
        did=did,
        hermes_provider=hermes_provider,
        hermes_model=hermes_model,
        hermes_api_key=hermes_api_key,
    )

    socket_path = os.path.join(socket_dir, f"noesis-nous-{nous_name}.sock")
    rpc = RPCServer(socket_path)

    # Register all RPC methods the Grid expects
    rpc.register("brain.onMessage", handler.on_message)
    rpc.register("brain.onTick", handler.on_tick)
    rpc.register("brain.onEvent", handler.on_event)

    async def _get_state(params: dict[str, Any]) -> dict[str, Any]:
        return handler.get_state()

    rpc.register("brain.getState", _get_state)
    rpc.register("brain.queryMemory", handler.query_memory)
    rpc.register("brain.forceTelos", handler.force_telos)

    return BrainApp(handler=handler, rpc=rpc, nous_name=nous_name)
